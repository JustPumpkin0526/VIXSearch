"""요약 관련 라우터"""
import logging
import os
import tempfile
import asyncio
from typing import Optional, List
import json
from fastapi import APIRouter, HTTPException, Form, UploadFile, Query
from services.video_service import _save_summary_to_db
from pydantic import BaseModel

from utils.helpers import (
    ensure_vss_client,
    get_via_model,
    build_summarize_params,
    check_video_type,
    translate_to_korean,
    get_recommended_chunk_size
)
from moviepy.video.io.VideoFileClip import VideoFileClip
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
    enable_chat_history: bool = Form(False),  # 채팅 히스토리 활성화 여부 (기본값: False)
    video_id: Optional[str] = Form(None),  # VIA 서버의 video_id (이미 업로드된 경우)
    user_id: str = Form(...),  # 사용자 ID (DB 저장용)
):
    """동영상/이미지 요약 VSS API"""
    await ensure_vss_client()
    model = await get_via_model()
    from utils.helpers import vss_client

    # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
    logger.info(
        "[CA-RAG DEBUG] ====== /vss-summarize 엔드포인트 호출 ======"
    )
    
    # 프론트엔드에서 전달받은 파라미터 로그 출력
    logger.info("[VSS-SUMMARIZE] 받은 파라미터:")
    logger.info(f"  - top_k: {top_k}")
    logger.info(f"  - top_p: {top_p}")
    logger.info(f"  - temperature: {temperature}")
    logger.info(f"  - max_tokens: {max_tokens}")
    logger.info(f"  - seed: {seed}")
    logger.info(f"  - summary_top_p: {summary_top_p}")
    logger.info(f"  - summary_temperature: {summary_temperature}")
    logger.info(f"  - summary_max_tokens: {summary_max_tokens}")
    logger.info(f"  - chat_top_p: {chat_top_p}")
    logger.info(f"  - chat_temperature: {chat_temperature}")
    logger.info(f"  - chat_max_tokens: {chat_max_tokens}")
    logger.info(f"  - alert_top_p: {alert_top_p}")
    logger.info(f"  - alert_temperature: {alert_temperature}")
    logger.info(f"  - alert_max_tokens: {alert_max_tokens}")
    logger.info(f"  - rag_top_k: {rag_top_k}")
    
    # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
    
    # video_id가 제공되지 않은 경우 파일 업로드
    temp_file_path = None
    image_mode = False  # 기본값 초기화
    
    if not video_id and file:
        # 파일 타입 확인 (이미지 모드 여부)
        image_mode = await check_video_type(file)
        
        logger.info(
            "[CA-RAG DEBUG] 파일 업로드 모드: image_mode=%s, filename=%s",
            image_mode,
            file.filename
        )

        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            temp_file_path = tmp_file.name
        
        try:
            # 모든 파일은 upload_video를 통해 업로드 (이미지/동영상 자동 감지)
            video_id = await vss_client.upload_video(temp_file_path)
            file_type = "이미지" if image_mode else "비디오"
            logger.info(f"{file_type} 업로드 완료: video_id={video_id}")
            
            logger.info(
                "[CA-RAG DEBUG] 파일 업로드 완료: file_type=%s, video_id=%s",
                file_type,
                video_id
            )
        except Exception as upload_error:
            logger.error(f"VIA 서버 파일 업로드 실패: {upload_error}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"파일 업로드 중 오류가 발생했습니다: {str(upload_error)}"
            )
        finally:
            # 임시 파일 정리
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"임시 파일 삭제 완료: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"임시 파일 삭제 실패: {temp_file_path}, 오류: {cleanup_error}")
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

    # 파라미터 검증
    if not prompt or not prompt.strip():
        raise HTTPException(status_code=400, detail="prompt는 필수입니다.")
    
    # VIA 서버 제약사항: max_tokens는 최대 1024까지만 허용
    if max_tokens > 1024:
        logger.warning(f"max_tokens가 1024를 초과합니다 ({max_tokens}). 1024로 제한합니다.")
        max_tokens = 1024
    
    # chunk_duration 자동 계산 (chunk_duration이 -1인 경우; Form은 필수 int이므로 None 분기 없음)
    final_chunk_duration = chunk_duration
    if chunk_duration == -1:
        # 비디오 파일인 경우에만 duration 계산 (이미지 모드는 chunk_duration이 의미 없음)
        if not image_mode and temp_file_path and os.path.exists(temp_file_path):
            try:
                video = VideoFileClip(temp_file_path)
                duration = video.duration or 0
                video.close()
                del video
                logger.info(f"Video duration: {duration} seconds for {temp_file_path}")
                
                if duration > 0:
                    final_chunk_duration = await get_recommended_chunk_size(duration)
                    logger.info(f"자동 지정: chunk_duration={final_chunk_duration} 사용 (영상 길이: {duration}초)")
                else:
                    logger.warning("영상 길이를 가져올 수 없습니다. 기본값 10 사용")
                    final_chunk_duration = 10
            except Exception as video_error:
                logger.warning(f"비디오 파일 로드 실패: {temp_file_path}, 오류: {video_error}. 기본값 10 사용")
                final_chunk_duration = 10
        elif video_id and not image_mode:
            # video_id만 있는 경우는 duration을 가져올 수 없으므로 기본값 사용
            logger.warning("video_id만 제공되어 영상 길이를 가져올 수 없습니다. 기본값 10 사용")
            final_chunk_duration = 10
        else:
            # 이미지 모드이거나 파일이 없는 경우 기본값 사용
            logger.info("이미지 모드이거나 파일이 없어 기본값 10 사용")
            final_chunk_duration = 10
    elif chunk_duration < 0:
        logger.warning(f"chunk_duration이 음수입니다 ({chunk_duration}). 기본값 10 사용")
        final_chunk_duration = 10
    
    try:
        # summarize_video 파라미터 준비 (Form으로 받은 모든 값 전달)
        summarize_params = build_summarize_params(
            image_mode=image_mode,
            video_id=video_id,
            chunk_duration=final_chunk_duration,
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
            enable_audio=enable_audio,
            enable_chat_history=enable_chat_history
        )

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
        
        # 다중 동영상 처리 시 VIA 서버 컨텍스트 정리를 위한 대기 시간
        # VIA 서버가 이전 동영상의 컨텍스트를 정리할 시간을 확보하여 메모리 누수 방지
        # 주의: 프론트엔드에서 순차적으로 호출하므로, 이 대기 시간은 VIA 서버 내부 정리를 위한 것
        await asyncio.sleep(0.5)
        logger.info(f"[MULTI-VIDEO] VIA 서버 컨텍스트 정리 대기 완료 (0.5초). video_id={video_id}")

        # 요약 결과를 한국어로 번역
        translated_result = result
        try:
            translated_result = await translate_to_korean(result)
            logger.info(f"요약 결과 번역 완료: video_id={video_id}")
        except Exception as translate_error:
            logger.warning(f"요약 결과 번역 실패, 원문 저장: {translate_error}")
            # 번역 실패 시 원문 사용

        # DB에 번역된 요약 결과 저장
        try:
            _save_summary_to_db(video_id, user_id, translated_result, prompt)
            logger.info(f"요약 결과 DB 저장 완료 (번역본): video_id={video_id}, user_id={user_id}")
        except Exception as save_error:
            logger.error(f"요약 결과 DB 저장 실패: {save_error}")
            # DB 저장 실패해도 요약 결과는 반환 (사용자 경험 우선)
        
        return {"summary": translated_result, "video_id": video_id, "image_mode": image_mode}
    except HTTPException:
        # HTTPException은 그대로 전파
        raise
    except ValueError as ve:
        # 파라미터 검증 오류
        logger.error(f"파라미터 검증 실패: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"잘못된 파라미터: {str(ve)}")
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
    chunk_duration: Optional[int] = Form(None),  # None이거나 -1이면 자동 계산
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
    enable_chat_history: str = Form("false"),  # 채팅 히스토리 활성화 여부 (기본값: False)
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
    from utils.helpers import vss_client

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
    
    # chunk_duration 자동 계산 (chunk_duration이 None이거나 -1인 경우)
    # 멀티 이미지는 항상 이미지 모드이므로 chunk_duration이 의미 없지만, 일관성을 위해 기본값 사용
    final_chunk_duration = chunk_duration
    if chunk_duration is None or chunk_duration == -1:
        logger.info("멀티 이미지 모드이므로 기본값 10 사용")
        final_chunk_duration = 10
    elif chunk_duration < 0:
        logger.warning(f"chunk_duration이 음수입니다 ({chunk_duration}). 기본값 10 사용")
        final_chunk_duration = 10
    
    try:
        # summarize_video 파라미터 준비
        # 멀티 이미지의 경우 video_id를 리스트로 전달 (via-server.py의 id_list와 동일)
        summarize_params = build_summarize_params(
            image_mode=True,  # 멀티 이미지는 항상 이미지 모드
            video_id=video_id_list,  # 리스트로 전달 (VIA 서버의 SummarizationQuery.id 필드가 리스트 지원)
            chunk_duration=final_chunk_duration,
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
            enable_audio=(enable_audio.lower() == "true"),
            enable_chat_history=False
        )
        result = await vss_client.summarize_video(*summarize_params)
        
        # 다중 이미지 처리 시 VIA 서버 컨텍스트 정리를 위한 대기 시간
        await asyncio.sleep(0.5)
        logger.info(f"[MULTI-IMAGE] VIA 서버 컨텍스트 정리 대기 완료 (0.5초). video_ids={len(video_id_list)}개")
        
        # 요약 결과를 한국어로 번역
        translated_result = result
        try:
            translated_result = await translate_to_korean(result)
            logger.info(f"멀티 이미지 요약 결과 번역 완료: video_ids={video_id_list}")
        except Exception as translate_error:
            logger.warning(f"멀티 이미지 요약 결과 번역 실패, 원문 저장: {translate_error}")
            # 번역 실패 시 원문 사용
        
        # DB에 번역된 요약 결과 저장 (멀티 이미지의 경우 첫 번째 video_id를 대표로 사용)
        try:
            # 멀티 이미지는 하나의 요약으로 통합되므로 첫 번째 video_id로 저장
            primary_video_id = video_id_list[0]
            _save_summary_to_db(primary_video_id, user_id, translated_result, prompt)
            logger.info(f"멀티 이미지 요약 결과 DB 저장 완료 (번역본): video_ids={video_id_list}, user_id={user_id}")
        except Exception as save_error:
            logger.error(f"멀티 이미지 요약 결과 DB 저장 실패: {save_error}")
            # DB 저장 실패해도 요약 결과는 반환
        
        return {"summary": translated_result, "video_ids": video_id_list, "image_mode": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"vss_summarize_multi 실행 중 오류: {e}", exc_info=True)
        error_msg = str(e) if str(e) else "알 수 없는 오류가 발생했습니다"
        raise HTTPException(status_code=500, detail=f"멀티 이미지 요약 생성 중 오류가 발생했습니다: {error_msg}")


@router.get("/summaries/batch")
def get_summaries_batch(
    video_ids: str = Query(...),  # JSON 배열 문자열: ["id1", "id2", ...]
    user_id: str = Query(...)
):
    """여러 동영상의 요약 상태를 한 번에 조회 (배치 처리)"""
    logger.info(f"[get_summaries_batch] 배치 요약 상태 조회 요청: USER_ID={user_id}, VIDEO_IDS={video_ids}")
    try:
        # JSON 문자열을 리스트로 파싱
        try:
            video_id_list = json.loads(video_ids) if isinstance(video_ids, str) else video_ids
            if not isinstance(video_id_list, list):
                raise ValueError("video_ids must be a list")
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"[get_summaries_batch] video_ids 파싱 실패: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid video_ids format: {str(e)}")
        
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"[get_summaries_batch] 사용자를 찾을 수 없음: USER_ID={user_id}")
                raise NotFoundException("사용자", user_id)
        
        # 배치로 요약 상태 조회
        summary_map = {}  # video_id -> summary 정보 매핑
        if video_id_list:
            with get_db_connection() as cursor:
                # 중복 제거
                unique_video_ids = list(set(video_id_list))
                placeholders = ','.join(['?'] * len(unique_video_ids))
                params = unique_video_ids + [user_id]
                cursor.execute(
                    f"""SELECT VIDEO_ID, ID, PROMPT, SUMMARY_TEXT, CREATED_AT, UPDATED_AT
                       FROM vss_summaries
                       WHERE VIDEO_ID IN ({placeholders}) AND USER_ID = ?""",
                    params
                )
                for row in cursor.fetchall():
                    video_id = row[0]
                    summary_map[video_id] = {
                        "id": row[1],
                        "video_id": video_id,
                        "user_id": user_id,
                        "prompt": row[2],
                        "summary_text": row[3],
                        "created_at": _format_datetime(row[4]),
                        "updated_at": _format_datetime(row[5])
                    }
        
        # 모든 video_id에 대해 응답 생성 (요약이 없는 것도 포함)
        results = {}
        for video_id in video_id_list:
            if video_id in summary_map:
                results[video_id] = {
                    "success": True,
                    "summary": summary_map[video_id]
                }
            else:
                results[video_id] = {
                    "success": False,
                    "message": "요약 결과가 없습니다."
                }
        
        logger.info(f"[get_summaries_batch] 배치 요약 상태 조회 완료: {len([r for r in results.values() if r['success']])}개 요약 존재, {len([r for r in results.values() if not r['success']])}개 요약 없음")
        return {
            "success": True,
            "results": results
        }
    except NotFoundException:
        raise
    except Exception as e:
        logger.error(f"[get_summaries_batch] 배치 요약 상태 조회 실패: {e}", exc_info=True)
        raise DatabaseException(f"배치 요약 상태 조회 중 오류가 발생했습니다: {str(e)}")

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

@router.get("/summaries/{video_id}")
def get_summary(
    video_id: str,
    user_id: str = Query(...)
):
    """특정 동영상의 요약 결과 조회 (VIA 서버 video_id 기준)"""
    logger.info(f"[get_summary] 요약 결과 조회 요청: VIDEO_ID={video_id}, USER_ID={user_id}")
    try:
        # 사용자 존재 확인
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"[get_summary] 사용자를 찾을 수 없음: USER_ID={user_id}")
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
                logger.info(f"[get_summary] 요약 결과 없음: VIDEO_ID={video_id}, USER_ID={user_id}")
                return {
                    "success": False,
                    "message": "요약 결과가 없습니다."
                }

        logger.info(f"[get_summary] 요약 결과 조회 성공: VIDEO_ID={video_id}, USER_ID={user_id}, SUMMARY_ID={row[0]}")
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
        logger.error(f"[get_summary] 요약 결과 조회 실패: VIDEO_ID={video_id}, USER_ID={user_id}, 오류={e}")
        raise DatabaseException(f"요약 결과 조회 중 오류가 발생했습니다: {str(e)}")

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
    except ValidationException:
        raise
    except Exception as e:
        logger.error(f"요약 결과 삭제 실패: {e}")
        raise DatabaseException(f"요약 결과 삭제 중 오류가 발생했습니다: {str(e)}")


@router.post("/translate-to-korean")
async def translate_summary_to_korean(
    text: str = Form(...)
):
    """요약 결과를 한국어로 번역하는 API"""
    try:
        translated_text = await translate_to_korean(text)
        return {
            "success": True,
            "translated_text": translated_text
        }
    except Exception as e:
        logger.error(f"번역 실패: {e}")
        # 번역 실패 시 원본 텍스트 반환
        return {
            "success": False,
            "translated_text": text,
            "error": str(e)
        }
