$ErrorActionPreference = 'Stop'
$logDir = 'C:\Users\KRIS\.openclaw\workspace\logs'
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logPath = Join-Path $logDir 'interest-watch.log'

$envPath = 'C:\Users\KRIS\.openclaw\workspace\lead-scraper-bot\.env'
if (!(Test-Path $envPath)) {
  Add-Content -Path $logPath -Value "$(Get-Date -Format o) interest error missing_env"
  exit 0
}

$raw = Get-Content $envPath -Raw
function Get-EnvVal($key) {
  $m = [regex]::Match($raw, "(?m)^$key=(.*)$")
  if ($m.Success) { return $m.Groups[1].Value.Trim() }
  return ''
}

$supabaseUrl = Get-EnvVal 'SUPABASE_URL'
if (-not $supabaseUrl) { $supabaseUrl = Get-EnvVal 'NEXT_PUBLIC_SUPABASE_URL' }
$serviceKey = Get-EnvVal 'SUPABASE_SERVICE_ROLE_KEY'

if (-not $supabaseUrl -or -not $serviceKey) {
  Add-Content -Path $logPath -Value "$(Get-Date -Format o) interest error missing_supabase_creds"
  exit 0
}

$since = (Get-Date).ToUniversalTime().AddHours(-24).ToString('o')
$statuses = 'interested,responded,reply_positive'
$uri = "$supabaseUrl/rest/v1/leads?select=id,company_name,status,updated_at&status=in.($statuses)&updated_at=gte.$([uri]::EscapeDataString($since))&order=updated_at.desc&limit=20"
$headers = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" }

try {
  $rows = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 30
  $count = @($rows).Count
  if ($count -gt 0) {
    $names = (@($rows) | ForEach-Object { $_.company_name } | Select-Object -Unique | Select-Object -First 5) -join ', '
    Add-Content -Path $logPath -Value "$(Get-Date -Format o) INTEREST count=$count businesses=$names"
  } else {
    Add-Content -Path $logPath -Value "$(Get-Date -Format o) interest ok count=0"
  }
} catch {
  Add-Content -Path $logPath -Value "$(Get-Date -Format o) interest error $($_.Exception.Message)"
}
