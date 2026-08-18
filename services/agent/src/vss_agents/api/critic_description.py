"""On-demand Korean descriptions for already-computed Critic results."""

import json
import logging
from typing import Any

from fastapi import FastAPI
from fastapi import HTTPException
from pydantic import BaseModel
from pydantic import Field

from vss_agents.utils.reasoning_parsing import parse_reasoning_content

logger = logging.getLogger(__name__)

_DESCRIPTION_PROMPT = """You translate Critic verification metadata into Korean for a video-search UI.

Use ONLY the criteria whose value is true. Do not mention false, missing, rejected, unverified, confidence,
or the phrases '검색 조건과 일치합니다' and '충족한 조건은'.
Write exactly one natural Korean sentence describing the verified subject, attributes, and action.
Do not add headings, explanations, quotation marks, or English text.

Verified criteria JSON:
{criteria_json}
"""


class CriticDescriptionRequest(BaseModel):
    """The Critic metadata already returned with a search result."""

    criteria_met: dict[str, bool] = Field(default_factory=dict)


def _response_content(response: Any) -> str:
    """Normalize LangChain chat-model content to a short string."""
    _, final_content = parse_reasoning_content(response)
    if final_content:
        return final_content.strip()

    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in content
        ).strip()
    return str(content).strip()


def register_critic_description_route(app: FastAPI, llm: Any) -> None:
    """Register a lightweight route that does not invoke Critic/VLM again."""

    @app.post("/api/v1/critic-description")
    async def critic_description(request: CriticDescriptionRequest) -> dict[str, str]:
        verified = {criterion: value for criterion, value in request.criteria_met.items() if value}
        if not verified:
            return {"description": "검증된 항목이 없습니다."}

        prompt = _DESCRIPTION_PROMPT.format(
            criteria_json=json.dumps(verified, ensure_ascii=False, separators=(",", ":")),
        )
        try:
            response = await llm.ainvoke(prompt)
            description = _response_content(response).replace("\n", " ").strip()
        except Exception as exc:
            logger.exception("Failed to generate Korean Critic description")
            raise HTTPException(status_code=502, detail="Critic description generation failed") from exc

        if not description:
            raise HTTPException(status_code=502, detail="Critic description generation returned an empty response")
        return {"description": description}
