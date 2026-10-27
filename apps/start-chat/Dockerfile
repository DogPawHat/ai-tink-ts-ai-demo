# Build from the repository root:
#   fly deploy . --config apps/start-chat/fly.toml --dockerfile apps/start-chat/Dockerfile --remote-only
FROM node:24-slim AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/start-chat/package.json apps/start-chat/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter start-chat
COPY apps/start-chat apps/start-chat
RUN pnpm --filter start-chat build

FROM node:24-slim
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/start-chat/package.json apps/start-chat/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter start-chat
COPY --from=build /repo/apps/start-chat/dist apps/start-chat/dist
COPY apps/start-chat/src/serve.ts apps/start-chat/src/serve.ts
COPY apps/start-chat/src/server/access-gate.ts apps/start-chat/src/server/access-gate.ts
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "apps/start-chat/src/serve.ts"]
