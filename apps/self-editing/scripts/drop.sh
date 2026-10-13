#!/usr/bin/env bash
set -euo pipefail

toolchain_dir="$HOME/.local/share/vite-plus"
if [[ ! -d "$toolchain_dir" ]]; then
  echo "Vite+ toolchain not found at $toolchain_dir" >&2
  exit 1
fi

# The Drop environment belongs to the monorepo root. Its config mounts the
# repo read-only and only this app read-write.
repo_root="$(git rev-parse --show-toplevel)"
env_id="${repo_root#/}"
env_id="${env_id//\//-}"

case "${1:-}" in
  setup)
    drop run -e "$env_id" --mount "$toolchain_dir" bash -c 'vp --version && npm install --prefix "$HOME/.local" -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code'
    ;;
  dev)
    vp exec varlock run -- drop run -e "$env_id" --mount "$toolchain_dir" --tcp-publish 3000 vp dev --host 0.0.0.0
    ;;
  *)
    echo "Usage: $0 {setup|dev}" >&2
    exit 2
    ;;
esac
