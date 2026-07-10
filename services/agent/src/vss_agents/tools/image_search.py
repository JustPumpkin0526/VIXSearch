# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncGenerator
from datetime import UTC
from datetime import datetime
import logging
import re
from typing import Any

from elasticsearch import NotFoundError as ESNotFoundError
from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig
from pydantic import BaseModel
from pydantic import Field
from pydantic import field_validator

from vss_agents.embed.cosmos_embed import CosmosEmbedClient
from vss_agents.tools.vst.snapshot import build_screenshot_url
from vss_agents.utils.es_client import VSSESClient
from vss_agents.utils.time_convert import datetime_to_iso8601
from vss_agents.utils.time_convert import iso8601_to_datetime
from vss_agents.utils.uuid_string import is_standard_uuid_string

logger = logging.getLogger(__name__)

BASE_2025 = datetime(2025, 1, 1, tzinfo=UTC)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


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
        description="Internal VST URL. Reserved for future validation.",
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
        description="Expected image embedding dimension.",
    )

    default_max_results: int = Field(
        default=10,
        ge=1,
        le=1000,
        description="Default number of image search results.",
    )

    default_num_candidates: int = Field(
        default=100,
        ge=1,
        description="Default Elasticsearch KNN candidate count.",
    )

    max_image_size_bytes: int = Field(
        default=10 * 1024 * 1024,
        ge=1,
        description="Maximum decoded image size.",
    )


class ImageSearchInput(BaseModel):
    """Input for image similarity search."""

    image_base64: str = Field(
        ...,
        min_length=1,
        description=(
            "Base64-encoded image. A full data URI such as "
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
        description="Minimum cosine similarity in the range -1.0 to 1.0.",
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

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        normalized = value.lower().strip()

        if normalized not in ALLOWED_IMAGE_TYPES:
            raise ValueError(
                "Only image/jpeg, image/png and image/webp are supported."
            )

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
        description="VST stream UUID.",
    )

    screenshot_url: str = Field(
        default="",
        description="VST screenshot URL.",
    )

    similarity_score: float = Field(
        default=0.0,
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
        description="Number of returned results.",
    )

    search_type: str = Field(
        default="image_similarity",
        description="Search type.",
    )


def _decode_image(
    image_base64: str,
    content_type: str,
) -> tuple[bytes, str]:
    """Decode plain base64 or a base64 data URI."""

    encoded_data = image_base64.strip()
    detected_content_type = content_type

    if encoded_data.startswith("data:image/"):
        try:
            header, encoded_data = encoded_data.split(",", 1)
        except ValueError as exc:
            raise ValueError("Invalid image data URI.") from exc

        mime_section = header.split(";", 1)[0]
        detected_content_type = mime_section.removeprefix("data:")

    try:
        image_bytes = base64.b64decode(
            encoded_data,
            validate=True,
        )
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid base64 image.") from exc

    return image_bytes, detected_content_type


def _build_image_data_uri(
    image_bytes: bytes,
    content_type: str,
) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _build_filter_clauses(
    request: ImageSearchInput,
) -> list[dict[str, Any]]:
    filters: list[dict[str, Any]] = []

    if request.sensor_ids:
        sensor_ids = [
            sensor_id.strip()
            for sensor_id in request.sensor_ids
            if sensor_id and sensor_id.strip()
        ]

        if sensor_ids:
            filters.append(
                {
                    "terms": {
                        "sensor.id.keyword": sensor_ids,
                    }
                }
            )

    # Return scenes overlapping the requested range:
    # document start <= requested end
    # document end >= requested start
    if request.start_time:
        filters.append(
            {
                "range": {
                    "end": {
                        "gte": request.start_time,
                    }
                }
            }
        )

    if request.end_time:
        filters.append(
            {
                "range": {
                    "timestamp": {
                        "lte": request.end_time,
                    }
                }
            }
        )

    return filters


def _build_es_query(
    query_embedding: list[float],
    request: ImageSearchInput,
    config: ImageSearchConfig,
) -> dict[str, Any]:
    """Build a nested Elasticsearch KNN query."""

    if len(query_embedding) != config.embedding_dimensions:
        raise ValueError(
            "Image embedding dimension mismatch: "
            f"expected={config.embedding_dimensions}, "
            f"actual={len(query_embedding)}"
        )

    max_results = request.max_results or config.default_max_results

    # Overfetch because similarity filtering and invalid documents may
    # remove results during post-processing.
    k_value = max_results * 5

    num_candidates = max(
        config.default_num_candidates,
        k_value * 2,
    )

    knn_query: dict[str, Any] = {
        "field": config.embedding_field,
        "query_vector": query_embedding,
        "k": k_value,
        "num_candidates": num_candidates,
    }

    nested_query: dict[str, Any] = {
        "nested": {
            "path": config.embedding_nested_path,
            "query": {
                "knn": knn_query,
            },
            "inner_hits": {
                "size": 1,
                "_source": {
                    "excludes": [
                        config.embedding_field,
                    ]
                },
            },
        }
    }

    filters = _build_filter_clauses(request)

    if filters:
        query_body: dict[str, Any] = {
            "query": {
                "bool": {
                    "must": [
                        nested_query,
                    ],
                    "filter": filters,
                }
            },
            "size": k_value,
        }
    else:
        query_body = {
            "query": nested_query,
            "size": k_value,
        }

    query_body["_source"] = {
        "excludes": [
            config.embedding_field,
        ]
    }

    return query_body


def _extract_stream_id(
    source: dict[str, Any],
) -> str:
    sensor = source.get("sensor", {}) or {}
    sensor_info = sensor.get("info", {}) or {}
    info = source.get("info", {}) or {}

    sensor_id = str(sensor.get("id", "") or "")
    video_path = str(
        sensor_info.get("path", "")
        or sensor_info.get("url", "")
        or ""
    )

    possible_stream_ids = [
        sensor.get("stream_id"),
        info.get("streamId"),
        info.get("sensorId"),
    ]

    for value in possible_stream_ids:
        if value and is_standard_uuid_string(str(value)):
            return str(value)

    uuid_pattern = (
        r"[0-9a-f]{8}-"
        r"[0-9a-f]{4}-"
        r"[0-9a-f]{4}-"
        r"[0-9a-f]{4}-"
        r"[0-9a-f]{12}"
    )

    uuid_match = re.search(
        uuid_pattern,
        video_path,
        re.IGNORECASE,
    )

    if uuid_match:
        return uuid_match.group(0)

    if sensor_id:
        return sensor_id

    return ""


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


async def _process_search_hit(
    hit: dict[str, Any],
    config: ImageSearchConfig,
    minimum_similarity: float,
) -> ImageSearchResultItem | None:
    try:
        # Elasticsearch cosine KNN score is normalized:
        # score = (1 + cosine_similarity) / 2
        similarity_score = round(
            (2.0 * float(hit.get("_score", 0.0))) - 1.0,
            4,
        )

        if similarity_score < minimum_similarity:
            return None

        source = hit.get("_source", {}) or {}
        sensor = source.get("sensor", {}) or {}
        sensor_info = sensor.get("info", {}) or {}

        if "llm" not in source:
            logger.warning(
                "Skipping result without llm field: %s",
                hit.get("_id", "unknown"),
            )
            return None

        sensor_id_raw = str(sensor.get("id", "") or "")
        stream_id = _extract_stream_id(source)

        video_path = str(
            sensor_info.get("path", "")
            or sensor_info.get("url", "")
            or ""
        )

        if video_path:
            video_name = video_path.rstrip("/").split("/")[-1]
        else:
            video_name = sensor_id_raw or stream_id

        description = str(
            sensor.get("description", "")
            or ""
        )

        # Existing embed_search.py uses timestamp as the result start time
        # and end as the result end time.
        start_time = _normalize_time(
            source.get("timestamp")
            or source.get("start")
        )

        end_time = _normalize_time(
            source.get("end")
            or source.get("timestamp")
            or source.get("start")
        )

        screenshot_url = ""

        if stream_id:
            screenshot_url = build_screenshot_url(
                config.vst_external_url,
                stream_id,
                start_time,
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

    logger.info("Image search config: %s", config)

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

        The image is embedded with Cosmos Embed and compared directly
        against vision embeddings stored in Elasticsearch.

        Input:
        - image_base64: Required base64 image or image data URI.
        - content_type: image/jpeg, image/png or image/webp.
        - max_results: Maximum result count.
        - min_similarity: Minimum cosine similarity from -1.0 to 1.0.
        - sensor_ids: Optional list of allowed sensor IDs.
        - start_time: Optional ISO 8601 search start.
        - end_time: Optional ISO 8601 search end.
        """

        image_bytes, detected_content_type = _decode_image(
            request.image_base64,
            request.content_type,
        )

        if not image_bytes:
            raise ValueError("Uploaded image is empty.")

        if len(image_bytes) > config.max_image_size_bytes:
            raise ValueError(
                "Image exceeds maximum allowed size: "
                f"{config.max_image_size_bytes} bytes."
            )

        if detected_content_type not in ALLOWED_IMAGE_TYPES:
            raise ValueError(
                f"Unsupported image content type: {detected_content_type}"
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

            return ImageSearchOutput(
                results=[],
                total=0,
            )

        image_data_uri = _build_image_data_uri(
            image_bytes,
            detected_content_type,
        )

        query_embedding = await embed_client.get_image_embedding(
            image_data_uri,
        )

        es_query = _build_es_query(
            query_embedding=query_embedding,
            request=request,
            config=config,
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

            return ImageSearchOutput(
                results=[],
                total=0,
            )

        hits = response["hits"]["hits"]

        minimum_similarity = (
            request.min_similarity
            if request.min_similarity is not None
            else -1.0
        )

        tasks = [
            _process_search_hit(
                hit=hit,
                config=config,
                minimum_similarity=minimum_similarity,
            )
            for hit in hits
        ]

        processed_results = await asyncio.gather(*tasks)

        results = [
            result
            for result in processed_results
            if result is not None
        ]

        max_results = (
            request.max_results
            or config.default_max_results
        )

        results = results[:max_results]

        logger.info(
            "Image search returned %d results.",
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