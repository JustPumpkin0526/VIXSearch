ARG USER_ID=65532
ARG GROUP_ID=65532
ARG BUILD_TYPE=prod

# Builder phase
FROM node:22.22.3 AS builder
ARG USER_ID
ARG GROUP_ID

WORKDIR /repo

# Copy source files
COPY services/ui/ services/ui/

ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_BUILD_TRACES false

# `npm ci` and the subsequent `turbo` invocation must run from the UI workspace root,
# which is where `package.json` and `package-lock.json` live after the COPY above.
WORKDIR /repo/services/ui

RUN npm ci
# Matches CI: run `bundle` after `build` where defined (e.g. nv-metropolis-bp-vss-ui). The runner
# stage still COPYs standalone, `.next/static`, and `public` explicitly for custom-server.js, so this
# mainly keeps Docker builds aligned with `turbo run build bundle` and validates those tasks.
RUN npx turbo run build bundle

# Set permissions for __ENV.js files to be writable at runtime
RUN chmod -R 755 apps/nv-metropolis-bp-vss-ui/public && \
    chmod -R 755 apps/nemo-agent-toolkit-ui/public && \
    chown -R ${USER_ID}:${GROUP_ID} apps/nv-metropolis-bp-vss-ui/public && \
    chown -R ${USER_ID}:${GROUP_ID} apps/nemo-agent-toolkit-ui/public


# Conditional runner phase
FROM node:22-bookworm-slim AS runner-prod
ARG BUILD_TYPE

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    fontconfig \
    fonts-dejavu \
  libcairo2 \
  libpango-1.0-0 \
  libjpeg62-turbo \
  libgif7 \
    && rm -rf /var/lib/apt/lists/*

ENV HOME=/tmp
ENV SAL_USE_VCLPLUGIN=svp
ENV FONTCONFIG_PATH=/etc/fonts

RUN which soffice && soffice --headless --version


FROM node:22-bookworm-slim AS runner-dev
ARG BUILD_TYPE

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    fontconfig \
    fonts-dejavu \
  libcairo2 \
  libpango-1.0-0 \
  libjpeg62-turbo \
  libgif7 \
    && rm -rf /var/lib/apt/lists/*

ENV HOME=/tmp
ENV SAL_USE_VCLPLUGIN=svp
ENV FONTCONFIG_PATH=/etc/fonts

RUN which soffice && soffice --headless --version


FROM runner-${BUILD_TYPE} AS runner
ARG USER_ID
ARG GROUP_ID

WORKDIR /repo

RUN mkdir -p /usr/share/fonts/opentype/noto \
    /repo/apps/nv-metropolis-bp-vss-ui/assets/fonts

# Copy local Korean CJK fonts for report PDF generation and LibreOffice rendering
COPY --from=builder --chown=root:root --chmod=444 \
  /repo/services/ui/apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf \
  /usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf

COPY --from=builder --chown=root:root --chmod=444 \
  /repo/services/ui/apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Bold.otf \
  /usr/share/fonts/opentype/noto/NotoSansCJKkr-Bold.otf

# Also keep the same fonts under the app path for _docx.ts pdf-lib fallback lookup
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=444 \
  /repo/services/ui/apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf \
  /repo/apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf

COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=444 \
  /repo/services/ui/apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Bold.otf \
  /repo/apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Bold.otf

RUN fc-cache -f -v

# Copy standalone output from each app into its own subdirectory (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/apps/nv-metropolis-bp-vss-ui/.next/standalone ./apps/nv-metropolis-bp-vss-ui/
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/apps/nv-metropolis-bp-vss-ui/.next/static ./apps/nv-metropolis-bp-vss-ui/apps/nv-metropolis-bp-vss-ui/.next/static
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=755 /repo/services/ui/apps/nv-metropolis-bp-vss-ui/public ./apps/nv-metropolis-bp-vss-ui/apps/nv-metropolis-bp-vss-ui/public

COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/apps/nemo-agent-toolkit-ui/.next/standalone ./apps/nemo-agent-toolkit-ui/
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/apps/nemo-agent-toolkit-ui/.next/static ./apps/nemo-agent-toolkit-ui/apps/nemo-agent-toolkit-ui/.next/static
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=755 /repo/services/ui/apps/nemo-agent-toolkit-ui/public ./apps/nemo-agent-toolkit-ui/apps/nemo-agent-toolkit-ui/public

# Copy required configuration files with their dependencies for next-runtime-env in custom-server.js (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/next-runtime-env ./node_modules/next-runtime-env
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/chalk ./node_modules/chalk
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/ansi-styles ./node_modules/ansi-styles
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/supports-color ./node_modules/supports-color
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/color-convert ./node_modules/color-convert
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/color-name ./node_modules/color-name
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/has-flag ./node_modules/has-flag

# Copy native napi packages (prebuilt binaries) required at runtime (pdfjs -> @napi-rs/canvas)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/node_modules/@napi-rs ./node_modules/@napi-rs

# Copy custom server (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/services/ui/custom-server.js ./custom-server.js

# Copy license files (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=444 /repo/services/ui/LICENSE* ./
COPY --from=builder --chown=root:root --chmod=0444 /repo/services/ui/NVIDIA-Software-License-Agreement.pdf ./

# Set environment variables
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOST 0.0.0.0


# Create separate stages for prod and dev commands
FROM runner AS runner-prod-cmd
ARG USER_ID
ARG GROUP_ID

# Ensure we run as nonroot user
USER ${USER_ID}:${GROUP_ID}
CMD ["node", "custom-server.js"]


FROM runner AS runner-dev-cmd
ARG USER_ID
ARG GROUP_ID

USER ${USER_ID}:${GROUP_ID}


# Final stage that selects the appropriate command based on BUILD_TYPE
FROM runner-${BUILD_TYPE}-cmd
ARG USER_ID
ARG GROUP_ID

USER ${USER_ID}:${GROUP_ID}