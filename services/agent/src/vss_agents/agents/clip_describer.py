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

from collections.abc import AsyncGenerator
import logging
from typing import Literal

from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.component_ref import FunctionRef
from nat.data_models.function import FunctionBaseConfig
from pydantic import BaseModel
from pydantic import Field

from vss_agents.tools.vst.timeline import get_timeline
from vss_agents.tools.vst.utils import get_stream_id
from vss_agents.utils.time_convert import iso8601_to_datetime

logger = logging.getLogger(__name__)


class ClipDescriberConfig(FunctionBaseConfig, name="clip_describer"):
    video_analysis_tool: FunctionRef = Field(
        ...,
        description="Video understanding tool to use for describing search result clips.",
    )
    time_format: Literal["iso", "offset"] = Field(
        default="offset",
        description="Timestamp format expected by video_analysis_tool.",
    )
    default_prompt: str = Field(
        default="Describe the visible scene and important actions in this video clip.",
        description="Default prompt used until the UI provides a custom prompt.",
    )
    vlm_reasoning: bool = Field(
        default=False,
        description="Whether to enable VLM reasoning for clip description requests.",
    )


class ClipDescribeInput(BaseModel):
    sensor_id: str = Field(description="The sensor ID or stream ID of the search result clip.")
    start_timestamp: str = Field(description="The search result clip start timestamp in ISO 8601 format.")
    end_timestamp: str = Field(description="The search result clip end timestamp in ISO 8601 format.")
    user_prompt: str | None = Field(
        default=None,
        description="Optional prompt for the VLM. If omitted, the configured default prompt is used.",
    )
    vlm_reasoning: bool | None = Field(
        default=None,
        description="Optional per-request override for VLM reasoning.",
    )


class ClipDescribeOutput(BaseModel):
    sensor_id: str = Field(description="The sensor ID or stream ID that was analyzed.")
    start_timestamp: str = Field(description="The original input clip start timestamp.")
    end_timestamp: str = Field(description="The original input clip end timestamp.")
    description: str = Field(description="The VLM description for the clip.")


def _convert_to_seconds(timestamp: str, video_start_dt) -> float:
    timestamp_dt = iso8601_to_datetime(timestamp)
    return (timestamp_dt - video_start_dt).total_seconds()


@register_function(config_type=ClipDescriberConfig, framework_wrappers=[LLMFrameworkEnum.LANGCHAIN])
async def clip_describer(config: ClipDescriberConfig, builder: Builder) -> AsyncGenerator[FunctionInfo]:
    async def _describe_clip(clip_input: ClipDescribeInput) -> ClipDescribeOutput:
        video_analysis_tool = await builder.get_function(config.video_analysis_tool)
        prompt = (clip_input.user_prompt or config.default_prompt).strip()
        use_reasoning = clip_input.vlm_reasoning if clip_input.vlm_reasoning is not None else config.vlm_reasoning

        if config.time_format == "iso":
            video_analysis_input = {
                "sensor_id": clip_input.sensor_id,
                "start_timestamp": clip_input.start_timestamp,
                "end_timestamp": clip_input.end_timestamp,
                "user_prompt": prompt,
                "vlm_reasoning": use_reasoning,
            }
        else:
            stream_id = await get_stream_id(clip_input.sensor_id)
            start_iso, end_iso = await get_timeline(stream_id)
            video_start_dt = iso8601_to_datetime(start_iso)
            start_offset = _convert_to_seconds(clip_input.start_timestamp, video_start_dt)
            end_offset = _convert_to_seconds(clip_input.end_timestamp, video_start_dt)
            clip_end_offset = _convert_to_seconds(end_iso, video_start_dt)
            if end_offset > clip_end_offset:
                end_offset = clip_end_offset

            video_analysis_input = {
                "sensor_id": clip_input.sensor_id,
                "start_timestamp": start_offset,
                "end_timestamp": end_offset,
                "user_prompt": prompt,
                "vlm_reasoning": use_reasoning,
            }

        logger.info(
            "Requesting VLM clip description: sensor_id=%s start=%s end=%s",
            clip_input.sensor_id,
            video_analysis_input["start_timestamp"],
            video_analysis_input["end_timestamp"],
        )
        description = await video_analysis_tool.ainvoke(video_analysis_input)
        return ClipDescribeOutput(
            sensor_id=clip_input.sensor_id,
            start_timestamp=clip_input.start_timestamp,
            end_timestamp=clip_input.end_timestamp,
            description=str(description),
        )

    yield FunctionInfo.create(
        single_fn=_describe_clip,
        description=_describe_clip.__doc__ or "Describe a search result clip with the configured VLM.",
        input_schema=ClipDescribeInput,
        single_output_schema=ClipDescribeOutput,
    )
