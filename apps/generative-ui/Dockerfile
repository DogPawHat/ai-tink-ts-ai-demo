# Build from the repository root:
#   fly deploy . --config apps/generative-ui/fly.toml --dockerfile apps/generative-ui/Dockerfile --remote-only
FROM node:24-slim AS build
RUN npm install -g pnpm@12.6.0
# One cache for every build on the builder: packages, and pnpm's record that the lockfile passed its supply-chain check.
ENV PNPM_CONFIG_STORE_DIR=/pnpm/store PNPM_CONFIG_CACHE_DIR=/pnpm/cache
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/generative-ui/package.json apps/generative-ui/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm pnpm install --frozen-lockfile --ignore-scripts --filter generative-ui
COPY apps/generative-ui apps/generative-ui
RUN pnpm --filter generative-ui build

FROM node:24-slim
RUN npm install -g pnpm@12.6.0
# One cache for every build on the builder: packages, and pnpm's record that the lockfile passed its supply-chain check.
ENV PNPM_CONFIG_STORE_DIR=/pnpm/store PNPM_CONFIG_CACHE_DIR=/pnpm/cache
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/generative-ui/package.json apps/generative-ui/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm pnpm install --frozen-lockfile --ignore-scripts --prod --filter generative-ui
COPY --from=build /repo/apps/generative-ui/dist apps/generative-ui/dist
COPY apps/generative-ui/src/serve.ts apps/generative-ui/src/serve.ts
COPY apps/generative-ui/src/server/access-gate.ts apps/generative-ui/src/server/access-gate.ts
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "apps/generative-ui/src/serve.ts"]
