ARG BASE_IMAGE=rtvi-cv:3.2.1-custom-lpr-es-x86-r5
FROM ${BASE_IMAGE}

USER root

COPY nvmultiurisrcbin-image-embedding.patch /tmp/
RUN patch -p1 -d /opt/nvidia/deepstream/deepstream/sources/gst-plugins/gst-nvmultiurisrcbin < /tmp/nvmultiurisrcbin-image-embedding.patch \
    && g++ -fPIC $(pkg-config --cflags glib-2.0) -I/opt/nvidia/deepstream/deepstream/sources/includes -I/opt/nvidia/deepstream/deepstream/sources/libs/nvds_msgapi_common_src -c -o /opt/nvidia/deepstream/deepstream/sources/libs/nvds_msgapi_common_src/nvds_utils.o /opt/nvidia/deepstream/deepstream/sources/libs/nvds_msgapi_common_src/nvds_utils.cpp \
    && make -C /opt/nvidia/deepstream/deepstream/sources/gst-plugins/gst-nvmultiurisrcbin CUDA_VER=13.1 \
    && make -C /opt/nvidia/deepstream/deepstream/sources/gst-plugins/gst-nvmultiurisrcbin install \
    && rm -f /tmp/nvmultiurisrcbin-image-embedding.patch

USER 1000:1000
