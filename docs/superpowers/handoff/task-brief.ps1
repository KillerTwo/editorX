param([string]$Plan, [int]$N)
$ErrorActionPreference = 'Stop'
$name = [IO.Path]::GetFileNameWithoutExtension($Plan)
$ws = Join-Path $PSScriptRoot "sdd/$name"
New-Item -ItemType Directory -Force $ws | Out-Null
$lines = Get-Content -Encoding UTF8 $Plan
$firstTask = ($lines | Select-String -Pattern '^### Task \d+' | Select-Object -First 1).LineNumber
$start = ($lines | Select-String -Pattern "^### Task ${N}:" | Select-Object -First 1).LineNumber
if (-not $start) { throw "Task $N not found" }
$next = ($lines | Select-String -Pattern '^### Task \d+|^## ' | Where-Object { $_.LineNumber -gt $start } | Select-Object -First 1).LineNumber
$end = if ($next) { $next - 1 } else { $lines.Count }
$header = $lines[0..($firstTask - 2)]
$body = $lines[($start - 1)..($end - 1)]
$out = Join-Path $ws "task-$N-brief.md"
($header + $body) | Set-Content -Encoding UTF8 $out
Write-Output $out
