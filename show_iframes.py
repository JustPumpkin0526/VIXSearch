"""
MP4 비디오 파일에서 중요한 프레임을 감지하여 순차적으로 화면에 표시하는 프로그램
- I-frame (키프레임)
- 장면 변화가 큰 프레임 (Scene Change Detection)
"""

import cv2
import numpy as np
import av
import sys
import os
import argparse
import time


def calculate_histogram_diff(frame1, frame2):
    """두 프레임 간의 히스토그램 차이를 계산합니다."""
    # BGR을 HSV로 변환 (조명 변화에 더 강건)
    hsv1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2HSV)
    hsv2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2HSV)
    
    # H, S 채널의 히스토그램 계산
    hist1_h = cv2.calcHist([hsv1], [0], None, [50], [0, 180])
    hist1_s = cv2.calcHist([hsv1], [1], None, [60], [0, 256])
    hist2_h = cv2.calcHist([hsv2], [0], None, [50], [0, 180])
    hist2_s = cv2.calcHist([hsv2], [1], None, [60], [0, 256])
    
    # 정규화
    cv2.normalize(hist1_h, hist1_h, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    cv2.normalize(hist1_s, hist1_s, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    cv2.normalize(hist2_h, hist2_h, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    cv2.normalize(hist2_s, hist2_s, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    
    # 상관계수 계산 (1에 가까울수록 유사)
    corr_h = cv2.compareHist(hist1_h, hist2_h, cv2.HISTCMP_CORREL)
    corr_s = cv2.compareHist(hist1_s, hist2_s, cv2.HISTCMP_CORREL)
    
    # 차이값 반환 (0~100, 클수록 다름)
    diff = (1 - (corr_h + corr_s) / 2) * 100
    return diff


def extract_iframe_indices(video_path):
    """비디오에서 I-frame(키프레임)의 인덱스를 추출합니다."""
    start_time = time.time()
    
    container = av.open(video_path)
    video_stream = container.streams.video[0]
    
    iframe_indices = []
    frame_index = 0
    
    for packet in container.demux(video_stream):
        for frame in packet.decode():
            if frame.key_frame:
                iframe_indices.append(frame_index)
            frame_index += 1
    
    container.close()
    
    elapsed_time = time.time() - start_time
    return iframe_indices, elapsed_time


def extract_key_frames(video_path, mode='hybrid', scene_threshold=30.0, max_interval=2.0, sample_rate=10, analysis_size=240):
    """
    중요한 프레임을 추출합니다.
    
    Args:
        video_path: 비디오 파일 경로
        mode: 'iframe' (I-frame만), 'simple' (I-frame + 균등간격), 'scene' (장면변화), 'hybrid' (둘 다)
        scene_threshold: 장면 변화 감지 임계값 (0-100, 높을수록 더 큰 변화만 감지)
        max_interval: 최대 프레임 간격 (초 단위)
        sample_rate: 초당 체크할 프레임 수 (높을수록 정확하지만 느림)
        analysis_size: 분석용 해상도 높이 (낮을수록 빠름, 권장: 120-480)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return [], 0
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # I-frame 추출 (모든 모드에서 기본)
    iframe_set = set()
    iframe_time = 0
    if mode != 'scene':
        print("I-frame 추출 중...")
        iframe_indices, iframe_time = extract_iframe_indices(video_path)
        iframe_set = set(iframe_indices)
        print(f"  → {len(iframe_indices)}개의 I-frame 발견 (소요시간: {iframe_time:.2f}초)")
    
    key_frames = set(iframe_set)
    
    # Simple 모드: I-frame 사이에 균등 간격으로 프레임 추가
    if mode == 'simple':
        print("균등 간격 프레임 추가 중...")
        simple_start_time = time.time()
        
        sorted_iframes = sorted(iframe_set)
        added_frames = 0
        
        # I-frame 사이 간격마다 중간 프레임 추가
        for i in range(len(sorted_iframes) - 1):
            start_frame = sorted_iframes[i]
            end_frame = sorted_iframes[i + 1]
            gap = end_frame - start_frame
            
            # 간격이 max_interval(초) 이상이면 중간에 프레임 추가
            if max_interval > 0 and gap > int(fps * max_interval):
                # 추가할 프레임 수 계산
                num_inserts = int(gap / (fps * max_interval))
                for j in range(1, num_inserts + 1):
                    insert_pos = start_frame + int(j * gap / (num_inserts + 1))
                    if insert_pos not in key_frames:
                        key_frames.add(insert_pos)
                        added_frames += 1
        
        simple_time = time.time() - simple_start_time
        print(f"  → {added_frames}개의 프레임 추가 (소요시간: {simple_time:.2f}초)")
        
        # 처리 시간 출력
        total_time = iframe_time + simple_time
        print(f"\n전체 처리 시간: {total_time:.2f}초")
        print(f"  - I-frame 추출: {iframe_time:.2f}초 ({iframe_time/total_time*100:.1f}%)")
        print(f"  - 간격 프레임 추가: {simple_time:.2f}초 ({simple_time/total_time*100:.1f}%)")
        
        cap.release()
        return sorted(key_frames), total_frames
    
    # 장면 변화 감지
    scene_time = 0
    if mode in ['scene', 'hybrid']:
        print("장면 변화 감지 중...")
        print(f"  설정: 초당 {sample_rate}프레임 체크, 분석 해상도 높이 {analysis_size}px")
        scene_start_time = time.time()
        
        # 샘플링 간격 (처리 속도 향상)
        sample_interval = max(1, int(fps / sample_rate))
        
        ret, prev_frame = cap.read()
        if not ret:
            cap.release()
            return [], total_frames
        
        # 낮은 해상도로 리사이즈 (처리 속도 향상)
        height, width = prev_frame.shape[:2]
        scale = analysis_size / height
        new_width = int(width * scale)
        new_height = analysis_size
        prev_frame_small = cv2.resize(prev_frame, (new_width, new_height))
        
        frame_idx = 0
        scene_changes = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_idx += 1
            
            # 샘플링 간격에 따라 체크
            if frame_idx % sample_interval != 0:
                continue
            
            # 이미 I-frame으로 선택된 경우 스킵
            if frame_idx in iframe_set:
                prev_frame_small = cv2.resize(frame, (new_width, new_height))
                continue
            
            frame_small = cv2.resize(frame, (new_width, new_height))
            
            # 히스토그램 차이 계산
            diff = calculate_histogram_diff(prev_frame_small, frame_small)
            
            if diff > scene_threshold:
                key_frames.add(frame_idx)
                scene_changes += 1
                prev_frame_small = frame_small
            
            # 진행상황 표시
            if frame_idx % (total_frames // 20) == 0:
                progress = frame_idx / total_frames * 100
                elapsed = time.time() - scene_start_time
                print(f"  진행중... {progress:.1f}% (경과시간: {elapsed:.1f}초)", end='\r')
        
        scene_time = time.time() - scene_start_time
        print(f"\n  → {scene_changes}개의 장면 변화 감지 (소요시간: {scene_time:.2f}초)")
    
    cap.release()
    
    # 최대 간격 제한 (옵션)
    interval_time = 0
    if max_interval > 0 and mode == 'hybrid':
        print("최대 간격 제한 적용 중...")
        interval_start_time = time.time()
        max_frame_gap = int(fps * max_interval)
        sorted_frames = sorted(key_frames)
        
        added_frames = 0
        for i in range(len(sorted_frames) - 1):
            gap = sorted_frames[i + 1] - sorted_frames[i]
            if gap > max_frame_gap:
                # 중간에 프레임 추가
                num_inserts = gap // max_frame_gap
                for j in range(1, num_inserts + 1):
                    insert_pos = sorted_frames[i] + j * max_frame_gap
                    if insert_pos < sorted_frames[i + 1]:
                        key_frames.add(insert_pos)
                        added_frames += 1
        
        interval_time = time.time() - interval_start_time
        if added_frames > 0:
            print(f"  → {added_frames}개의 프레임 추가 (소요시간: {interval_time:.2f}초)")
    
    # 전체 처리 시간 출력
    total_time = iframe_time + scene_time + interval_time
    if total_time > 0:
        print(f"\n전체 처리 시간: {total_time:.2f}초")
        if iframe_time > 0:
            print(f"  - I-frame 추출: {iframe_time:.2f}초 ({iframe_time/total_time*100:.1f}%)")
        if scene_time > 0:
            print(f"  - 장면 변화 감지: {scene_time:.2f}초 ({scene_time/total_time*100:.1f}%)")
        if interval_time > 0:
            print(f"  - 간격 제한 적용: {interval_time:.2f}초 ({interval_time/total_time*100:.1f}%)")
    elif mode == 'iframe' and iframe_time > 0:
        print(f"\n전체 처리 시간: {iframe_time:.2f}초")
    
    return sorted(key_frames), total_frames


def show_key_frames(video_path, mode='hybrid', scene_threshold=30.0, max_interval=2.0, sample_rate=10, analysis_size=240):
    """중요한 프레임을 순차적으로 화면에 표시합니다."""
    
    if not os.path.exists(video_path):
        print(f"오류: 파일을 찾을 수 없습니다 - {video_path}")
        return
    
    print(f"\n모드: {mode}")
    print(f"장면 변화 임계값: {scene_threshold}")
    print(f"최대 간격: {max_interval}초")
    print("-" * 50)
    
    # 중요한 프레임 추출
    key_frame_indices, total_frames = extract_key_frames(
        video_path, mode, scene_threshold, max_interval, sample_rate, analysis_size
    )
    
    if not key_frame_indices:
        print("중요한 프레임을 찾을 수 없습니다.")
        return
    
    print(f"\n총 {len(key_frame_indices)}개의 중요한 프레임을 찾았습니다.")
    
    # OpenCV로 비디오 열기
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print("비디오 파일을 열 수 없습니다.")
        return
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    print(f"전체 프레임 수: {total_frames}")
    print(f"FPS: {fps:.2f}")
    print(f"선택된 프레임 비율: {len(key_frame_indices)}/{total_frames} ({len(key_frame_indices)/total_frames*100:.2f}%)")
    
    # 평균 간격 계산
    if len(key_frame_indices) > 1:
        avg_interval = sum(key_frame_indices[i+1] - key_frame_indices[i] 
                          for i in range(len(key_frame_indices)-1)) / (len(key_frame_indices)-1)
        print(f"평균 프레임 간격: {avg_interval:.1f}프레임 ({avg_interval/fps:.2f}초)")
    
    print("\n조작 방법:")
    print("  - 스페이스바 또는 'n': 다음 프레임")
    print("  - 'p': 이전 프레임")
    print("  - 'j': 10프레임 건너뛰기")
    print("  - 'k': 10프레임 뒤로")
    print("  - 'q' 또는 ESC: 종료")
    print("-" * 50)
    
    current_frame_idx = 0
    
    while True:
        # 현재 키 프레임의 실제 프레임 번호
        frame_number = key_frame_indices[current_frame_idx]
        
        # 해당 프레임으로 이동
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        
        if not ret:
            print(f"프레임 {frame_number}을 읽을 수 없습니다.")
            break
        
        # 프레임에 정보 오버레이
        display_frame = frame.copy()
        
        # 간격 계산
        if current_frame_idx > 0:
            prev_frame = key_frame_indices[current_frame_idx - 1]
            interval = frame_number - prev_frame
        else:
            interval = 0
        
        # 텍스트 배경
        overlay = display_frame.copy()
        cv2.rectangle(overlay, (10, 10), (600, 150), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, display_frame, 0.4, 0, display_frame)
        
        # 정보 텍스트
        info_text = [
            f"Key Frame: {current_frame_idx + 1}/{len(key_frame_indices)}",
            f"Frame Number: {frame_number}/{total_frames}",
            f"Time: {frame_number/fps:.2f}s / {total_frames/fps:.2f}s",
            f"Interval: {interval} frames ({interval/fps:.2f}s)"
        ]
        
        y_offset = 35
        for text in info_text:
            cv2.putText(display_frame, text, (20, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            y_offset += 30
        
        # 화면에 표시
        cv2.imshow('Key Frames Viewer', display_frame)
        
        # 키 입력 대기
        key = cv2.waitKey(0) & 0xFF
        
        if key == ord('q') or key == 27:  # 'q' 또는 ESC
            print("종료합니다.")
            break
        elif key == ord('n') or key == ord(' '):  # 'n' 또는 스페이스바
            if current_frame_idx < len(key_frame_indices) - 1:
                current_frame_idx += 1
            else:
                print("마지막 프레임입니다.")
        elif key == ord('p'):  # 'p' - 이전
            if current_frame_idx > 0:
                current_frame_idx -= 1
            else:
                print("첫 번째 프레임입니다.")
        elif key == ord('j'):  # 'j' - 10프레임 앞으로
            if current_frame_idx < len(key_frame_indices) - 10:
                current_frame_idx += 10
            else:
                current_frame_idx = len(key_frame_indices) - 1
                print("마지막 프레임입니다.")
        elif key == ord('k'):  # 'k' - 10프레임 뒤로
            if current_frame_idx >= 10:
                current_frame_idx -= 10
            else:
                current_frame_idx = 0
                print("첫 번째 프레임입니다.")
    
    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(
        description='비디오에서 중요한 프레임을 감지하여 표시합니다.'
    )
    parser.add_argument('video', help='비디오 파일 경로')
    parser.add_argument(
        '--mode', 
        choices=['iframe', 'simple', 'scene', 'hybrid'],
        default='simple',
        help='프레임 선택 모드 (기본값: simple)'
    )
    parser.add_argument(
        '--threshold',
        type=float,
        default=30.0,
        help='장면 변화 감지 임계값 0-100 (기본값: 30.0, 높을수록 큰 변화만 감지)'
    )
    parser.add_argument(
        '--max-interval',
        type=float,
        default=2.0,
        help='최대 프레임 간격(초) (기본값: 2.0, 0이면 제한 없음)'
    )
    parser.add_argument(
        '--sample-rate',
        type=int,
        default=10,
        help='장면 변화 감지시 초당 체크할 프레임 수 (기본값: 10, 낮을수록 빠름)'
    )
    parser.add_argument(
        '--analysis-size',
        type=int,
        default=240,
        help='장면 분석용 해상도 높이 (기본값: 240, 낮을수록 빠름, 권장: 120-480)'
    )
    
    args = parser.parse_args()
    
    show_key_frames(
        args.video,
        mode=args.mode,
        scene_threshold=args.threshold,
        max_interval=args.max_interval,
        sample_rate=args.sample_rate,
        analysis_size=args.analysis_size
    )


if __name__ == "__main__":
    main()
