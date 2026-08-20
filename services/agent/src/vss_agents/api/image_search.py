"""Image-upload endpoint for object similarity search from the Chat UI."""

import logging
import os
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI
from fastapi import File
from fastapi import Form
from fastapi import HTTPException
from fastapi import UploadFile
from PIL import Image
from PIL import UnidentifiedImageError

from vss_agents.embed.rtvi_cv_embed import RTVICVEmbedClient
from vss_agents.tools.attribute_search import DEFAULT_BEHAVIOR_INDEX
from vss_agents.tools.attribute_search import enrich_attribute_results
from vss_agents.tools.attribute_search import search_by_attributes
from vss_agents.tools.vst.utils import get_name_to_stream_id_map
from vss_agents.utils.es_client import VSSESClient


logger = logging.getLogger(__name__)

_UPLOAD_DIR = Path(
    os.getenv(
        "IMAGE_SEARCH_DIR",
        "/image-search",
    )
)

_MAX_IMAGE_BYTES = 2 * 1024 * 1024


def _parse_sensor_ids(
    sensor_ids: str | None,
) -> list[str] | None:
    """Parse a comma-separated sensor ID list."""

    if not sensor_ids:
        return None

    parsed = [
        value.strip()
        for value in sensor_ids.split(",")
        if value.strip()
    ]

    return list(dict.fromkeys(parsed)) or None


def _resolve_behavior_sensor_ids(
    allowed_sensor_ids: list[str] | None,
    stream_id_to_name: dict[str, str],
) -> list[str] | None:
    """
    Convert VST stream UUIDs to the sensor names used by mdx-behavior.

    Unknown values are retained because callers may already provide sensor
    names instead of UUIDs.
    """

    if not allowed_sensor_ids:
        return None

    resolved = [
        stream_id_to_name.get(
            sensor_id,
            sensor_id,
        )
        for sensor_id in allowed_sensor_ids
    ]

    return list(dict.fromkeys(resolved)) or None


def register_image_search_route(
    app: FastAPI,
) -> None:
    """Register the cropped-image upload and similarity-search API."""

    @app.post("/api/v1/image-search")
    async def image_search(
        file: UploadFile = File(...),
        top_k: int = 10,
        min_similarity: float = Form(0.0),
        sensor_ids: str | None = Form(None),
    ) -> dict:
        content_type = (
            file.content_type or ""
        ).lower()

        if not content_type.startswith(
            "image/"
        ):
            raise HTTPException(
                status_code=415,
                detail=(
                    "Only image files are "
                    "supported"
                ),
            )

        payload = await file.read()

        if not payload:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded image is empty"
                ),
            )

        if len(payload) > _MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    "Uploaded image exceeds "
                    "the 2 MiB limit"
                ),
            )

        allowed_sensor_ids = (
            _parse_sensor_ids(
                sensor_ids
            )
        )

        image_path: Path | None = None
        embedding_client: (
            RTVICVEmbedClient | None
        ) = None

        try:
            try:
                _UPLOAD_DIR.mkdir(
                    parents=True,
                    exist_ok=True,
                )
            except PermissionError as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Image search directory "
                        "is not writable: "
                        f"{_UPLOAD_DIR}"
                    ),
                ) from exc
            except OSError as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to create image "
                        "search directory "
                        f"{_UPLOAD_DIR}: {exc}"
                    ),
                ) from exc

            image_path = (
                _UPLOAD_DIR
                / f"{uuid4().hex}.jpg"
            )

            try:
                with Image.open(
                    BytesIO(payload)
                ) as source:
                    rgb_image = (
                        source.convert("RGB")
                    )
            except (
                UnidentifiedImageError,
                ValueError,
            ) as exc:
                raise HTTPException(
                    status_code=415,
                    detail=(
                        "Unable to decode the "
                        "uploaded image"
                    ),
                ) from exc
            except OSError as exc:
                raise HTTPException(
                    status_code=415,
                    detail=(
                        "Unable to read the "
                        f"uploaded image: {exc}"
                    ),
                ) from exc

            try:
                rgb_image.save(
                    image_path,
                    format="JPEG",
                    quality=95,
                )
            except PermissionError as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Image search directory "
                        "is not writable: "
                        f"{_UPLOAD_DIR}"
                    ),
                ) from exc
            except OSError as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to save the "
                        f"uploaded image: {exc}"
                    ),
                ) from exc

            if (
                not image_path.exists()
                or image_path.stat().st_size
                == 0
            ):
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Normalized image file "
                        "was not created"
                    ),
                )

            rtvi_cv_host = os.getenv(
                "HOST_IP",
                "127.0.0.1",
            )

            rtvi_cv_port = os.getenv(
                "RTVI_CV_PORT",
                "9000",
            )

            rtvi_cv_endpoint = (
                f"http://{rtvi_cv_host}:"
                f"{rtvi_cv_port}"
            )

            es_endpoint = os.getenv(
                "ELASTIC_SEARCH_ENDPOINT",
                "http://127.0.0.1:9200",
            )

            vst_internal_url = os.getenv(
                "VST_INTERNAL_URL",
                "http://127.0.0.1:30888",
            )

            vst_external_url = os.getenv(
                "VST_EXTERNAL_URL",
                vst_internal_url,
            )

            logger.info(
                "Image search request: "
                "file_size=%d, "
                "content_type=%s, "
                "top_k=%d, "
                "min_similarity=%s, "
                "requested_sensor_ids=%s",
                len(payload),
                content_type,
                top_k,
                min_similarity,
                allowed_sensor_ids,
            )

            try:
                name_to_stream_id = (
                    await
                    get_name_to_stream_id_map(
                        vst_internal_url
                    )
                )
            except Exception as exc:
                logger.warning(
                    "Failed to resolve VST "
                    "sensor mappings: %s",
                    exc,
                    exc_info=True,
                )

                name_to_stream_id = {}

            stream_id_to_name = {
                stream_id: name
                for name, stream_id
                in name_to_stream_id.items()
            }

            behavior_sensor_ids = (
                _resolve_behavior_sensor_ids(
                    allowed_sensor_ids,
                    stream_id_to_name,
                )
            )

            logger.info(
                "Resolved image-search "
                "video sources: "
                "requested=%s, behavior=%s",
                allowed_sensor_ids,
                behavior_sensor_ids,
            )

            embedding_client = (
                RTVICVEmbedClient(
                    rtvi_cv_endpoint
                )
            )

            embedding = (
                await embedding_client
                .get_image_embedding(
                    str(image_path)
                )
            )

            if not embedding:
                raise RuntimeError(
                    "RTVI-CV returned an "
                    "empty image embedding"
                )

            logger.info(
                "Image embedding generated: "
                "dimensions=%d",
                len(embedding),
            )

            es = (
                await
                VSSESClient.get_es_client(
                    es_endpoint=es_endpoint,
                )
            )

            normalized_top_k = max(
                1,
                min(top_k, 100),
            )

            normalized_min_similarity = min(
                1.0,
                max(
                    0.0,
                    min_similarity,
                ),
            )

            results = (
                await search_by_attributes(
                    query_embedding=embedding,
                    index=(
                        DEFAULT_BEHAVIOR_INDEX
                    ),
                    es=es,
                    top_k=normalized_top_k,
                    min_similarity=(
                        normalized_min_similarity
                    ),
                    source_type=(
                        "video_file"
                    ),
                    video_sources=(
                        behavior_sensor_ids
                    ),
                )
            )

            logger.info(
                "Image similarity search "
                "matched %d result(s)",
                len(results),
            )

            await enrich_attribute_results(
                results,
                vst_internal_url,
                vst_external_url,
            )

            response_data = []

            for result in results:
                metadata = (
                    result.metadata
                )

                similarity = (
                    metadata.frame_score
                    if (
                        metadata.frame_score
                        is not None
                    )
                    else (
                        metadata
                        .behavior_score
                    )
                )

                response_data.append(
                    {
                        "video_name":
                            stream_id_to_name.get(
                                metadata.sensor_id,
                                (
                                    metadata
                                    .video_name
                                    or ""
                                ),
                            ),
                        "description": "",
                        "start_time":
                            (
                                metadata
                                .start_time
                                or metadata
                                .frame_timestamp
                            ),
                        "end_time":
                            (
                                metadata
                                .end_time
                                or metadata
                                .frame_timestamp
                            ),
                        "sensor_id":
                            metadata.sensor_id,
                        "screenshot_url":
                            (
                                result
                                .screenshot_url
                                or ""
                            ),
                        "similarity":
                            similarity,
                        "object_ids": [
                            metadata.object_id
                        ],
                        "matched_object_type":
                            (
                                metadata
                                .object_type
                            ),
                        "matched_object_bbox":
                            metadata.bbox,
                        "matched_object_timestamp":
                            (
                                metadata
                                .frame_timestamp
                            ),
                    }
                )

            return {
                "data": response_data,
                "total": len(
                    response_data
                ),
                "search_type":
                    "image_similarity",
            }

        except HTTPException:
            raise

        except Exception as exc:
            logger.error(
                "Image embedding search "
                "failed: %s",
                exc,
                exc_info=True,
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "Image embedding search "
                    f"failed: {exc}"
                ),
            ) from exc

        finally:
            if embedding_client is not None:
                try:
                    await (
                        embedding_client
                        .aclose()
                    )
                except Exception:
                    logger.warning(
                        "Failed to close image "
                        "embedding client",
                        exc_info=True,
                    )

            if image_path is not None:
                try:
                    image_path.unlink(
                        missing_ok=True,
                    )
                except OSError:
                    logger.warning(
                        "Failed to remove "
                        "temporary image: %s",
                        image_path,
                        exc_info=True,
                    )