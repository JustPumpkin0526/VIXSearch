"""동영상 관련 유틸리티 함수"""
import os
import re
import json
import time
import shutil
import logging
import asyncio
import aiohttp
import threading
import subprocess
from pathlib import Path
from moviepy.video.io.VideoFileClip import VideoFileClip
from database.connection import conn, cursor, ensure_db_connection
from config.settings import (
    VIA_SERVER_URL, CLIP_CLEANUP_AGE, CONVERTED_VIDEOS_DIR, UNSUPPORTED_VIDEO_FORMATS,
    OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT
)

logger = logging.getLogger(__name__)

# 동시 메타데이터 추출 작업 제한 (최대 1개만 동시 실행)
_metadata_extraction_semaphore = threading.Semaphore(1)
_metadata_extraction_queue = []

async def parse_timestamps_with_llm(timestamp_text, video_duration):
    """
    LLM을 사용하여 타임스탬프와 텍스트를 자연스럽게 분리하고, 각 타임스탬프에 해당하는 문장을 짝지어 반환합니다.
    
    Args:
        timestamp_text (str): 타임스탬프가 포함된 텍스트
        video_duration (float): 동영상 전체 길이 (초)
    
    Returns:
        list: [(start_time, end_time, sentence), ...] 리스트 또는 None (실패 시)
            - 각 튜플은 (시작시간, 끝시간, 해당 구간의 장면 설명) 형식
    """
    if not timestamp_text or not isinstance(timestamp_text, str):
        return None
    
    try:
        # Ollama API 호출을 위한 프롬프트 구성
        ollama_prompt = f"""다음 텍스트에서 각 타임스탬프와 해당하는 장면 설명 문장을 짝지어서 분리해주세요.

입력 텍스트: "{timestamp_text}"

다음 JSON 형식으로만 응답해주세요:
{{
  "timestamps": [
    {{"start": 시작시간(초), "end": 끝시간(초), "sentence": "해당 타임스탬프 구간의 장면 설명"}},
    ...
  ]
}}

타임스탬프 형식:
- 초 단위: 10.5, 120.3
- 분:초 형식: 1:30, 2:45 (초로 변환)
- 범위: 10.5-15.3 또는 1:30-2:45 (시작-끝으로 분리)

중요:
1. JSON 형식으로만 응답하세요. 다른 설명이나 텍스트는 포함하지 마세요.
2. 타임스탬프는 초 단위 숫자로 변환하세요 (예: 1:30 → 90).
3. 각 타임스탬프마다 해당 구간의 장면 설명을 "sentence" 필드에 포함하세요.
4. 타임스탬프가 여러 개 있으면 모두 배열에 포함하세요. 각각에 해당하는 장면 설명을 짝지어주세요.
5. 타임스탬프가 없으면 timestamps는 빈 배열 []로 설정하세요.
6. 각 타임스탬프 구간에 해당하는 문장만 해당 타임스탬프의 sentence에 포함하세요.
"""
        
        # Ollama API 호출 (aiohttp 사용)
        session = aiohttp.ClientSession()
        ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": """You are a timestamp parser. Your task is to extract timestamps and pair each timestamp with its corresponding scene description.

CRITICAL RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code blocks.
2. Timestamps must be converted to seconds (e.g., 1:30 → 90.0).
3. Extract all timestamps as start-end pairs. Each timestamp must have a "sentence" field with the scene description for that specific time range.
4. Pair each timestamp with its corresponding scene description text.
5. If no timestamps found, return empty array for timestamps.
6. Each timestamp object must have: "start", "end", and "sentence" fields."""
                },
                {
                    "role": "user",
                    "content": ollama_prompt
                }
            ],
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 4000  # 여러 타임스탬프와 문장을 생성하기 위해 충분한 토큰 수 제공
            }
        }
        
        async with session.post(
            ollama_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=OLLAMA_TIMEOUT)
        ) as ollama_response:
            if ollama_response.status == 200:
                ollama_data = await ollama_response.json()
                generated_text = ollama_data.get("message", {}).get("content", "")
                
                if generated_text:
                    # JSON 파싱 시도
                    # 마크다운 코드 블록 제거 (있는 경우)
                    generated_text = generated_text.strip()
                    if generated_text.startswith("```"):
                        # 코드 블록 제거
                        lines = generated_text.split("\n")
                        generated_text = "\n".join(lines[1:-1]) if len(lines) > 2 else generated_text
                    generated_text = generated_text.strip()
                    if generated_text.startswith("```json"):
                        generated_text = generated_text[7:].strip()
                    if generated_text.endswith("```"):
                        generated_text = generated_text[:-3].strip()
                    
                    # JSON 부분만 추출 (정규표현식 사용)
                    import re
                    # JSON 객체 패턴 찾기 (첫 번째 {부터 시작)
                    json_match = re.search(r'\{[\s\S]*', generated_text)
                    if json_match:
                        generated_text = json_match.group(0)
                    
                    # 불완전한 JSON 수정 시도
                    # sentence 필드의 값이 따옴표로 닫히지 않은 경우 처리
                    if '"sentence"' in generated_text:
                        # "sentence": "로 시작하는 부분 찾기
                        sentence_start = generated_text.find('"sentence"')
                        if sentence_start != -1:
                            # 콜론 다음의 따옴표 위치 찾기
                            colon_pos = generated_text.find(':', sentence_start)
                            if colon_pos != -1:
                                # 콜론 다음의 첫 번째 따옴표 (값 시작)
                                value_start_quote = generated_text.find('"', colon_pos)
                                if value_start_quote != -1:
                                    # 값 시작 따옴표 다음부터 끝까지 확인
                                    value_text = generated_text[value_start_quote + 1:]
                                    # 닫는 따옴표가 없는 경우 (값이 끝나지 않음)
                                    # 마지막 문자가 따옴표가 아니면 추가
                                    if not generated_text.rstrip().endswith('"'):
                                        generated_text = generated_text.rstrip() + '"'
                    
                    # 닫는 괄호 추가 (올바른 순서로)
                    open_braces = generated_text.count('{')
                    close_braces = generated_text.count('}')
                    open_brackets = generated_text.count('[')
                    close_brackets = generated_text.count(']')
                    
                    # 배열이 먼저 닫혀야 함 (timestamps 배열)
                    if open_brackets > close_brackets:
                        generated_text += ']' * (open_brackets - close_brackets)
                    # 객체 닫기
                    if open_braces > close_braces:
                        generated_text += '}' * (open_braces - close_braces)
                    
                    try:
                        result = json.loads(generated_text)
                        timestamp_data = []
                        for ts in result.get("timestamps", []):
                            start = float(ts.get("start", 0))
                            end = float(ts.get("end", 0))
                            sentence = ts.get("sentence", "").strip()
                            
                            # 비디오 길이 범위 내로 제한
                            start = max(0, min(start, video_duration))
                            end = max(start, min(end, video_duration))
                            if end > start:
                                timestamp_data.append((start, end, sentence))
                        
                        logger.info(f"LLM으로 파싱된 타임스탬프 (각각에 sentence 포함): {len(timestamp_data)}개")
                        await session.close()
                        return timestamp_data
                    except json.JSONDecodeError as e:
                        logger.warning(f"LLM 응답 JSON 파싱 실패: {e}, 불완전한 JSON에서 완성된 타임스탬프만 추출 시도")
                        # 불완전한 JSON에서도 완성된 타임스탬프 객체만 추출 시도
                        try:
                            # timestamps 배열 내의 완성된 객체만 찾기
                            # 패턴: {"start": 숫자, "end": 숫자, "sentence": "문장"}
                            # sentence는 이스케이프된 따옴표를 포함할 수 있으므로 더 복잡한 패턴 사용
                            import re
                            # 각 타임스탬프 객체를 개별적으로 찾기 (더 견고한 방법)
                            # "timestamps": [로 시작하는 부분 찾기
                            timestamps_start = generated_text.find('"timestamps"')
                            if timestamps_start != -1:
                                # 배열 시작 부분 찾기
                                array_start = generated_text.find('[', timestamps_start)
                                if array_start != -1:
                                    # 배열 내의 각 객체 찾기
                                    # {"start": 숫자, "end": 숫자, "sentence": "..."} 패턴
                                    # sentence는 따옴표로 시작하고 끝나야 함
                                    object_pattern = r'\{\s*"start"\s*:\s*(\d+\.?\d*)\s*,\s*"end"\s*:\s*(\d+\.?\d*)\s*,\s*"sentence"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}'
                                    matches = re.findall(object_pattern, generated_text[array_start:])
                                    
                                    timestamp_data = []
                                    for match in matches:
                                        try:
                                            start = float(match[0])
                                            end = float(match[1])
                                            sentence = match[2].strip()
                                            # 이스케이프된 문자 처리
                                            sentence = sentence.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
                                            
                                            # 비디오 길이 범위 내로 제한
                                            start = max(0, min(start, video_duration))
                                            end = max(start, min(end, video_duration))
                                            if end > start:
                                                timestamp_data.append((start, end, sentence))
                                        except (ValueError, IndexError) as ve:
                                            logger.debug(f"타임스탬프 객체 파싱 실패: {ve}, match: {match}")
                                            continue
                                    
                                    if timestamp_data:
                                        logger.info(f"불완전한 JSON에서 완성된 타임스탬프 {len(timestamp_data)}개 추출 성공")
                                        await session.close()
                                        return timestamp_data
                            
                            logger.warning(f"완성된 타임스탬프를 찾을 수 없습니다. 응답: {generated_text[:300]}")
                        except Exception as parse_error:
                            logger.warning(f"불완전한 JSON에서 타임스탬프 추출 실패: {parse_error}, 응답: {generated_text[:300]}")
                else:
                    logger.warning("LLM 응답에 content가 없습니다.")
            else:
                error_text = await ollama_response.text()
                logger.warning(f"Ollama API 호출 실패 (HTTP {ollama_response.status}): {error_text}")
    except aiohttp.ClientConnectorError as e:
        logger.warning(f"Ollama 서버에 연결할 수 없습니다: {e}")
    except Exception as e:
        logger.warning(f"LLM을 사용한 타임스탬프 파싱 중 오류 발생: {e}")
    finally:
        if 'session' in locals() and not session.closed:
            await session.close()
    
    return None

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
        # 예: "109.57s에 등장..." (거부)
        # 예: "60.01s - 60.01s : ..." (거부)
        equals_pattern = r'^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*=\s*(.+)$'
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
        colon_pattern = r'(\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)\s*[-~]\s*(\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)\s*[:]\s*(.+)'
        colon_match = re.search(colon_pattern, line)
        
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
    global _metadata_extraction_queue
    
    # 큐에 추가
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
        
        video = VideoFileClip(str(file_path))
        width = int(video.w) if video.w else None
        height = int(video.h) if video.h else None
        duration = float(video.duration) if video.duration else None
        video.close()
        
        # 메타데이터 업데이트
        ensure_db_connection()
        cursor.execute(
            """UPDATE vss_videos 
               SET WIDTH = ?, HEIGHT = ?, DURATION = ? 
               WHERE ID = ?""",
            (width, height, duration, video_id)
        )
        conn.commit()
        logger.info(f"동영상 메타데이터 업데이트 완료: {filename} (ID: {video_id}), 해상도: {width}x{height}, 길이: {duration:.1f}s")
    except Exception as e:
        logger.warning(f"동영상 메타데이터 추출 실패: {e}")
    finally:
        _metadata_extraction_semaphore.release()
        logger.info(f"메타데이터 추출 완료, 대기 중인 작업: {len(_metadata_extraction_queue)}")

