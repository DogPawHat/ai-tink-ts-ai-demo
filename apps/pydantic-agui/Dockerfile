# Build from the repository root:
#   fly deploy . --config apps/pydantic-agui/fly.toml --dockerfile apps/pydantic-agui/Dockerfile --remote-only
FROM node:24-slim AS client
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/pydantic-agui/package.json apps/pydantic-agui/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter pydantic-agui
COPY apps/pydantic-agui/tsconfig.json apps/pydantic-agui/vite.config.ts apps/pydantic-agui/
COPY apps/pydantic-agui/src apps/pydantic-agui/src
RUN pnpm --filter pydantic-agui build

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1
WORKDIR /app
COPY apps/pydantic-agui/server/pyproject.toml apps/pydantic-agui/server/uv.lock ./
RUN uv sync --frozen --no-install-project
COPY apps/pydantic-agui/server/src src
RUN uv sync --frozen
COPY --from=client /repo/apps/pydantic-agui/dist/client client
ENV STATIC_DIR=/app/client PATH="/app/.venv/bin:$PATH"
EXPOSE 8080
CMD ["uvicorn", "pydantic_agui.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
