[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("web", "api", "worker")]
    [string] $Service,

    [string] $RailwayServiceName,

    [string] $Message,

    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$rootConfig = Join-Path $repoRoot "railway.json"

$profiles = @{
    web = @{
        ServiceName = "personalasisstant"
        Template = "railway/assistant-web.railway.json"
        Message = "Deploy assistant web"
    }
    api = @{
        ServiceName = "assistant-api"
        Template = "railway/assistant-api.railway.json"
        Message = "Deploy assistant API runtime"
    }
    worker = @{
        ServiceName = "assistant-worker"
        Template = "railway/assistant-worker.railway.json"
        Message = "Deploy assistant worker runtime"
    }
}

$profile = $profiles[$Service]
$targetService = if ($RailwayServiceName) { $RailwayServiceName } else { $profile.ServiceName }
$deployMessage = if ($Message) { $Message } else { $profile.Message }
$templatePath = Join-Path $repoRoot $profile.Template

if (-not (Test-Path -LiteralPath $templatePath)) {
    throw "Railway template not found: $templatePath"
}

if (-not (Test-Path -LiteralPath $rootConfig)) {
    throw "Root Railway config not found: $rootConfig"
}

$commandPreview = "npx -y @railway/cli up --service `"$targetService`" --detach --yes --message `"$deployMessage`""

if ($DryRun) {
    Write-Host "Railway profile: $Service"
    Write-Host "Railway service: $targetService"
    Write-Host "Template: $templatePath"
    Write-Host "Root config: $rootConfig"
    Write-Host "Command: $commandPreview"
    Write-Host "Dry run only; no files changed and no deploy triggered."
    exit 0
}

$backupPath = Join-Path ([System.IO.Path]::GetTempPath()) ("railway-root-config-{0}.json" -f ([System.Guid]::NewGuid()))
$originalHash = (Get-FileHash -LiteralPath $rootConfig -Algorithm SHA256).Hash

Copy-Item -LiteralPath $rootConfig -Destination $backupPath -Force

try {
    Copy-Item -LiteralPath $templatePath -Destination $rootConfig -Force
    & npx -y "@railway/cli" up --service $targetService --detach --yes --message $deployMessage
    if ($LASTEXITCODE -ne 0) {
        throw "Railway deploy failed with exit code $LASTEXITCODE."
    }
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $rootConfig -Force
    Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
}

$restoredHash = (Get-FileHash -LiteralPath $rootConfig -Algorithm SHA256).Hash
if ($restoredHash -ne $originalHash) {
    throw "railway.json was not restored to its original content."
}

Write-Host "Railway deploy requested for $targetService and railway.json was restored."
