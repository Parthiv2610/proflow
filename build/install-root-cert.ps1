# Trust the ProFlow self-signed code-signing certificate on THIS machine.
# This only affects this computer — it makes Get-AuthenticodeSignature report
# 'Valid' for ProFlow-signed files so Defender is quieter locally. It does NOT
# clear SmartScreen's 'Windows protected your PC' warning for other people.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File build\install-root-cert.ps1

$cerPath = Join-Path $PSScriptRoot "proflow-codesign.cer"

if (-not (Test-Path $cerPath)) {
    Write-Host "ERROR: $cerPath not found. Run build\create-cert.ps1 first."
    exit 1
}

Write-Host "Installing ProFlow certificate into Trusted Root + Trusted Publishers (CurrentUser)..."
Write-Host "  Cert: $cerPath"
Write-Host ""

# CurrentUser stores — no admin required for these.
$rootResult = Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\Root"
Write-Host "  Trusted Root:        $($rootResult.Thumbprint)"

$pubResult = Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher"
Write-Host "  Trusted Publishers:  $($pubResult.Thumbprint)"

Write-Host ""
Write-Host "Done. Now re-run:  powershell -ExecutionPolicy Bypass -File build\sign-installer.ps1"
Write-Host "The installer signature should report 'Valid' on this machine."
Write-Host ""
Write-Host "NOTE: This does not fix SmartScreen for other people. Submit the installer to"
Write-Host "Microsoft's SmartScreen program (build\open-smartscreen-submission.bat) to build"
Write-Host "download reputation, or use a paid code-signing certificate from a real CA."
