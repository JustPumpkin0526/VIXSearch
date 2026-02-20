"""요약 관련 라우터"""
import logging
import os
import shutil
import tempfile
from typing import Optional, List
import json
from fastapi import APIRouter, HTTPException, Form, UploadFile, Query
from services.video_service import _save_summary_to_db
from pydantic import BaseModel

from utils.helpers import (
    ensure_vss_client,
    get_via_model,
    build_summarize_params,
    check_video_type
)
from database.connection import get_db_connection
from exceptions import NotFoundException, DatabaseException, ValidationException

logger = logging.getLogger(__name__)

router = APIRouter()

class DeleteSummaryRequest(BaseModel):
    # vss_videos 테이블의 ID 목록 (내부 DB ID)
    video_ids: List[int]
    user_id: str


def _format_datetime(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


# ==================== 엔드포인트 ====================
@router.post("/vss-summarize")
async def vss_summarize(
    file: UploadFile = Form(None),
    prompt: str = Form(...),
    csprompt: str = Form(...),
    saprompt: str = Form(...),
    chunk_duration: int = Form(...),
    num_frames_per_chunk: int = Form(...),
    frame_width: int = Form(...),
    frame_height: int = Form(...),
    top_k: int = Form(...),
    top_p: float = Form(...),
    temperature: float = Form(...),
    max_tokens: int = Form(...),
    seed: int = Form(...),
    batch_size: int = Form(...),
    rag_batch_size: int = Form(...),
    rag_top_k: int = Form(...),
    summary_top_p: float = Form(...),
    summary_temperature: float = Form(...),
    summary_max_tokens: int = Form(...),
    chat_top_p: float = Form(...),
    chat_temperature: float = Form(...),
    chat_max_tokens: int = Form(...),
    alert_top_p: float = Form(...),
    alert_temperature: float = Form(...),
    alert_max_tokens: int = Form(...),
    enable_audio: bool = Form(...),
    video_id: Optional[str] = Form(None),  # VIA 서버의 video_id (이미 업로드된 경우)
    user_id: str = Form(...),  # 사용자 ID (DB 저장용)
):
    """동영상/이미지 요약 VSS API"""
    await ensure_vss_client()
    model = await get_via_model()

    # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
    logger.info(
        "[CA-RAG DEBUG] ====== /vss-summarize 엔드포인트 호출 ======"
    )
    # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
    
    # video_id가 제공되지 않은 경우 파일 업로드
    if not video_id and file:
        # 파일 타입 확인 (이미지 모드 여부)
        image_mode = await check_video_type(file)
        
        logger.info(
            "[CA-RAG DEBUG] 파일 업로드 모드: image_mode=%s, filename=%s",
            image_mode,
            file.filename
        )
        
        from utils.helpers import vss_client
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # 모든 파일은 upload_video를 통해 업로드 (이미지/동영상 자동 감지)
            video_id = await vss_client.upload_video(tmp_file_path)
            file_type = "이미지" if image_mode else "비디오"
            logger.info(f"{file_type} 업로드 완료: video_id={video_id}")
            
            logger.info(
                "[CA-RAG DEBUG] 파일 업로드 완료: file_type=%s, video_id=%s",
                file_type,
                video_id
            )
        finally:
            # 임시 파일 삭제
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    elif not video_id:
        raise HTTPException(status_code=400, detail="video_id 또는 file 중 하나는 필요합니다.")
    else:
        # video_id만 제공된 경우 (이미 업로드된 파일)
        image_mode = False  # 기본값, 실제로는 video_id로 확인 불가능하지만 동영상으로 가정
        
        logger.info(
            "[CA-RAG DEBUG] video_id만 제공됨: video_id=%s, image_mode=%s (기본값: False)",
            video_id,
            image_mode
        )

    try:
        # summarize_video 파라미터 준비 (Form으로 받은 모든 값 전달)
        summarize_params = build_summarize_params(
            image_mode=image_mode,
            video_id=video_id,
            chunk_duration=chunk_duration,
            model=model,
            prompt=prompt,
            cs_prompt=csprompt,
            sa_prompt=saprompt,
            num_frames_per_chunk=num_frames_per_chunk,
            frame_width=frame_width,
            frame_height=frame_height,
            top_k=top_k,
            top_p=top_p,
            temperature=temperature,
            max_new_tokens=max_tokens,
            seed=seed,
            batch_size=batch_size,
            rag_batch_size=rag_batch_size,
            rag_top_k=rag_top_k,
            summarize_top_p=summary_top_p,
            summarize_temperature=summary_temperature,
            summarize_max_tokens=summary_max_tokens,
            chat_top_p=chat_top_p,
            chat_temperature=chat_temperature,
            chat_max_tokens=chat_max_tokens,
            notification_top_p=alert_top_p,
            notification_temperature=alert_temperature,
            notification_max_tokens=alert_max_tokens,
            enable_audio=enable_audio
        )
        from utils.helpers import vss_client
        
        logger.info(
            "[CA-RAG DEBUG] summarize_video 호출 전: image_mode=%s, video_id=%s",
            image_mode,
            video_id if not isinstance(video_id, list) else f"[{len(video_id)} files]"
        )
        
        result = await vss_client.summarize_video(*summarize_params)
        
        logger.info(
            "[CA-RAG DEBUG] summarize_video 호출 완료: image_mode=%s, 결과 길이=%d",
            image_mode,
            len(result) if result else 0
        )
        logger.info(
            "[CA-RAG DEBUG] ⚠️ 이후 query_video 호출 시 CA-RAG 컨텍스트 상태 확인 필요"
        )

        # DB에 요약 결과 저장
        try:
            _save_summary_to_db(video_id, user_id, result, prompt)
            logger.info(f"요약 결과 DB 저장 완료: video_id={video_id}, user_id={user_id}")
        except Exception as save_error:
            logger.error(f"요약 결과 DB 저장 실패: {save_error}")
            # DB 저장 실패해도 요약 결과는 반환 (사용자 경험 우선)
        
        return {"summary": result, "video_id": video_id, "image_mode": image_mode}
    except HTTPException:
        # HTTPException은 그대로 전파
        raise
    except Exception as e:
        # 기타 예외 처리
        logger.error(f"vss_summarize 실행 중 오류: {e}", exc_info=True)
        error_msg = str(e)
        
        # 빈 에러 메시지 처리
        if not error_msg or error_msg.strip() == "":
            error_msg = "알 수 없는 오류가 발생했습니다"
        
        if "gst-stream-error" in error_msg or "qtdemux" in error_msg or "not-negotiated" in error_msg:
            raise HTTPException(
                status_code=500,
                detail=f"기술적 오류: {error_msg}"
            )
        else:
            raise HTTPException(status_code=500, detail=f"요약 생성 중 오류가 발생했습니다: {error_msg}")

@router.post("/vss-summarize-multi")
async def vss_summarize_multi(
    video_ids: str = Form(...),  # JSON 배열 문자열: ["id1", "id2", ...]
    prompt: str = Form(...),
    csprompt: str = Form(...),
    saprompt: str = Form(...),
    chunk_duration: int = Form(...),
    num_frames_per_chunk: int = Form(...),
    frame_width: int = Form(...),
    frame_height: int = Form(...),
    top_k: int = Form(...),
    top_p: float = Form(...),
    temperature: float = Form(...),
    max_tokens: int = Form(...),
    seed: int = Form(...),
    batch_size: int = Form(...),
    rag_batch_size: int = Form(...),
    rag_top_k: int = Form(...),
    summary_top_p: float = Form(...),
    summary_temperature: float = Form(...),
    summary_max_tokens: int = Form(...),
    chat_top_p: float = Form(...),
    chat_temperature: float = Form(...),
    chat_max_tokens: int = Form(...),
    alert_top_p: float = Form(...),
    alert_temperature: float = Form(...),
    alert_max_tokens: int = Form(...),
    enable_audio: str = Form("false"),
    user_id: str = Form(...),  # 사용자 ID (DB 저장용)
):
    """
    멀티 이미지 요약 VSS API (여러 이미지를 한 번에 요약)
    
    via-server.py의 /summarize 엔드포인트를 참고하여 구현:
    - id_list를 받아서 여러 이미지를 한 번에 처리
    - 멀티 파일의 경우 이미지만 지원 (via-server.py 786-796줄 참고)
    """
    await ensure_vss_client()
    model = await get_via_model()
    
    try:
        # JSON 문자열을 리스트로 파싱
        video_id_list = json.loads(video_ids)
        if not isinstance(video_id_list, list) or len(video_id_list) == 0:
            raise HTTPException(status_code=400, detail="video_ids는 비어있지 않은 배열이어야 합니다.")
        
        # via-server.py 참고: 멀티 파일의 경우 이미지만 지원
        if len(video_id_list) > 1:
            logger.info(f"멀티 이미지 요약 요청: {len(video_id_list)}개 이미지")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="video_ids는 유효한 JSON 배열이어야 합니다.")
    
    try:
        # summarize_video 파라미터 준비
        # 멀티 이미지의 경우 video_id를 리스트로 전달 (via-server.py의 id_list와 동일)
        summarize_params = build_summarize_params(
            image_mode=True,  # 멀티 이미지는 항상 이미지 모드
            video_id=video_id_list,  # 리스트로 전달 (VIA 서버의 SummarizationQuery.id 필드가 리스트 지원)
            chunk_duration=chunk_duration,
            model=model,
            prompt=prompt,
            cs_prompt=csprompt,
            sa_prompt=saprompt,
            num_frames_per_chunk=num_frames_per_chunk,
            frame_width=frame_width,
            frame_height=frame_height,
            top_k=top_k,
            top_p=top_p,
            temperature=temperature,
            max_new_tokens=max_tokens,
            seed=seed,
            batch_size=batch_size,
            rag_batch_size=rag_batch_size,
            rag_top_k=rag_top_k,
            summarize_top_p=summary_top_p,
            summarize_temperature=summary_temperature,
            summarize_max_tokens=summary_max_tokens,
            chat_top_p=chat_top_p,
            chat_temperature=chat_temperature,
            chat_max_tokens=chat_max_tokens,
            notification_top_p=alert_top_p,
            notification_temperature=alert_temperature,
            notification_max_tokens=alert_max_tokens,
            enable_audio=(enable_audio.lower() == "true")
        )
        from utils.helpers import vss_client
        result = await vss_client.summarize_video(*summarize_params)
        
        # DB에 요약 결과 저장 (멀티 이미지의 경우 첫 번째 video_id를 대표로 사용)
        try:
            # 멀티 이미지는 하나의 요약으로 통합되므로 첫 번째 video_id로 저장
            primary_video_id = video_id_list[0]
            _save_summary_to_db(primary_video_id, user_id, result, prompt)
            logger.info(f"멀티 이미지 요약 결과 DB 저장 완료: video_ids={video_id_list}, user_id={user_id}")
        except Exception as save_error:
            logger.error(f"멀티 이미지 요약 결과 DB 저장 실패: {save_error}")
            # DB 저장 실패해도 요약 결과는 반환
        
        return {"summary": result, "video_ids": video_id_list, "image_mode": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"vss_summarize_multi 실행 중 오류: {e}", exc_info=True)
        error_msg = str(e) if str(e) else "알 수 없는 오류가 발생했습니다"
        raise HTTPException(status_code=500, detail=f"멀티 이미지 요약 생성 중 오류가 발생했습니다: {error_msg}")


@router.get("/summaries/{video_id}")
def get_summary(
    video_id: str,
    user_id: str = Query(...)
):
    """특정 동영상의 요약 결과 조회 (VIA 서버 video_id 기준)"""
    try:
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                raise NotFoundException("사용자", user_id)
        with get_db_connection() as cursor:
            cursor.execute(
                """SELECT ID, VIDEO_ID, USER_ID, PROMPT, SUMMARY_TEXT, CREATED_AT, UPDATED_AT
                   FROM vss_summaries
                   WHERE VIDEO_ID = ? AND USER_ID = ?""",
                (video_id, user_id)
            )
            row = cursor.fetchone()
            if not row:
                return {
                    "success": False,
                    "message": "요약 결과가 없습니다."
                }

        return {
            "success": True,
            "summary": {
                "id": row[0],
                "video_id": row[1],
                "user_id": row[2],
                "prompt": row[3],
                "summary_text": row[4],
                "created_at": _format_datetime(row[5]),
                "updated_at": _format_datetime(row[6])
            }
        }
    except NotFoundException:
        raise
    except Exception as e:
        logger.error(f"요약 결과 조회 실패: {e}")
        raise DatabaseException(f"요약 결과 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/summaries")
def get_summaries(user_id: str = Query(...)):
    """사용자 요약 결과 목록 조회"""
    try:
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                raise NotFoundException("사용자", user_id)
        with get_db_connection() as cursor:
            cursor.execute(
                """SELECT ID, VIDEO_ID, USER_ID, PROMPT, SUMMARY_TEXT, CREATED_AT, UPDATED_AT
                   FROM vss_summaries
                   WHERE USER_ID = ?
                   ORDER BY UPDATED_AT DESC""",
                (user_id,)
            )
            rows = cursor.fetchall()

        summaries = [
            {
                "id": row[0],
                "video_id": row[1],
                "user_id": row[2],
                "prompt": row[3],
                "summary_text": row[4],
                "created_at": _format_datetime(row[5]),
                "updated_at": _format_datetime(row[6])
            }
            for row in rows
        ]

        return {
            "success": True,
            "summaries": summaries
        }
    except NotFoundException:
        raise
    except Exception as e:
        logger.error(f"요약 목록 조회 실패: {e}")
        raise DatabaseException(f"요약 목록 조회 중 오류가 발생했습니다: {str(e)}")

@router.delete("/summaries")
async def delete_summaries(request: DeleteSummaryRequest):
    """
    요약 결과 삭제
    
    vss_videos 테이블의 내부 ID 목록을 받아서 해당 동영상들의 요약 결과를 삭제합니다.
    """
    try:
        if not request.video_ids or len(request.video_ids) == 0:
            raise ValidationException("video_ids는 비어있지 않은 배열이어야 합니다.")
        
        with get_db_connection() as cursor:
            # vss_videos 테이블에서 해당 동영상들의 VIDEO_ID (VIA 서버의 video_id) 조회
            placeholders = ','.join(['?' for _ in request.video_ids])
            cursor.execute(
                f"""SELECT VIDEO_ID FROM vss_videos 
                   WHERE ID IN ({placeholders}) AND USER_ID = ?""",
                request.video_ids + [request.user_id]
            )
            rows = cursor.fetchall()
            
            if not rows:
                return {
                    "success": True,
                    "message": "삭제할 요약 결과가 없습니다.",
                    "deleted_count": 0
                }
            
            # VIDEO_ID 목록 추출 (None 제외)
            video_ids = [row[0] for row in rows if row[0] is not None]
            
            if not video_ids:
                return {
                    "success": True,
                    "message": "삭제할 요약 결과가 없습니다.",
                    "deleted_count": 0
                }
            
            # vss_summaries 테이블에서 해당 VIDEO_ID와 USER_ID로 요약 결과 삭제
            video_placeholders = ','.join(['?' for _ in video_ids])
            cursor.execute(
                f"""DELETE FROM vss_summaries 
                   WHERE VIDEO_ID IN ({video_placeholders}) AND USER_ID = ?""",
                video_ids + [request.user_id]
            )
            deleted_count = cursor.rowcount
            # autocommit이 활성화되어 있으므로 명시적 커밋 불필요
        
        logger.info(f"요약 결과 삭제 완료: USER_ID={request.user_id}, 삭제된 요약 수={deleted_count}")
        
        return {
            "success": True,
            "message": f"{deleted_count}개의 요약 결과가 삭제되었습니다.",
            "deleted_count": deleted_count
        }
    except (ValidationException, NotFoundException):
        raise
    except Exception as e:
        logger.error(f"요약 결과 삭제 실패: {e}")
        raise DatabaseException(f"요약 결과 삭제 중 오류가 발생했습니다: {str(e)}")
