// SPDX-License-Identifier: Apache-2.0

#ifndef KOREAN_PLATE_H
#define KOREAN_PLATE_H

#include <stdbool.h>

typedef enum {
  KOREAN_PLATE_INVALID = 0,
  KOREAN_PLATE_STANDARD_7,
  KOREAN_PLATE_STANDARD_8,
  KOREAN_PLATE_REGIONAL_7,
  KOREAN_PLATE_REGIONAL_8,
} KoreanPlateKind;

bool korean_plate_validate(const char *text, KoreanPlateKind *kind);
const char *korean_plate_kind_name(KoreanPlateKind kind);

#endif
