param([string]$Plan, [string]$Base, [string]$Head = 'HEAD', [string]$Label)
$ErrorActionPreference = 'Stop'
$name = [IO.Path]::GetFileNameWithoutExtension($Plan)
$ws = Join-Path $PSScriptRoot "sdd/$name"
New-Item -ItemType Directory -Force $ws | Out-Null
$out = Join-Path $ws "$Label.diff"
$content = @(
  '## Commits'; (git log --oneline "$Base..$Head")
  ''; '## Stat'; (git diff --stat "$Base..$Head" -- . ':(exclude)pnpm-lock.yaml')
  ''; '## Diff (pnpm-lock.yaml excluded)'; (git diff -U10 "$Base..$Head" -- . ':(exclude)pnpm-lock.yaml')
)
$content | Set-Content -Encoding UTF8 $out
Write-Output $out
