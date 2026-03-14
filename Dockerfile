# syntax=docker/dockerfile:1.7
# =================================
# Builder stage
# =================================
FROM python:3.13-slim AS builder

# Build environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLBACKEND=Agg \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
       build-essential \
       python3-dev \
       libffi-dev \
       libssl-dev \
       cargo \
       rustc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and build wheels
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip wheel --wheel-dir /wheels -r requirements.txt

# =================================
# Production stage
# =================================
FROM python:3.13-slim AS production

# Labels
LABEL maintainer="Gloup" \
      description="MyAstroBoard" \
      org.opencontainers.image.source="https://github.com/WorldOfGZ/myastroboard" \
      org.opencontainers.image.license="AGPL-3.0"

# Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLBACKEND=Agg \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime dependencies
RUN set -eux; \
    apt-get update; \
    apt-get upgrade -y; \
    apt-get install -y --no-install-recommends \
       curl \
       ca-certificates \
       tzdata \
       passwd; \
    rm -rf /var/lib/apt/lists/* /tmp/* /usr/share/doc /usr/share/man/* /usr/share/info/*

# Copy wheels from builder and install
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* \
    && rm -rf /wheels /root/.cache/pip

# Version file
COPY VERSION /app/VERSION

# Application code
COPY backend/ ./backend/
COPY templates/ ./templates/
COPY static/ ./static/

# Application directories
RUN mkdir -p /app/data /app/uptonight/configs /app/uptonight/outputs

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && sed -i 's/\r$//' /entrypoint.sh \
    && chown root:root /entrypoint.sh

# Expose port
EXPOSE 5000

# Entrypoint root → fix perms → drop user
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "backend.app:app"]