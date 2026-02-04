# Multi-stage build for smaller production image
FROM python:3.11-alpine AS builder

# Build environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV MPLBACKEND=Agg

WORKDIR /build

# Install build dependencies for Alpine
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    g++ \
    musl-dev \
    python3-dev \
    libffi-dev \
    openssl-dev \
    cargo \
    rust

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt \
    && pip install --no-cache-dir --user gunicorn

# ================================
# Production stage
# ================================
FROM python:3.11-alpine AS production

# Prevents .pyc files and enables immediate logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV MPLBACKEND=Agg
ENV PATH=/usr/local/bin:$PATH

WORKDIR /app

# Install only runtime dependencies for Alpine
RUN apk add --no-cache \
    curl \
    ca-certificates \
    gnupg \
    tzdata \
    docker-cli \
    shadow \
    && rm -rf /tmp/* /var/cache/apk/*

# Copy Python packages from builder and make accessible to appuser
COPY --from=builder /root/.local /usr/local

# Version files
COPY VERSION /app/VERSION
COPY UPTONIGHT_VERSION /app/UPTONIGHT_VERSION

# Application code
COPY backend/ ./backend/
COPY templates/ ./templates/
COPY static/ ./static/

# Application directories
RUN mkdir -p /app/data /app/uptonight_outputs /app/uptonight_configs

# Create non-root user
RUN adduser -D -u 1000 appuser

# Copy entrypoint script and make it executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && sed -i 's/\r$//' /entrypoint.sh \
    && chown root:root /entrypoint.sh

EXPOSE 5000

# Entrypoint root → fix perms → drop user
ENTRYPOINT ["/entrypoint.sh"]

# Production default (gunicorn)
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "backend.app:app"]
