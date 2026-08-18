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

ARG BASE_IMAGE="nvcr.io/nvidia/vss-core/vss-rt-cv:3.2.1"
FROM ${BASE_IMAGE}

# Copy sources
COPY src/metropolis_perception_app.c /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/metropolis_perception_app.c
COPY src/perception_utc.c /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/perception_utc.c
COPY src/metropolis_perception_app.h /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/metropolis_perception_app.h
COPY src/korean_plate.c /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/korean_plate.c
COPY src/korean_plate.h /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/korean_plate.h
COPY src/Makefile /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/Makefile
COPY src/deepstream_app.c /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/deepstream-app/deepstream_app.c
COPY src/lpr_parser/nvdsinfer_yolov7_lpr.cpp /tmp/lpr-parser/nvdsinfer_yolov7_lpr.cpp
COPY tests/ /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/tests/

ENV CUDA_VER=13.1
WORKDIR "/opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app"

# Build binary
RUN make
USER root:root
RUN make install
RUN g++ -std=c++17 -O2 -shared -fPIC \
    -I/opt/nvidia/deepstream/deepstream/sources/includes \
    -I/usr/local/cuda-${CUDA_VER}/include \
    /tmp/lpr-parser/nvdsinfer_yolov7_lpr.cpp \
    -o /opt/nvidia/deepstream/deepstream/lib/libnvdsinfer_custom_yolov7_lpr.so

# Extend the bundled mega2d protobuf converter without changing object.type.
RUN cd /opt/nvidia/deepstream/deepstream/sources/libs/nvmsgconv_mega2d && \
    perl -0pi -e 's!    auto \*info = object->mutable_info\(\);!    auto *info = object->mutable_info();\n    if (meta->otherAttrs \&\& meta->otherAttrs[0]) {\n      (*info)["licensePlate"] = meta->otherAttrs;\n    }! or die "Object.info anchor not found\n"' deepstream_schema/eventmsg_payload.cpp && \
    make && \
    cp libnvds_msgconv_mega2d.so /opt/nvidia/deepstream/deepstream/lib/libnvds_msgconv_mega2d.so

WORKDIR /opt/nvidia/deepstream/deepstream/sources/apps/sample_apps/metropolis_perception_app/

# Switch to this non-root user
USER 1000:1000
