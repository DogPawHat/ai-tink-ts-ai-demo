# Both halves of the AI SDK demo in one image (see fly-start.sh). Build from the repository root:
#   fly deploy . --config apps/ai-sdk-next/fly.toml --dockerfile apps/ai-sdk-next/Dockerfile --remote-only
FROM node:24-slim AS build
RUN npm install -g pnpm@12.6.0
# One cache for every build on the builder: packages, and pnpm's record that the lockfile passed its supply-chain check.
ENV PNPM_CONFIG_STORE_DIR=/pnpm/store PNPM_CONFIG_CACHE_DIR=/pnpm/cache
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ai-sdk-next/package.json apps/ai-sdk-next/package.json
COPY apps/ai-sdk-hono/package.json apps/ai-sdk-hono/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm pnpm install --frozen-lockfile --ignore-scripts --filter ai-sdk-next --filter ai-sdk-hono
COPY apps/ai-sdk-next apps/ai-sdk-next
COPY apps/ai-sdk-hono apps/ai-sdk-hono
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter ai-sdk-next build

FROM node:24-slim
RUN npm install -g pnpm@12.6.0
# One cache for every build on the builder: packages, and pnpm's record that the lockfile passed its supply-chain check.
ENV PNPM_CONFIG_STORE_DIR=/pnpm/store PNPM_CONFIG_CACHE_DIR=/pnpm/cache
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ai-sdk-next/package.json apps/ai-sdk-next/package.json
COPY apps/ai-sdk-hono/package.json apps/ai-sdk-hono/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm pnpm install --frozen-lockfile --ignore-scripts --prod --filter ai-sdk-next --filter ai-sdk-hono
COPY apps/ai-sdk-hono/src apps/ai-sdk-hono/src
COPY apps/ai-sdk-next/next.config.ts apps/ai-sdk-next/fly-start.sh apps/ai-sdk-next/
COPY --from=build /repo/apps/ai-sdk-next/.next apps/ai-sdk-next/.next
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080
EXPOSE 8080
CMD ["apps/ai-sdk-next/fly-start.sh"]
