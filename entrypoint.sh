#!/bin/sh
set -e

echo "[INFO] Fixing permissions on mounted volumes..."
chown -R appuser:appuser /app/data /app/uptonight_outputs /app/uptonight_configs || true

# ---- Docker socket permissions fix ----
if [ -S /var/run/docker.sock ]; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
    echo "[INFO] Detected docker.sock group id: $DOCKER_GID"

    if [ "$DOCKER_GID" -eq 0 ]; then
        echo "[WARNING] docker.sock belongs to root (Docker Desktop case)"
        echo "[WARNING] Running app as root because non-root access is impossible here"
        exec "$@"
    else
        # Normal Linux case
        groupadd -g "$DOCKER_GID" dockerhost || true
        usermod -aG dockerhost appuser
        echo "[INFO] Starting application as non-root user"
        exec su appuser -c "$*"
    fi
else
    echo "[INFO] No docker.sock mounted, starting normally"
    exec su appuser -c "$*"
fi

