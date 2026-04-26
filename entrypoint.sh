#!/bin/sh
set -e

echo "[INFO] Fixing permissions on mounted volumes..."
chown -R appuser:appuser /app/data || true

echo "[INFO] Cleaning temporary files in /app/data..."
# Keep persisted caches/status across restarts.
# Only remove transient lock/trigger files.
find /app/data -type f \( \
  -name "*.lock" -o \
  -name "scheduler_trigger" \
\) -delete || true
# Keep SkyTonight logs for production diagnostics.

echo "[INFO] Starting application as non-root user"
exec su appuser -c "$*"