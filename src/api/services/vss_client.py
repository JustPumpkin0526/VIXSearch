"""VSS API 클라이언트"""
import os
import aiohttp
import logging
from fastapi import HTTPException
from utils.helpers import get_session
from config.settings import (
    VIA_MODEL_TIMEOUT,
    VIA_UPLOAD_TIMEOUT_MIN,
    VIA_UPLOAD_TIMEOUT_MAX,
    VIA_UPLOAD_TIMEOUT_PER_MB
)

logger = logging.getLogger(__name__)

class VSS:
    """Wrapper to call VSS REST APIs"""

    def __init__(self, host):
        self.host = host
        self.summarize_endpoint = self.host + "/summarize"
        self.query_endpoint = self.host + "/chat/completions"
        self.files_endpoint = self.host + "/files"
        self.models_endpoint = self.host + "/models"
        self.model = None
        self.f_count = 0

    async def check_response(self, response, json_format=True):
        logger.debug(f"Response Status Code: {response.status}")
        if response.status == 200:
            try:
                return await response.json()
            except Exception:
                logger.warning("JSON decode error, returning text.")
                return await response.text()
        else:
            text = await response.text()
            logger.error(f"서버 에러: {response.status}, {text}")
            return text

    async def get_model(self):
        session = await get_session()
        try:
            async with session.get(
                self.models_endpoint,
                timeout=aiohttp.ClientTimeout(total=VIA_MODEL_TIMEOUT)
            ) as resp:
                json_data = await self.check_response(resp)
                try:
                    return json_data["data"][0]["id"]
                except Exception as e:
                    raise HTTPException(status_code=502, detail=f"Invalid response from VIA /models: {e}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach VIA server for models: {e}")

    async def upload_video(self, file_path, purpose="vision", media_type=None):
        """
        동영상 또는 이미지 파일을 VIA 서버에 업로드
        
        Args:
            file_path: 업로드할 파일 경로 (동영상 또는 이미지)
            purpose: 파일 목적 (기본값: "vision")
            media_type: 미디어 타입 ("image" 또는 "video"). None이면 파일 확장자로 자동 판단
            
        Returns:
            업로드된 파일의 ID
        """
        from pathlib import Path
        
        # 이미지 확장자 목록
        IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}
        
        # media_type이 제공되지 않으면 파일 확장자로 판단
        if media_type is None:
            file_ext = Path(file_path).suffix.lower()
            is_image = file_ext in IMAGE_EXTENSIONS
            media_type = "image" if is_image else "video"
        
        is_image = (media_type == "image")
        
        session = await get_session()
        data = aiohttp.FormData()
        
        file_size = os.path.getsize(file_path)
        file_type = media_type
        logger.info(f"Uploading {file_type} file: {file_path} (size: {file_size / (1024*1024):.2f} MB)")
        
        # vss-summarize.py는 Linux 환경에서 실행되므로 경로만 전달하지만,
        # Windows 환경에서는 VIA 서버가 파일에 접근할 수 없으므로 파일을 실제로 업로드해야 함
        file_handle = open(file_path, "rb")
        try:
            if is_image:
                # 이미지인 경우: 파일을 실제로 업로드 (Windows 경로 문제 해결)
                # 파일명만 추출하여 filename에 사용
                file_name = Path(file_path).name
                data.add_field("file", file_handle, filename=file_name)
                data.add_field("purpose", purpose)
                data.add_field("media_type", media_type)
                # 이미지는 일반적으로 작으므로 기본 타임아웃 사용
                timeout_seconds = VIA_UPLOAD_TIMEOUT_MIN
            else:
                # 동영상인 경우: 파일을 실제로 업로드
                data.add_field("file", file_handle, filename=f"file_{self.f_count}")
                data.add_field("purpose", purpose)
                data.add_field("media_type", media_type)
                # 파일 크기에 따라 동적 타임아웃 계산
                timeout_seconds = max(
                    VIA_UPLOAD_TIMEOUT_MIN,
                    min(VIA_UPLOAD_TIMEOUT_MAX, int(file_size / (1024 * 1024) * VIA_UPLOAD_TIMEOUT_PER_MB))
                )

            async with session.post(
                self.files_endpoint, 
                data=data
            ) as response:
                self.f_count += 1
                json_data = await self.check_response(response)
                if response.status >= 400:
                    error_msg = json_data.get("message", "Unknown error") if isinstance(json_data, dict) else str(json_data)
                    raise HTTPException(status_code=response.status, detail=f"{file_type} 업로드 실패: {error_msg}")
                return json_data.get("id")  # return uploaded file id

        finally:
            # 파일 핸들 닫기
            file_handle.close()

    async def summarize_video(self, file_id, prompt, cs_prompt, sa_prompt, chunk_duration, model, num_frames_per_chunk, frame_width, frame_height, top_k, top_p, temperature, max_new_tokens, seed, batch_size, rag_batch_size, rag_top_k, summarize_top_p, summarize_temperature, summarize_max_tokens, chat_top_p, chat_temperature, chat_max_tokens, notification_top_p, notification_temperature, notification_max_tokens, enable_audio, enable_chat_history):
        """
        VIA 서버에 요약 요청 전송
        
        Args:
            file_id: VIA 서버의 file_id (단일 문자열 또는 문자열 리스트)
                    - 단일 문자열: 단일 파일 요약
                    - 문자열 리스트: 멀티 이미지 요약 (이미지만 지원, via-server.py 참고)
            기타 파라미터: 요약에 필요한 설정값들
        
        Returns:
            요약 결과 텍스트
        """
        # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
        is_multi_file = isinstance(file_id, list)
        file_id_str = str(file_id) if not is_multi_file else f"[{len(file_id)} files]"
        logger.info(
            "[CA-RAG DEBUG] ====== summarize_video 요청 시작 ======"
        )
        logger.info(
            "[CA-RAG DEBUG] file_id 타입: %s, 값: %s",
            "리스트 (멀티 이미지)" if is_multi_file else "단일 파일",
            file_id_str
        )
        logger.info(
            "[CA-RAG DEBUG] enable_chat: True, stream: False (설정됨)"
        )
        
        # Summarize 파라미터 로그 출력
        logger.info(f"[SUMMARIZE-VIDEO] 파라미터:")
        logger.info(f"  - top_k: {top_k}")
        logger.info(f"  - top_p: {top_p}")
        logger.info(f"  - temperature: {temperature}")
        logger.info(f"  - max_new_tokens: {max_new_tokens}")
        logger.info(f"  - seed: {seed}")
        logger.info(f"  - summarize_top_p: {summarize_top_p}")
        logger.info(f"  - summarize_temperature: {summarize_temperature}")
        logger.info(f"  - summarize_max_tokens: {summarize_max_tokens}")
        logger.info(f"  - chat_top_p: {chat_top_p}")
        logger.info(f"  - chat_temperature: {chat_temperature}")
        logger.info(f"  - chat_max_tokens: {chat_max_tokens}")
        logger.info(f"  - notification_top_p: {notification_top_p}")
        logger.info(f"  - notification_temperature: {notification_temperature}")
        logger.info(f"  - notification_max_tokens: {notification_max_tokens}")
        logger.info(f"  - rag_top_k: {rag_top_k}")
        
        # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
        
        # VIA 서버의 SummarizationQuery 모델은 id 필드가 Union[UUID, List[UUID]]를 지원
        # 따라서 file_id가 리스트인 경우 그대로 전달하면 됨
        body = {
            "id": file_id,  # 단일 문자열 또는 리스트 모두 가능 (VIA 서버가 자동 처리)
            "prompt": prompt,
            "caption_summarization_prompt": cs_prompt,
            "summary_aggregation_prompt": sa_prompt,
            "model": model,
            "chunk_duration": chunk_duration,
            "temperature": temperature,
            "seed": seed,
            "max_tokens": max_new_tokens,
            "top_p": top_p,
            "top_k": top_k,
            "num_frames_per_chunk": num_frames_per_chunk,
            "vlm_input_width": frame_width,
            "vlm_input_height": frame_height,
            "summarize_top_p": summarize_top_p,
            "summarize_temperature": summarize_temperature,
            "summarize_max_tokens": summarize_max_tokens,
            "chat_top_p": chat_top_p,
            "chat_temperature": chat_temperature,
            "chat_max_tokens": chat_max_tokens,
            "notification_top_p": notification_top_p,
            "notification_temperature": notification_temperature,
            "notification_max_tokens": notification_max_tokens,
            "summarize_batch_size": batch_size,
            "rag_batch_size": rag_batch_size,
            "rag_top_k": rag_top_k,
            "enable_chat": True,
            "enable_audio": enable_audio,
            "enable_chat_history": enable_chat_history,
            "stream": False,  # 채팅 기능 활성화를 위해 stream: False 명시
        }

        session = await get_session()
        logger.info(
            "[CA-RAG DEBUG] VIA 서버 /summarize 요청 전송: file_id=%s, enable_chat=%s, stream=%s",
            file_id_str,
            body.get("enable_chat"),
            body.get("stream")
        )
        # 타임아웃 없이 요청 (요약 작업은 시간이 오래 걸릴 수 있음)
        async with session.post(
            self.summarize_endpoint, 
            json=body,
            timeout=None  # 타임아웃 제거
        ) as response:
            # 에러 응답 처리
            if response.status != 200:
                error_text = await response.text()
                logger.error(f"VIA 서버 summarize_video 오류 (HTTP {response.status}): {error_text}")
                
                # GStreamer 에러인 경우 더 명확한 메시지 제공
                if "gst-stream-error" in error_text or "qtdemux" in error_text or "not-negotiated" in error_text:
                    error_msg = (
                        "동영상 파일 처리 중 오류가 발생했습니다. "
                        "가능한 원인:\n"
                        "1. 손상된 동영상 파일\n"
                        "2. 지원하지 않는 코덱 또는 포맷\n"
                        "3. 파일이 완전히 업로드되지 않음\n"
                        "4. 파일 메타데이터 문제\n\n"
                        f"VIA 서버 오류: {error_text}"
                    )
                    raise HTTPException(status_code=500, detail=error_msg)
                else:
                    raise HTTPException(status_code=response.status, detail=f"VIA 서버 summarize_video 오류: {error_text}")
            
            # check response
            json_data = await self.check_response(response)
            
            # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
            logger.info(
                "[CA-RAG DEBUG] ====== summarize_video 응답 수신 ======"
            )
            logger.info(
                "[CA-RAG DEBUG] HTTP 상태 코드: %d",
                response.status
            )
            if isinstance(json_data, dict):
                has_choices = "choices" in json_data
                logger.info(
                    "[CA-RAG DEBUG] 응답 타입: dict, choices 존재: %s",
                    has_choices
                )
                if has_choices:
                    choices = json_data.get("choices") or []
                    if choices and isinstance(choices[0], dict):
                        message = choices[0].get("message", {})
                        content = message.get("content") if isinstance(message, dict) else None
                        logger.info(
                            "[CA-RAG DEBUG] 요약 완료: choices[0].message.content 길이=%d",
                            len(content) if content else 0
                        )
                    else:
                        logger.warning("[CA-RAG DEBUG] summarize 응답 choices가 비어 있습니다.")
            else:
                logger.info(
                    "[CA-RAG DEBUG] 응답 타입: %s (dict 아님)",
                    type(json_data).__name__
                )
            logger.info(
                "[CA-RAG DEBUG] 요약 요청 완료. 이후 query_video 호출 시 컨텍스트 상태 확인 필요"
            )
            # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
            
            if isinstance(json_data, dict) and "choices" in json_data:
                # choices 리스트가 비어있지 않은지 확인
                if json_data["choices"] and len(json_data["choices"]) > 0:
                    choice = json_data["choices"][0]
                    if isinstance(choice, dict) and "message" in choice:
                        message = choice["message"]
                        if isinstance(message, dict) and "content" in message:
                            message_content = message["content"]
                            return message_content
                        else:
                            logger.warning(f"choices[0].message에 content가 없습니다: {message}")
                            return str(json_data)
                    else:
                        logger.warning(f"choices[0]에 message가 없습니다: {choice}")
                        return str(json_data)
                else:
                    logger.warning(f"choices 리스트가 비어있습니다: {json_data}")
                    return str(json_data)
            else:
                # JSON이 아니거나 에러일 때는 원본 텍스트 또는 에러 메시지 반환
                return json_data

    async def list_files(self, purpose: str = "vision"):
        """
        VIA 서버에서 파일 목록 조회
        
        Args:
            purpose: 파일 목적 (기본값: "vision")
        
        Returns:
            파일 목록 (ListFilesResponse 형식)
        """
        session = await get_session()
        try:
            async with session.get(
                self.files_endpoint,
                params={"purpose": purpose},
                timeout=aiohttp.ClientTimeout(total=VIA_MODEL_TIMEOUT)
            ) as response:
                json_data = await self.check_response(response)
                
                # 오류 응답 처리
                if response.status != 200:
                    error_msg = json_data if isinstance(json_data, str) else str(json_data)
                    raise HTTPException(status_code=response.status, detail=f"VIA 서버 파일 목록 조회 오류: {error_msg}")
                
                # 정상 응답 처리
                if isinstance(json_data, dict) and "data" in json_data:
                    return json_data
                else:
                    raise HTTPException(status_code=502, detail=f"VIA 서버 응답 형식 오류: {json_data}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"VIA 서버 파일 목록 조회 실패: {e}")
            raise HTTPException(status_code=502, detail=f"VIA 서버 파일 목록 조회 실패: {str(e)}")

    async def query_video(self, video_id, model, chunk_size, temperature, seed, max_new_tokens, top_p, top_k, query):
        # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
        logger.info(
            "[CA-RAG DEBUG] ====== query_video 요청 시작 ======"
        )
        logger.info(
            "[CA-RAG DEBUG] video_id: %s, query: %s",
            video_id,
            query
        )
        logger.info(f"chunk_size: {chunk_size}")
        logger.info(f"temperature: {temperature}")
        logger.info(f"seed: {seed}")
        logger.info(f"max_new_tokens: {max_new_tokens}")
        logger.info(f"top_p: {top_p}")
        logger.info(f"top_k: {top_k}")
        logger.info(
            "[CA-RAG DEBUG] 이전에 summarize_video가 호출되었는지 확인 필요"
        )
        # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
        
        body = {
            "id": video_id,
            "model": model,
            "chunk_duration": chunk_size,
            "temperature": temperature,
            "seed": seed,
            "max_tokens": max_new_tokens,
            "top_p": top_p,
            "top_k": top_k,
            "stream": True,
            "stream_options": {"include_usage": True},
            "highlight": False,
        }

        logger.info(f"chunk_size: {chunk_size}")
        body["messages"] = [{"content": str(query), "role": "user"}]
        session = await get_session()
        
        logger.info(
            "[CA-RAG DEBUG] VIA 서버 /chat/completions 요청 전송: video_id=%s",
            video_id
        )
        # 타임아웃 없이 요청 (질의 작업은 시간이 오래 걸릴 수 있음)
        async with session.post(
            self.query_endpoint, 
            json=body,
            timeout=None  # 타임아웃 제거
        ) as response:
            json_data = await self.check_response(response)
            
            # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
            logger.info(
                "[CA-RAG DEBUG] ====== query_video 응답 수신 ======"
            )
            logger.info(
                "[CA-RAG DEBUG] HTTP 상태 코드: %d",
                response.status
            )
            # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
            
            # 오류 응답 처리
            if response.status != 200:
                error_msg = json_data if isinstance(json_data, str) else str(json_data)
                
                # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
                logger.error(
                    "[CA-RAG DEBUG] ====== query_video 오류 발생 ======"
                )
                logger.error(
                    "[CA-RAG DEBUG] 오류 상태 코드: %d",
                    response.status
                )
                logger.error(
                    "[CA-RAG DEBUG] 오류 메시지: %s",
                    error_msg
                )
                if "Chat functionality disabled" in str(error_msg):
                    logger.error(
                        "[CA-RAG DEBUG] ⚠️ 핵심 문제 발견: 'Chat functionality disabled' 에러"
                    )
                    logger.error(
                        "[CA-RAG DEBUG] 이는 VIA 서버의 _ctx_mgr가 None이라는 의미입니다."
                    )
                    logger.error(
                        "[CA-RAG DEBUG] video_id=%s에 대한 이전 summarize_video 호출에서 CA-RAG 컨텍스트가 초기화되지 않았거나 해제되었을 가능성",
                        video_id
                    )
                # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
                
                raise HTTPException(status_code=response.status, detail=f"VIA 서버 query_video 오류: {error_msg}")
            
            # 정상 응답 처리
            if isinstance(json_data, dict) and "choices" in json_data:
                choices = json_data.get("choices") or []
                if not choices:
                    logger.warning("[CA-RAG DEBUG] query_video 응답에 choices가 비어 있습니다.")
                    return None
                message = choices[0].get("message") if isinstance(choices[0], dict) else None
                message_content = message.get("content") if isinstance(message, dict) else None
                if not message_content:
                    logger.warning("[CA-RAG DEBUG] query_video 응답에 message.content가 없습니다.")
                    return None
                logger.info(f"message_content: {message_content}")
                
                # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
                logger.info(
                    "[CA-RAG DEBUG] ✅ query_video 성공: 응답 수신 완료"
                )
                logger.info(
                    "[CA-RAG DEBUG] 응답 내용 길이: %d 문자",
                    len(message_content) if message_content else 0
                )
                # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
                
                # "Audio transcript not available." 메시지 필터링
                if message_content and "Audio transcript not available" in message_content:
                    # 메시지에서 "Audio transcript not available." 부분 제거
                    message_content = message_content.replace("Audio transcript not available.", "").strip()
                    message_content = message_content.replace("Audio transcript not available", "").strip()
                    # 제거 후 빈 문자열이면 None 반환
                    if not message_content:
                        logger.warning("VIA 서버 응답에 오디오 트랜스크립트가 없습니다.")
                        return None
                
                return message_content
            else:
                # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
                logger.error(
                    "[CA-RAG DEBUG] ⚠️ query_video 응답 형식 오류: choices가 없음"
                )
                logger.error(
                    "[CA-RAG DEBUG] 응답 데이터: %s",
                    str(json_data)[:500] if json_data else "None"
                )
                # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
                
                raise HTTPException(status_code=502, detail=f"VIA 서버 응답 형식 오류: {json_data}")

