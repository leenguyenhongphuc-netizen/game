#!/usr/bin/env bash
# Dựng bản mới nhất và chạy máy chủ thử ở cổng 3100 với cơ sở dữ liệu trống (PostgreSQL cục bộ).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${UI_TEST_DATABASE_URL:=postgres://vuon:vuon@localhost:5432/vuon_ui}"
npm run build
pkill -f "PORT=3100" 2>/dev/null || true
psql "${UI_TEST_DATABASE_URL%/*}/postgres" -qc "drop database if exists vuon_ui" -c "create database vuon_ui" 2>/dev/null \
  || su postgres -c "psql -qc 'drop database if exists vuon_ui' -c 'create database vuon_ui owner vuon'"
DATABASE_URL="$UI_TEST_DATABASE_URL" TIME_SCALE=3600 PORT=3100 nohup node server/src/index.ts > tools/ui-test/server.log 2>&1 &
for _ in $(seq 1 30); do curl -sf localhost:3100/api/health >/dev/null && { echo "Máy chủ thử đã chạy ở http://localhost:3100"; exit 0; }; sleep 1; done
echo "Máy chủ thử không lên được, xem tools/ui-test/server.log"; exit 1
