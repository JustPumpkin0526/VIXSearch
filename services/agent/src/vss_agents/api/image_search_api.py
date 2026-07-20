# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from vss_agents.tools import image_search as image_search_tool
from vss_agents.embed.cosmos_embed import CosmosEmbedClient
from vss_agents.utils.es_client import VSSESClient

logger = logging.getLogger(__name__)


class ImageSearchRouterConfig(BaseModel):
    cosmos_embed_endpoint: str | None = None
    es_endpoint: str | None = None
    es_index: str | None = None
    vst_external_url: str | None = None
    embedding_field: str | None = None
    embedding_nested_path: str | None = None
    embedding_dimensions: int | None = None
    max_image_size_bytes: int | None = None
    require_sensor_ids: bool | None = None


def create_image_search_router(
    cosmos_embed_endpoint: str | None = None,
    es_endpoint: str | None = None,
    es_index: str | None = None,
    vst_external_url: str | None = None,
) -> APIRouter:
    cfg = ImageSearchRouterConfig(
        cosmos_embed_endpoint=cosmos_embed_endpoint,
        es_endpoint=es_endpoint,
        es_index=es_index,
        vst_external_url=vst_external_url,
    )

    router = APIRouter()

    @router.post("/api/v1/image_search", response_model=image_search_tool.ImageSearchOutput)
    async def image_search_endpoint(request: image_search_tool.ImageSearchInput) -> image_search_tool.ImageSearchOutput:
        if not cfg.cosmos_embed_endpoint or not cfg.es_endpoint or not cfg.vst_external_url:
            logger.error("Image search configuration incomplete; cannot perform image search")
            raise HTTPException(status_code=500, detail="Image search is not configured on the agent")

        try:
            tool_cfg = image_search_tool.ImageSearchConfig(
                cosmos_embed_endpoint=cfg.cosmos_embed_endpoint,
                es_endpoint=cfg.es_endpoint,
                es_index=cfg.es_index or image_search_tool.ImageSearchConfig.__fields__["es_index"].get_default(),
                vst_external_url=cfg.vst_external_url,
            )
        except Exception as exc:
            logger.exception("Failed to construct ImageSearchConfig: %s", exc)
            raise HTTPException(status_code=500, detail="Invalid image search configuration")

        # perform core logic reusing helpers from tools/image_search
        es = await VSSESClient.get_es_client(es_endpoint=tool_cfg.es_endpoint)
        embed_client = CosmosEmbedClient(tool_cfg.cosmos_embed_endpoint)

        try:
            if request.cropped_image_base64:
                image_bytes, detected_content_type = image_search_tool._decode_image(
                    image_base64=request.cropped_image_base64,
                    content_type=request.content_type,
                )
            elif request.bbox is not None:
                original_bytes, original_content_type = image_search_tool._decode_image(
                    image_base64=request.image_base64,
                    content_type=request.content_type,
                )
                image_bytes, detected_content_type = image_search_tool._crop_image_by_normalized_bbox(
                    original_bytes,
                    request.bbox,
                )
            else:
                image_bytes, detected_content_type = image_search_tool._decode_image(
                    image_base64=request.image_base64,
                    content_type=request.content_type,
                )

            if len(image_bytes) > tool_cfg.max_image_size_bytes:
                raise HTTPException(status_code=400, detail="Image exceeds maximum allowed size")

            index_exists = bool(await es.indices.exists(index=tool_cfg.es_index))
            if not index_exists:
                logger.warning("Image search index '%s' does not exist", tool_cfg.es_index)
                return image_search_tool.ImageSearchOutput()

            image_data_uri = image_search_tool._build_image_data_uri(image_bytes=image_bytes, content_type=detected_content_type)

            try:
                raw_embedding = await embed_client.get_image_embedding(image_data_uri)
            except Exception:
                logger.exception("Failed to generate image embedding via Cosmos Embed")
                raise HTTPException(status_code=502, detail="Cosmos Embed failed to generate an embedding")

            query_embedding = image_search_tool._validate_embedding(query_embedding=raw_embedding, expected_dimensions=tool_cfg.embedding_dimensions)

            es_query = image_search_tool._build_es_query(query_embedding=query_embedding, request=request, config=tool_cfg)

            try:
                response = await es.search(index=tool_cfg.es_index, body=es_query)
            except Exception:
                logger.exception("Elasticsearch image similarity search failed")
                raise HTTPException(status_code=502, detail="Elasticsearch image similarity search failed")

            hits_container = response.get("hits") or {}
            hits = hits_container.get("hits") or []

            results = []
            minimum_similarity = request.min_similarity if request.min_similarity is not None else -1.0

            for hit in hits:
                item = image_search_tool._process_search_hit(hit=hit, config=tool_cfg, minimum_similarity=minimum_similarity)
                if item is not None:
                    results.append(item)

            results.sort(key=lambda item: item.similarity_score, reverse=True)

            max_results = request.max_results or tool_cfg.default_max_results
            results = results[:max_results]

            if request.object_query:
                try:
                    text_embedding = await embed_client.get_text_embedding(request.object_query)
                except Exception:
                    logger.exception("Failed to generate text embedding for object_query")
                    text_embedding = None

                if text_embedding is not None:
                    alpha = 0.7
                    reranked = []
                    for item in results:
                        combined_score = item.similarity_score
                        if item.screenshot_url:
                            try:
                                candidate_emb = await embed_client.get_image_embedding(item.screenshot_url)
                                candidate_emb = image_search_tool._validate_embedding(query_embedding=candidate_emb, expected_dimensions=tool_cfg.embedding_dimensions)
                                text_sim = image_search_tool._cosine_similarity(text_embedding, candidate_emb)
                                combined_score = (alpha * item.similarity_score) + ((1.0 - alpha) * text_sim)
                            except Exception:
                                logger.debug("Hybrid rerank: failed to embed candidate screenshot %s", item.screenshot_url)

                        item.similarity_score = round(max(-1.0, min(1.0, combined_score)), 4)
                        reranked.append(item)

                    reranked.sort(key=lambda it: it.similarity_score, reverse=True)
                    results = reranked

            logger.info("Image search returned %d result(s).", len(results))

            return image_search_tool.ImageSearchOutput(results=results, total=len(results))

        finally:
            try:
                await embed_client.aclose()
            except Exception:
                logger.debug("Failed to close embed client")

    return router
