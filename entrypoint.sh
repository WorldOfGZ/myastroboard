#!/bin/sh
set -e

echo "[INFO] Fixing permissions on mounted volumes..."
chown -R appuser:appuser /app/data || true

echo "[INFO] Cleaning temporary files in /app/data..."
# Old cache storage and lock files
find /app/data -type f \( \
  -name "*.lock" -o \
  -name "*cache*" -o \
  -name "conditions.json" -o \
  -name "scheduler_status.json" \
\) -delete || true
rm -rf /app/data/cache/* || true # Clear cache directory
# Clear skytonight logs but keep the directory itself
# We kept data as we have a fallback mechanism 
rm -rf /app/data/skytonight/logs/* || true

echo "[INFO] Starting application as non-root user"
exec su appuser -c "$*"

