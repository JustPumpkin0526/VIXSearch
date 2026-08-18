#!/usr/bin/env bash
set -euo pipefail

# Download Helsinki-NLP/opus-mt-tc-big-ko-en assets required by query_translation.py
# Usage:
#   export HUGGINGFACE_HUB_TOKEN="hf_..."   # if required
#   ./scripts/download_query_translation_model.sh /vss-agent/models/opus-mt-tc-big-ko-en

TARGET_DIR=${1:-/vss-agent/models/opus-mt-tc-big-ko-en}
REPO_ID="Helsinki-NLP/opus-mt-tc-big-ko-en"

echo "Downloading model files for ${REPO_ID} into ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

# Use environment variables inside the heredoc to avoid argument-passing issues
env TARGET_DIR="${TARGET_DIR}" REPO_ID="${REPO_ID}" python3 - <<'PY'
from huggingface_hub import snapshot_download
import os
from pathlib import Path

target = Path(os.environ['TARGET_DIR'])
repo_id = os.environ['REPO_ID']
print('snapshot_download ->', target)
# Only grab the essential files used by query_translation.py
snapshot_download(
    repo_id=repo_id,
    local_dir=str(target),
    allow_patterns=[
        'config.json',
        'generation_config.json',
        'model.safetensors',
        'pytorch_model.bin',
        'source.spm',
        'target.spm',
    ],
    ignore_patterns=['*'],
)
print('Download complete')
PY

# Ensure files are readable
chmod -R u+rw,go+r "${TARGET_DIR}"

echo "Model saved to ${TARGET_DIR}"
