#!/usr/bin/env bash
# One-shot / later redeploy of the current tree to Cloudflare Pages.
# First run: npx wrangler login   (free Cloudflare account)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:web
npx wrangler pages deploy dist-web --project-name=cmnt-web
