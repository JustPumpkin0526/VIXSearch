"""동영상 관련 유틸리티 함수"""
import re
import logging
import subprocess
import threading

logger = logging.getLogger(__name__)
_VIDEOFILECLIP_IMPORT_FAILED = False

def get_VideoFileClip():
    """Return the VideoFileClip class from installed moviepy version.

    Tries multiple import paths to support moviepy 2.x and older releases.
    Raises ImportError if none available.
    """
    try:
        # moviepy 2.x
        from moviepy import VideoFileClip as VFC
        return VFC
    except Exception:
        try:
            # older moviepy
            from moviepy.editor import VideoFileClip as VFC
            return VFC
        except Exception:
            try:
                # fallback internal path
                from moviepy.video.io.VideoFileClip import VideoFileClip as VFC
                return VFC
            except Exception as e:
                raise ImportError("moviepy VideoFileClip import failed: " + str(e))
from database.repositories.vss_videos_repo import VideoRepository

# 동시 메타데이터 추출 작업 제한 (최대 1개만 동시 실행)
_metadata_extraction_semaphore = threading.Semaphore(1)
_metadata_extraction_queue = []


async def parse_timestamps(timestamp_text, video_duration):
    """
    타임스탬프 텍스트에서 시간 구간을 파싱하여 각 타임스탬프와 해당하는 문장을 짝지어 반환합니다.
    
    정규표현식 방식을 사용하여 파싱합니다.
    
    지원 형식:
    - 초 단위: 10.5, 120.3
    - 분:초 형식: 1:30, 2:45
    - 범위: 10.5-15.3, 1:30-2:45, 10.5~15.3
    - 여러 타임스탬프: "10.5, 20.3, 30.1" 또는 "1:30, 2:45"
    - 타임스탬프와 문장: "00:05:00, 00:06:00 A person is seen holding a knife."
    
    타임스탬프는 짝으로 처리되며, 첫 번째 타임스탬프가 시작 시간, 두 번째 타임스탬프가 끝 시간이 됩니다.
    타임스탬프가 명시적으로 주어진 경우 실제 범위를 그대로 사용합니다.
    
    Args:
        timestamp_text (str): 타임스탬프가 포함된 텍스트
        video_duration (float): 동영상 전체 길이 (초)
    
    Returns:
        list: [(start_time, end_time, sentence), ...] 리스트
            - 각 튜플은 (시작시간, 끝시간, 해당 구간의 장면 설명) 형식
    """
    # 정규표현식 방식 사용
    parsed = parse_timestamps_regex(timestamp_text, video_duration)
    
    # 후처리 최적화: 타임스탬프가 1개 이하이거나 이미 non-overlapping이면 병합 생략
    if len(parsed) <= 1:
        return parsed
    
    # 겹치거나(Overlap) 이어지는(Contiguous) 타임스탬프 구간 병합
    # - Search 메뉴의 Query 결과(예: 60.02-66.01, 63.03-66.01 ...)에서 중복 클립/결과를 방지
    # - 5초 마진을 두고 5초 이내의 결과가 있으면 합침
    return await merge_timestamp_ranges(parsed, gap_tolerance_seconds=5.0)


async def merge_timestamp_ranges(timestamps, gap_tolerance_seconds: float = 5.0):
    """
    (start, end, sentence) 구간 리스트를 정렬 후 병합합니다.

    병합 조건:
    - 다음 구간의 시작이 이전 구간의 끝보다 작거나 같으면(겹침) 병합
    - 또는 gap_tolerance_seconds 이내로 이어지면(거의 인접) 병합
    - 기본값은 5초 마진을 사용하여 5초 이내의 결과를 합침

    sentence 병합:
    - 병합된 구간에 포함되는 문장들을 LLM을 사용하여 한 문장으로 요약합니다.
    """
    if not timestamps:
        return []

    # 입력 유효성/정규화
    normalized = []
    for item in timestamps:
        if not item or len(item) < 2:
            continue
        start = float(item[0])
        end = float(item[1])
        sentence = ""
        if len(item) >= 3 and item[2] is not None:
            sentence = str(item[2]).strip()
        if end <= start:
            continue
        normalized.append((start, end, sentence))

    if not normalized:
        return []

    normalized.sort(key=lambda x: (x[0], x[1]))
    
    # 디버깅: 정규화된 타임스탬프 로그
    logger.debug(f"정규화된 타임스탬프: {normalized}")

    # helpers에서 summarize_sentences 함수 import
    from utils.helpers import summarize_sentences

    merged = []
    cur_start, cur_end, cur_sent = normalized[0]
    cur_sentences = []
    if cur_sent:
        cur_sentences.append(cur_sent)

    def _add_sentence(sent_list, s):
        s = (s or "").strip()
        if not s:
            return
        # 완전 동일 문장만 중복 제거 (원문 유지)
        if s not in sent_list:
            sent_list.append(s)

    for start, end, sentence in normalized[1:]:
        # 겹침 확인: 다음 구간의 시작이 현재 구간의 끝보다 작거나 같으면 겹침
        is_overlapping = start <= cur_end
        
        # 인접 확인: 다음 구간의 시작이 현재 구간의 끝보다 크고, gap_tolerance_seconds 이내에 있으면 인접
        is_contiguous = start > cur_end and start <= (cur_end + gap_tolerance_seconds)
        
        logger.debug(f"병합 확인: 현재 구간 [{cur_start:.2f}-{cur_end:.2f}], 다음 구간 [{start:.2f}-{end:.2f}], 겹침={is_overlapping}, 인접={is_contiguous}")
        
        if is_overlapping or is_contiguous:
            # 겹치는 경우: 끝 시간을 더 큰 값으로 설정
            # 인접한 경우: 두 구간을 연결
            cur_end = max(cur_end, end)
            _add_sentence(cur_sentences, sentence)
        else:
            # 후처리 최적화: 문장이 2개 이하이거나 완전히 동일하면 요약 생략
            if len(cur_sentences) > 2:
                # 3개 이상일 때만 요약 수행
                merged_sentence = await summarize_sentences(cur_sentences)
            elif len(cur_sentences) == 2:
                # 2개일 때는 완전히 동일한지 확인
                if cur_sentences[0] == cur_sentences[1]:
                    merged_sentence = cur_sentences[0]
                else:
                    # 다르면 첫 번째 문장 사용 (요약 생략)
                    merged_sentence = cur_sentences[0]
            else:
                merged_sentence = cur_sentences[0] if cur_sentences else ""
            merged.append((cur_start, cur_end, merged_sentence))
            cur_start, cur_end = start, end
            cur_sentences = []
            _add_sentence(cur_sentences, sentence)

    # 마지막 구간 처리 (동일한 최적화 적용)
    if len(cur_sentences) > 2:
        merged_sentence = await summarize_sentences(cur_sentences)
    elif len(cur_sentences) == 2:
        if cur_sentences[0] == cur_sentences[1]:
            merged_sentence = cur_sentences[0]
        else:
            merged_sentence = cur_sentences[0]
    else:
        merged_sentence = cur_sentences[0] if cur_sentences else ""
    merged.append((cur_start, cur_end, merged_sentence))

    logger.info(
        f"타임스탬프 병합: {len(timestamps)}개 -> {len(merged)}개 (tolerance={gap_tolerance_seconds}s)"
    )
    return merged

def parse_timestamps_regex(timestamp_text, video_duration):
    """
    정규표현식을 사용하여 타임스탬프와 텍스트를 파싱합니다.
    00:00-00:00=장면 설명 형태를 지원합니다.
    
    Args:
        timestamp_text (str): 타임스탬프가 포함된 텍스트
        video_duration (float): 동영상 전체 길이 (초)
    
    Returns:
        list: [(start_time, end_time, sentence), ...] 리스트
            - 각 튜플은 (시작시간, 끝시간, 장면 설명) 형식
    """
    if not timestamp_text or not isinstance(timestamp_text, str):
        return []
    
    timestamps = []
    original_text = timestamp_text
    
    # 분:초 형식을 초로 변환하는 함수
    def parse_time_to_seconds(time_str):
        time_str = time_str.strip()
        if not time_str:
            return None
        
        # 's' 접미사 제거 (예: "300.03s" -> "300.03")
        time_str = re.sub(r's\s*$', '', time_str, flags=re.IGNORECASE).strip()
        
        # 숫자로만 구성된 타임스탬프인지 확인 (소수점, 음수 부호 허용)
        # 패턴: 선택적 음수 부호 + 하나 이상의 숫자 + 선택적 소수점과 숫자
        # SS.000 같은 잘못된 형식은 제외
        numeric_pattern = r'^-?\d+(?:\.\d+)?$'
        if not re.match(numeric_pattern, time_str):
            return None
        
        # 분:초 형식인지 확인 (MM:SS)
        if ':' in time_str:
            parts = time_str.split(':')
            if len(parts) == 2:
                try:
                    # 각 부분이 숫자 형식인지 확인
                    if not (re.match(r'^-?\d+(?:\.\d+)?$', parts[0].strip()) and 
                            re.match(r'^-?\d+(?:\.\d+)?$', parts[1].strip())):
                        return None
                    minutes = float(parts[0])
                    seconds = float(parts[1])
                    # 음수 시간은 허용하지 않음
                    if minutes < 0 or seconds < 0:
                        return None
                    return minutes * 60 + seconds
                except ValueError:
                    return None
        
        # 초 단위 형식
        try:
            result = float(time_str)
            # 음수 시간은 허용하지 않음
            if result < 0:
                return None
            return result
        except ValueError:
            return None
    
    # 00:00-00:00=장면 설명 형태를 먼저 파싱
    # 각 줄을 개별적으로 처리
    lines = timestamp_text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 엄격한 패턴만 허용: START-END=Description (줄 시작부터, 숫자-숫자=형식만)
        # 예: "0.00-20.00=Description" (허용)
        # 예: "300.03s - 303.07s = Description" (허용, 's' 접미사 제거 후 파싱)
        # 예: "109.57s에 등장..." (거부)
        # 예: "60.01s - 60.01s : ..." (거부)
        equals_pattern = r'^(\d+(?:\.\d+)?)s?\s*-\s*(\d+(?:\.\d+)?)s?\s*=\s*(.+)$'
        equals_match = re.match(equals_pattern, line)
        
        if equals_match:
            # = 기호로 구분된 형태
            start_str = equals_match.group(1)
            end_str = equals_match.group(2)
            sentence = equals_match.group(3).strip()
            
            start_time = parse_time_to_seconds(start_str)
            end_time = parse_time_to_seconds(end_str)
            
            if start_time is not None and end_time is not None:
                # 시작 시간이 끝 시간보다 크면 스왑 (잘못된 형식 처리)
                if start_time > end_time:
                    start_time, end_time = end_time, start_time
                start_time = max(0, min(start_time, video_duration))
                end_time = max(start_time, min(end_time, video_duration))
                # 유효한 타임스탬프만 추가 (시작 < 끝)
                if start_time < end_time:
                    timestamps.append((start_time, end_time, sentence))
            continue
        
        # 기존 패턴도 지원 (00:00-00:00 : 장면 설명 또는 00:00-00:00 장면 설명)
        # 콜론 앞에 공백이 있을 수도 있고 없을 수도 있음 (예: "10.00-12.00 : 설명" 또는 "10.00-12.00:설명")
        colon_pattern = r'^(\d+(?:\.\d+)?)s?\s*-\s*(\d+(?:\.\d+)?)s?\s*[:]\s*(.+)$'
        colon_match = re.match(colon_pattern, line)
        
        if colon_match:
            start_str = colon_match.group(1)
            end_str = colon_match.group(2)
            sentence = colon_match.group(3).strip()
            
            start_time = parse_time_to_seconds(start_str)
            end_time = parse_time_to_seconds(end_str)
            
            if start_time is not None and end_time is not None:
                # 시작 시간이 끝 시간보다 크면 스왑 (잘못된 형식 처리)
                if start_time > end_time:
                    start_time, end_time = end_time, start_time
                start_time = max(0, min(start_time, video_duration))
                end_time = max(start_time, min(end_time, video_duration))
                # 유효한 타임스탬프만 추가 (시작 < 끝)
                if start_time < end_time:
                    timestamps.append((start_time, end_time, sentence))
            continue
        
        # 범위 패턴만 있는 경우 (장면 설명 없음)
        range_pattern = r'(\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)\s*[-~]\s*(\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)'
        range_match = re.search(range_pattern, line)
        
        if range_match:
            start_str = range_match.group(1)
            end_str = range_match.group(2)
            
            start_time = parse_time_to_seconds(start_str)
            end_time = parse_time_to_seconds(end_str)
            
            if start_time is not None and end_time is not None:
                start_time = max(0, min(start_time, video_duration))
                end_time = max(start_time, min(end_time, video_duration))
                # 장면 설명 추출 시도 (타임스탬프 다음의 텍스트)
                sentence = line[range_match.end():].strip()
                sentence = re.sub(r'^[:\-~=,.\s]+', '', sentence)  # 앞의 구분자 제거
                sentence = sentence.strip()
                timestamps.append((start_time, end_time, sentence if sentence else ""))
    
    # 파싱된 결과가 있으면 반환
    if timestamps:
        logger.info(f"파싱된 타임스탬프 (정규표현식): {len(timestamps)}개")
        return timestamps
    
    # 기존 방식으로 폴백 (하위 호환성)
    # 범위 패턴 찾기 (예: 10.5-15.3, 1:30-2:45)
    range_pattern = r'(\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)\s*[-~]\s*(\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)'
    range_timestamps = []
    for match in re.finditer(range_pattern, timestamp_text):
        start_str = match.group(1)
        end_str = match.group(2)
        start_time = parse_time_to_seconds(start_str)
        end_time = parse_time_to_seconds(end_str)
        if start_time is not None and end_time is not None:
            start_time = max(0, min(start_time, video_duration))
            end_time = max(start_time, min(end_time, video_duration))
            range_timestamps.append((start_time, end_time))
    
    # 단일 타임스탬프 찾기
    processed_text = re.sub(range_pattern, '', timestamp_text)
    number_pattern = r'\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?'
    single_timestamps = []
    for match in re.finditer(number_pattern, processed_text):
        time_str = match.group(0)
        time_seconds = parse_time_to_seconds(time_str)
        if time_seconds is not None:
            time_seconds = max(0, min(time_seconds, video_duration))
            single_timestamps.append(time_seconds)
    
    timestamps_pairs = list(range_timestamps)
    for i in range(0, len(single_timestamps) - 1, 2):
        start_time = single_timestamps[i]
        end_time = single_timestamps[i + 1]
        timestamps_pairs.append((start_time, end_time))
    
    # 중복 제거 및 정렬
    timestamps_pairs = sorted(set(timestamps_pairs), key=lambda x: x[0])
    
    # 겹치는 구간 병합
    merged = []
    for start, end in timestamps_pairs:
        if merged and start - merged[-1][1] < 5:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    
    # 타임스탬프를 제거한 나머지 텍스트 추출
    sentence_text = original_text
    sentence_text = re.sub(range_pattern, '', sentence_text)
    sentence_text = re.sub(number_pattern, '', sentence_text)
    sentence_text = re.sub(r'[,:]\s*', ' ', sentence_text)
    sentence_text = re.sub(r'\s+', ' ', sentence_text)
    sentence_text = sentence_text.strip()
    
    result = [(start, end, sentence_text) for start, end in merged]
    logger.info(f"파싱된 타임스탬프 (정규표현식, 폴백): {len(result)}개, 문장: {sentence_text}")
    return result

def convert_video_to_mp4(input_path: str, output_path: str):
    """동영상을 MP4 형식으로 변환"""
    try:
        cmd = [
            "ffmpeg", "-y", "-i", str(input_path),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            "-threads", "2",
            str(output_path)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logger.info(f"동영상 변환 완료: {input_path} -> {output_path}")
        return True
    except Exception as e:
        logger.error(f"동영상 변환 실패: {e}")
        return False

def extract_video_metadata(file_path: str, video_id: int, filename: str):
    """동영상 메타데이터를 추출하여 DB에 업데이트 (동시 실행 제한)"""
    # 큐에 추가 (모듈 레벨 리스트에 대한 append/pop이므로 global 불필요)
    _metadata_extraction_queue.append((file_path, video_id, filename))
    logger.info(f"메타데이터 추출 대기열에 추가: {filename} (ID: {video_id}), 대기 중인 작업: {len(_metadata_extraction_queue)}")
    
    # 세마포 획득 (최대 1개만 동시 실행)
    acquired = _metadata_extraction_semaphore.acquire(blocking=False)
    if not acquired:
        logger.info(f"메타데이터 추출 작업 대기 중: {filename} (ID: {video_id})")
        _metadata_extraction_semaphore.acquire()  # 대기
    
    try:
        # 큐에서 제거
        if _metadata_extraction_queue and _metadata_extraction_queue[0][1] == video_id:
            _metadata_extraction_queue.pop(0)
        
        logger.info(f"메타데이터 추출 시작: {filename} (ID: {video_id})")
        
        try:
            VFC = get_VideoFileClip()
        except ImportError as ie:
            logger.warning(f"Video metadata extraction skipped: {ie}")
            return

        video = VFC(str(file_path))
        try:
            # moviepy API differences: prefer .size then .w/.h
            if hasattr(video, 'size') and video.size:
                width, height = int(video.size[0]), int(video.size[1])
            else:
                width = int(video.w) if getattr(video, 'w', None) else None
                height = int(video.h) if getattr(video, 'h', None) else None
            duration = float(video.duration) if getattr(video, 'duration', None) else None
        finally:
            try:
                video.close()
            except Exception:
                pass
        video.close()
        
        # 메타데이터 업데이트 (ORM 세션 사용)
        try:
            ok = VideoRepository.update_metadata(video_id, width, height, duration)
            if ok:
                logger.info(f"동영상 메타데이터 업데이트 완료: {filename} (ID: {video_id}), 해상도: {width}x{height}, 길이: {duration:.1f}s")
            else:
                logger.warning(f"동영상 메타데이터 업데이트 실패: {filename} (ID: {video_id})")
        except Exception as e:
            logger.warning(f"동영상 메타데이터 업데이트 실패: {e}")
    except Exception as e:
        logger.warning(f"동영상 메타데이터 추출 실패: {e}")
    finally:
        _metadata_extraction_semaphore.release()
        logger.info(f"메타데이터 추출 완료, 대기 중인 작업: {len(_metadata_extraction_queue)}")

