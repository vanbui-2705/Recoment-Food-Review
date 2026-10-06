param(
  [Parameter(Mandatory=$true)][string]$EnvironmentFile,
  [ValidatePattern('^rec-food-[a-z0-9-]+$')][string]$Project = 'rec-food-staging',
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$deploymentRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$privateEnv = (Resolve-Path -LiteralPath $EnvironmentFile).Path
$composeArgs = @('compose','--env-file',$privateEnv,'-p',$Project,'-f',(Join-Path $deploymentRoot 'compose.yaml'),'-f',(Join-Path $deploymentRoot 'compose.staging.yaml'),'--profile','background')
# Quiet validation never emits interpolated secrets. Default only validates.
& docker @composeArgs config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Staging configuration validation failed.' }
if (-not $Apply) { Write-Output 'Configuration valid. No deployment was changed.'; return }
# Operator must have completed backup/rollback and live-provider gates before using -Apply.
& docker @composeArgs pull backend worker frontend migrate edge
if ($LASTEXITCODE -ne 0) { throw 'Reviewed image pull failed; deployment was not changed.' }
& docker @composeArgs stop --timeout 120 worker
if ($LASTEXITCODE -ne 0) { throw 'Worker pause failed; stop the rollout and inspect the deployment.' }
& docker @composeArgs run --rm migrate
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; keep worker paused and inspect before resuming.' }
& docker @composeArgs up --no-build -d --wait --wait-timeout 120 backend frontend edge
if ($LASTEXITCODE -ne 0) { throw 'Web readiness failed; keep worker paused and follow rollback runbook.' }
& docker @composeArgs up --no-build -d worker
if ($LASTEXITCODE -ne 0) { throw 'Background startup failed; keep worker-related capabilities disabled until repaired.' }
Write-Output 'Reviewed services started. Run origin, account ownership and provider live smoke gates before opening traffic.'
