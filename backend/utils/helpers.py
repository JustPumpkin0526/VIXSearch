"""헬퍼 유틸리티 함수"""
from typing import Optional, Union, List
import aiohttp
import logging
from fastapi import UploadFile
from fastapi import HTTPException
from config.settings import (
    API_BASE_URL, VIA_SERVER_URL, VIA_MODEL_TIMEOUT,
    OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TRANSLATION_MODEL, OLLAMA_TIMEOUT, DEFAULT_NUM_FRAMES_PER_CHUNK,
    DEFAULT_SUMMARIZE_PROMPT,
    DEFAULT_VIA_TARGET_RESPONSE_TIME, DEFAULT_VIA_TARGET_USECASE_EVENT_DURATION,
    DEFAULT_FRAME_WIDTH, DEFAULT_FRAME_HEIGHT, DEFAULT_TOP_K, DEFAULT_TOP_P,
    DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_SEED, DEFAULT_BATCH_SIZE,
    DEFAULT_RAG_BATCH_SIZE, DEFAULT_RAG_TOP_K, DEFAULT_SUMMARIZE_TOP_P,
    DEFAULT_SUMMARIZE_TEMPERATURE, DEFAULT_SUMMARIZE_MAX_TOKENS,
    DEFAULT_CHAT_TOP_P, DEFAULT_CHAT_TEMPERATURE, DEFAULT_CHAT_MAX_TOKENS,
    DEFAULT_NOTIFICATION_TOP_P, DEFAULT_NOTIFICATION_TEMPERATURE,
    DEFAULT_NOTIFICATION_MAX_TOKENS, DEFAULT_ENABLE_AUDIO,
    DEFAULT_CAPTION_SUMMARIZATION_PROMPT, DEFAULT_SUMMARY_AGGREGATION_PROMPT,
    DEFAULT_QUERY_TEMPERATURE, DEFAULT_QUERY_SEED, DEFAULT_QUERY_MAX_TOKENS,
    DEFAULT_QUERY_TOP_P, DEFAULT_QUERY_TOP_K
)

logger = logging.getLogger(__name__)

# 전역 변수
http_session: Optional[aiohttp.ClientSession] = None
vss_client = None

# VSS 클래스를 나중에 import (순환 참조 방지)
VSS = None

async def get_session():
    """전역 aiohttp 세션 가져오기 또는 생성"""
    global http_session
    if http_session is None or http_session.closed:
        http_session = aiohttp.ClientSession()
    return http_session

async def ensure_vss_client():
    """VSS 클라이언트 초기화 (중복 초기화 방지)"""
    global vss_client, VSS
    if VSS is None:
        from services.vss_client import VSS as VSSClass
        VSS = VSSClass
    
    if vss_client is None:
        vss_client = VSS(VIA_SERVER_URL)
        vss_client.model = await vss_client.get_model()
    return vss_client

async def get_via_model():
    """VIA 서버에서 모델 정보 가져오기"""
    session = await get_session()
    try:
        async with session.get(
            f"{VIA_SERVER_URL}/models",
            timeout=aiohttp.ClientTimeout(total=VIA_MODEL_TIMEOUT)
        ) as resp:
            if resp.status >= 400:
                raise HTTPException(status_code=502, detail=f"VIA /models returned status {resp.status}")
            try:
                resp_json = await resp.json()
            except Exception:
                raise HTTPException(status_code=502, detail="VIA /models returned invalid JSON")
            return resp_json["data"][0]["id"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to contact VIA server: {e}")

def build_file_url(file_url: str, request: Optional[object] = None) -> str:
    """
    파일 URL 생성 (API 베이스 URL 포함)
    
    Args:
        file_url: 상대 경로 또는 절대 URL
        request: FastAPI Request 객체 (선택사항, 있으면 동적으로 호스트 결정)
    
    Returns:
        절대 URL 문자열
    """
    # 이미 절대 URL인 경우 그대로 반환
    if file_url.startswith('http'):
        return file_url
    
    # Request 객체가 있으면 동적으로 호스트 결정 (외부 접속 지원)
    if request:
        try:
            # Request에서 호스트와 스키마 추출
            # Host 헤더가 있으면 우선 사용 (프록시나 리버스 프록시 환경 대응)
            host_header = request.headers.get("host")
            if host_header:
                # Host 헤더에 포트가 포함되어 있을 수 있음
                scheme = request.url.scheme
                return f"{scheme}://{host_header}{file_url}"
            else:
                # Host 헤더가 없으면 URL에서 추출
                scheme = request.url.scheme
                hostname = request.url.hostname or "localhost"
                port = request.url.port
                if port:
                    host = f"{hostname}:{port}"
                else:
                    # 포트가 없으면 기본 포트 사용
                    if scheme == "https":
                        host = hostname  # HTTPS는 기본 443 포트
                    else:
                        host = f"{hostname}:8001"  # HTTP는 8001 포트 (백엔드 기본 포트)
                return f"{scheme}://{host}{file_url}"
        except Exception as e:
            # Request 파싱 실패 시 기본값 사용
            logger.warning(f"Request에서 호스트 추출 실패, 기본값 사용: {e}")
    
    # Request가 없거나 실패한 경우 설정된 API_BASE_URL 사용
    return f"{API_BASE_URL}{file_url}"

async def create_summarize_prompt(user_prompt: str) -> str:
    logger.info(f"user_prompt: {user_prompt}")
    """
    Ollama를 사용하여 요약 프롬프트 생성
    
    Args:
        user_prompt: 사용자가 입력한 프롬프트
    
    Returns:
        생성된 요약 프롬프트 (Ollama 실패 시 기본 프롬프트 반환)
    """
    try:
        # Ollama API 호출을 위한 프롬프트 구성
        ollama_prompt = f"""User question: "{user_prompt}"

Base prompt format (for reference):
"{DEFAULT_SUMMARIZE_PROMPT}"

Task:
Create a new video summarization prompt that maintains the structure, style, and format of the base prompt while reflecting the topic and content of the user's question."""
        
        # Ollama API 호출 (aiohttp 사용)
        session = await get_session()
        ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": """You are a prompt generator. Your task is to transform user questions into video summarization prompts.

ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:

OUTPUT FORMAT:
• Output ONLY the prompt text itself - nothing else.
• Start directly with the prompt text. No introductory phrases like "Here is...", "Sure", "The prompt is...", or "Here's the prompt:".
• Do NOT include any preface, explanation, quotes, examples, samples, or timestamps.
• Do NOT add example outputs like "00:05:00, 00:06:00 A person is seen..." or any timestamp examples.
• The output must be a complete, usable prompt that can be directly used for video summarization.

PROMPT STRUCTURE:
• Maintain the ENTIRE structure, tone, and English style of the base prompt exactly as it is.
• Include essential elements from the base prompt:
  - Role definition parts like "You are a video monitoring system"
  - Timestamp-related instructions (including start time and end time)
• Follow the base prompt's format precisely.

CONTENT INTEGRATION:
• Naturally integrate the core topic and requirements of the user's question into the prompt.
• Ensure the generated prompt reflects the user's intent while preserving the base prompt's framework."""
                },
                {
                    "role": "user",
                    "content": ollama_prompt
                }
            ],
            "stream": False,
            "options": {
                "temperature": 0.4, 
                "num_predict": 1000
            }
        }
        
        async with session.post(
            ollama_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=OLLAMA_TIMEOUT)
        ) as ollama_response:
            if ollama_response.status == 200:
                ollama_data = await ollama_response.json()
                generated_prompt = ollama_data.get("message", {}).get("content", "")
                if generated_prompt:
                    generated_prompt = generated_prompt.strip()
                    logger.info(f"Ollama를 사용하여 요약 프롬프트 생성 성공: {generated_prompt}")
                    return generated_prompt
                else:
                    logger.warning("Ollama 응답에 content가 없습니다. 기본 프롬프트 사용")
            else:
                error_text = await ollama_response.text()
                logger.warning(f"Ollama API 호출 실패 (HTTP {ollama_response.status}): {error_text}")
    except aiohttp.ClientConnectorError as e:
        logger.warning(f"Ollama 서버에 연결할 수 없습니다: {e}")
        logger.info("Ollama가 실행 중인지 확인하세요: ollama serve")
    except Exception as e:
        logger.warning(f"Ollama를 사용한 프롬프트 생성 중 오류 발생: {e}")
    
    # Ollama 실패 시 기본 프롬프트와 사용자 프롬프트 결합
    return f"{DEFAULT_SUMMARIZE_PROMPT}\n\n사용자 요청: {user_prompt}"

async def build_query_prompt(prompt: str) -> str:
    """
    Ollama를 사용하여 프롬프트를 영어로 번역
    
    Args:
        prompt: 사용자가 입력한 프롬프트
    
    Returns:
        영어로 번역된 프롬프트 (실패 시 원본 반환)
    """
    try:
        # Ollama API 호출을 위한 프롬프트 구성 (영어로 번역)
        ollama_prompt = f"Translate the following text to English. Output ONLY the translation without any explanation:\n\n{prompt}\n\nTranslation:"
        
        # Ollama API 호출 (aiohttp 사용) - 번역 전용 모델 사용
        session = await get_session()
        ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
        # 번역 전용 모델 사용 (hy-mt15-translation)
        translation_model = OLLAMA_TRANSLATION_MODEL
        payload = {
            "model": translation_model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a translation machine. Your ONLY output must be the translated text. Never include phrases like 'Sure,', 'Here is the translation', 'Translation:', 'Please', or any explanations. Never add quotation marks. Do not add 'Please' or any polite phrases. Output the translation directly without any preamble or postamble."
                },
                {
                    "role": "user",
                    "content": ollama_prompt
                }
            ],
            "stream": False,
            "options": {
                "temperature": 0.0,  # 번역은 정확성이 중요하므로 낮은 temperature
                "num_predict": 1000  # 충분한 토큰 수 제공
            }
        }
        
        async with session.post(
            ollama_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=OLLAMA_TIMEOUT)
        ) as ollama_response:
            if ollama_response.status == 200:
                ollama_data = await ollama_response.json()
                translated_prompt = ollama_data.get("message", {}).get("content", "")
                if translated_prompt:
                    translated_prompt = translated_prompt.strip()
                    # 혹시 모를 경우를 대비한 최소한의 정리 (system prompt가 강화되었으므로 대부분 불필요하지만 안전장치)
                    import re
                    # 앞뒤 따옴표 제거 (큰따옴표, 작은따옴표, 유니코드 따옴표 등)
                    translated_prompt = re.sub(r'^["\'"\u201C\u201D\u2018\u2019]+|["\'"\u201C\u201D\u2018\u2019]+$', '', translated_prompt)
                    # 혹시 설명이 포함된 경우 첫 줄 제거 (줄바꿈이 있는 경우)
                    lines = translated_prompt.split('\n')
                    if len(lines) > 1:
                        first_line_lower = lines[0].lower().strip()
                        # 설명 패턴이 첫 줄에 있으면 제거
                        if any(keyword in first_line_lower for keyword in ['sure', 'here is', 'translation', '번역']):
                            translated_prompt = '\n'.join(lines[1:]).strip()
                    translated_prompt = translated_prompt.strip()
                    
                    # "please" 제거 (대소문자 구분 없이, 단어 경계 고려)
                    # 문장 시작, 끝, 중간에 있는 "please" 모두 제거
                    translated_prompt = re.sub(r'\b[Pp]lease\b\s*', '', translated_prompt, flags=re.IGNORECASE)
                    # 연속된 공백 정리
                    translated_prompt = re.sub(r'\s+', ' ', translated_prompt)
                    translated_prompt = translated_prompt.strip()
                    
                    logger.info("Ollama를 사용하여 프롬프트 영어 번역 성공")
                    return f"{translated_prompt}"
                else:
                    logger.warning("Ollama 응답에 content가 없습니다. 원본 프롬프트 사용")
            else:
                error_text = await ollama_response.text()
                logger.warning(f"Ollama API 호출 실패 (HTTP {ollama_response.status}): {error_text}")
    except aiohttp.ClientConnectorError as e:
        logger.warning(f"Ollama 서버에 연결할 수 없습니다: {e}")
        logger.info("Ollama가 실행 중인지 확인하세요: ollama serve")
    except Exception as e:
        logger.warning(f"Ollama를 사용한 프롬프트 번역 중 오류 발생: {e}")
    
    # 번역 실패한 경우 원본 프롬프트 반환
    return f"{prompt}"


async def translate_to_korean(text: str) -> str:
    """
    Ollama를 사용하여 텍스트를 한국어로 번역
    
    Args:
        text: 번역할 텍스트 (영어 또는 다른 언어)
    
    Returns:
        한국어로 번역된 텍스트 (실패 시 원본 반환)
    """

    try:
        logger.info(f"번역할 문장: {text}")
        # Ollama API 호출을 위한 프롬프트 구성
        ollama_prompt = f"Translate the following text to Korean. Output ONLY the translation without any explanation:\n\n{text}\n\nTranslation:"
        
        # Ollama API 호출 (aiohttp 사용) - 번역 전용 모델 사용
        session = await get_session()
        ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
        # 번역 전용 모델 사용 (hy-mt15-translation)
        translation_model = OLLAMA_TRANSLATION_MODEL
        payload = {
            "model": translation_model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a translation machine. Your ONLY output must be the translated text. Never include phrases like 'Sure,', 'Here is the translation', 'Translation:', or any explanations. Never add quotation marks. Output the translation directly without any preamble or postamble."
                },
                {
                    "role": "user",
                    "content": ollama_prompt
                }
            ],
            "stream": False,
            "options": {
                "temperature": 0.0,  # 번역은 정확성이 중요하므로 낮은 temperature
                "num_predict": -1  # 최대값: 모델의 컨텍스트 윈도우 크기만큼 생성 (무제한)
            }
        }
        
        async with session.post(
            ollama_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=OLLAMA_TIMEOUT)
        ) as ollama_response:
            if ollama_response.status == 200:
                ollama_data = await ollama_response.json()
                translated_text = ollama_data.get("message", {}).get("content", "")
                if translated_text:
                    translated_text = translated_text.strip()
                    # 혹시 모를 경우를 대비한 최소한의 정리 (system prompt가 강화되었으므로 대부분 불필요하지만 안전장치)
                    import re
                    # 앞뒤 따옴표 제거 (큰따옴표, 작은따옴표, 유니코드 따옴표 등)
                    translated_text = re.sub(r'^["\'"\u201C\u201D\u2018\u2019]+|["\'"\u201C\u201D\u2018\u2019]+$', '', translated_text)
                    
                    # 번역 결과에서 불필요한 헤더나 설명 제거
                    lines = translated_text.split('\n')
                    cleaned_lines = []
                    skip_until_content = False
                    
                    for i, line in enumerate(lines):
                        line_lower = line.lower().strip()
                        # 설명 패턴이 포함된 줄 제거
                        if any(keyword in line_lower for keyword in ['sure', 'here is', 'translation:', '번역:', '**번역**', '**번역:**']):
                            skip_until_content = True
                            continue
                        # 마크다운 헤더 패턴 제거 (예: **번역:**, ## 번역 등)
                        if re.match(r'^[*#\s]*번역\s*[:：]*\s*[*#]*$', line_lower):
                            skip_until_content = True
                            continue
                        # 빈 줄이 연속으로 나오면 스킵 모드 해제
                        if not line.strip() and skip_until_content:
                            continue
                        # 실제 내용이 시작되면 스킵 모드 해제
                        if line.strip() and skip_until_content:
                            skip_until_content = False
                        
                        # 스킵 모드가 아니면 라인 추가
                        if not skip_until_content:
                            cleaned_lines.append(line)
                    
                    translated_text = '\n'.join(cleaned_lines).strip()
                    
                    # 원본 텍스트의 시작 부분이 번역 결과에 포함되어 있는지 확인 및 제거
                    # 원본 텍스트의 첫 50자 정도가 번역 결과에 포함되어 있으면 제거
                    if len(text) > 0:
                        original_start = text[:50].strip()
                        if original_start and original_start in translated_text:
                            # 원본 텍스트 시작 부분이 포함된 위치 찾기
                            idx = translated_text.find(original_start)
                            if idx >= 0:
                                # 원본 텍스트 부분 제거
                                translated_text = translated_text[:idx].strip()
                    
                    translated_text = translated_text.strip()
                    logger.info(f"Ollama를 사용하여 한국어 번역 성공 {translated_text[:200]}...")  # 로그 길이 제한
                    return translated_text
                else:
                    logger.warning("Ollama 응답에 content가 없습니다. 원본 텍스트 사용")
            else:
                error_text = await ollama_response.text()
                logger.warning(f"Ollama API 호출 실패 (HTTP {ollama_response.status}): {error_text}")
    except aiohttp.ClientConnectorError as e:
        logger.warning(f"Ollama 서버에 연결할 수 없습니다: {e}")
        logger.info("Ollama가 실행 중인지 확인하세요: ollama serve")
    except Exception as e:
        logger.warning(f"Ollama를 사용한 한국어 번역 중 오류 발생: {e}")
    
    # 번역 실패한 경우 원본 텍스트 반환
    return text


async def summarize_sentences(sentences: list) -> str:
    """
    여러 문장을 LLM을 사용하여 한 문장으로 요약
    
    Args:
        sentences: 요약할 문장 리스트
    
    Returns:
        요약된 한 문장 (실패 시 공백으로 합친 문장 반환)
    """
    if not sentences:
        return ""
    
    # 문장이 하나면 그대로 반환
    if len(sentences) == 1:
        return sentences[0]
    
    # 빈 문장 제거
    filtered_sentences = [s.strip() for s in sentences if s.strip()]
    if not filtered_sentences:
        return ""
    
    # 문장이 하나면 그대로 반환
    if len(filtered_sentences) == 1:
        return filtered_sentences[0]
    
    try:
        # 문장들을 하나의 텍스트로 합치기
        combined_text = " ".join(filtered_sentences)
        
        # 입력 언어 감지 (간단한 휴리스틱: 한글이 포함되어 있으면 한국어로 간주)
        has_korean = any('\uAC00' <= char <= '\uD7A3' for char in combined_text)
        
        # Ollama API 호출을 위한 프롬프트 구성 (입력 언어에 맞춰 작성)
        if has_korean:
            ollama_prompt = f"""
다음 문장들을 자연스럽게 하나의 문장으로 합쳐주세요. 입력 언어(한국어)를 그대로 유지해주세요.

문장들:
{combined_text}

요약된 하나의 문장만 출력해주세요. 설명이나 추가 텍스트는 포함하지 마세요."""
            
            system_prompt = "당신은 텍스트 요약 전문가입니다. 여러 문장을 하나의 자연스러운 문장으로 합치는 것이 당신의 임무입니다. 입력된 언어를 그대로 유지하여 요약된 문장만 출력하세요. 설명, 지시사항, 추가 내용은 포함하지 마세요."
        else:
            ollama_prompt = f"""
{combined_text}
summarize the sentences into one concise sentence"""
            
            system_prompt = "You are a text summarizer. Your task is to combine multiple sentences into one concise sentence. Output ONLY the summarized sentence without any explanations, instructions, or additional content. Do not include any text other than the summary result. Maintain the same language as the input."
        
        # Ollama API 호출 (aiohttp 사용)
        session = await get_session()
        ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": ollama_prompt
                }
            ],
            "stream": False,
            "options": {
                "temperature": 0.3,  # 요약은 적당한 창의성 필요
                "num_predict": 500  # 요약은 적은 토큰 수로 충분
            }
        }
        
        async with session.post(
            ollama_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=OLLAMA_TIMEOUT)
        ) as ollama_response:
            if ollama_response.status == 200:
                ollama_data = await ollama_response.json()
                summarized_text = ollama_data.get("message", {}).get("content", "")
                if summarized_text:
                    summarized_text = summarized_text.strip()
                    # 따옴표 제거
                    import re
                    summarized_text = re.sub(r'^["\'"\u201C\u201D\u2018\u2019]+|["\'"\u201C\u201D\u2018\u2019]+$', '', summarized_text)
                    summarized_text = summarized_text.strip()
                    logger.info(f"문장 요약 성공: {len(filtered_sentences)}개 문장 -> 1개 문장")
                    return summarized_text
                else:
                    logger.warning("Ollama 응답에 content가 없습니다. 원본 문장 합침")
            else:
                error_text = await ollama_response.text()
                logger.warning(f"Ollama API 호출 실패 (HTTP {ollama_response.status}): {error_text}")
    except aiohttp.ClientConnectorError as e:
        logger.warning(f"Ollama 서버에 연결할 수 없습니다: {e}")
        logger.info("Ollama가 실행 중인지 확인하세요: ollama serve")
    except Exception as e:
        logger.warning(f"Ollama를 사용한 문장 요약 중 오류 발생: {e}")
    
    # 요약 실패한 경우 공백으로 합친 문장 반환
    return " ".join(filtered_sentences)


# CHUNK_SIZES 정의 (튜플 리스트 형식: (label, value))
CHUNK_SIZES = [
    ("0초", 0),
    ("5초", 5),
    ("10초", 10),
    ("20초", 20),
    ("30초", 30),
    ("60초", 60),
    ("120초", 120),
    ("300초", 300),
    ("600초", 600),
    ("1200초", 1200),
    ("1800초", 1800),
]


def get_closest_chunk_size(CHUNK_SIZES, x):
    """
    Returns the integer value from CHUNK_SIZES that is closest to x.

    Args:
        CHUNK_SIZES (list of tuples): A list of tuples containing chunk size labels and values.
        x (int): The target value to find the closest chunk size to.

    Returns:
        int: The integer value from CHUNK_SIZES that is closest to x.
    """
    _, values = zip(*CHUNK_SIZES)  # extract just the values from CHUNK_SIZES
    closest_value = min(values, key=lambda v: abs(v - x))  # find the value closest to x
    return closest_value


async def get_recommended_chunk_size(video_length):
    """동영상 길이에 따른 추천 chunk_size 계산"""
    # In seconds:
    target_response_time = DEFAULT_VIA_TARGET_RESPONSE_TIME
    usecase_event_duration = DEFAULT_VIA_TARGET_USECASE_EVENT_DURATION
    recommended_chunk_size = 0

    session = await get_session()
    async with session.post(
        f"{VIA_SERVER_URL}/recommended_config",
        json={
            "video_length": int(video_length),
            "target_response_time": int(target_response_time),
            "usecase_event_duration": int(usecase_event_duration),
        },
        timeout=aiohttp.ClientTimeout(total=VIA_MODEL_TIMEOUT)
    ) as response:
        if response.status < 400:
            # Success response from API:
            resp_json = await response.json()
            recommended_chunk_size = int(resp_json.get("chunk_size", 0))
        if recommended_chunk_size == 0:
            # API fail to provide non-zero chunk size
            # Choose the largest chunk-size in favor of quick VIA execution
            recommended_chunk_size = video_length
        return get_closest_chunk_size(CHUNK_SIZES, recommended_chunk_size)

async def check_video_type(file: UploadFile) -> bool:
    """동영상 파일 타입 확인"""
    if file.content_type.startswith('video/'):
        return False
    else:
        return True


def build_summarize_params(
    image_mode: bool,
    video_id: Union[str, List[str]],
    chunk_duration: int,
    model: str,
    prompt: str = DEFAULT_SUMMARIZE_PROMPT,
    cs_prompt: str = DEFAULT_CAPTION_SUMMARIZATION_PROMPT,
    sa_prompt: str = DEFAULT_SUMMARY_AGGREGATION_PROMPT,
    num_frames_per_chunk: Optional[int] = DEFAULT_NUM_FRAMES_PER_CHUNK,
    frame_width: int = DEFAULT_FRAME_WIDTH,
    frame_height: int = DEFAULT_FRAME_HEIGHT,
    top_k: int = DEFAULT_TOP_K,
    top_p: float = DEFAULT_TOP_P,
    temperature: float = DEFAULT_TEMPERATURE,
    max_new_tokens: int = DEFAULT_MAX_TOKENS,
    seed: int = DEFAULT_SEED,
    batch_size: int = DEFAULT_BATCH_SIZE,
    rag_batch_size: int = DEFAULT_RAG_BATCH_SIZE,
    rag_top_k: int = DEFAULT_RAG_TOP_K,
    summarize_top_p: float = DEFAULT_SUMMARIZE_TOP_P,
    summarize_temperature: float = DEFAULT_SUMMARIZE_TEMPERATURE,
    summarize_max_tokens: int = DEFAULT_SUMMARIZE_MAX_TOKENS,
    chat_top_p: float = DEFAULT_CHAT_TOP_P,
    chat_temperature: float = DEFAULT_CHAT_TEMPERATURE,
    chat_max_tokens: int = DEFAULT_CHAT_MAX_TOKENS,
    notification_top_p: float = DEFAULT_NOTIFICATION_TOP_P,
    notification_temperature: float = DEFAULT_NOTIFICATION_TEMPERATURE,
    notification_max_tokens: int = DEFAULT_NOTIFICATION_MAX_TOKENS,
    enable_audio: bool = DEFAULT_ENABLE_AUDIO,
    enable_chat_history: bool = False
):
    """
    summarize_video 함수 호출을 위한 파라미터 튜플 생성
    
    Args:
        image_mode: 이미지 모드 여부 (True: 이미지, False: 비디오) - 참고용, 실제로는 사용되지 않음
        video_id: VIA 서버의 video_id (단일 문자열 또는 문자열 리스트)
                  - 단일 문자열: 단일 파일 요약
                  - 문자열 리스트: 멀티 이미지 요약 (이미지만 지원)
        chunk_duration: 청크 지속 시간
        model: 모델 ID
        num_frames_per_chunk: None이면 chunk_duration // 4로 자동 계산
        기타 파라미터: 기본값 사용 또는 커스텀 값 지정
    
    Returns:
        summarize_video 함수에 전달할 파라미터 튜플
    """

    # image_mode는 VIA 서버에서 지원하지 않으므로 제거 (파일 업로드 시 media_type으로 구분됨)
    # video_id는 단일 문자열 또는 리스트 모두 가능 (VIA 서버의 SummarizationQuery.id 필드가 Union[UUID, List[UUID]] 지원)
    return (
        video_id,
        prompt,
        cs_prompt,
        sa_prompt,
        chunk_duration,
        model,
        num_frames_per_chunk,
        frame_width,
        frame_height,
        top_k,
        top_p,
        temperature,
        max_new_tokens,
        seed,
        batch_size,
        rag_batch_size,
        rag_top_k,
        summarize_top_p,
        summarize_temperature,
        summarize_max_tokens,
        chat_top_p,
        chat_temperature,
        chat_max_tokens,
        notification_top_p,
        notification_temperature,
        notification_max_tokens,
        enable_audio,
        enable_chat_history
    )


def build_query_video_params(
    video_id: str,
    model: str,
    query: str,
    chunk_size: int,
    temperature: float = DEFAULT_QUERY_TEMPERATURE,
    seed: int = DEFAULT_QUERY_SEED,
    max_new_tokens: int = DEFAULT_QUERY_MAX_TOKENS,
    top_p: float = DEFAULT_QUERY_TOP_P,
    top_k: int = DEFAULT_QUERY_TOP_K
):
    """
    query_video 함수 호출을 위한 파라미터 튜플 생성
    
    Args:
        video_id: VIA 서버의 video_id
        model: 모델 ID
        query: 질문 텍스트
        chunk_size: 청크 크기
        temperature: 기본값 0.3
        seed: 기본값 42
        max_new_tokens: 기본값 1024 (VIA 서버 최대값)
        top_p: 기본값 1.0
        top_k: 기본값 80
    
    Returns:
        query_video 함수에 전달할 파라미터 튜플
    """
    return (
        video_id,
        model,
        chunk_size,
        temperature,
        seed,
        max_new_tokens,
        top_p,
        top_k,
        query
    )

