# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Deterministic Korean license-plate extraction for search queries."""

import re
import logging

logger = logging.getLogger(__name__)

_KOREAN_PLATE_PATTERN = re.compile(
    r"(?<![0-9가-힣])"
    r"((?:(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)"
    r"[\s-]*)?\d{2,3}[\s-]*[가-힣][\s-]*\d{4})"
    r"(?!\d)"
)

_PLATE_MARKER = r"(?:차번|번호판)"
_PLATE_SUFFIX_PATTERN = re.compile(
    rf"{_PLATE_MARKER}\s*(?:(?:뒤|뒷|끝)\s*(?:4\s*자리|네\s*자리)\s*)?[:=]?\s*(\d{{4}})(?!\d)"
)
_PLATE_PREFIX_PATTERN = re.compile(
    rf"{_PLATE_MARKER}\s*(?:(?:앞|앞쪽|앞부분|앞자리|시작)\s*)?[:=]?\s*"
    r"((?:(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)"
    r"[\s-]*\d{0,3}(?:[\s-]*[가-힣](?:[\s-]*\d{0,3})?)?"
    r"|\d{1,3}(?:[\s-]*[가-힣](?:[\s-]*\d{0,3})?)?))(?![0-9가-힣])"
)
_INTERNAL_PLATE_TOKEN_PATTERN = re.compile(
    r"(?<![0-9가-힣])(?:\*\d{4}|[0-9가-힣]{1,9}\*)(?![0-9가-힣])"
)
_LEFTOVER_PLATE_MARKER_PATTERN = re.compile(
    rf"{_PLATE_MARKER}\s*(?:(?:전체|정확히|일치)\s*)?"
)


def normalize_korean_license_plate(value: str) -> str:
    """Remove separators from a Korean license plate."""
    return re.sub(r"[\s-]+", "", value)


def _extract_plate_query(query: str) -> tuple[str | None, tuple[int, int] | None]:
    """Return an exact/suffix/prefix token and the matched query span."""
    # Log incoming query for diagnostics
    try:
        logger.info("license_plate._extract_plate_query input: %s", query)
    except Exception:
        pass

    exact_match = _KOREAN_PLATE_PATTERN.search(query)
    if exact_match:
        plate = normalize_korean_license_plate(exact_match.group(1))
        try:
            logger.info("license_plate._extract_plate_query exact match: %s span=%s", plate, exact_match.span())
        except Exception:
            pass
        return plate, exact_match.span()

    internal_match = _INTERNAL_PLATE_TOKEN_PATTERN.search(query)
    if internal_match:
        token = internal_match.group(0)
        try:
            logger.info("license_plate._extract_plate_query internal token: %s span=%s", token, internal_match.span())
        except Exception:
            pass
        return token, internal_match.span()

    suffix_match = _PLATE_SUFFIX_PATTERN.search(query)
    if suffix_match:
        token = f"*{suffix_match.group(1)}"
        try:
            logger.info("license_plate._extract_plate_query suffix token: %s span=%s", token, suffix_match.span())
        except Exception:
            pass
        return token, suffix_match.span()

    prefix_match = _PLATE_PREFIX_PATTERN.search(query)
    if prefix_match:
        prefix = normalize_korean_license_plate(prefix_match.group(1))
        token = f"{prefix}*"
        try:
            logger.info("license_plate._extract_plate_query prefix token: %s span=%s", token, prefix_match.span())
        except Exception:
            pass
        return token, prefix_match.span()

    return None, None


def extract_korean_license_plate(query: str) -> str | None:
    """Extract an exact plate or an explicitly marked prefix/suffix query."""
    plate, span = _extract_plate_query(query)
    try:
        logger.info("license_plate.extract_korean_license_plate result: %s span=%s", plate, span)
    except Exception:
        pass
    return plate


def remove_korean_license_plate(query: str) -> str:
    """Remove a plate expression while retaining the semantic query."""
    _, span = _extract_plate_query(query)
    if span is None:
        return query.strip()
    remaining = f"{query[: span[0]]} {query[span[1] :]}"
    remaining = _LEFTOVER_PLATE_MARKER_PATTERN.sub(" ", remaining)
    try:
        logger.info("license_plate.remove_korean_license_plate remaining before cleanup: %s", remaining)
    except Exception:
        pass
    return re.sub(r"\s+", " ", remaining).strip()


def split_korean_license_plate(query: str) -> tuple[str | None, str]:
    """Return the protected plate and remaining semantic query."""
    plate = extract_korean_license_plate(query)
    remaining = remove_korean_license_plate(query)
    try:
        logger.info("license_plate.split_korean_license_plate plate=%s remaining=%s", plate, remaining)
    except Exception:
        pass
    return plate, remaining
