#!/usr/bin/env bash
set -euo pipefail

toolchain_dir="$HOME/.local/share/vite-plus"
if [[ ! -d "$toolchain_dir" ]]; then
  echo "Vite+ toolchain not found at $toolchain_dir" >&2
  exit 1
fi

case "${1:-}" in
  setup)
    drop run --mount "$toolchain_dir" vp --version
    ;;
  dev)
    vp exec varlock run -- drop run --mount "$toolchain_dir" --tcp-publish 3000 vp dev --host 0.0.0.0
    ;;
  *)
    echo "Usage: $0 {setup|dev}" >&2
    exit 2
    ;;
esac
