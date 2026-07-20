# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES.
# SPDX-License-Identifier: Apache-2.0

import logging
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi import HTTPException
from pydantic import BaseModel
from pydantic import Field
import base64
import io
try:
    from PIL import Image
except Exception:
    Image = None

logger = logging.getLogger(__name__)


class ImageDetectRequest(BaseModel):
    image_base64: str = Field(..., description="Image data URI or base64 string")
    content_type: str = Field(default="image/jpeg", description="MIME type")


class DetectionItem(BaseModel):
    label: str
    score: float
    bbox: list[float]  # normalized [x,y,w,h]


class ImageDetectResponse(BaseModel):
    detections: list[DetectionItem] = Field(default_factory=list)


def create_image_detect_router(rtvi_cv_base_url: str, rtvi_cv_timeout_seconds: float | None = None, capture_dir: str | None = None) -> APIRouter:
    router = APIRouter()

    @router.post("/api/v1/image_detect", response_model=ImageDetectResponse)
    async def detect_image(request: ImageDetectRequest) -> ImageDetectResponse:
        if not rtvi_cv_base_url:
            logger.info("RTVI-CV not configured — image detection skipped")
            return ImageDetectResponse()

        client_timeout = httpx.Timeout(connect=10.0, read=rtvi_cv_timeout_seconds or 30.0)
        async with httpx.AsyncClient(timeout=client_timeout) as client:
            # Try a few plausible RTVI-CV endpoints in order.
            candidates = [
                f"{rtvi_cv_base_url.rstrip('/')}/api/v1/detect",
                f"{rtvi_cv_base_url.rstrip('/')}/v1/detect",
                f"{rtvi_cv_base_url.rstrip('/')}/api/v1/image/detect",
            ]

            payload = {"image": request.image_base64}

            # Decode request image once to get dims for pixel->normalized conversion
            img_w = None
            img_h = None
            if Image is not None:
                try:
                    data = request.image_base64
                    if data.startswith('data:'):
                        _, rest = data.split(',', 1)
                        data = rest
                    img_bytes = base64.b64decode(''.join(data.split()))
                    with Image.open(io.BytesIO(img_bytes)) as im:
                        img_w, img_h = im.size
                except Exception:
                    img_w = None
                    img_h = None

            last_exc: Exception | None = None

            for url in candidates:
                try:
                    logger.info("Attempting RTVI-CV detect POST %s", url)
                    resp = await client.post(url, json=payload)
                    if resp.status_code in (200, 201):
                        try:
                            body = resp.json()
                        except Exception:
                            logger.exception("RTVI-CV returned non-JSON response")
                            return ImageDetectResponse()

                        # Optionally capture raw RTVI-CV response for offline inspection
                        if capture_dir:
                            try:
                                import os, time, json as _json
                                os.makedirs(capture_dir, exist_ok=True)
                                fname = os.path.join(capture_dir, f"rtvi_resp_{int(time.time()*1000)}.json")
                                with open(fname, 'w', encoding='utf-8') as fh:
                                    _json.dump({'url': url, 'status': resp.status_code, 'body': body}, fh, indent=2)
                                logger.info('Saved RTVI-CV raw response to %s', fname)
                            except Exception:
                                logger.exception('Failed to persist RTVI-CV raw response')

                        # Heuristic: look for common shapes in the response
                        # Accept either {detections: [...]}, {results: [...]}, or raw list
                        detections_raw = None
                        if isinstance(body, dict):
                            if "detections" in body and isinstance(body["detections"], list):
                                detections_raw = body["detections"]
                            elif "results" in body and isinstance(body["results"], list):
                                detections_raw = body["results"]
                            elif "data" in body and isinstance(body["data"], list):
                                detections_raw = body["data"]
                        elif isinstance(body, list):
                            detections_raw = body

                        if not detections_raw:
                            logger.info("RTVI-CV response had no detections field; returning empty list")
                            return ImageDetectResponse()

                        detections: list[DetectionItem] = []

                        for item in detections_raw:
                            # Flexible extraction
                            if not isinstance(item, dict):
                                logger.debug('Skipping non-dict detection item: %s', repr(item))
                                continue
                            label = item.get("label") or item.get("class") or item.get("name") or item.get('tag') or ""
                            score = float(item.get("score") or item.get("confidence") or item.get('probability') or 0.0)
                            # Various places bbox may be stored
                            bbox = item.get("bbox") or item.get("box") or item.get("bounding_box") or item.get('box_xyxy') or item.get('coordinates') or None
                            # If no bbox at top-level, check for nested 'prediction' structures
                            if bbox is None:
                                for k in ('prediction', 'pred', 'detection'):
                                    v = item.get(k)
                                    if isinstance(v, dict):
                                        bbox = v.get('bbox') or v.get('box') or v.get('coordinates')
                                        if bbox is not None:
                                            break

                            if isinstance(bbox, dict):
                                x = float(bbox.get('x', 0))
                                y = float(bbox.get('y', 0))
                                w = float(bbox.get('w', bbox.get('width', 0)))
                                h = float(bbox.get('h', bbox.get('height', 0)))
                                bbox_list = [x, y, w, h]
                            elif isinstance(bbox, (list, tuple)):
                                bbox_list = [float(v) for v in bbox]
                            else:
                                bbox_list = None

                            # Attempt to normalize bbox to normalized [x,y,w,h] in 0..1
                            if bbox_list and len(bbox_list) == 4:
                                norm_bbox = bbox_list

                                # If bbox appears to be [x1,y1,x2,y2] convert to [x,y,w,h]
                                try:
                                    x0, y0, x2_or_w, y2_or_h = norm_bbox
                                except Exception:
                                    x0 = y0 = x2_or_w = y2_or_h = 0

                                if x2_or_w > 1.0 or y2_or_h > 1.0:
                                    if x2_or_w > x0 and y2_or_h > y0:
                                        w = x2_or_w - x0
                                        h = y2_or_h - y0
                                        norm_bbox = [x0, y0, w, h]

                                # If values exceed 1.0 and we have image dims, normalize from pixels
                                try:
                                    maxv = max([abs(float(v)) for v in norm_bbox])
                                except Exception:
                                    maxv = 0

                                if maxv > 1.0 and img_w and img_h:
                                    x, y, w, h = norm_bbox
                                    norm_bbox = [x / img_w, y / img_h, w / img_w, h / img_h]

                                # Clamp to 0..1
                                try:
                                    norm_bbox = [max(0.0, min(1.0, float(v))) for v in norm_bbox]
                                except Exception:
                                    norm_bbox = [0.0, 0.0, 1.0, 1.0]

                                logger.info('Normalized detection bbox for label=%s -> %s', label, norm_bbox)
                                detections.append(DetectionItem(label=str(label), score=score, bbox=norm_bbox))

                        return ImageDetectResponse(detections=detections)

                    # non-2xx: try next candidate
                    logger.info("RTVI-CV detect returned %s for %s", resp.status_code, url)
                except Exception as exc:  # pragma: no cover - upstream runtime
                    logger.exception("RTVI-CV detect attempt failed: %s", exc)
                    last_exc = exc

            # If we reach here, all attempts failed
            if last_exc:
                raise HTTPException(status_code=502, detail=f"RTVI-CV detect calls failed: {last_exc}")
            return ImageDetectResponse()

    return router
