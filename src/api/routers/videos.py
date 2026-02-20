"""동영상 관련 라우터"""
import asyncio
import logging
import os
import time
import aiofiles
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Form, BackgroundTasks
from database.connection import get_db_connection
from config.settings import VIDEOS_DIR, CONVERTED_VIDEOS_DIR
from utils.helpers import build_file_url
from utils.video_utils import convert_video_to_mp4, extract_video_metadata
from services.video_service import upload_to_via_server_background
from config.settings import UNSUPPORTED_VIDEO_FORMATS
from exceptions import NotFoundException, ValidationException, DatabaseException

logger = logging.getLogger(__name__)

router = APIRouter()

def _format_datetime(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)

# 허용된 동영상 확장자
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'}
# 허용된 이미지 확장자
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}
# 모든 허용된 파일 확장자 (동영상 + 이미지)
ALLOWED_FILE_EXTENSIONS = ALLOWED_VIDEO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS
FILE_BUFFER_SIZE = 8192  # 8KB 청크

@router.get("")
async def get_videos(user_id: str = Query(...)):
    """사용자의 동영상 목록 조회 (파일 존재 여부 확인 및 유효한 URL 반환) - 최적화 버전"""
    try:
        with get_db_connection() as local_cursor:
            local_cursor.execute(
                """SELECT ID, FILE_NAME, FILE_URL, FILE_SIZE, WIDTH, HEIGHT, DURATION, CREATED_AT, VIDEO_ID 
                   FROM vss_videos 
                   WHERE USER_ID = ? 
                   ORDER BY CREATED_AT DESC""",
                (user_id,)
            )
            rows = local_cursor.fetchall()
        
        if not rows:
            return {"success": True, "videos": []}
        
        # 병렬 처리를 위한 비동기 함수
        async def process_video_row(row):
            video_id = row[0]
            file_name = row[1]
            file_url = row[2]
            file_size = row[3]
            width = row[4]
            height = row[5]
            duration = row[6]
            created_at = row[7]
            via_video_id = row[8]
            
            # 파일 존재 여부 확인 및 유효한 URL 결정
            valid_file_url = ""
            
            # 1. 원본 파일 확인 (FILE_URL에서 파일명 추출)
            if file_url:
                # FILE_URL에서 파일명 추출
                original_filename = file_url.replace("/video-files/", "").lstrip("/")
                original_file_path = VIDEOS_DIR / original_filename
                
                # 파일 존재 확인 (asyncio.to_thread를 사용하여 비동기로 처리)
                if await asyncio.to_thread(original_file_path.exists):
                    # 원본 파일이 존재하면 원본 URL 사용
                    valid_file_url = build_file_url(file_url)
                else:
                    # 원본 파일이 없으면 변환된 MP4 확인
                    base_name = Path(original_filename).stem
                    converted_filename = f"{base_name}.mp4"
                    converted_file_path = CONVERTED_VIDEOS_DIR / converted_filename
                    
                    if await asyncio.to_thread(converted_file_path.exists):
                        # 변환된 MP4가 존재하면 변환된 URL 사용
                        converted_url = f"/converted-videos/{converted_filename}"
                        valid_file_url = build_file_url(converted_url)
                    else:
                        # 둘 다 없으면 원본 URL 사용 (나중에 404 처리)
                        valid_file_url = build_file_url(file_url)
            else:
                logger.warning(f"FILE_URL이 없음: video_id={video_id}, file_name={file_name}")
            
            return {
                "id": video_id,
                "title": file_name,
                "file_url": valid_file_url,
                "file_size": file_size,
                "width": width,
                "height": height,
                "duration": duration,
                "created_at": _format_datetime(created_at),
                "video_id": via_video_id
            }
        
        # 모든 비디오를 병렬로 처리
        videos = await asyncio.gather(*[process_video_row(row) for row in rows])
        
        return {
            "success": True,
            "videos": list(videos)
        }
    except Exception as e:
        logger.error(f"동영상 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"동영상 목록 조회 중 오류가 발생했습니다: {str(e)}")

@router.delete("/{video_id}")
async def delete_video(
    video_id: int,
    user_id: str = Query(...)
):
    """동영상 삭제"""
    try:
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                raise NotFoundException("사용자", user_id)
        
        with get_db_connection() as cursor:
            # 동영상 정보 조회
            cursor.execute(
                """SELECT FILE_PATH, FILE_URL, VIDEO_ID FROM vss_videos 
                   WHERE ID = ? AND USER_ID = ?""",
                (video_id, user_id)
            )
            row = cursor.fetchone()
            
            if not row:
                raise NotFoundException("동영상", str(video_id))
            
            file_path_str, file_url, via_video_id = row
            
            # 요약 결과 삭제 (VIDEO_ID가 있는 경우)
            if via_video_id:
                try:
                    cursor.execute(
                        """DELETE FROM vss_summaries 
                           WHERE VIDEO_ID = ? AND USER_ID = ?""",
                        (via_video_id, user_id)
                    )
                    deleted_summaries_count = cursor.rowcount
                    if deleted_summaries_count > 0:
                        logger.info(f"요약 결과 삭제 완료: VIDEO_ID={via_video_id}, 삭제된 요약 수={deleted_summaries_count}")
                except Exception as e:
                    logger.warning(f"요약 결과 삭제 실패 (무시): {e}")
            
            # DB에서 삭제
            cursor.execute(
                """DELETE FROM vss_videos WHERE ID = ? AND USER_ID = ?""",
                (video_id, user_id)
            )
            # autocommit이 활성화되어 있으므로 명시적 커밋 불필요
        
        # 파일 삭제 (DB 트랜잭션 외부에서 처리)
        if file_path_str:
            file_path = Path(file_path_str)
            if file_path.exists():
                try:
                    file_path.unlink()
                    logger.info(f"동영상 파일 삭제: {file_path}")
                except Exception as e:
                    logger.warning(f"동영상 파일 삭제 실패 (무시): {e}")
        
        # 변환된 파일도 삭제 시도
        if file_url:
            original_filename = file_url.replace("/video-files/", "").lstrip("/")
            base_name = Path(original_filename).stem
            converted_filename = f"{base_name}.mp4"
            converted_file_path = CONVERTED_VIDEOS_DIR / converted_filename
            if converted_file_path.exists():
                try:
                    converted_file_path.unlink()
                    logger.info(f"변환된 동영상 파일 삭제: {converted_file_path}")
                except Exception as e:
                    logger.warning(f"변환된 동영상 파일 삭제 실패 (무시): {e}")
        
        logger.info(f"동영상 삭제 완료: USER_ID={user_id}, VIDEO_ID={video_id}")
        
        return {
            "success": True,
            "message": "동영상이 성공적으로 삭제되었습니다."
        }
    except NotFoundException:
        raise
    except Exception as e:
        logger.error(f"동영상 삭제 실패: {e}")
        raise DatabaseException(f"동영상 삭제 중 오류가 발생했습니다: {str(e)}")

@router.post("")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """동영상 또는 이미지 파일을 서버에 업로드하고 DB에 저장"""
    file_path = None
    try:
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                raise NotFoundException("사용자", user_id)
        # 1. 파일 검증
        if not file.filename:
            raise ValidationException("파일명이 없습니다.")
        
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_FILE_EXTENSIONS:
            raise ValidationException(f"지원하지 않는 파일 형식입니다: {file_ext}")
        
        # 이미지인지 동영상인지 확인
        is_image = file_ext in ALLOWED_IMAGE_EXTENSIONS
        
        # 2. 중복 확인
        with get_db_connection() as cursor:
            cursor.execute(
                """SELECT EXISTS(SELECT 1 FROM vss_videos WHERE USER_ID = ? AND FILE_NAME = ?)""",
                (user_id, file.filename)
            )
            duplicate_exists = bool(cursor.fetchone()[0])
            
            if duplicate_exists:
                file_type = "이미지" if is_image else "동영상"
                raise ValidationException(f"이미 업로드된 {file_type}입니다: {file.filename}")
        
        # 3. 파일명 생성
        base_filename = Path(file.filename).stem
        timestamp = int(time.time() * 1000)
        unique_filename = f"{base_filename}_{timestamp}{file_ext}"
        file_path = VIDEOS_DIR / unique_filename
        file_url = f"/video-files/{unique_filename}"
        
        # 4. 파일 저장
        file_size = 0
        async with aiofiles.open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(FILE_BUFFER_SIZE)
                if not chunk:
                    break
                await buffer.write(chunk)
                file_size += len(chunk)
        
        # 5. DB 저장
        with get_db_connection() as cursor:
            cursor.execute(
                """INSERT INTO vss_videos 
                   (USER_ID, FILE_NAME, FILE_PATH, FILE_SIZE, FILE_URL, WIDTH, HEIGHT, DURATION, VIDEO_ID) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (user_id, file.filename, str(file_path), file_size, file_url, None, None, None, None)
            )
            video_id = cursor.lastrowid
        
        # 6. VIA 서버 업로드 (동기적으로 처리하여 완전한 업로드 완료 보장)
        try:
            via_video_id = await upload_to_via_server_background(str(file_path), video_id, user_id)
            if via_video_id:
                # DB에 VIDEO_ID 업데이트
                with get_db_connection() as cursor:
                    cursor.execute(
                        "UPDATE vss_videos SET VIDEO_ID = ? WHERE ID = ? AND USER_ID = ?",
                        (via_video_id, video_id, user_id)
                    )
                    # autocommit이 활성화되어 있으므로 명시적 커밋 불필요
                file_type = "이미지" if is_image else "동영상"
                logger.info(f"VIA 서버 {file_type} 업로드 완료: video_id={video_id}, via_video_id={via_video_id}")
        except Exception as e:
            logger.warning(f"VIA 서버 업로드 실패 (video_id={video_id}): {e}")
            # VIA 업로드 실패해도 계속 진행 (나중에 재시도 가능)
        
        # 7. 메타데이터 추출은 백그라운드로 실행 (이미지는 제외, 동영상만)
        if not is_image:
            background_tasks.add_task(extract_video_metadata, str(file_path), video_id, file.filename)
        
        file_type = "이미지" if is_image else "동영상"
        return {
            "success": True,
            "video_id": video_id,
            "file_url": build_file_url(file_url),
            "message": f"{file_type} 업로드가 완료되었습니다."
        }
    except (ValidationException, NotFoundException):
        # 파일이 저장되었지만 검증 실패 시 파일 삭제
        if file_path and file_path.exists():
            try:
                file_path.unlink()
            except:
                pass
        raise
    except Exception as e:
        logger.error(f"파일 업로드 실패: {e}")
        # 파일이 저장되었지만 DB 저장 실패 시 파일 삭제
        if file_path and file_path.exists():
            try:
                file_path.unlink()
            except:
                pass
        raise DatabaseException(f"파일 업로드 중 오류가 발생했습니다: {str(e)}")

@router.get("/convert-video/{video_id}")
async def convert_video(
    video_id: int,
    user_id: str = Query(...)
):
    """동영상을 MP4로 변환"""
    try:
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                raise NotFoundException("사용자", user_id)
        with get_db_connection() as cursor:
            # 동영상 정보 조회
            cursor.execute(
                """SELECT FILE_PATH, FILE_NAME, FILE_URL FROM vss_videos 
                   WHERE ID = ? AND USER_ID = ?""",
                (video_id, user_id)
            )
            row = cursor.fetchone()
            
            if not row:
                raise NotFoundException("동영상", str(video_id))
            
            file_path_str, file_name, file_url = row
        
        file_path = Path(file_path_str)
        
        if not file_path.exists():
            raise NotFoundException("동영상 파일", file_path_str)
        
        # 파일 확장자 확인
        file_ext = file_path.suffix.lower()
        if file_ext not in UNSUPPORTED_VIDEO_FORMATS:
            # 이미 지원하는 형식이면 원본 URL 반환
            return {
                "success": True,
                "converted_url": build_file_url(file_url),
                "message": "이미 지원하는 형식입니다."
            }
        
        # 변환된 파일 경로 생성
        base_name = file_path.stem
        converted_filename = f"{base_name}_converted.mp4"
        converted_file_path = CONVERTED_VIDEOS_DIR / converted_filename
        converted_url = f"/converted-videos/{converted_filename}"
        
        # 이미 변환된 파일이 있으면 반환
        if converted_file_path.exists():
            logger.info(f"변환된 파일이 이미 존재함: {converted_file_path}")
            return {
                "success": True,
                "converted_url": build_file_url(converted_url),
                "message": "변환된 동영상이 준비되었습니다."
            }
        
        # 동영상 변환 실행
        logger.info(f"동영상 변환 시작: {file_path} -> {converted_file_path}")
        success = convert_video_to_mp4(str(file_path), str(converted_file_path))
        
        if not success:
            raise DatabaseException("동영상 변환에 실패했습니다.")
        
        return {
            "success": True,
            "converted_url": build_file_url(converted_url),
            "message": "동영상이 MP4로 변환되었습니다."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"동영상 변환 실패: {e}")
        raise HTTPException(status_code=500, detail=f"동영상 변환 중 오류가 발생했습니다: {str(e)}")
