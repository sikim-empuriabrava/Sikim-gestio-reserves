#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required" >&2
  exit 1
fi

export PGSSLMODE=${PGSSLMODE:-require}

mkdir -p supabase docs

pg_dump --schema-only --no-owner --no-privileges "$SUPABASE_DB_URL" > supabase/schema_snapshot.sql

tmp_json=$(mktemp)
psql "$SUPABASE_DB_URL" -tA -f scripts/db_report.sql > "$tmp_json"

python3 scripts/render_db_md.py "$tmp_json" docs/database.md

rm -f "$tmp_json"
