# Sign the portable ProFlow.exe ONLY (skip third-party DLLs — re-signing them can break compatibility)
$projectRoot = "C:\Users\parth\Desktop\Python\pro-flow"
$certPath = Join-Path $projectRoot "build\proflow-codesign.pfx"
$portableExe = Join-Path $projectRoot "release\ProFlow-v5\ProFlow-win32-x64\ProFlow.exe"
$password = ConvertTo-SecureString -String "proflow2024" -Force -AsPlainText

Write-Host "=== Signing Portable ProFlow.exe ==="

$cert = Import-PfxCertificate -FilePath $certPath -Password $password -CertStoreLocation "Cert:\CurrentUser\My"

Write-Host "Signing: $portableExe"
$result = Set-AuthenticodeSignature -FilePath $portableExe -Certificate $cert -HashAlgorithm SHA256 -Force
Write-Host "  Result: $($result.Status)"

$verify = Get-AuthenticodeSignature -FilePath $portableExe
Write-Host "  Verify: $($verify.Status)"
Write-Host "  Subject: $($verify.SignerCertificate.Subject)"

if ($verify.Status -eq "Valid") {
    Write-Host ""
    Write-Host "✅ ProFlow.exe is now signed!"
    Write-Host ""
    Write-Host "Next step: Rebuild the NSIS installer so the signed ProFlow.exe"
    Write-Host "gets packaged inside, then sign the resulting Setup.exe."
}

Write-Host ""
Write-Host "Done."
