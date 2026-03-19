$ErrorActionPreference = 'Stop'
$base = 'C:\Users\KRIS\.openclaw\workspace\clinic-saas-mvp\scripts'
& "$base\run-onboarding.ps1"
& "$base\run-retention.ps1"
& "$base\run-billing-trial.ps1"
Write-Output "All automation runners executed."