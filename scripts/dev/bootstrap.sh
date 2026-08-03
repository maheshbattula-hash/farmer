#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [ ! -f apps/mobile/.env ]; then
  cp apps/mobile/.env.example apps/mobile/.env
  echo "Created apps/mobile/.env from apps/mobile/.env.example"
fi

npm install --workspaces --include-workspace-root

echo "Bootstrap complete."
echo "Make sure MongoDB is running on mongodb://127.0.0.1:27017"
