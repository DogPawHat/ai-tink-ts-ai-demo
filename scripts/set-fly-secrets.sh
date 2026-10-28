#!/bin/bash
# Sets ANTHROPIC_API_KEY and ACCESS_KEY on the gated demo apps in one
# `fly secrets set` per app, so each restarts once with the gate and the key
# turned on together. The self-editing host reaches Claude through the
# Sprites connector, so it only gets ACCESS_KEY.
#
#   scripts/set-fly-secrets.sh                   # prompts for the Anthropic key
#   ANTHROPIC_API_KEY=... scripts/set-fly-secrets.sh
#   ACCESS_KEY=... scripts/set-fly-secrets.sh    # one access key for every app
#
# Every app gets the same access key: ACCESS_KEY if set, otherwise a new
# random one. The links with the keys are printed and saved to $URLS_FILE, since Fly can't
# show a secret again.
set -euo pipefail

APPS=(ai-tink-start-chat ai-tink-genui ai-tink-ai-sdk ai-tink-pydantic)
ACCESS_ONLY_APPS=(ai-tink-host)
URLS_FILE="${URLS_FILE:-$HOME/.config/ai-tink/access-urls}"

export PATH="$HOME/.fly/bin:$PATH"

anthropic_key="${ANTHROPIC_API_KEY:-}"
if [ -z "$anthropic_key" ]; then
  read -rsp "Anthropic API key: " anthropic_key
  echo
fi
[ -n "$anthropic_key" ] || { echo "No Anthropic API key given." >&2; exit 1; }

mkdir -p "$(dirname "$URLS_FILE")"
touch "$URLS_FILE"
chmod 600 "$URLS_FILE"

access_key="${ACCESS_KEY:-$(openssl rand -hex 24)}"

save_url() {
  local url="https://$1.fly.dev/?key=$access_key"
  echo "$(date -u +%FT%TZ) $url" >> "$URLS_FILE"
  echo "$1: $url"
}

for app in "${APPS[@]}"; do
  echo "Setting secrets on $app..."
  fly secrets set ANTHROPIC_API_KEY="$anthropic_key" ACCESS_KEY="$access_key" --app "$app"
  save_url "$app"
done

for app in "${ACCESS_ONLY_APPS[@]}"; do
  echo "Setting the access key on $app..."
  fly secrets set ACCESS_KEY="$access_key" --app "$app"
  save_url "$app"
done

echo "Links saved to $URLS_FILE"
