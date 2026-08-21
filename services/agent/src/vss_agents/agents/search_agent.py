# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Search Agent - Streaming search with agent-think visibility.

This agent implements the full search workflow with streaming and three execution paths:
- Path 1: Attribute-only search (if has_action=False and attributes exist) - Query decomposition → Attribute search
- Path 2: Embed-only search (if no attributes) - Query decomposition → Embed search
- Path 3: Fusion search (if has_action=True and attributes exist) - Query decomposition → Embed search → Fusion reranking (with confidence threshold check)

All paths yield AgentMessageChunk for real-time visibility.
"""

from collections.abc import AsyncGenerator
from datetime import UTC
from datetime import datetime
from datetime import timedelta
import json
import logging
import time
from typing import Literal

from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.api_server import ChatRequest
from nat.data_models.api_server import ChatResponse
from nat.data_models.api_server import ChatResponseChunk
from nat.data_models.api_server import Usage
from nat.data_models.component_ref import FunctionRef
from nat.data_models.component_ref import LLMRef
from nat.data_models.function import FunctionBaseConfig
from pydantic import BaseModel
from pydantic import Field

from vss_agents.agents.data_models import AgentMessageChunk
from vss_agents.agents.data_models import AgentMessageChunkType
from vss_agents.agents.data_models import AgentOutput
from vss_agents.agents.data_models import AgentRequestOptions
from vss_agents.tools.attribute_search import DEFAULT_BEHAVIOR_INDEX
from vss_agents.tools.search import SearchInput
from vss_agents.tools.search import SearchOutput
from vss_agents.tools.search import SearchResult
from vss_agents.tools.search import execute_core_search
from vss_agents.tools.vst.utils import get_name_to_stream_id_map
from vss_agents.utils.license_plate import split_korean_license_plate
from vss_agents.utils.time_convert import datetime_to_iso8601
from vss_agents.utils.time_convert import iso8601_to_datetime

logger = logging.getLogger(__name__)

_ARTIFACT_DISPLAY_NOTE = (
    "Do not include or offer to provide the search result summary table and the JSON search results in your final response "
    "since they will be automatically appended to your final response to the user. "
    "The critic/verification status of results is controlled by system configuration, not by user interaction or the agent. "
    "Do not mention the critic/verification status or suggest any follow-up actions such as refining, verifying, or re-running the search."
)

_PTS_EPOCH = datetime(2025, 1, 1, 0, 0, 0, tzinfo=UTC)


def _to_search_results(raw: list) -> list[SearchResult]:
    """Convert raw results (embed/attribute) to SearchResult schema. Used by both sync and streaming."""
    out = []
    for r in raw:
        if isinstance(r, SearchResult):
            out.append(r)
        elif hasattr(r, "model_dump"):
            d = r.model_dump()
            d.setdefault("similarity", d.pop("similarity_score", 0.0))
            d.setdefault("object_ids", [])
            out.append(SearchResult(**d))
        elif isinstance(r, dict):
            d = dict(r)
            d.setdefault("similarity", d.pop("similarity_score", 0.0))
            d.setdefault("object_ids", [])
            out.append(SearchResult(**d))
        else:
            continue
    return out


class SearchAgentInput(BaseModel):
    """Input for search agent."""

    query: str = Field(
        description="Natural language search query. Pass the user's query as-is, including object IDs if mentioned (e.g., 'find objects similar to ID 5').",
    )
    agent_mode: bool = Field(default=True, description="Enable query decomposition")
    use_attribute_search: bool | None = Field(
        default=None, description="Enable fusion reranking with attribute search (overrides config if provided)"
    )
    max_results: int | None = Field(
        default=None,
        ge=1,
        le=100,
        description=(
            "Optional explicit result count. "
            "The parent request_options value takes priority."
        ),
    )
    start_time: str | None = Field(default=None, description="Start time filter (ISO format)")
    end_time: str | None = Field(default=None, description="End time filter (ISO format)")
    source_type: Literal["video_file", "rtsp"] = Field(
        default="video_file",
        description="Type of video source: 'video_file' for uploaded videos, 'rtsp' for live/camera streams",
    )
    use_critic: bool = Field(default=True, description="Whether to verify search results with VLM critic agent")
    request_options: AgentRequestOptions | None = Field(
        default=None,
        description="Per-request options passed by the parent agent. When present, these override matching fields.",
    )

    embed_confidence_threshold: float | None = Field(
        default=None,
        description="Override the embed confidence threshold used during fusion fallback",
    )

    top_k: int | None = Field(
        default=None,
        description="Override top_k for internal search retrieval",
    )

    owned_video_ids: list[str] | None = Field(
        default=None,
        description="List of uploaded video sensor IDs owned by the currently logged-in user",
    )

    result_min_similarity: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )

    critic_max_results: int | None = Field(
        default=None,
        ge=1,
        le=100,
        description=(
            "Maximum number of search results "
            "submitted to the critic agent. "
            "Parent request_options takes priority."
        ),
    )

class ResolvedSearchOptions(BaseModel):
    """Final runtime search options after applying request priorities."""

    source_type: Literal[
        "video_file",
        "rtsp",
    ]

    use_critic: bool

    owned_video_ids: list[str] | None

    max_results: int | None

    result_min_similarity: float

    critic_max_results: int

    candidate_top_k: int


def _effective_search_runtime_options(
    search_agent_input: SearchAgentInput,
) -> tuple[Literal["video_file", "rtsp"], bool]:
    """Resolve runtime search options from parent request options."""

    request_options = search_agent_input.request_options

    if request_options is None:
        return (
            search_agent_input.source_type,
            search_agent_input.use_critic,
        )

    source_type = (
        request_options.search_source_type
        if request_options.search_source_type is not None
        else search_agent_input.source_type
    )

    use_critic = (
        request_options.use_critic
        if request_options.use_critic is not None
        else search_agent_input.use_critic
    )

    return source_type, use_critic

def _effective_owned_video_ids(
    search_agent_input: SearchAgentInput,
) -> list[str] | None:
    """
    Resolve allowed video IDs.

    Priority:
    1. Parent request_options
    2. Direct SearchAgentInput
    3. None
    """

    request_options = (
        search_agent_input.request_options
    )

    if request_options is not None:
        value = request_options.owned_video_ids

        if value is not None:
            return [
                str(video_id).strip()
                for video_id in value
                if str(video_id).strip()
            ]

    if search_agent_input.owned_video_ids is not None:
        return [
            str(video_id).strip()
            for video_id
            in search_agent_input.owned_video_ids
            if str(video_id).strip()
        ]

    return None

def _explicit_max_results(
    search_agent_input: SearchAgentInput,
) -> int | None:
    request_options = search_agent_input.request_options

    if request_options is not None:
        value = getattr(
            request_options,
            "max_results",
            None,
        )

        if value is not None:
            return min(
                100,
                max(1, int(value)),
            )

    if search_agent_input.max_results is not None and "max_results" in search_agent_input.model_fields_set:
        return min(
            100,
            max(
                1,
                int(search_agent_input.max_results),
            ),
        )

    return None

def _effective_result_min_similarity(
    search_agent_input: SearchAgentInput,
) -> float:
    request_options = search_agent_input.request_options

    if request_options is not None:
        value = getattr(
            request_options,
            "result_min_similarity",
            None,
        )

        if value is not None:
            return min(
                1.0,
                max(0.0, float(value)),
            )

    if search_agent_input.result_min_similarity is not None:
        return min(
            1.0,
            max(
                0.0,
                float(
                    search_agent_input.result_min_similarity
                ),
            ),
        )

    return 0.1

def _effective_candidate_top_k(
    search_agent_input: SearchAgentInput,
    default_top_k: int,
) -> int:
    max_results = _explicit_max_results(
        search_agent_input,
    )

    requested_top_k = (
        search_agent_input.top_k
        if search_agent_input.top_k is not None
        else default_top_k
    )

    if max_results is None:
        return max(1, int(requested_top_k))

    # 최종 결과 개수보다 검색 후보가 적어지지 않도록 함
    return max(
        int(requested_top_k),
        int(max_results),
    )

def _effective_critic_max_results(search_agent_input: SearchAgentInput) -> int:
    request_options = (search_agent_input.request_options)

    # Search 메뉴 Settings에서 전달된 값을 최우선 사용
    if request_options is not None:
        value = getattr(request_options, "critic_max_results",None)

        if value is not None:
            resolved_val = min(100,max(1,int(value)))
            logger.info(
                "[SearchAgent] request_options.critic_max_results provided: %s -> resolved=%d",
                value,
                resolved_val,
            )
            return resolved_val

    # Search Agent를 직접 호출하는 경우의 fallback
    if (search_agent_input.critic_max_results is not None):
        resolved_val = min(100, max(1, int(search_agent_input.critic_max_results)))
        logger.info(
            "[SearchAgent] search_agent_input.critic_max_results provided: %s -> resolved=%d",
            search_agent_input.critic_max_results,
            resolved_val,
        )
        return resolved_val

    return 5

def _resolve_search_options(
    search_agent_input: SearchAgentInput,
    default_top_k: int,
) -> ResolvedSearchOptions:
    """Resolve all runtime search settings exactly once."""

    owned_video_ids = (
        _effective_owned_video_ids(
            search_agent_input
        )
    )

    max_results = _explicit_max_results(
        search_agent_input
    )

    result_min_similarity = (
        _effective_result_min_similarity(
            search_agent_input
        )
    )

    critic_max_results = (
        _effective_critic_max_results(
            search_agent_input
        )
    )

    candidate_top_k = (
        _effective_candidate_top_k(
            search_agent_input,
            default_top_k,
        )
    )

    source_type, use_critic = (
        _effective_search_runtime_options(
            search_agent_input
        )
    )

    return ResolvedSearchOptions(
        source_type=source_type,
        use_critic=use_critic,
        owned_video_ids=owned_video_ids,
        max_results=max_results,
        result_min_similarity=(
            result_min_similarity
        ),
        critic_max_results=(
            critic_max_results
        ),
        candidate_top_k=candidate_top_k,
    )

_MIN_RESULT_CLIP_SECONDS = 5.0


def _expand_zero_duration_results(
    results: list[SearchResult],
    min_duration_seconds: float = _MIN_RESULT_CLIP_SECONDS,
) -> list[SearchResult]:
    """Ensure every returned SearchResult has a positive clip duration.

    Some search paths, especially frame/object-level attribute search, can return
    start_time and end_time as the same timestamp. The UI/VST clip renderer then
    treats that as a 0-second clip. Expand those results to a small time window.
    """
    fixed_results: list[SearchResult] = []

    for result in results:
        try:
            if not result.start_time or not result.end_time:
                fixed_results.append(result)
                continue

            start_dt = iso8601_to_datetime(result.start_time)
            end_dt = iso8601_to_datetime(result.end_time)

            if end_dt > start_dt:
                fixed_results.append(result)
                continue

            new_end_dt = start_dt + timedelta(seconds=min_duration_seconds)

            logger.info(
                "Expanded zero-duration search result: sensor_id=%s start=%s end=%s -> %s",
                result.sensor_id,
                result.start_time,
                result.end_time,
                datetime_to_iso8601(new_end_dt),
            )

            fixed_results.append(
                result.model_copy(
                    update={
                        "end_time": datetime_to_iso8601(new_end_dt),
                    }
                )
            )

        except Exception as e:
            logger.warning(
                "Failed to normalize search result timestamp for sensor_id=%s: %s",
                getattr(result, "sensor_id", None),
                e,
            )
            fixed_results.append(result)

    return fixed_results

class SearchAgentConfig(FunctionBaseConfig, name="search_agent"):
    """Config for search agent."""

    # Tool references - we'll call these directly
    embed_search_tool: FunctionRef = Field(description="Embed search tool reference")

    attribute_search_tool: FunctionRef | None = Field(
        default=None, description="Attribute search tool for fusion (optional)"
    )

    agent_mode_llm: LLMRef | None = Field(
        default=None, description="LLM for query decomposition (required if agent_mode=True)"
    )

    use_attribute_search: bool = Field(
        default=False,
        description="If True and attribute_search_tool is configured, performs multi-attribute object-level search using extracted attributes from query decomposition. Requires agent_mode=True. (internal config, not exposed to user)",
    )

    default_max_results: int = Field(
        default=10,
        description="Default internal candidate count for search and reranking when the user does not request a larger final result count.",
    )

    # Config fields needed for execute_core_search (matching SearchConfig)
    embed_confidence_threshold: float = Field(
        default=0.1,
        description="Minimum embed search similarity threshold. If all embed results are below this threshold, fallback to attribute-only search (if attributes exist).",
    )

    vst_internal_url: str = Field(
        ...,
        description="The internal VST URL for stream_id to sensor_id conversion in fusion reranking.",
    )

    vst_external_url: str | None = Field(
        default=None,
        description=(
            "The external VST URL for client-facing screenshot URLs. Falls back to vst_internal_url when unset."
        ),
    )

    fusion_method: Literal["weighted_linear", "rrf", "rrf_with_attribute_rank"] = Field(
        default="rrf",
        description="Fusion method: 'weighted_linear' for weighted linear fusion, 'rrf' for Reciprocal Rank Fusion using embed rank, 'rrf_with_attribute_rank' for RRF using both embed and attribute ranks",
    )

    w_attribute: float = Field(
        default=0.55,
        description="Weight for attribute score in weighted linear fusion (default: 0.55)",
    )

    w_embed: float = Field(
        default=0.35,
        description="Weight for embed score in weighted linear fusion (default: 0.35)",
    )

    rrf_k: int = Field(
        default=60,
        description="RRF constant k for Reciprocal Rank Fusion (default: 60, only used for RRF)",
    )

    rrf_w: float = Field(
        default=0.5,
        description="RRF weight w for attribute cosine similarity in Reciprocal Rank Fusion (default: 0.5, only used for RRF)",
    )

    critic_agent: FunctionRef | None = Field(
        default=None, description="Optional critic agent to verify search results with VLM"
    )

    enable_critic: bool = Field(
        default=False,
        description="Configuration flag to enable/disable critic agent at a global level.",
    )

    search_max_iterations: int = Field(
        default=1,
        ge=1,
        description="""Maximum number of search iterations when refining search results with critic agent.
        Note, high max iterations can run for a long time. Default is 1.""",
    )

    top_percent_filter: float | None = Field(
        default=None,
        description="Score-based filter applied before merging consecutive segments. "
        "Value between 0 and 1.0 — keeps results with similarity >= max_similarity * top_percent_filter. "
        "E.g., 0.9 with max similarity 0.5 keeps results >= 0.45. None or 0 disables filtering.",
    )

    behavior_es_endpoint: str | None = Field(
        default=None,
        description="Elasticsearch endpoint for behavior index (needed for object_id re-search).",
    )

    behavior_index: str = Field(
        default=DEFAULT_BEHAVIOR_INDEX,
        description="Behavior index name for object embedding lookup.",
    )

    merge_gap_tolerance_seconds: float = Field(
        default=1.0,
        ge=0.0,
        description=(
            "Maximum allowed gap in seconds when merging consecutive search result clips. "
            "Use this to absorb timestamp rounding drift."
        ),
    )

    min_result_clip_seconds: float = Field(
        default=0.0,
        ge=0.0,
        description=(
            "Minimum duration in seconds for final search result clips after merging. "
            "Set this to the embedding chunk duration to suppress 0-second or too-short clips."
        ),
    )

    candidate_top_k_multiplier: int = Field(
        default=10,
        ge=1,
        description=(
            "Multiplier for internal candidate retrieval before merging/filtering. "
            "Final output is still limited by max_results/top_k, but internal search "
            "fetches more candidates so merged consecutive clips do not reduce the "
            "visible result count."
        ),
    )

    max_candidate_top_k: int = Field(
        default=100,
        ge=1,
        description=(
            "Maximum number of internal search candidates to fetch before merging/filtering."
        ),
    )


# ===== Presentation converters (moved from embed_search.py) =====
# These operate on SearchOutput (from search.py) instead of VisionLLM.


def _to_incidents_output(search_output: SearchOutput) -> str:
    """Format SearchOutput results as incidents JSON wrapped in <incidents> tags."""
    incidents = []

    for result in search_output.data:
        try:
            incident = {
                "Alert Details": {
                    "Alert Triggered": result.video_name,
                    "video_description": result.description,
                    "similarity_score": round(result.similarity, 2),
                    "description": result.description,
                },
                "Clip Information": {
                    "Timestamp": result.start_time,
                    "video_id": result.video_name,
                    "start_time": result.start_time,
                    "end_time": result.end_time,
                },
            }
            incidents.append(incident)
        except Exception as e:
            logger.error(f"Error parsing search result: {e}")
            continue

    incidents_json = {"incidents": incidents}
    json_string = json.dumps(incidents_json, indent=2)
    return f"<incidents>\n{json_string}\n</incidents>"


def _helper_markdown_bullet_list(search_output: SearchOutput) -> str:
    """Convert SearchOutput to markdown bullet list."""
    markdown = "```markdown\n"

    for result in search_output.data:
        try:
            markdown += (
                f"- **Video ID:** `{result.video_name}`\n"
                f"  * Similarity Score: **{result.similarity:.2f}**\n"
                f"  * Description: {result.description}\n"
                f"  * Start Time: {result.start_time}\n"
                f"  * End Time: {result.end_time}\n"
                f"  * Sensor ID: {result.sensor_id}\n"
                f"  * Timestamp: {result.start_time}\n\n"
            )
        except Exception as e:
            logger.error(f"Error formatting search result: {e}")
            continue

    markdown += "```"
    return markdown


def _to_chat_response(search_output: SearchOutput) -> ChatResponse:
    """Convert SearchOutput to ChatResponse."""
    incidents = _to_incidents_output(search_output)
    return ChatResponse.from_string(incidents, usage=Usage())


def _to_chat_response_chunk(search_output: SearchOutput) -> ChatResponseChunk:
    """Convert SearchOutput to ChatResponseChunk."""
    incidents = _to_incidents_output(search_output)
    return ChatResponseChunk.from_string(incidents)


def _to_pts(ts: str | float) -> str:
    """Convert an ISO 8601 timestamp string or float offset to a PTS string (e.g. '163.1s').

    ISO strings are interpreted relative to 2025-01-01T00:00:00Z.
    Float values are assumed to already be seconds and are formatted directly.
    """
    if isinstance(ts, (int, float)):
        return f"{float(ts):.1f}s"
    try:
        dt = iso8601_to_datetime(ts)
        return f"{(dt - _PTS_EPOCH).total_seconds():.1f}s"
    except Exception:
        return str(ts)


def _results_summary_table(results: list[SearchResult]) -> str:
    """Format search results as a Markdown summary table."""
    has_critic = any(r.critic_result is not None for r in results)

    headers = ["#", "Video", "Start", "End"]
    if has_critic:
        headers.append("Critic")

    rows = []
    for i, r in enumerate(results, 1):
        row = [str(i), r.video_name, _to_pts(r.start_time), _to_pts(r.end_time)]
        if has_critic:
            if r.critic_result is not None:
                verdict = r.critic_result.result
                criteria = ", ".join(f"{k}: {'✓' if v else '✗'}" for k, v in r.critic_result.criteria_met.items())
                row.append(f"{verdict} ({criteria})" if criteria else verdict)
            else:
                row.append("—")
        rows.append(row)

    col_widths = [max(len(h), *(len(row[i]) for row in rows)) for i, h in enumerate(headers)]

    def _fmt(cells: list[str]) -> str:
        return "| " + " | ".join(c.ljust(w) for c, w in zip(cells, col_widths, strict=False)) + " |"

    sep = "| " + " | ".join("-" * w for w in col_widths) + " |"
    return "\n".join([_fmt(headers), sep, *(_fmt(r) for r in rows)])


class _StreamNameResolver:
    """TTL-cached resolver that maps VST stream UUIDs to human-readable video names."""

    def __init__(self, vst_url: str, ttl: float = 60.0):
        self._vst_url = vst_url
        self._ttl = ttl
        self._cache: dict[str, str] = {}  # stream_id → video name
        self._cache_ts: float = 0.0

    async def _refresh_cache(self) -> None:
        now = time.monotonic()
        if not self._cache or (now - self._cache_ts) > self._ttl:
            try:
                mapping = await get_name_to_stream_id_map(self._vst_url)  # video name → stream_id
                self._cache = {v: k for k, v in mapping.items()}  # inverse mapping
                self._cache_ts = now
            except Exception as e:
                logger.warning(f"Could not refresh stream name map from VST: {e}")

    async def get_name_for_stream_id(self, stream_id: str) -> str | None:
        """Return the video name for a given stream_id."""
        await self._refresh_cache()
        return self._cache.get(stream_id)

    async def resolve(self, results: list[SearchResult]) -> list[SearchResult]:
        await self._refresh_cache()
        if not self._cache:
            return results
        return [r.model_copy(update={"video_name": self._cache.get(r.sensor_id, r.video_name)}) for r in results]


@register_function(config_type=SearchAgentConfig, framework_wrappers=[LLMFrameworkEnum.LANGCHAIN])
async def search_agent(config: SearchAgentConfig, builder: Builder) -> AsyncGenerator[FunctionInfo]:
    """
    Search agent with streaming support - implements full search workflow.

    Calls search components directly (decompose_query, embed_search, attribute_search)
    and streams intermediate steps as AgentMessageChunk.
    """

    # Load function references (for execute_core_search)
    embed_search_fn = await builder.get_function(config.embed_search_tool)
    attribute_search_fn = (
        await builder.get_function(config.attribute_search_tool)
        if config.attribute_search_tool is not None
        else None
    )

    stream_name_resolver = _StreamNameResolver(config.vst_internal_url)

    agent_llm = None
    if config.agent_mode_llm:
        agent_llm = await builder.get_llm(config.agent_mode_llm, wrapper_type=LLMFrameworkEnum.LANGCHAIN)

    # Get critic agent if configured
    critic_agent = None
    if config.critic_agent:
        critic_agent = await builder.get_function(config.critic_agent)

    logger.info(
        "Search agent initialized with direct tool references: "
        "attribute_search=%s",
        attribute_search_fn is not None,
    )

    async def _execute_search(search_agent_input: SearchAgentInput) -> SearchOutput:
        """Non-streaming search execution. Returns SearchOutput directly."""

        license_plate, semantic_query = split_korean_license_plate(
            search_agent_input.query
        )
        if license_plate:
            if attribute_search_fn is None:
                raise ValueError(
                    "attribute_search_tool is required for license plate search"
                )
            logger.info(
                "Search agent recognized license plate: plate=%s, "
                "semantic_query=%r",
                license_plate,
                semantic_query,
            )

        timestamp_start = None
        timestamp_end = None
        if search_agent_input.start_time:
            try:
                timestamp_start = iso8601_to_datetime(search_agent_input.start_time)
            except Exception as e:
                logger.warning(f"Failed to parse start_time: {e}")
        if search_agent_input.end_time:
            try:
                timestamp_end = iso8601_to_datetime(search_agent_input.end_time)
            except Exception as e:
                logger.warning(f"Failed to parse end_time: {e}")

        resolved = _resolve_search_options(
            search_agent_input,
            config.default_max_results,
        )

        effective_config = config.model_copy(
            update={
                "embed_confidence_threshold": (
                    search_agent_input.embed_confidence_threshold
                    if search_agent_input.embed_confidence_threshold is not None
                    else config.embed_confidence_threshold
                ),
                "use_attribute_search": (
                    search_agent_input.use_attribute_search
                    if search_agent_input.use_attribute_search is not None
                    else config.use_attribute_search
                ),
            }
        )

        search_input = SearchInput(
            query=search_agent_input.query,
            source_type=resolved.source_type,
            top_k=resolved.candidate_top_k,
            min_cosine_similarity=(effective_config.embed_confidence_threshold),
            result_min_similarity=(resolved.result_min_similarity),
            critic_max_results=(resolved.critic_max_results),
            agent_mode=search_agent_input.agent_mode,
            timestamp_start=timestamp_start,
            timestamp_end=timestamp_end,
            owned_video_ids=(resolved.owned_video_ids),
            use_critic=resolved.use_critic,
        )

        # Use shared core search function (async generator, collect all progress and return final result)
        search_output = SearchOutput(data=[])
        async for update in execute_core_search(
            search_input=search_input,
            embed_search=embed_search_fn,
            agent_llm=agent_llm,
            config=effective_config,
            builder=builder,
            attribute_search_fn=attribute_search_fn,
            critic_agent=critic_agent,
        ):
            if isinstance(update, SearchOutput):
                search_output = update

        final_results = (
            await stream_name_resolver.resolve(
                search_output.data
            )
        )

        if resolved.max_results is not None:
            final_results = final_results[
                :resolved.max_results
            ]
        return SearchOutput(data=final_results, search_messages=search_output.search_messages)

    async def _execute_search_stream(
        search_agent_input: SearchAgentInput,
    ) -> AsyncGenerator[AgentMessageChunk]:
        """
        Execute search with full streaming - implements three execution paths using shared core search function.

        Path 1: Attribute-only search (if has_action=False and attributes exist)
        Path 2: Embed-only search (if no attributes)
        Path 3: Fusion search (if has_action=True and attributes exist, with confidence threshold check)
        """
        query = search_agent_input.query
        agent_mode = search_agent_input.agent_mode
        license_plate, semantic_query = split_korean_license_plate(query)
        use_attribute_search_flag = (
            search_agent_input.use_attribute_search
            if search_agent_input.use_attribute_search
            is not None
            else config.use_attribute_search
        )
        resolved = _resolve_search_options(
            search_agent_input,
            config.default_max_results,
        )
        start_time = search_agent_input.start_time
        end_time = search_agent_input.end_time

        logger.info(
            "Search agent executing: %s",
            search_agent_input.model_dump_json(),
        )

        if license_plate:
            if attribute_search_fn is None:
                error_message = (
                    "attribute_search_tool is required for license plate search"
                )
                logger.error(error_message)
                yield AgentMessageChunk(
                    type=AgentMessageChunkType.ERROR,
                    content=error_message,
                )
                output = AgentOutput(
                    messages=["License plate search is not configured"],
                    status="error",
                    error_message=error_message,
                    metadata={
                        "query": query,
                        "license_plate": license_plate,
                    },
                )
                yield AgentMessageChunk(
                    type=AgentMessageChunkType.FINAL,
                    content=output.model_dump_json(),
                )
                return

            logger.info(
                "Search agent recognized license plate: plate=%s, "
                "semantic_query=%r",
                license_plate,
                semantic_query,
            )

        timestamp_start = None
        timestamp_end = None
        if start_time:
            try:
                timestamp_start = iso8601_to_datetime(start_time)
            except Exception as e:
                logger.warning(f"Failed to parse start_time: {e}")
        if end_time:
            try:
                timestamp_end = iso8601_to_datetime(end_time)
            except Exception as e:
                logger.warning(f"Failed to parse end_time: {e}")

        effective_config = config.model_copy(
            update={
                "embed_confidence_threshold": (
                    search_agent_input.embed_confidence_threshold
                    if search_agent_input.embed_confidence_threshold is not None
                    else config.embed_confidence_threshold
                )
            }
        )

        search_input = SearchInput(
            query=query,
            source_type=resolved.source_type,
            top_k=resolved.candidate_top_k,
            min_cosine_similarity=(
                effective_config.embed_confidence_threshold
            ),
            result_min_similarity=(
                resolved.result_min_similarity
            ),
            critic_max_results=(
                resolved.critic_max_results
            ),
            agent_mode=agent_mode,
            timestamp_start=timestamp_start,
            timestamp_end=timestamp_end,
            owned_video_ids=(
                resolved.owned_video_ids
            ),
            use_critic=resolved.use_critic,
        )

        try:
            # Use shared core search function (async generator) - yield progress updates in real-time
            search_output = SearchOutput(data=[])

            async for update in execute_core_search(
                search_input=search_input,
                embed_search=embed_search_fn,
                agent_llm=agent_llm,
                config=effective_config,
                builder=builder,
                attribute_search_fn=attribute_search_fn,
                critic_agent=critic_agent,
            ):
                if isinstance(update, AgentMessageChunk):
                    # Forward progress updates directly
                    yield update
                elif isinstance(update, SearchOutput):
                    search_output = update

            final_results = (
                await stream_name_resolver.resolve(
                    search_output.data
                )
            )

            if resolved.max_results is not None:
                final_results = final_results[
                    :resolved.max_results
                ]
            result_count = len(final_results)

            # Build SearchOutput-compatible JSON
            results_dicts = [r.model_dump() for r in final_results]
            search_dict = {"data": results_dicts}

            # Format results for display
            if result_count > 0:
                header = f"Found {result_count} matching video{'s' if result_count != 1 else ''}"
                results_summary_table = _results_summary_table(final_results)
                summary = header + "\n\n" + results_summary_table
                search_result_json = json.dumps(search_dict, indent=2)
                #search_result_json_block = "\n\n**Search API result (JSON):**\n```json\n" + search_result_json + "\n```"
                messages = [summary]
                side_effects = {
                    "results_summary": results_summary_table,
                    #"search_result_json": search_result_json_block,
                    "artifact_note": _ARTIFACT_DISPLAY_NOTE,
                }

                output = AgentOutput(
                    messages=messages,
                    side_effects=side_effects,
                    metadata={
                        "query": query,
                        "agent_mode": agent_mode,
                        "fusion_enabled": use_attribute_search_flag,
                        "max_results": resolved.max_results,
                        "filters": (
                            {
                                "start_time": start_time,
                                "end_time": end_time,
                            }
                            if (start_time or end_time)
                            else None
                        ),
                    },
                    status="success",
                )
            else:
                search_dict = {"data": []}
                search_result_json = json.dumps(search_dict, indent=2)
                no_results_msg = f"No videos found matching: '{query}'"
                if search_output.search_messages:
                    no_results_msg += "\n\nNote: " + "; ".join(search_output.search_messages)
                #search_result_json_block = "\n\n**Search API result (JSON):**\n```json\n" + search_result_json + "\n```"
                messages = [no_results_msg]
                side_effects = {
                    "results_summary": no_results_msg,
                    #"search_result_json": search_result_json_block,
                    "artifact_note": _ARTIFACT_DISPLAY_NOTE,
                }
                output = AgentOutput(
                    messages=messages,
                    side_effects=side_effects,
                    metadata={"query": query},
                    status="success",
                )

            yield AgentMessageChunk(type=AgentMessageChunkType.FINAL, content=output.model_dump_json())

        except Exception as e:
            logger.error(f"Search failed: {e}", exc_info=True)
            yield AgentMessageChunk(type=AgentMessageChunkType.ERROR, content=f"Search failed: {e!s}")
            output = AgentOutput(
                messages=["Search failed due to an error"],
                status="error",
                error_message=str(e),
                metadata={"query": query},
            )
            yield AgentMessageChunk(type=AgentMessageChunkType.FINAL, content=output.model_dump_json())

    # Input converters for search_agent
    def _str_input_converter(input: str) -> SearchAgentInput:
        return SearchAgentInput.model_validate_json(input)

    def _chat_request_input_converter(request: ChatRequest) -> SearchAgentInput:
        return SearchAgentInput.model_validate_json(request.messages[-1].content)

    # Register the agent
    yield FunctionInfo.create(
        single_fn=_execute_search,
        stream_fn=_execute_search_stream,
        input_schema=SearchAgentInput,
        single_output_schema=SearchOutput,
        stream_output_schema=AgentMessageChunk,
        converters=[
            _str_input_converter,
            _chat_request_input_converter,
            _to_chat_response,
            _to_chat_response_chunk,
            _helper_markdown_bullet_list,
        ],
    )