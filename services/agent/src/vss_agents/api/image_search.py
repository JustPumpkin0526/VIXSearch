"""Image-upload endpoint for object similarity search from the Chat UI."""

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

_UPLOAD_DIR = Path("/image-search")
_MAX_IMAGE_BYTES = 2 * 1024 * 1024


def register_image_search_route(app: FastAPI) -> None:
    """Register the cropped-image upload and object-similarity search API."""

    @app.post("/api/v1/image-search")
    async def image_search(file: UploadFile = File(...), top_k: int = 10, min_similarity: float = Form(0.0), sensor_ids: str | None = Form(None)) -> dict:
        if not (file.content_type or "").startswith("image/"):
            raise HTTPException(status_code=415, detail="Only image files are supported")
        payload = await file.read()
        if not payload or len(payload) > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image must be between 1 byte and 2 MiB")

        allowed_sensor_ids = (
            [
                value.strip()
                for value in sensor_ids.split(",")
                if value.strip()
            ]
            if sensor_ids
            else None
        )

        _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        # DeepStream's Vision Encoder accepts JPEG (and PPM), not PNG/WebP.
        # Normalize every browser upload to RGB JPEG so pasted screenshots and
        # file attachments take the same reliable path.
        image_path = _UPLOAD_DIR / f"{uuid4().hex}.jpg"
        try:
            with Image.open(BytesIO(payload)) as source:
                source.convert("RGB").save(image_path, format="JPEG", quality=95)
        except (UnidentifiedImageError, OSError) as exc:
            raise HTTPException(status_code=415, detail="Unable to decode the uploaded image") from exc

        endpoint = f"http://{os.getenv('HOST_IP', '127.0.0.1')}:{os.getenv('RTVI_CV_PORT', '9000')}"
        es_endpoint = os.getenv("ELASTIC_SEARCH_ENDPOINT", "http://127.0.0.1:9200")
        try:
            embedding = await RTVICVEmbedClient(endpoint).get_image_embedding(str(image_path))
            es = await VSSESClient.get_es_client(es_endpoint=es_endpoint)
            results = await search_by_attributes(
                query_embedding=embedding,
                index=DEFAULT_BEHAVIOR_INDEX,
                es=es,
                top_k=max(
                    1,
                    min(top_k, 100),
                ),
                min_similarity=min(
                    1.0,
                    max(0.0, min_similarity),
                ),
                source_type="video_file",
                video_sources=allowed_sensor_ids,
            )
            await enrich_attribute_results(
                results,
                os.getenv("VST_INTERNAL_URL"),
                os.getenv("VST_EXTERNAL_URL"),
            )
            # enrich_attribute_results replaces the sensor name with the VST
            # stream UUID. Resolve it back for the UI's video-name column.
            name_to_stream_id = await get_name_to_stream_id_map(os.getenv("VST_INTERNAL_URL"))
            stream_id_to_name = {stream_id: name for name, stream_id in name_to_stream_id.items()}
            return {
                "data": [
                    {
                        "video_name": stream_id_to_name.get(
                            result.metadata.sensor_id, result.metadata.video_name or ""
                        ),
                        "description": "",
                        "start_time": result.metadata.start_time or result.metadata.frame_timestamp,
                        "end_time": result.metadata.end_time or result.metadata.frame_timestamp,
                        "sensor_id": result.metadata.sensor_id,
                        "screenshot_url": result.screenshot_url or "",
                        "similarity": result.metadata.frame_score or result.metadata.behavior_score,
                        "object_ids": [result.metadata.object_id],
                        # Preserve the source-frame geometry as the reliable
                        # visual identity of this similarity-search result.
                        # Tracker IDs alone can be reused across object types
                        # or adjacent indexed frames.
                        "matched_object_type": result.metadata.object_type,
                        "matched_object_bbox": result.metadata.bbox,
                        # Exact frame at which this object embedding was matched.
                        # Object IDs are tracker-local and must not be highlighted
                        # at arbitrary timestamps in the returned video clip.
                        "matched_object_timestamp": result.metadata.frame_timestamp,
                    }
                    for result in results
                ]
            }
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Image embedding search failed: {exc}") from exc
        finally:
            image_path.unlink(missing_ok=True)
