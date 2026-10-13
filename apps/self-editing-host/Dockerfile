# Build from the repository root:
#   fly deploy . --config apps/self-editing-host/fly.toml --dockerfile apps/self-editing-host/Dockerfile --remote-only
FROM node:24-slim AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/self-editing/package.json apps/self-editing/package.json
COPY apps/self-editing-host/package.json apps/self-editing-host/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter self-editing-host
COPY apps/self-editing apps/self-editing
COPY apps/self-editing-host apps/self-editing-host
RUN pnpm --filter self-editing-host build

FROM node:24-slim
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/self-editing/package.json apps/self-editing/package.json
COPY apps/self-editing-host/package.json apps/self-editing-host/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter self-editing-host
COPY --from=build /repo/apps/self-editing-host/dist apps/self-editing-host/dist
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "apps/self-editing-host/dist/index.mjs"]
