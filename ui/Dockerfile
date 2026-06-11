ARG USER_ID=65532
ARG GROUP_ID=65532
ARG BUILD_TYPE=prod


# Builder phase
FROM node:22 AS builder
ARG USER_ID
ARG GROUP_ID

WORKDIR /repo

# Copy workspace manifests first so dependency install can be cached
COPY ui/package.json ui/package-lock.json ui/turbo.json /repo/ui/
COPY ui/apps/nv-metropolis-bp-vss-ui/package.json /repo/ui/apps/nv-metropolis-bp-vss-ui/
COPY ui/apps/nemo-agent-toolkit-ui/package.json /repo/ui/apps/nemo-agent-toolkit-ui/
COPY ui/packages/nemo-agent-toolkit-ui/package.json /repo/ui/packages/nemo-agent-toolkit-ui/
COPY ui/packages/nv-metropolis-bp-vss-ui/all/package.json /repo/ui/packages/nv-metropolis-bp-vss-ui/all/
COPY ui/packages/nv-metropolis-bp-vss-ui/alerts/package.json /repo/ui/packages/nv-metropolis-bp-vss-ui/alerts/
COPY ui/packages/nv-metropolis-bp-vss-ui/dashboard/package.json /repo/ui/packages/nv-metropolis-bp-vss-ui/dashboard/
COPY ui/packages/nv-metropolis-bp-vss-ui/map/package.json /repo/ui/packages/nv-metropolis-bp-vss-ui/map/
COPY ui/packages/nv-metropolis-bp-vss-ui/search/package.json /repo/ui/packages/nv-metropolis-bp-vss-ui/search/
COPY ui/packages/nv-metropolis-bp-vss-ui/video-management/package.json /repo/ui/packages/nv-metropolis-bp-vss-ui/video-management/

ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_BUILD_TRACES false

WORKDIR /repo/ui
RUN npm ci

# Copy source files after dependencies so UI code changes do not invalidate npm install
COPY ui/ ./

RUN cp node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs apps/nv-metropolis-bp-vss-ui/public/pdf.worker.min.mjs

RUN npx turbo build

# Set permissions for __ENV.js files to be writable at runtime
RUN chmod -R 755 apps/nv-metropolis-bp-vss-ui/public && \
    chmod -R 755 apps/nemo-agent-toolkit-ui/public && \
    chown -R ${USER_ID}:${GROUP_ID} apps/nv-metropolis-bp-vss-ui/public && \
    chown -R ${USER_ID}:${GROUP_ID} apps/nemo-agent-toolkit-ui/public


# Conditional runner phase
FROM node:22-bookworm-slim as runner-prod
ARG BUILD_TYPE

RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-core \
        libreoffice-writer \
        fonts-noto-cjk \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM node:22-bookworm-slim as runner-dev
ARG BUILD_TYPE

RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-core \
        libreoffice-writer \
        fonts-noto-cjk \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*


FROM runner-${BUILD_TYPE} as runner
ARG USER_ID
ARG GROUP_ID


WORKDIR /repo


# Copy standalone output from each app into its own subdirectory (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/apps/nv-metropolis-bp-vss-ui/.next/standalone ./apps/nv-metropolis-bp-vss-ui/
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/apps/nv-metropolis-bp-vss-ui/.next/static ./apps/nv-metropolis-bp-vss-ui/apps/nv-metropolis-bp-vss-ui/.next/static
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=755 /repo/ui/apps/nv-metropolis-bp-vss-ui/public ./apps/nv-metropolis-bp-vss-ui/apps/nv-metropolis-bp-vss-ui/public

COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/apps/nemo-agent-toolkit-ui/.next/standalone ./apps/nemo-agent-toolkit-ui/
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/apps/nemo-agent-toolkit-ui/.next/static ./apps/nemo-agent-toolkit-ui/apps/nemo-agent-toolkit-ui/.next/static
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=755 /repo/ui/apps/nemo-agent-toolkit-ui/public ./apps/nemo-agent-toolkit-ui/apps/nemo-agent-toolkit-ui/public

# Copy required configuration files with their dependencies for next-runtime-env in custom-server.js (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/next-runtime-env ./node_modules/next-runtime-env
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/chalk ./node_modules/chalk
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/ansi-styles ./node_modules/ansi-styles
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/supports-color ./node_modules/supports-color
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/color-convert ./node_modules/color-convert
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/color-name ./node_modules/color-name
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/node_modules/has-flag ./node_modules/has-flag

# Copy custom server (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=555 /repo/ui/custom-server.js ./custom-server.js

# Copy license files (read-only)
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} --chmod=444 /repo/ui/LICENSE* ./

# Set environment variables
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOST 0.0.0.0


# Create separate stages for prod and dev commands
FROM runner as runner-prod-cmd
ARG USER_ID
ARG GROUP_ID

# Ensure we run as nonroot user
USER ${USER_ID}:${GROUP_ID}
CMD ["node", "custom-server.js"]


FROM runner as runner-dev-cmd
ARG USER_ID
ARG GROUP_ID

USER ${USER_ID}:${GROUP_ID}


# Final stage that selects the appropriate command based on BUILD_TYPE
FROM runner-${BUILD_TYPE}-cmd
ARG USER_ID
ARG GROUP_ID

USER ${USER_ID}:${GROUP_ID}