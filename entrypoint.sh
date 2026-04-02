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
# Clear skytonight transient data but preserve the catalogue (targets.json takes time to build)
rm -rf /app/data/skytonight/outputs/* || true
rm -rf /app/data/skytonight/logs/* || true
rm -rf /app/data/skytonight/runtime/* || true
rm -rf /app/data/skytonight/configs/* || true
rm -f /app/data/skytonight/calculation_results.json || true

echo "[INFO] Starting application as non-root user"
exec su appuser -c "$*"

