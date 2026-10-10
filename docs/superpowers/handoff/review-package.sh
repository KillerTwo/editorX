#!/usr/bin/env bash
# bash port of review-package.ps1. Usage: review-package.sh PLAN BASE HEAD LABEL
set -euo pipefail
plan=$1; base=$2; head=${3:-HEAD}; label=$4
here=$(cd "$(dirname "$0")" && pwd)
ws="$here/sdd/$(basename "$plan" .md)"
mkdir -p "$ws"
out="$ws/$label.diff"
git merge-base --is-ancestor "$base" "$head" || { echo "HEAD is not a descendant of BASE" >&2; exit 3; }
{
  echo '## Commits'; git log --oneline "$base..$head"
  echo; echo '## Stat'; git diff --stat "$base..$head" -- . ':(exclude)pnpm-lock.yaml'
  echo; echo '## Diff (pnpm-lock.yaml excluded)'; git diff -U10 "$base..$head" -- . ':(exclude)pnpm-lock.yaml'
} > "$out"
echo "$out"
