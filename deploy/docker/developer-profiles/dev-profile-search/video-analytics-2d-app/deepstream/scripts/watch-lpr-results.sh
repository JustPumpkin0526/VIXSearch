#!/usr/bin/env bash

set -euo pipefail

container_name="${1:-vss-rtvi-cv}"

if ! docker inspect "${container_name}" >/dev/null 2>&1; then
  echo "ERROR: container not found: ${container_name}" >&2
  echo "Usage: $0 [rt-cv-container-name]" >&2
  exit 1
fi

echo "Watching LPR output from ${container_name}. Press Ctrl-C to stop."
docker logs --follow --since 1m "${container_name}" 2>&1 |
  grep --line-buffered -E '\[LPR\]|NvDsInferContext\[UID 3\]|ERROR|Assertion'
