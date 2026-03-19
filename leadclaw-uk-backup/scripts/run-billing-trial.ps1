$ErrorActionPreference = 'Stop'
$secrets = 'C:\Users\KRIS\.openclaw\workspace\.secrets\AUTOMATION_ENDPOINTS.ps1'
if (!(Test-Path $secrets)) { throw 'Missing .secrets/AUTOMATION_ENDPOINTS.ps1' }
. $secrets

$appUrl = $global:LEADCLAW_APP_URL
$token = $global:BILLING_RUN_TOKEN
$uri = "$appUrl/api/billing/trial-run"
$headers = @{ Authorization = "Bearer $token" }

try {
  $res = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -TimeoutSec 60
  $line = "$(Get-Date -Format o) billing trial ok sent=$($res.sentCount) skipped=$($res.skippedCount)"
} catch {
  $line = "$(Get-Date -Format o) billing trial error $($_.Exception.Message)"
}

$logDir = 'C:\Users\KRIS\.openclaw\workspace\logs'
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
Add-Content -Path (Join-Path $logDir 'billing-trial-run.log') -Value $line
