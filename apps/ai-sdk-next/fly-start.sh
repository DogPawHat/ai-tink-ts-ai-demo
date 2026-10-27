#!/bin/bash
# Runs both halves of the demo on one machine: Hono on 127.0.0.1:8020, where
# only Next.js can reach it, and Next.js on the public port. If either exits,
# so does the other, and Fly restarts the machine.
trap 'kill $(jobs -p) 2>/dev/null' EXIT
PORT=8020 HOST=127.0.0.1 node apps/ai-sdk-hono/src/main.ts &
apps/ai-sdk-next/node_modules/.bin/next start apps/ai-sdk-next --hostname 0.0.0.0 --port "${PORT:-8080}" &
wait -n
