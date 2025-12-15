#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SECRET="${CRON_SECRET:-}"
WINDOW_DAYS="${WINDOW_DAYS:-7}"
TIME_RANGE="${TIME_RANGE:-short_term}"
ARTISTS="${ARTISTS:-5}"
TRACKS="${TRACKS:-5}"

function curl_json() {
  local path="$1"
  local qs="$2"
  curl -sS -X GET "${BASE_URL}${path}?${qs}" \
    -H "Accept: application/json"
  echo
}

qs_with_key() {
  local qs="$1"
  if [[ -n "$SECRET" ]]; then
    if [[ -n "$qs" ]]; then
      echo "key=${SECRET}&${qs}"
    else
      echo "key=${SECRET}"
    fi
  else
    echo "$qs"
  fi
}

spotify_qs="$(qs_with_key "timeRange=${TIME_RANGE}&artists=${ARTISTS}&tracks=${TRACKS}")"
github_weekly_qs="$(qs_with_key "windowDays=${WINDOW_DAYS}")"
github_sync_qs="$(qs_with_key "windowDays=${WINDOW_DAYS}")"

echo "=== Spotify snapshot (${TIME_RANGE}) ==="
curl_json "/api/integrations/spotify-sync" "$spotify_qs"

echo "=== GitHub weekly (${WINDOW_DAYS} days) ==="
curl_json "/api/integrations/github-weekly-sync" "$github_weekly_qs"

echo "=== GitHub PR sync (${WINDOW_DAYS} days) ==="
curl_json "/api/integrations/github-sync" "$github_sync_qs"
