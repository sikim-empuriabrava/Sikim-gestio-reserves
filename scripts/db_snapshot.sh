#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required" >&2
  exit 1
fi

export PGSSLMODE=${PGSSLMODE:-require}

mkdir -p supabase docs

tmp_schema=$(mktemp)
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file "$tmp_schema"

if [[ -f supabase/schema_snapshot.sql ]] && cmp -s "$tmp_schema" supabase/schema_snapshot.sql; then
  rm -f "$tmp_schema"
else
  mv "$tmp_schema" supabase/schema_snapshot.sql
fi

tmp_json=$(mktemp)
tmp_md=$(mktemp)
psql "$SUPABASE_DB_URL" -tA -f scripts/db_report.sql > "$tmp_json"

python3 scripts/render_db_md.py "$tmp_json" "$tmp_md"

if [[ -f docs/database.md ]] && cmp -s "$tmp_md" docs/database.md; then
  rm -f "$tmp_md"
else
  mv "$tmp_md" docs/database.md
fi

rm -f "$tmp_json"
