# SPDX-FileCopyrightText: Copyright (c) 2025-2026,
# NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

import base64
import binascii
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
import logging
import math
import re
import io
from typing import Any

from elasticsearch import NotFoundError as ESNotFoundError
from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig
from pydantic import BaseModel, Field, field_validator

from vss_agents.embed.cosmos_embed import CosmosEmbedClient
from vss_agents.tools.vst.snapshot import build_screenshot_url
from vss_agents.utils.es_client import VSSESClient
from vss_agents.utils.time_convert import datetime_to_iso8601
from vss_agents.utils.time_convert import iso8601_to_datetime
from vss_agents.utils.uuid_string import is_standard_uuid_string

try:  # Pillow is optional at runtime; provide clear error if cropping requested but not installed
    from PIL import Image
except Exception:  # pragma: no cover - defensive
    Image = None


logger = logging.getLogger(__name__)

BASE_2025 = datetime(2025, 1, 1, tzinfo=UTC)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

DATA_URI_PATTERN = re.compile(
    r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.*)$",
    re.DOTALL,
)

UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-"
    r"[0-9a-f]{4}-"
    r"[0-9a-f]{4}-"
    r"[0-9a-f]{4}-"
    r"[0-9a-f]{12}",
    re.IGNORECASE,
)


class ImageSearchConfig(
    FunctionBaseConfig,
    name="image_search",
):
    """Configuration for image similarity search."""

    cosmos_embed_endpoint: str = Field(
        ...,
        description="Cosmos Embed service base endpoint.",
    )

    es_endpoint: str = Field(
        ...,
        description="Elasticsearch endpoint.",
    )

    es_index: str = Field(
        default="video_embeddings",
        description="Elasticsearch index containing video embeddings.",
    )

    vst_external_url: str = Field(
        ...,
        description="External VST URL used to generate screenshot URLs.",
    )

    vst_internal_url: str | None = Field(
        default=None,
        description="Internal VST URL. Reserved for future use.",
    )

    embedding_field: str = Field(
        default="llm.visionEmbeddings.vector",
        description="Elasticsearch field containing vision embeddings.",
    )

    embedding_nested_path: str = Field(
        default="llm.visionEmbeddings",
        description="Nested Elasticsearch path containing vision embeddings.",
    )

    embedding_dimensions: int = Field(
        default=768,
        ge=1,
        description="Expected image embedding dimension.",
    )

    sensor_filter_field: str = Field(
        default="sensor.id.keyword",
        description="Elasticsearch field used for sensor access filtering.",
    )

    start_time_field: str = Field(
        default="start",
        description="Scene start-time field in Elasticsearch.",
    )

    end_time_field: str = Field(
        default="end",
        description="Scene end-time field in Elasticsearch.",
    )

    default_max_results: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Default number of image search results.",
    )

    default_num_candidates: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Default Elasticsearch KNN candidate count.",
    )

    maximum_knn_results: int = Field(
        default=200,
        ge=1,
        le=1000,
        description="Upper bound for Elasticsearch KNN k.",
    )

    maximum_num_candidates: int = Field(
        default=500,
        ge=1,
        le=5000,
        description="Upper bound for Elasticsearch num_candidates.",
    )

    max_image_size_bytes: int = Field(
        default=10 * 1024 * 1024,
        ge=1,
        description="Maximum decoded image size.",
    )

    require_sensor_ids: bool = Field(
        default=True,
        description=(
            "Reject searches without sensor IDs. This prevents a failure "
            "to resolve user permissions from becoming an unrestricted search."
        ),
    )


class ImageSearchInput(BaseModel):
    """Input for image similarity search."""

    image_base64: str = Field(
        ...,
        min_length=1,
        description=(
            "Base64-encoded image. A complete data URI such as "
            "'data:image/jpeg;base64,...' is also accepted."
        ),
    )

    content_type: str = Field(
        default="image/jpeg",
        description="Image MIME type.",
    )

    max_results: int | None = Field(
        default=None,
        ge=1,
        le=100,
        description="Maximum number of results.",
    )

    min_similarity: float | None = Field(
        default=None,
        ge=-1.0,
        le=1.0,
        description="Minimum cosine similarity from -1.0 to 1.0.",
    )

    sensor_ids: list[str] | None = Field(
        default=None,
        description="Allowed sensor or video stream IDs.",
    )

    start_time: str | None = Field(
        default=None,
        description="Search range start time in ISO 8601 format.",
    )

    end_time: str | None = Field(
        default=None,
        description="Search range end time in ISO 8601 format.",
    )

    bbox: list[float] | None = Field(
        default=None,
        description=(
            "Optional normalized bounding box to crop before embedding: "
            "[x, y, w, h] where values are in the 0..1 range."
        ),
    )

    cropped_image_base64: str | None = Field(
        default=None,
        description=(
            "Optional pre-cropped image base64 (data URI or raw base64). If provided, "
            "it is used directly instead of server-side cropping."
        ),
    )

    object_query: str | None = Field(
        default=None,
        description=(
            "Optional textual refinement for hybrid search (e.g. 'red car', 'two people')."
        ),
    )

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        normalized = value.lower().strip()

        if normalized not in ALLOWED_IMAGE_TYPES:
            raise ValueError(
                "Only image/jpeg, image/png and image/webp are supported."
            )

        return normalized

    @field_validator("sensor_ids")
    @classmethod
    def normalize_sensor_ids(
        cls,
        value: list[str] | None,
    ) -> list[str] | None:
        if value is None:
            return None

        normalized: list[str] = []
        seen: set[str] = set()

        for sensor_id in value:
            if not isinstance(sensor_id, str):
                continue

            cleaned = sensor_id.strip()

            if not cleaned or cleaned in seen:
                continue

            normalized.append(cleaned)
            seen.add(cleaned)

        return normalized


class ImageSearchResultItem(BaseModel):
    """A single image similarity search result."""

    video_name: str = Field(
        default="",
        description="Video filename or sensor name.",
    )

    description: str = Field(
        default="",
        description="Video or sensor description.",
    )

    start_time: str = Field(
        default="",
        description="Scene start time.",
    )

    end_time: str = Field(
        default="",
        description="Scene end time.",
    )

    sensor_id: str = Field(
        default="",
        description="VST stream UUID or sensor ID.",
    )

    screenshot_url: str = Field(
        default="",
        description="VST screenshot URL.",
    )

    similarity_score: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Cosine similarity score.",
    )


class ImageSearchOutput(BaseModel):
    """Output of image similarity search."""

    results: list[ImageSearchResultItem] = Field(
        default_factory=list,
        description="Image similarity search results.",
    )

    total: int = Field(
        default=0,
        ge=0,
        description="Number of returned results.",
    )

    search_type: str = Field(
        default="image_similarity",
        description="Search type.",
    )


def _detect_image_content_type(image_bytes: bytes) -> str | None:
    """Detect supported image MIME type from file signature."""

    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    if (
        len(image_bytes) >= 12
        and image_bytes[:4] == b"RIFF"
        and image_bytes[8:12] == b"WEBP"
    ):
        return "image/webp"

    return None


def _decode_image(
    image_base64: str,
    content_type: str,
) -> tuple[bytes, str]:
    """Decode plain base64 or a base64 image data URI."""

    encoded_data = image_base64.strip()
    declared_content_type = content_type.lower().strip()

    data_uri_match = DATA_URI_PATTERN.match(encoded_data)

    if data_uri_match:
        declared_content_type = data_uri_match.group(1).lower()
        encoded_data = data_uri_match.group(2)

    if declared_content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError(
            f"Unsupported declared image content type: {declared_content_type}"
        )

    # Accept base64 generated by command-line tools that may contain newlines.
    encoded_data = "".join(encoded_data.split())

    if not encoded_data:
        raise ValueError("Image base64 data is empty.")

    try:
        image_bytes = base64.b64decode(
            encoded_data,
            validate=True,
        )
    except (binascii.Error, ValueError, TypeError) as exc:
        raise ValueError("Invalid base64 image.") from exc

    if not image_bytes:
        raise ValueError("Decoded image is empty.")

    detected_content_type = _detect_image_content_type(image_bytes)

    if detected_content_type is None:
        raise ValueError(
            "The decoded file is not a supported JPEG, PNG or WEBP image."
        )

    if detected_content_type != declared_content_type:
        raise ValueError(
            "Image content type does not match the decoded file: "
            f"declared={declared_content_type}, "
            f"detected={detected_content_type}"
        )

    return image_bytes, detected_content_type


def _build_image_data_uri(
    image_bytes: bytes,
    content_type: str,
) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _crop_image_by_normalized_bbox(image_bytes: bytes, bbox: list[float]) -> tuple[bytes, str]:
    """Crop image bytes by normalized bbox [x, y, w, h] and return bytes and detected content type.

    Raises ValueError on invalid bbox. Raises RuntimeError when Pillow is not installed.
    """
    if Image is None:
        raise RuntimeError(
            "Server-side cropping requires Pillow. Install with 'pip install pillow'."
        )

    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        raise ValueError("bbox must be a list of four floats: [x, y, w, h].")

    try:
        x, y, w, h = [float(v) for v in bbox]
    except Exception as exc:
        raise ValueError("bbox values must be numeric.") from exc

    if not (0 <= x <= 1 and 0 <= y <= 1 and 0 <= w <= 1 and 0 <= h <= 1):
        raise ValueError("bbox values must be normalized in the 0..1 range.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            img_w, img_h = img.size

            left = int(round(x * img_w))
            top = int(round(y * img_h))
            right = int(round((x + w) * img_w))
            bottom = int(round((y + h) * img_h))

            # Clamp
            left = max(0, min(left, img_w - 1))
            top = max(0, min(top, img_h - 1))
            right = max(left + 1, min(right, img_w))
            bottom = max(top + 1, min(bottom, img_h))

            cropped = img.crop((left, top, right, bottom))

            buf = io.BytesIO()
            cropped.save(buf, format="JPEG")
            cropped_bytes = buf.getvalue()

            detected = _detect_image_content_type(cropped_bytes) or "image/jpeg"
            return cropped_bytes, detected
    except Exception as exc:
        raise RuntimeError("Failed to crop image on server.") from exc


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y

    if na <= 0 or nb <= 0:
        return 0.0

    return dot / (math.sqrt(na) * math.sqrt(nb))


def _parse_request_time(
    value: str | None,
    field_name: str,
) -> datetime | None:
    if value is None:
        return None

    try:
        return iso8601_to_datetime(value)
    except Exception as exc:
        raise ValueError(
            f"{field_name} must be a valid ISO 8601 datetime."
        ) from exc


def _validate_time_range(
    request: ImageSearchInput,
) -> None:
    start_time = _parse_request_time(
        request.start_time,
        "start_time",
    )
    end_time = _parse_request_time(
        request.end_time,
        "end_time",
    )

    if (
        start_time is not None
        and end_time is not None
        and start_time > end_time
    ):
        raise ValueError(
            "start_time must be earlier than or equal to end_time."
        )


def _build_filter_clauses(
    request: ImageSearchInput,
    config: ImageSearchConfig,
) -> list[dict[str, Any]]:
    """Build parent-document filters for the KNN search."""

    filters: list[dict[str, Any]] = []

    sensor_ids = request.sensor_ids or []

    if config.require_sensor_ids and not sensor_ids:
        raise ValueError(
            "No allowed sensor IDs were supplied. "
            "Image search was blocked to prevent unrestricted index access."
        )

    if sensor_ids:
        filters.append(
            {
                "terms": {
                    config.sensor_filter_field: sensor_ids,
                }
            }
        )

    # Scene overlap rule:
    # document.end >= requested start
    # document.start <= requested end
    if request.start_time:
        filters.append(
            {
                "range": {
                    config.end_time_field: {
                        "gte": request.start_time,
                    }
                }
            }
        )

    if request.end_time:
        filters.append(
            {
                "range": {
                    config.start_time_field: {
                        "lte": request.end_time,
                    }
                }
            }
        )

    return filters


def _validate_embedding(
    query_embedding: Any,
    expected_dimensions: int,
) -> list[float]:
    if not isinstance(query_embedding, (list, tuple)):
        raise ValueError(
            "Cosmos Embed returned an invalid embedding type."
        )

    if len(query_embedding) != expected_dimensions:
        raise ValueError(
            "Image embedding dimension mismatch: "
            f"expected={expected_dimensions}, "
            f"actual={len(query_embedding)}"
        )

    normalized_embedding: list[float] = []

    for index, value in enumerate(query_embedding):
        if not isinstance(value, (int, float)):
            raise ValueError(
                f"Image embedding contains a non-numeric value at index {index}."
            )

        numeric_value = float(value)

        if not math.isfinite(numeric_value):
            raise ValueError(
                f"Image embedding contains a non-finite value at index {index}."
            )

        normalized_embedding.append(numeric_value)

    return normalized_embedding


def _build_es_query(
    query_embedding: list[float],
    request: ImageSearchInput,
    config: ImageSearchConfig,
) -> dict[str, Any]:
    """Build a nested Elasticsearch KNN query."""

    max_results = (
        request.max_results
        or config.default_max_results
    )

    # Overfetch to compensate for post-filtering and invalid documents.
    k_value = min(
        max(max_results * 5, max_results),
        config.maximum_knn_results,
    )

    num_candidates = min(
        max(
            config.default_num_candidates,
            k_value * 2,
            k_value,
        ),
        config.maximum_num_candidates,
    )

    # Elasticsearch requires num_candidates >= k.
    if num_candidates < k_value:
        num_candidates = k_value

    knn_query: dict[str, Any] = {
        "field": config.embedding_field,
        "query_vector": query_embedding,
        "k": k_value,
        "num_candidates": num_candidates,
    }

    nested_query: dict[str, Any] = {
        "nested": {
            "path": config.embedding_nested_path,
            "score_mode": "max",
            "query": {
                "knn": knn_query,
            },
            "inner_hits": {
                "name": "best_vision_embedding",
                "size": 1,
                "_source": {
                    "excludes": [
                        config.embedding_field,
                    ]
                },
            },
        }
    }

    filters = _build_filter_clauses(
        request=request,
        config=config,
    )

    query: dict[str, Any]

    if filters:
        query = {
            "bool": {
                "must": [
                    nested_query,
                ],
                "filter": filters,
            }
        }
    else:
        query = nested_query

    return {
        "size": k_value,
        "track_total_hits": False,
        "query": query,
        "_source": {
            "excludes": [
                config.embedding_field,
            ]
        },
    }


def _extract_stream_id(
    source: dict[str, Any],
) -> str:
    sensor = source.get("sensor") or {}
    sensor_info = sensor.get("info") or {}
    info = source.get("info") or {}

    sensor_id = str(sensor.get("id") or "").strip()

    video_path = str(
        sensor_info.get("path")
        or sensor_info.get("url")
        or ""
    )

    possible_stream_ids = [
        sensor.get("stream_id"),
        sensor.get("streamId"),
        info.get("streamId"),
        info.get("sensorId"),
    ]

    for value in possible_stream_ids:
        candidate = str(value or "").strip()

        if (
            candidate
            and is_standard_uuid_string(candidate)
        ):
            return candidate

    uuid_match = UUID_PATTERN.search(video_path)

    if uuid_match:
        return uuid_match.group(0)

    return sensor_id


def _extract_video_name(
    source: dict[str, Any],
    stream_id: str,
) -> str:
    sensor = source.get("sensor") or {}
    sensor_info = sensor.get("info") or {}
    info = source.get("info") or {}

    explicit_name = (
        source.get("video_name")
        or source.get("videoName")
        or info.get("streamId")
    )

    if explicit_name:
        return str(explicit_name)

    video_path = str(
        sensor_info.get("path")
        or sensor_info.get("url")
        or ""
    ).strip()

    if video_path:
        return video_path.rstrip("/").split("/")[-1]

    sensor_id = str(sensor.get("id") or "").strip()

    return sensor_id or stream_id


def _normalize_time(
    value: Any,
    fallback: datetime = BASE_2025,
) -> str:
    if not value:
        return datetime_to_iso8601(fallback)

    try:
        parsed = iso8601_to_datetime(str(value))
        return datetime_to_iso8601(parsed)
    except Exception:
        logger.warning(
            "Failed to parse Elasticsearch timestamp: %s",
            value,
        )
        return str(value)


def _score_to_cosine_similarity(
    score: Any,
) -> float:
    try:
        normalized_score = float(score)
    except (TypeError, ValueError):
        normalized_score = 0.0

    # For indexed cosine dense_vector fields:
    # Elasticsearch score = (1 + cosine_similarity) / 2
    cosine_similarity = (2.0 * normalized_score) - 1.0

    # Protect the output model from small floating-point overflows.
    cosine_similarity = max(
        -1.0,
        min(1.0, cosine_similarity),
    )

    return round(cosine_similarity, 4)


def _process_search_hit(
    hit: dict[str, Any],
    config: ImageSearchConfig,
    minimum_similarity: float,
) -> ImageSearchResultItem | None:
    """Convert one Elasticsearch hit into an API result."""

    try:
        similarity_score = _score_to_cosine_similarity(
            hit.get("_score"),
        )

        if similarity_score < minimum_similarity:
            return None

        source = hit.get("_source") or {}
        sensor = source.get("sensor") or {}

        stream_id = _extract_stream_id(source)

        if not stream_id:
            logger.warning(
                "Skipping image search result without a usable stream ID: %s",
                hit.get("_id", "unknown"),
            )
            return None

        video_name = _extract_video_name(
            source=source,
            stream_id=stream_id,
        )

        description = str(
            sensor.get("description")
            or ""
        )

        # Use the actual scene start first.
        start_time = _normalize_time(
            source.get(config.start_time_field)
            or source.get("timestamp")
        )

        end_time = _normalize_time(
            source.get(config.end_time_field)
            or source.get(config.start_time_field)
            or source.get("timestamp")
        )

        screenshot_url = ""

        try:
            screenshot_url = build_screenshot_url(
                config.vst_external_url,
                stream_id,
                start_time,
            )
        except Exception:
            logger.exception(
                "Failed to build VST screenshot URL for stream %s.",
                stream_id,
            )

        return ImageSearchResultItem(
            video_name=video_name,
            description=description,
            start_time=start_time,
            end_time=end_time,
            sensor_id=stream_id,
            screenshot_url=screenshot_url,
            similarity_score=similarity_score,
        )

    except Exception:
        logger.exception(
            "Failed to process image search hit: %s",
            hit.get("_id", "unknown"),
        )
        return None


@register_function(
    config_type=ImageSearchConfig,
    framework_wrappers=[LLMFrameworkEnum.LANGCHAIN],
)
async def image_search(
    config: ImageSearchConfig,
    _builder: Builder,
) -> AsyncGenerator[FunctionInfo]:
    """Register image similarity search."""

    logger.info(
        "Initializing image search: index=%s, embedding_field=%s",
        config.es_index,
        config.embedding_field,
    )

    es = await VSSESClient.get_es_client(
        es_endpoint=config.es_endpoint,
    )

    embed_client = CosmosEmbedClient(
        config.cosmos_embed_endpoint,
    )

    async def _image_search(
        request: ImageSearchInput,
    ) -> ImageSearchOutput:
        """Search stored video scenes using an uploaded image.

        The uploaded image is embedded with Cosmos Embed and compared
        directly against vision embeddings stored in Elasticsearch.
        """

        _validate_time_range(request)

        # Determine image bytes to embed. Support three modes:
        # 1) `cropped_image_base64` provided by client -> use directly
        # 2) `bbox` provided -> server-side crop original `image_base64`
        # 3) fallback -> use full `image_base64`

        if request.cropped_image_base64:
            image_bytes, detected_content_type = _decode_image(
                image_base64=request.cropped_image_base64,
                content_type=request.content_type,
            )
        elif request.bbox is not None:
            # Decode original image, then crop server-side
            original_bytes, original_content_type = _decode_image(
                image_base64=request.image_base64,
                content_type=request.content_type,
            )

            image_bytes, detected_content_type = _crop_image_by_normalized_bbox(
                original_bytes,
                request.bbox,
            )
        else:
            image_bytes, detected_content_type = _decode_image(
                image_base64=request.image_base64,
                content_type=request.content_type,
            )

        if len(image_bytes) > config.max_image_size_bytes:
            raise ValueError(
                "Image exceeds maximum allowed size: "
                f"maximum={config.max_image_size_bytes} bytes, "
                f"actual={len(image_bytes)} bytes."
            )

        index_exists = bool(
            await es.indices.exists(
                index=config.es_index,
            )
        )

        if not index_exists:
            logger.warning(
                "Image search index '%s' does not exist.",
                config.es_index,
            )

            return ImageSearchOutput()

        image_data_uri = _build_image_data_uri(
            image_bytes=image_bytes,
            content_type=detected_content_type,
        )

        try:
            raw_embedding = (
                await embed_client.get_image_embedding(
                    image_data_uri,
                )
            )
        except Exception as exc:
            logger.exception(
                "Failed to generate image embedding."
            )
            raise RuntimeError(
                "Cosmos Embed failed to generate an image embedding."
            ) from exc

        query_embedding = _validate_embedding(
            query_embedding=raw_embedding,
            expected_dimensions=config.embedding_dimensions,
        )

        es_query = _build_es_query(
            query_embedding=query_embedding,
            request=request,
            config=config,
        )

        logger.debug(
            "Executing image search: index=%s, max_results=%s, sensor_count=%s",
            config.es_index,
            request.max_results or config.default_max_results,
            len(request.sensor_ids or []),
        )

        try:
            response = await es.search(
                index=config.es_index,
                body=es_query,
            )
        except ESNotFoundError:
            logger.warning(
                "Image search index '%s' was not found.",
                config.es_index,
            )
            return ImageSearchOutput()
        except Exception as exc:
            logger.exception(
                "Elasticsearch image similarity search failed."
            )
            raise RuntimeError(
                "Elasticsearch image similarity search failed."
            ) from exc

        hits_container = response.get("hits") or {}
        hits = hits_container.get("hits") or []

        if not isinstance(hits, list):
            logger.error(
                "Elasticsearch returned an invalid hits structure."
            )
            raise RuntimeError(
                "Elasticsearch returned an invalid search response."
            )

        minimum_similarity = (
            request.min_similarity
            if request.min_similarity is not None
            else -1.0
        )

        results: list[ImageSearchResultItem] = []

        for hit in hits:
            if not isinstance(hit, dict):
                continue

            result = _process_search_hit(
                hit=hit,
                config=config,
                minimum_similarity=minimum_similarity,
            )

            if result is not None:
                results.append(result)

        # Elasticsearch normally returns scores in descending order,
        # but sort explicitly after score conversion for predictable output.
        results.sort(
            key=lambda item: item.similarity_score,
            reverse=True,
        )

        max_results = (
            request.max_results
            or config.default_max_results
        )

        results = results[:max_results]

        # If the caller provided an object_query, perform a lightweight
        # hybrid re-ranking: compute a text embedding for the query and
        # compare it to candidate screenshot embeddings, then combine
        # with the image similarity score.
        if request.object_query:
            try:
                text_embedding = await embed_client.get_text_embedding(request.object_query)
            except Exception:
                logger.exception("Failed to generate text embedding for object_query")
                text_embedding = None

            if text_embedding is not None:
                alpha = 0.7
                reranked: list[ImageSearchResultItem] = []

                for item in results:
                    # Default to original score when anything fails
                    combined_score = item.similarity_score

                    if item.screenshot_url:
                        try:
                            candidate_emb = await embed_client.get_image_embedding(item.screenshot_url)
                            candidate_emb = _validate_embedding(
                                query_embedding=candidate_emb,
                                expected_dimensions=config.embedding_dimensions,
                            )

                            text_sim = _cosine_similarity(text_embedding, candidate_emb)

                            combined_score = (
                                (alpha * item.similarity_score) + ((1.0 - alpha) * text_sim)
                            )
                        except Exception:
                            logger.debug(
                                "Hybrid rerank: failed to embed candidate screenshot %s",
                                item.screenshot_url,
                            )

                    item.similarity_score = round(max(-1.0, min(1.0, combined_score)), 4)
                    reranked.append(item)

                reranked.sort(key=lambda it: it.similarity_score, reverse=True)
                results = reranked

        logger.info(
            "Image search returned %d result(s).",
            len(results),
        )

        return ImageSearchOutput(
            results=results,
            total=len(results),
        )

    try:
        yield FunctionInfo.create(
            single_fn=_image_search,
            description=_image_search.__doc__,
            input_schema=ImageSearchInput,
            single_output_schema=ImageSearchOutput,
        )
    finally:
        try:
            await embed_client.aclose()
        except Exception as exc:
            logger.warning(
                "Failed to close Cosmos Embed client: %s",
                exc,
            )
