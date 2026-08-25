// SPDX-License-Identifier: Apache-2.0

#include "../src/korean_plate.h"
#include <assert.h>
#include <stdio.h>

int main(void) {
  KoreanPlateKind kind = KOREAN_PLATE_INVALID;
  assert(korean_plate_validate("81너9673", &kind) && kind == KOREAN_PLATE_STANDARD_7);
  assert(korean_plate_validate("123가4567", &kind) && kind == KOREAN_PLATE_STANDARD_8);
  assert(korean_plate_validate("891너9673", &kind) && kind == KOREAN_PLATE_STANDARD_8);
  assert(korean_plate_validate("서울12바3456", &kind) && kind == KOREAN_PLATE_REGIONAL_7);
  assert(korean_plate_validate("경기123허4567", &kind) && kind == KOREAN_PLATE_REGIONAL_8);
  assert(!korean_plate_validate("8991너9673", &kind));
  assert(!korean_plate_validate("81너96731", &kind));
  assert(!korean_plate_validate("사4783", &kind));
  assert(!korean_plate_validate("81로도6256", &kind));
  assert(!korean_plate_validate("25681로6", &kind));
  assert(!korean_plate_validate("29112", &kind));
  assert(!korean_plate_validate("12국3456", &kind));
  puts("korean_plate tests passed");
  return 0;
}
