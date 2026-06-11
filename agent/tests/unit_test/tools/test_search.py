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
"""Unit tests for search module."""

from datetime import UTC
from datetime import datetime
import json
from unittest.mock import AsyncMock
from unittest.mock import MagicMock

from pydantic import ValidationError
import pytest

from vss_agents.tools.embed_search import EmbedSearchConfig
from vss_agents.tools.embed_search import QueryInput
from vss_agents.tools.embed_search import _str_input_converter
from vss_agents.tools.search import QUERY_DECOMPOSITION_PROMPT
from vss_agents.tools.search import DecomposedQuery
from vss_agents.tools.search import SearchConfig
from vss_agents.tools.search import SearchInput
from vss_agents.tools.search import SearchOutput
from vss_agents.tools.search import SearchResult
from vss_agents.tools.search import decompose_query
from vss_agents.tools.search import execute_core_search
from vss_agents.tools.search import merge_touching_search_results


class TestSearchConfig:
    """Test SearchConfig model."""

    def test_required_fields(self):
        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="http://localhost:30888",
        )
        assert config.embed_search_tool == "embed_search"
        assert config.agent_mode_llm == "gpt-4o"
        assert config.vst_internal_url == "http://localhost:30888"
        assert "query" in config.agent_mode_prompt

    def test_custom_prompt(self):
        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="http://localhost:30888",
            agent_mode_prompt="Custom prompt for analysis",
        )
        assert config.agent_mode_prompt == "Custom prompt for analysis"

    def test_fusion_method_defaults(self):
        """Test that fusion method defaults are set correctly."""
        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="http://localhost:30888",
        )
        assert config.fusion_method == "rrf"
        assert config.w_attribute == 0.55
        assert config.w_embed == 0.35
        assert config.rrf_k == 60
        assert config.rrf_w == 0.5

    def test_fusion_method_weighted_linear(self):
        """Test weighted linear fusion configuration."""
        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="http://localhost:30888",
            fusion_method="weighted_linear",
            w_attribute=0.6,
            w_embed=0.4,
        )
        assert config.fusion_method == "weighted_linear"
        assert config.w_attribute == 0.6
        assert config.w_embed == 0.4

    def test_fusion_method_rrf_custom(self):
        """Test RRF fusion with custom parameters."""
        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="http://localhost:30888",
            fusion_method="rrf",
            rrf_k=100,
            rrf_w=0.7,
        )
        assert config.fusion_method == "rrf"
        assert config.rrf_k == 100
        assert config.rrf_w == 0.7


class TestSearchInput:
    """Test SearchInput model."""

    def test_required_fields(self):
        input_data = SearchInput(
            query="find a person",
            source_type="video_file",
            agent_mode=True,
        )
        assert input_data.query == "find a person"
        assert input_data.agent_mode is True

    def test_all_fields(self):
        input_data = SearchInput(
            query="find cars",
            source_type="rtsp",
            video_sources=["video1", "video2"],
            description="parking lot",
            timestamp_start=datetime(2025, 1, 15, 10, 0, 0, tzinfo=UTC),
            timestamp_end=datetime(2025, 1, 15, 11, 0, 0, tzinfo=UTC),
            top_k=10,
            min_cosine_similarity=0.5,
            agent_mode=False,
        )
        assert input_data.query == "find cars"
        assert input_data.video_sources == ["video1", "video2"]
        assert input_data.description == "parking lot"
        assert input_data.top_k == 10
        assert input_data.min_cosine_similarity == 0.5
        assert input_data.agent_mode is False

    def test_defaults(self):
        input_data = SearchInput(
            query="test query",
            source_type="video_file",
            agent_mode=True,
        )
        assert input_data.video_sources is None
        assert input_data.description is None
        assert input_data.timestamp_start is None
        assert input_data.timestamp_end is None
        assert input_data.top_k is None  # return all mathing results
        assert input_data.min_cosine_similarity == 0.0

    def test_missing_query_raises(self):
        with pytest.raises(ValidationError):
            SearchInput(source_type="video_file", agent_mode=True)

    def test_missing_agent_mode_raises(self):
        with pytest.raises(ValidationError):
            SearchInput(query="test", source_type="video_file")

    def test_extra_fields_forbidden(self):
        with pytest.raises(ValidationError):
            SearchInput(
                query="test",
                source_type="video_file",
                agent_mode=True,
                extra_field="not allowed",
            )


class TestSearchResult:
    """Test SearchResult model."""

    def test_valid_result(self):
        result = SearchResult(
            video_name="video1.mp4",
            description="A video of a parking lot",
            start_time="2025-01-15T10:00:00Z",
            end_time="2025-01-15T10:01:00Z",
            sensor_id="21908c9a-bd40-4941-8a2e-79bc0880fb5a",
            screenshot_url="http://example.com/screenshot1.jpg",
            similarity=0.95,
        )
        assert result.video_name == "video1.mp4"
        assert result.description == "A video of a parking lot"
        assert result.start_time == "2025-01-15T10:00:00Z"
        assert result.end_time == "2025-01-15T10:01:00Z"
        assert result.sensor_id == "21908c9a-bd40-4941-8a2e-79bc0880fb5a"
        assert result.screenshot_url == "http://example.com/screenshot1.jpg"
        assert result.similarity == 0.95

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            SearchResult(
                video_name="video1.mp4",
                # Missing other required fields
            )


class TestMergeTouchingSearchResults:
    """Test merging touching search clips from the same sensor."""

    def test_merges_touching_clips_from_same_sensor(self):
        merged = merge_touching_search_results(
            [
                SearchResult(
                    video_name="video1.mp4",
                    description="First clip",
                    start_time="2025-01-15T10:00:00Z",
                    end_time="2025-01-15T10:00:10Z",
                    sensor_id="sensor-1",
                    screenshot_url="http://example.com/screenshot1.jpg",
                    similarity=0.61,
                    object_ids=["1"],
                ),
                SearchResult(
                    video_name="video1.mp4",
                    description="Touching clip",
                    start_time="2025-01-15T10:00:10Z",
                    end_time="2025-01-15T10:00:20Z",
                    sensor_id="sensor-1",
                    screenshot_url="http://example.com/screenshot2.jpg",
                    similarity=0.72,
                    object_ids=["2"],
                ),
                SearchResult(
                    video_name="video2.mp4",
                    description="Different sensor clip",
                    start_time="2025-01-15T10:00:10Z",
                    end_time="2025-01-15T10:00:20Z",
                    sensor_id="sensor-2",
                    screenshot_url="http://example.com/screenshot3.jpg",
                    similarity=0.93,
                    object_ids=["3"],
                ),
                SearchResult(
                    video_name="video1.mp4",
                    description="Gap clip",
                    start_time="2025-01-15T10:00:31Z",
                    end_time="2025-01-15T10:00:41Z",
                    sensor_id="sensor-1",
                    screenshot_url="http://example.com/screenshot4.jpg",
                    similarity=0.58,
                    object_ids=["4"],
                ),
            ]
        )

        assert len(merged) == 3
        assert merged[0].sensor_id == "sensor-1"
        assert merged[0].start_time == "2025-01-15T10:00:00Z"
        assert merged[0].end_time == "2025-01-15T10:00:20Z"
        assert merged[0].similarity == 0.72
        assert merged[0].object_ids == ["1", "2"]

        assert merged[1].sensor_id == "sensor-2"
        assert merged[1].start_time == "2025-01-15T10:00:10Z"
        assert merged[1].end_time == "2025-01-15T10:00:20Z"

        assert merged[2].sensor_id == "sensor-1"
        assert merged[2].start_time == "2025-01-15T10:00:31Z"
        assert merged[2].end_time == "2025-01-15T10:00:41Z"

    def test_merges_one_chunk_gap_for_same_sensor(self):
        merged = merge_touching_search_results(
            [
                SearchResult(
                    video_name="video1.mp4",
                    description="Chunk 1",
                    start_time="2025-01-15T10:01:10Z",
                    end_time="2025-01-15T10:01:20Z",
                    sensor_id="sensor-1",
                    screenshot_url="http://example.com/screenshot1.jpg",
                    similarity=0.61,
                    object_ids=["1"],
                ),
                SearchResult(
                    video_name="video1.mp4",
                    description="Chunk 3",
                    start_time="2025-01-15T10:01:30Z",
                    end_time="2025-01-15T10:01:40Z",
                    sensor_id="sensor-1",
                    screenshot_url="http://example.com/screenshot2.jpg",
                    similarity=0.72,
                    object_ids=["2"],
                ),
                SearchResult(
                    video_name="video2.mp4",
                    description="Other sensor",
                    start_time="2025-01-15T10:01:30Z",
                    end_time="2025-01-15T10:01:40Z",
                    sensor_id="sensor-2",
                    screenshot_url="http://example.com/screenshot3.jpg",
                    similarity=0.93,
                    object_ids=["3"],
                ),
            ]
        )

        assert len(merged) == 2
        assert merged[0].sensor_id == "sensor-1"
        assert merged[0].start_time == "2025-01-15T10:01:10Z"
        assert merged[0].end_time == "2025-01-15T10:01:40Z"
        assert merged[0].similarity == 0.72
        assert merged[0].object_ids == ["1", "2"]

        assert merged[1].sensor_id == "sensor-2"
        assert merged[1].start_time == "2025-01-15T10:01:30Z"
        assert merged[1].end_time == "2025-01-15T10:01:40Z"


class TestSearchOutput:
    """Test SearchOutput model."""

    def test_empty_data(self):
        output = SearchOutput()
        assert output.data == []

    def test_with_results(self):
        result1 = SearchResult(
            video_name="video1.mp4",
            description="Description 1",
            start_time="2025-01-15T10:00:00Z",
            end_time="2025-01-15T10:01:00Z",
            sensor_id="sensor-1",
            screenshot_url="http://example.com/screenshot1.jpg",
            similarity=0.95,
        )
        result2 = SearchResult(
            video_name="video2.mp4",
            description="Description 2",
            start_time="2025-01-15T11:00:00Z",
            end_time="2025-01-15T11:01:00Z",
            sensor_id="sensor-2",
            screenshot_url="http://example.com/screenshot2.jpg",
            similarity=0.85,
        )
        output = SearchOutput(data=[result1, result2])
        assert len(output.data) == 2
        assert output.data[0].video_name == "video1.mp4"
        assert output.data[1].video_name == "video2.mp4"

    def test_extra_fields_forbidden(self):
        with pytest.raises(ValidationError):
            SearchOutput(
                data=[],
                extra_field="not allowed",
            )

    def test_serialization(self):
        result = SearchResult(
            video_name="video1.mp4",
            description="Test",
            start_time="2025-01-15T10:00:00Z",
            end_time="2025-01-15T10:01:00Z",
            sensor_id="sensor-1",
            screenshot_url="http://example.com/screenshot1.jpg",
            similarity=0.9,
        )
        output = SearchOutput(data=[result])
        json_str = output.model_dump_json()
        assert "video1.mp4" in json_str
        assert "0.9" in json_str


class TestQueryInput:
    """Test QueryInput model."""

    def test_defaults(self):
        qi = QueryInput(source_type="video_file")
        assert qi.id == ""
        assert qi.params == {}
        assert qi.prompts == {}
        assert qi.response == ""
        assert qi.embeddings == []
        assert qi.source_type == "video_file"

    def test_with_values(self):
        qi = QueryInput(
            id="input1",
            params={"query": "find person"},
            prompts={"system": "analyze"},
            response="result",
            embeddings=[{"vector": [0.1, 0.2]}],
            source_type="rtsp",
        )
        assert qi.id == "input1"
        assert qi.params["query"] == "find person"
        assert qi.source_type == "rtsp"


class TestEmbedSearchConfig:
    """Test EmbedSearchConfig model."""

    def test_required_fields(self):
        config = EmbedSearchConfig(
            cosmos_embed_endpoint="http://localhost:8080",
            es_endpoint="http://localhost:9200",
            vst_external_url="http://localhost:8081",
        )
        assert config.cosmos_embed_endpoint == "http://localhost:8080"
        assert config.es_endpoint == "http://localhost:9200"
        assert config.es_index == "video_embeddings"
        assert config.vst_external_url == "http://localhost:8081"

    def test_custom_index(self):
        config = EmbedSearchConfig(
            cosmos_embed_endpoint="http://localhost:8080",
            es_endpoint="http://localhost:9200",
            vst_external_url="http://localhost:8081",
            es_index="custom_index",
        )
        assert config.es_index == "custom_index"


class TestStrInputConverter:
    """Test _str_input_converter function."""

    def test_json_with_params(self):
        input_str = '{"params": {"query": "find cars"}, "source_type": "video_file"}'
        result = _str_input_converter(input_str)
        assert result.params["query"] == "find cars"
        assert result.source_type == "video_file"

    def test_json_with_prompts(self):
        input_str = '{"prompts": {"system": "analyze"}, "source_type": "rtsp"}'
        result = _str_input_converter(input_str)
        assert result.prompts["system"] == "analyze"
        assert result.source_type == "rtsp"

    def test_invalid_json_format(self):
        input_str = "not valid json"
        result = _str_input_converter(input_str)
        assert result.params["query"] == "not valid json"

    def test_json_without_params_or_prompts(self):
        input_str = '{"other_field": "value"}'
        result = _str_input_converter(input_str)
        # Should treat entire input as query string
        assert result.params["query"] == '{"other_field": "value"}'


class TestDecomposedQuery:
    """Test DecomposedQuery model."""

    def test_defaults(self):
        dq = DecomposedQuery()
        assert dq.query == ""
        assert dq.video_sources == []
        assert dq.source_type == "video_file"
        assert dq.timestamp_start is None
        assert dq.timestamp_end is None
        assert dq.attributes == []
        assert dq.top_k is None
        assert dq.min_cosine_similarity is None

    def test_with_values(self):
        dq = DecomposedQuery(
            query="man pushing cart",
            video_sources=["Endeavor heart"],
            source_type="stream",
            timestamp_start="2025-01-01T13:00:00Z",
            timestamp_end="2025-01-01T14:00:00Z",
            attributes=["man", "beige shirt"],
            top_k=10,
            min_cosine_similarity=0.7,
        )
        assert dq.query == "man pushing cart"
        assert dq.video_sources == ["Endeavor heart"]
        assert dq.source_type == "stream"
        assert dq.timestamp_start == "2025-01-01T13:00:00Z"
        assert dq.timestamp_end == "2025-01-01T14:00:00Z"
        assert dq.attributes == ["man", "beige shirt"]
        assert dq.top_k == 10
        assert dq.min_cosine_similarity == 0.7

    def test_with_negative_min_cosine_similarity(self):
        """Test that negative min_cosine_similarity values are valid (-1.0 to 1.0 range)."""
        dq = DecomposedQuery(
            query="any match",
            min_cosine_similarity=-0.5,
        )
        assert dq.min_cosine_similarity == -0.5


class TestQueryDecompositionPrompt:
    """Test QUERY_DECOMPOSITION_PROMPT constant."""

    def test_prompt_has_placeholders(self):
        assert "{video_sources}" in QUERY_DECOMPOSITION_PROMPT
        assert "{few_shot_examples}" in QUERY_DECOMPOSITION_PROMPT
        assert "{user_query}" in QUERY_DECOMPOSITION_PROMPT

    def test_prompt_contains_instructions(self):
        assert "query" in QUERY_DECOMPOSITION_PROMPT.lower()
        assert "video_sources" in QUERY_DECOMPOSITION_PROMPT
        assert "source_type" in QUERY_DECOMPOSITION_PROMPT
        assert "timestamp_start" in QUERY_DECOMPOSITION_PROMPT
        assert "timestamp_end" in QUERY_DECOMPOSITION_PROMPT
        assert "attributes" in QUERY_DECOMPOSITION_PROMPT
        assert "top_k" in QUERY_DECOMPOSITION_PROMPT
        assert "min_cosine_similarity" in QUERY_DECOMPOSITION_PROMPT
        assert "-1.0" in QUERY_DECOMPOSITION_PROMPT  # Verify correct range is documented


class TestDecomposeQuery:
    """Test decompose_query function."""

    @pytest.fixture
    def mock_llm(self):
        """Create a mock LLM for testing."""
        llm = MagicMock()
        llm.ainvoke = AsyncMock()
        return llm

    @pytest.mark.asyncio
    async def test_simple_query(self, mock_llm):
        """Test decomposition of a simple search query."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "red car", "video_sources": [], "source_type": "video_file", "attributes": ["red", "car"]}'
        )

        result = await decompose_query("find a red car", mock_llm)

        assert result.query == "red car"
        assert result.video_sources == []
        assert result.source_type == "video_file"
        assert result.attributes == ["red", "car"]

    @pytest.mark.asyncio
    async def test_query_with_time_range(self, mock_llm):
        """Test decomposition with time range extraction."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "person walking", "timestamp_start": "2025-01-01T09:00:00Z", "timestamp_end": "2025-01-01T10:00:00Z"}'
        )

        result = await decompose_query("find person walking between 9am and 10am", mock_llm)

        assert result.query == "person walking"
        assert result.timestamp_start == "2025-01-01T09:00:00Z"
        assert result.timestamp_end == "2025-01-01T10:00:00Z"

    @pytest.mark.asyncio
    async def test_query_with_video_sources(self, mock_llm):
        """Test decomposition with video source extraction."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "delivery truck", "video_sources": ["warehouse entrance", "parking lot"], "source_type": "stream"}'
        )

        result = await decompose_query(
            "find delivery truck at warehouse entrance or parking lot camera",
            mock_llm,
            video_stream_names=["warehouse entrance", "parking lot", "main gate"],
        )

        assert result.query == "delivery truck"
        assert result.video_sources == ["warehouse entrance", "parking lot"]
        assert result.source_type == "stream"

    @pytest.mark.asyncio
    async def test_complex_query_all_parameters(self, mock_llm):
        """Test decomposition of complex query with all parameters."""
        mock_llm.ainvoke.return_value = MagicMock(
            content="""{
                "query": "man pushing cart",
                "video_sources": ["Endeavor heart"],
                "source_type": "stream",
                "timestamp_start": "2025-01-01T13:00:00Z",
                "timestamp_end": "2025-01-01T14:00:00Z",
                "attributes": ["man", "beige shirt"]
            }"""
        )

        result = await decompose_query(
            "Find a man pushing a cart wearing a beige shirt between 1 pm and 2 pm at Endeavor heart",
            mock_llm,
            video_stream_names=["Endeavor heart", "Building A"],
        )

        assert result.query == "man pushing cart"
        assert result.video_sources == ["Endeavor heart"]
        assert result.source_type == "stream"
        assert result.timestamp_start == "2025-01-01T13:00:00Z"
        assert result.timestamp_end == "2025-01-01T14:00:00Z"
        assert result.attributes == ["man", "beige shirt"]

    @pytest.mark.asyncio
    async def test_query_with_json_code_block(self, mock_llm):
        """Test parsing JSON wrapped in markdown code blocks."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='```json\n{"query": "blue car", "attributes": ["blue", "car"]}\n```'
        )

        result = await decompose_query("find blue car", mock_llm)

        assert result.query == "blue car"
        assert result.attributes == ["blue", "car"]

    @pytest.mark.asyncio
    async def test_query_with_plain_code_block(self, mock_llm):
        """Test parsing JSON wrapped in plain code blocks."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='```\n{"query": "person running", "source_type": "video_file"}\n```'
        )

        result = await decompose_query("find person running", mock_llm)

        assert result.query == "person running"
        assert result.source_type == "video_file"

    @pytest.mark.asyncio
    async def test_fallback_on_invalid_json(self, mock_llm):
        """Test fallback to original query when LLM returns invalid JSON."""
        mock_llm.ainvoke.return_value = MagicMock(content="This is not valid JSON")

        result = await decompose_query("find a dog", mock_llm)

        assert result.query == "find a dog"
        assert result.video_sources == []
        assert result.source_type == "video_file"

    @pytest.mark.asyncio
    async def test_fallback_on_llm_exception(self, mock_llm):
        """Test fallback when LLM raises an exception."""
        mock_llm.ainvoke.side_effect = Exception("LLM service unavailable")

        result = await decompose_query("find a cat", mock_llm)

        assert result.query == "find a cat"
        assert result.video_sources == []

    @pytest.mark.asyncio
    async def test_with_video_file_names(self, mock_llm):
        """Test providing video file names as context."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "accident scene", "video_sources": ["highway_cam.mp4"], "source_type": "video_file"}'
        )

        result = await decompose_query(
            "find accident in highway_cam video",
            mock_llm,
            video_file_names=["highway_cam.mp4", "parking_lot.mp4"],
        )

        assert result.query == "accident scene"
        assert result.video_sources == ["highway_cam.mp4"]
        assert result.source_type == "video_file"

    @pytest.mark.asyncio
    async def test_empty_response_fields(self, mock_llm):
        """Test handling of null/empty fields in response."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "test", "video_sources": null, "attributes": null, "source_type": null}'
        )

        result = await decompose_query("test query", mock_llm)

        assert result.query == "test"
        assert result.video_sources == []
        assert result.attributes == []
        assert result.source_type == "video_file"

    @pytest.mark.asyncio
    async def test_custom_few_shot_examples(self, mock_llm):
        """Test using custom few-shot examples."""
        mock_llm.ainvoke.return_value = MagicMock(content='{"query": "forklift", "source_type": "stream"}')

        custom_examples = """Example:
User query: "Find forklift"
Output: {"query": "forklift", "source_type": "stream"}"""

        result = await decompose_query(
            "find forklift",
            mock_llm,
            few_shot_examples=custom_examples,
        )

        assert result.query == "forklift"

    @pytest.mark.asyncio
    async def test_query_with_only_attributes(self, mock_llm):
        """Test query that extracts only attributes."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "person with backpack", "attributes": ["person", "blue backpack", "hat"]}'
        )

        result = await decompose_query("find a person with a blue backpack and hat", mock_llm)

        assert result.query == "person with backpack"
        assert "blue backpack" in result.attributes
        assert "hat" in result.attributes

    @pytest.mark.asyncio
    async def test_partial_time_range(self, mock_llm):
        """Test query with only start time specified."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "security guard", "timestamp_start": "2025-01-01T08:00:00Z"}'
        )

        result = await decompose_query("find security guard after 8am", mock_llm)

        assert result.query == "security guard"
        assert result.timestamp_start == "2025-01-01T08:00:00Z"
        assert result.timestamp_end is None

    @pytest.mark.asyncio
    async def test_query_with_top_k(self, mock_llm):
        """Test extraction of top_k from query."""
        mock_llm.ainvoke.return_value = MagicMock(content='{"query": "red car", "top_k": 5}')

        result = await decompose_query("find top 5 red cars", mock_llm)

        assert result.query == "red car"
        assert result.top_k == 5

    @pytest.mark.asyncio
    async def test_query_with_min_cosine_similarity(self, mock_llm):
        """Test extraction of min_cosine_similarity from query."""
        mock_llm.ainvoke.return_value = MagicMock(content='{"query": "person running", "min_cosine_similarity": 0.8}')

        result = await decompose_query("find highly similar matches of person running", mock_llm)

        assert result.query == "person running"
        assert result.min_cosine_similarity == 0.8

    @pytest.mark.asyncio
    async def test_query_with_all_filtering_params(self, mock_llm):
        """Test extraction of both top_k and min_cosine_similarity."""
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"query": "blue truck", "top_k": 10, "min_cosine_similarity": 0.7}'
        )

        result = await decompose_query("find top 10 highly similar blue trucks", mock_llm)

        assert result.query == "blue truck"
        assert result.top_k == 10
        assert result.min_cosine_similarity == 0.7

    @pytest.mark.asyncio
    async def test_invalid_top_k_ignored(self, mock_llm):
        """Test that invalid top_k values are ignored."""
        mock_llm.ainvoke.return_value = MagicMock(content='{"query": "car", "top_k": "invalid"}')

        result = await decompose_query("find cars", mock_llm)

        assert result.query == "car"
        assert result.top_k is None

    @pytest.mark.asyncio
    async def test_invalid_min_cosine_similarity_ignored(self, mock_llm):
        """Test that invalid min_cosine_similarity values are ignored."""
        mock_llm.ainvoke.return_value = MagicMock(content='{"query": "car", "min_cosine_similarity": "high"}')

        result = await decompose_query("find similar cars", mock_llm)

        assert result.query == "car"
        assert result.min_cosine_similarity is None

    @pytest.mark.asyncio
    async def test_negative_min_cosine_similarity(self, mock_llm):
        """Test extraction of negative min_cosine_similarity (valid range is -1.0 to 1.0)."""
        mock_llm.ainvoke.return_value = MagicMock(content='{"query": "any object", "min_cosine_similarity": -0.5}')

        result = await decompose_query("find any matching objects", mock_llm)

        assert result.query == "any object"
        assert result.min_cosine_similarity == -0.5


class TestExecuteCoreSearch:
    """Test execute_core_search result-limit precedence."""

    @pytest.mark.asyncio
    async def test_explicit_top_k_is_not_overridden_by_query_decomposition(self, monkeypatch):
        captured_payloads: list[dict[str, object]] = []

        async def mock_decompose_query(*args, **kwargs):
            return DecomposedQuery(query="red car", top_k=20)

        async def mock_embed_search_ainvoke(query_input_json: str):
            captured_payloads.append(json.loads(query_input_json))
            return {
                "results": [
                    {
                        "video_name": "video1.mp4",
                        "description": "Test video",
                        "start_time": "2025-01-15T10:00:00Z",
                        "end_time": "2025-01-15T10:01:00Z",
                        "sensor_id": "sensor-1",
                        "screenshot_url": "http://example.com/screenshot1.jpg",
                        "similarity_score": 0.95,
                    }
                ]
            }

        monkeypatch.setattr("vss_agents.tools.search.decompose_query", mock_decompose_query)

        embed_search = MagicMock()
        embed_search.ainvoke = AsyncMock(side_effect=mock_embed_search_ainvoke)

        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="",
        )

        updates = []
        async for update in execute_core_search(
            search_input=SearchInput(
                query="find top 20 red cars",
                source_type="video_file",
                top_k=3,
                agent_mode=True,
            ),
            embed_search=embed_search,
            agent_llm=object(),
            config=config,
            builder=MagicMock(),
        ):
            updates.append(update)

        assert captured_payloads[0]["params"]["top_k"] == "6"
        assert any(isinstance(update, SearchOutput) for update in updates)

    @pytest.mark.asyncio
    async def test_min_cosine_similarity_filters_individual_clips(self):
        embed_search = MagicMock()
        embed_search.ainvoke = AsyncMock(
            return_value={
                "results": [
                    {
                        "video_name": "video1.mp4",
                        "description": "High similarity clip",
                        "start_time": "2025-01-15T10:00:00Z",
                        "end_time": "2025-01-15T10:00:10Z",
                        "sensor_id": "sensor-1",
                        "screenshot_url": "http://example.com/screenshot1.jpg",
                        "similarity_score": 0.24,
                    },
                    {
                        "video_name": "video1.mp4",
                        "description": "Low similarity clip",
                        "start_time": "2025-01-15T10:00:10Z",
                        "end_time": "2025-01-15T10:00:20Z",
                        "sensor_id": "sensor-1",
                        "screenshot_url": "http://example.com/screenshot2.jpg",
                        "similarity_score": 0.14,
                    },
                ]
            }
        )

        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="",
        )

        final_output = None
        async for update in execute_core_search(
            search_input=SearchInput(
                query="find falldown clips",
                source_type="video_file",
                top_k=10,
                min_cosine_similarity=0.2,
                agent_mode=False,
            ),
            embed_search=embed_search,
            agent_llm=None,
            config=config,
            builder=MagicMock(),
        ):
            if isinstance(update, SearchOutput):
                final_output = update

        assert final_output is not None
        assert len(final_output.data) == 1
        assert final_output.data[0].similarity == 0.24
        assert final_output.data[0].start_time == "2025-01-15T10:00:00Z"

    @pytest.mark.asyncio
    async def test_merge_refill_fetches_more_candidates_to_fill_top_k(self):
        captured_top_ks: list[int] = []
        all_results: list[dict[str, object]] = []

        merged_group_sizes = [3, 3, 3, 3, 3, 3, 2]
        current_index = 0
        for group_index, group_size in enumerate(merged_group_sizes):
            sensor_id = f"sensor-merge-{group_index}"
            for offset in range(group_size):
                start_second = current_index * 10
                all_results.append(
                    {
                        "video_name": f"merge-video-{group_index}.mp4",
                        "description": f"Merged clip {group_index}",
                        "start_time": f"2025-01-15T10:{start_second // 60:02d}:{start_second % 60:02d}Z",
                        "end_time": f"2025-01-15T10:{(start_second + 10) // 60:02d}:{(start_second + 10) % 60:02d}Z",
                        "sensor_id": sensor_id,
                        "screenshot_url": f"http://example.com/merge-{group_index}-{offset}.jpg",
                        "similarity_score": 0.4 - (current_index * 0.001),
                    }
                )
                current_index += 1

        for fill_index in range(10):
            start_second = current_index * 10
            all_results.append(
                {
                    "video_name": f"fill-video-{fill_index}.mp4",
                    "description": f"Fill clip {fill_index}",
                    "start_time": f"2025-01-15T10:{start_second // 60:02d}:{start_second % 60:02d}Z",
                    "end_time": f"2025-01-15T10:{(start_second + 10) // 60:02d}:{(start_second + 10) % 60:02d}Z",
                    "sensor_id": f"sensor-fill-{fill_index}",
                    "screenshot_url": f"http://example.com/fill-{fill_index}.jpg",
                    "similarity_score": 0.3 - (fill_index * 0.001),
                }
            )
            current_index += 1

        async def mock_embed_search_ainvoke(query_input_json: str):
            payload = json.loads(query_input_json)
            requested_top_k = int(payload["params"]["top_k"])
            captured_top_ks.append(requested_top_k)
            return {"results": all_results[:requested_top_k]}

        embed_search = MagicMock()
        embed_search.ainvoke = AsyncMock(side_effect=mock_embed_search_ainvoke)

        config = SearchConfig(
            embed_search_tool="embed_search",
            agent_mode_llm="gpt-4o",
            vst_internal_url="",
        )

        final_output = None
        async for update in execute_core_search(
            search_input=SearchInput(
                query="find merged clips but keep ten results",
                source_type="video_file",
                top_k=10,
                min_cosine_similarity=0.2,
                agent_mode=False,
            ),
            embed_search=embed_search,
            agent_llm=None,
            config=config,
            builder=MagicMock(),
        ):
            if isinstance(update, SearchOutput):
                final_output = update

        assert final_output is not None
        assert len(final_output.data) == 10
        assert captured_top_ks[0] == 20
        assert captured_top_ks[-1] > 20
        assert final_output.data[7].video_name == "fill-video-0.mp4"


class TestQueryInputSourceType:
    """Test QueryInput source_type field."""

    def test_source_type_required(self):
        with pytest.raises(ValidationError):
            QueryInput()

    def test_source_type_rtsp(self):
        qi = QueryInput(source_type="rtsp")
        assert qi.source_type == "rtsp"

    def test_source_type_video_file(self):
        qi = QueryInput(source_type="video_file")
        assert qi.source_type == "video_file"

    def test_source_type_in_serialization(self):
        qi = QueryInput(
            id="test",
            params={"query": "test"},
            source_type="rtsp",
        )
        json_str = qi.model_dump_json()
        parsed = json.loads(json_str)
        assert parsed["source_type"] == "rtsp"
