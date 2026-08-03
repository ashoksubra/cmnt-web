#!/usr/bin/env bash
# On agent stop: if there are unpushed commits (or a ripe uncommitted tree),
# ask the agent to offer a clean commit + push to GitHub — never force-push.
set -euo pipefail

# Consume hook stdin (JSON event payload).
cat >/dev/null || true

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo '{}'
  exit 0
fi
cd "$ROOT"

# Only act on this project's mainline workflow.
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ -n "$REMOTE_URL" && "$REMOTE_URL" != *ashoksubra/cmnt-web* && "$REMOTE_URL" != *ashoksubra/cmnt-web.git* ]]; then
  echo '{}'
  exit 0
fi

DIRTY="$(git status --porcelain 2>/dev/null || true)"
AHEAD="0"
if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
  AHEAD="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)"
elif [[ -n "$(git rev-parse --verify HEAD 2>/dev/null || true)" ]] && [[ -z "$REMOTE_URL" || -z "$(git ls-remote --heads origin 2>/dev/null | head -1)" ]]; then
  # Local commits exist but no upstream yet — prompt to publish.
  AHEAD="$(git rev-list --count HEAD 2>/dev/null || echo 0)"
fi

MSG=""
if [[ "${AHEAD}" =~ ^[0-9]+$ ]] && (( AHEAD > 0 )); then
  MSG="There are ${AHEAD} local commit(s) not on GitHub (ashoksubra/cmnt-web). Prompt the user for a clean push: show git status/log, confirm, then push with -u if needed. Never force-push main. Do not invent a commit unless they also want uncommitted work included."
elif [[ -n "$DIRTY" ]]; then
  # Substantial tree changes with no commit yet — offer to commit+push once.
  CHANGED="$(echo "$DIRTY" | wc -l | tr -d ' ')"
  if (( CHANGED >= 3 )); then
    MSG="Working tree has ${CHANGED} changed paths and nothing is queued to push. Prompt the user whether to make a clean commit and push to GitHub ashoksubra/cmnt-web (status/diff/log first; no secrets; no force-push)."
  fi
fi

if [[ -z "$MSG" ]]; then
  echo '{}'
  exit 0
fi

# JSON-escape the follow-up message.
python3 - "$MSG" <<'PY'
import json, sys
msg = sys.argv[1]
print(json.dumps({"followup_message": msg}))
PY
