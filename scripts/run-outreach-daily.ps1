$ErrorActionPreference = 'Stop'

$secrets = 'C:\Users\KRIS\.openclaw\workspace\.secrets\AUTOMATION_ENDPOINTS.ps1'
if (!(Test-Path $secrets)) { throw 'Missing .secrets/AUTOMATION_ENDPOINTS.ps1' }
. $secrets

$appUrl = $global:LEADCLAW_APP_URL
$token = $global:OUTREACH_RUN_TOKEN

if ([string]::IsNullOrWhiteSpace($appUrl)) { throw 'Missing LEADCLAW_APP_URL' }
if ([string]::IsNullOrWhiteSpace($token)) { throw 'Missing OUTREACH_RUN_TOKEN' }

$uri = "$appUrl/api/outreach/run"
$headers = @{ Authorization = "Bearer $token" }

try {
  $res = Invoke-RestMethod -Method POST -Uri $uri -Headers $headers
  $line = "$(Get-Date -Format o) outreach ok sent=$($res.sentCount) skipped=$($res.skippedCount) capped=$($res.capped) cap=$($res.dailyCap)"
} catch {
  $line = "$(Get-Date -Format o) outreach error $($_.Exception.Message)"
}

$logDir = 'C:\Users\KRIS\.openclaw\workspace\logs'
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

Add-Content -Path (Join-Path $logDir 'outreach-run.log') -Value $line