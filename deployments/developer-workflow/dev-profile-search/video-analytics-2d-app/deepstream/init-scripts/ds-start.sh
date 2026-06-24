#!/bin/bash

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

if [[ "$MODEL_TYPE" != "cnn" ]]; then
    echo "##### Invalid value $MODEL_TYPE for MODEL_TYPE variable. Valid values are: 'cnn'. #####"
    exit 1
fi

echo "##### $MODEL_TYPE models will be used. #####"

NUM_SENSORS=${NUM_SENSORS:-8}
MODEL_NAME_2D=${MODEL_NAME_2D:-GDINO}

if [[ "$MODEL_NAME_2D" != "GDINO" && "$MODEL_NAME_2D" != "RTDETR" ]]; then
    echo "##### Invalid value $MODEL_NAME_2D for MODEL_NAME_2D variable. Valid values are: 'GDINO' or 'RTDETR'. #####"
    exit 1
fi

if [[ "$STREAM_TYPE" == "redis" ]]; then
    CONFIG_FILE="ds-main-redis-config.txt"
else
    CONFIG_FILE="ds-main-config.txt"
fi

ACTIVE_CONFIG="$CONFIG_FILE"

echo "##### Using NUM_SENSORS=${NUM_SENSORS} #####"
echo "##### Using MODEL_NAME_2D=${MODEL_NAME_2D} #####"

if [[ "$MODEL_NAME_2D" == "GDINO" ]]; then
    RUNTIME_CONFIG_DIR=/tmp/search-profile-runtime-config
    mkdir -p "$RUNTIME_CONFIG_DIR"

    ACTIVE_CONFIG="$RUNTIME_CONFIG_DIR/$(basename "$CONFIG_FILE")"
    GDINO_CONFIG="$RUNTIME_CONFIG_DIR/config_triton_nvinferserver_gdino.txt"
    PGIE_CONFIG_SRC="ds-ppl-analytics-pgie-config.yml"
    PGIE_CONFIG_DST="$RUNTIME_CONFIG_DIR/$PGIE_CONFIG_SRC"
    DETECTOR_LABELS_SRC="ds-detector-labels.txt"
    DETECTOR_LABELS_DST="$RUNTIME_CONFIG_DIR/$DETECTOR_LABELS_SRC"
    TRACKER_CONFIG_SRC="ds-nvdcf-accuracy-tracker-config.yml"
    TRACKER_CONFIG_DST="$RUNTIME_CONFIG_DIR/$TRACKER_CONFIG_SRC"

    cp "$CONFIG_FILE" "$ACTIVE_CONFIG"
    cp "$PGIE_CONFIG_SRC" "$PGIE_CONFIG_DST"
    cp "$DETECTOR_LABELS_SRC" "$DETECTOR_LABELS_DST"
    cp "$TRACKER_CONFIG_SRC" "$TRACKER_CONFIG_DST"

    sed -i "/^\[source-list\]/,/^\[/{s/^max-batch-size=.*/max-batch-size=${NUM_SENSORS}/;}" "$ACTIVE_CONFIG"
    sed -i "/^\[streammux\]/,/^\[/{s/^batch-size=.*/batch-size=${NUM_SENSORS}/;}" "$ACTIVE_CONFIG"
    sed -i "/^\[primary-gie\]/,/^\[/{s/^batch-size=.*/batch-size=${NUM_SENSORS}/;}" "$ACTIVE_CONFIG"

    cp config_triton_nvinferserver_gdino.txt "$GDINO_CONFIG"
    echo "##### Building GDINO TensorRT engine... #####"
    /usr/src/tensorrt/bin/trtexec --onnx=/opt/storage/mgdino_mask_head_pruned_dynamic_batch.onnx \
      --minShapes=inputs:1x3x544x960,input_ids:1x256,attention_mask:1x256,position_ids:1x256,token_type_ids:1x256,text_token_mask:1x256x256 \
      --optShapes=inputs:1x3x544x960,input_ids:1x256,attention_mask:1x256,position_ids:1x256,token_type_ids:1x256,text_token_mask:1x256x256 \
      --maxShapes=inputs:${NUM_SENSORS}x3x544x960,input_ids:${NUM_SENSORS}x256,attention_mask:${NUM_SENSORS}x256,position_ids:${NUM_SENSORS}x256,token_type_ids:${NUM_SENSORS}x256,text_token_mask:${NUM_SENSORS}x256x256 \
      --useCudaGraph \
      --fp16 \
      --saveEngine=/opt/storage/model_gdino_trt.plan

    cp /opt/storage/model_gdino_trt.plan /opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/gdino_trt/1/model.plan

    GDINO_POSTPROCESS_MODEL_OVERRIDE="/opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/triton-model-overrides/gdino_postprocess/1/model.py"
    GDINO_POSTPROCESS_CONFIG_OVERRIDE="/opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/triton-model-overrides/gdino_postprocess/config.pbtxt"
    GDINO_POSTPROCESS_MODEL_DST="/opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/gdino_postprocess/1/model.py"
    GDINO_POSTPROCESS_CONFIG_DST="/opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/gdino_postprocess/config.pbtxt"

    if [[ -f "$GDINO_POSTPROCESS_MODEL_OVERRIDE" ]]; then
        cp "$GDINO_POSTPROCESS_MODEL_OVERRIDE" "$GDINO_POSTPROCESS_MODEL_DST"
    fi

    if [[ -f "$GDINO_POSTPROCESS_CONFIG_OVERRIDE" ]]; then
        cp "$GDINO_POSTPROCESS_CONFIG_OVERRIDE" "$GDINO_POSTPROCESS_CONFIG_DST"
    fi

    awk -v gdino_config="$GDINO_CONFIG" '
        function emit_primary_gie_overrides() {
            print "config-file=" gdino_config
            print "plugin-type=1"
        }
        /^\[primary-gie\]/ {
            in_primary=1
            print
            next
        }
        in_primary && /^\[/ {
            emit_primary_gie_overrides()
            in_primary=0
            print
            next
        }
        in_primary && (/^config-file=/ || /^plugin-type=/) {
            next
        }
        {
            print
        }
        END {
            if (in_primary) {
                emit_primary_gie_overrides()
            }
        }
    ' "$ACTIVE_CONFIG" > "$ACTIVE_CONFIG.tmp" && mv "$ACTIVE_CONFIG.tmp" "$ACTIVE_CONFIG"

    sed -i "s/max_batch_size: [0-9]\+/max_batch_size: ${NUM_SENSORS}/" "$GDINO_CONFIG"

    GDINO_CONFIG_FILES=(
        "/opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/ensemble_python_gdino/config.pbtxt"
        "/opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/gdino_trt/config.pbtxt"
        "/opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/gdino_postprocess/config.pbtxt"
        "/opt/nvidia/deepstream/deepstream/sources/TritonGdino/triton_model_repo/gdino_preprocess/config.pbtxt"
    )

    for gdino_config_file in "${GDINO_CONFIG_FILES[@]}"; do
        if [[ -f "$gdino_config_file" ]]; then
            sed -i \
                -e "s/^\s*max_batch_size\s*:\s*[0-9]\+\s*$/max_batch_size: ${NUM_SENSORS}/" \
                -e "s/^\s*max_batch_size\s*=\s*[0-9]\+\s*$/max_batch_size = ${NUM_SENSORS}/" \
                "$gdino_config_file"
        fi
    done

    M_PARAM=4
else
    M_PARAM=1
fi

echo -e "\nActive main config\n"
cat "$ACTIVE_CONFIG"

if [[ "$MODEL_NAME_2D" == "GDINO" ]]; then
    echo -e "\nActive GDINO config\n"
    cat "$GDINO_CONFIG"
fi

./metropolis_perception_app -c "$ACTIVE_CONFIG" -m "$M_PARAM" -t 0 -l 5 --message-rate 1 --tracker-reid
