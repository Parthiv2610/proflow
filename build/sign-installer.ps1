# Sign the ProFlow installer using the ProFlow Code Signing certificate
# This script assumes the certificate is already installed in Cert:\CurrentUser\My
# (run create-cert.ps1 first if it's not)

$installerPath = "C:\Users\parth\Desktop\Python\pro-flow\release\ProFlow-Setup-2.0.0.exe"

Write-Host "=== Signing ProFlow Setup.exe ==="
Write-Host ""

# Find the ProFlow code signing certificate
$cert = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { $_.Subject -eq "CN=ProFlow, O=ProFlow, C=US" -and $_.EnhancedKeyUsageList -match "Code Signing" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "ERROR: ProFlow code signing certificate not found in CurrentUser\My."
    Write-Host "Run build\create-cert.ps1 first to create the certificate."
    exit 1
}

Write-Host "Using certificate:"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  Subject:    $($cert.Subject)"
Write-Host ""

Write-Host "Signing: $installerPath"
$result = Set-AuthenticodeSignature -FilePath $installerPath -Certificate $cert -HashAlgorithm SHA256 -Force
Write-Host "  Result: $($result.Status)"

$verify = Get-AuthenticodeSignature -FilePath $installerPath
Write-Host "  Verify: $($verify.Status)"
Write-Host "  Subject: $($verify.SignerCertificate.Subject)"

if ($verify.Status -eq "Valid") {
    Write-Host ""
    Write-Host "✅ Setup.exe is properly signed!"
} else {
    Write-Host ""
    Write-Host "WARNING: Signature status is $($verify.Status)."
    Write-Host "  The installer may still be signed, but the certificate is not"
    Write-Host "  trusted on this machine. To trust it, run:"
    Write-Host "    powershell -File build\install-root-cert.ps1"
    Write-Host "  (This installs the self-signed cert into the Trusted Root store.)"
}
