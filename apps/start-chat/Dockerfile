# Build from the repository root:
#   fly deploy . --config apps/start-chat/fly.toml --dockerfile apps/start-chat/Dockerfile --remote-only
FROM node:24-slim AS build
RUN npm install -g pnpm@12.6.0
# One cache for every build on the builder: packages, and pnpm's record that the lockfile passed its supply-chain check.
ENV PNPM_CONFIG_STORE_DIR=/pnpm/store PNPM_CONFIG_CACHE_DIR=/pnpm/cache
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/start-chat/package.json apps/start-chat/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm pnpm install --frozen-lockfile --ignore-scripts --filter start-chat
COPY apps/start-chat apps/start-chat
RUN pnpm --filter start-chat build

FROM node:24-slim
RUN npm install -g pnpm@12.6.0
# One cache for every build on the builder: packages, and pnpm's record that the lockfile passed its supply-chain check.
ENV PNPM_CONFIG_STORE_DIR=/pnpm/store PNPM_CONFIG_CACHE_DIR=/pnpm/cache
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/start-chat/package.json apps/start-chat/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm pnpm install --frozen-lockfile --ignore-scripts --prod --filter start-chat
COPY --from=build /repo/apps/start-chat/dist apps/start-chat/dist
COPY apps/start-chat/src/serve.ts apps/start-chat/src/serve.ts
COPY apps/start-chat/src/server/access-gate.ts apps/start-chat/src/server/access-gate.ts
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "apps/start-chat/src/serve.ts"]
