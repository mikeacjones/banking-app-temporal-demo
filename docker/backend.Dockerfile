FROM python:3.13-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy workspace root + backend + workflow packages
COPY pyproject.toml uv.lock ./
COPY backend/ backend/
COPY workflows/python/ workflows/python/

# Install dependencies
RUN uv sync --frozen --no-dev

# No hot reload in Docker
ENV BANKING_RELOAD=0

EXPOSE 8000

CMD ["uv", "run", "--package", "banking-demo-backend", "server"]
