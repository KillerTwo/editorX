#!/usr/bin/env bash
# bash port of task-brief.ps1: plan header (everything before the first "### Task") + the body of Task N.
# Usage: task-brief.sh PLAN N
set -euo pipefail
plan=$1; n=$2
here=$(cd "$(dirname "$0")" && pwd)
ws="$here/sdd/$(basename "$plan" .md)"
mkdir -p "$ws"
out="$ws/task-$n-brief.md"
awk -v n="$n" '
  /^### Task [0-9]+/ && !seen { seen = 1 }
  !seen { print; next }
  /^```/ { infence = !infence }
  !infence && /^### Task [0-9]+:/ { intask = ($0 ~ ("^### Task " n ":")); if (intask) found = 1 }
  !infence && intask && /^## / { intask = 0 }
  intask { print }
  END { if (!found) exit 3 }
' "$plan" > "$out" || { echo "Task $n not found" >&2; exit 3; }
echo "$out"
