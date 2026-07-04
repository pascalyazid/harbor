# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Stage 1 — build the Vite/React static bundle (no Rust/Tauri toolchain needed
# for the browser build).
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

# The corepack bundled with node can fail to verify the pnpm 11 signature
# ("Cannot find matching keyid"). Upgrade corepack first, then activate the
# exact pnpm version pinned in package.json.
RUN npm install -g corepack@latest && corepack enable

WORKDIR /app

# Copy manifests first for layer caching. pnpm-workspace.yaml carries the
# build-script allow-list (esbuild) that pnpm 10+/11 requires.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack prepare pnpm@11.9.0 --activate

# Deterministic install from the committed lockfile (no `pnpm add`, no drift).
RUN pnpm install --frozen-lockfile

# pnpm 11 blocks postinstall build scripts by default; force esbuild's so the
# Vite bundler's native binary is linked even if the allow-list is not honored.
RUN pnpm rebuild esbuild

# App source.
COPY . .

# Production build -> /app/dist
RUN pnpm build

# ----------------------------------------------------------------------------
# Stage 2 — serve the static bundle with nginx. Small image, no Node runtime.
# ----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA routing + gzip + sane cache headers.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite emits hashed assets into dist/assets; copy the whole dist tree.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
