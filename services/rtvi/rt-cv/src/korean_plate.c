// SPDX-License-Identifier: Apache-2.0

#include "korean_plate.h"

#include <stddef.h>
#include <string.h>

static const char *const kRegions[] = {
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남",
    "제주",
};

/* Model labels permitted in the single use-symbol position. Region labels
 * and the military branch marks 국/합/육/해/공 are intentionally excluded. */
static const char *const kUseSymbols[] = {
    "가", "나", "다", "라", "마", "바", "사", "아", "자", "차",
    "카", "타", "파", "하", "거", "너", "더", "러", "머", "버",
    "서", "어", "저", "처", "커", "터", "퍼", "허", "고", "노",
    "도", "로", "모", "보", "소", "오", "조", "초", "코", "토",
    "포", "호", "구", "누", "두", "루", "무", "부", "수", "우",
    "주", "추", "쿠", "투", "푸", "후", "배",
};

static bool consume_literal(const char **cursor, const char *literal) {
  const size_t length = strlen(literal);
  if (strncmp(*cursor, literal, length) != 0) {
    return false;
  }
  *cursor += length;
  return true;
}

static unsigned int consume_digits(const char **cursor) {
  unsigned int count = 0;
  while (**cursor >= '0' && **cursor <= '9') {
    ++(*cursor);
    ++count;
  }
  return count;
}

bool korean_plate_validate(const char *text, KoreanPlateKind *kind) {
  if (kind != NULL) *kind = KOREAN_PLATE_INVALID;
  if (text == NULL || *text == '\0') return false;

  const char *cursor = text;
  bool regional = false;
  for (size_t i = 0; i < sizeof(kRegions) / sizeof(kRegions[0]); ++i) {
    const char *candidate = cursor;
    if (consume_literal(&candidate, kRegions[i])) {
      cursor = candidate;
      regional = true;
      break;
    }
  }

  const unsigned int prefix_digits = consume_digits(&cursor);
  if (prefix_digits != 2 && prefix_digits != 3) return false;

  bool use_symbol_found = false;
  for (size_t i = 0; i < sizeof(kUseSymbols) / sizeof(kUseSymbols[0]); ++i) {
    const char *candidate = cursor;
    if (consume_literal(&candidate, kUseSymbols[i])) {
      cursor = candidate;
      use_symbol_found = true;
      break;
    }
  }
  if (!use_symbol_found || consume_digits(&cursor) != 4 || *cursor != '\0') {
    return false;
  }

  if (kind != NULL) {
    if (regional) {
      *kind = prefix_digits == 2 ? KOREAN_PLATE_REGIONAL_7 : KOREAN_PLATE_REGIONAL_8;
    } else {
      *kind = prefix_digits == 2 ? KOREAN_PLATE_STANDARD_7 : KOREAN_PLATE_STANDARD_8;
    }
  }
  return true;
}

const char *korean_plate_kind_name(KoreanPlateKind kind) {
  switch (kind) {
    case KOREAN_PLATE_STANDARD_7: return "standard-7";
    case KOREAN_PLATE_STANDARD_8: return "standard-8";
    case KOREAN_PLATE_REGIONAL_7: return "regional-7";
    case KOREAN_PLATE_REGIONAL_8: return "regional-8";
    default: return "invalid";
  }
}
