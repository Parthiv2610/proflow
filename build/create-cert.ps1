# Create self-signed code signing certificate for ProFlow
$cert = New-SelfSignedCertificate `
    -Subject "CN=ProFlow, O=ProFlow, C=US" `
    -FriendlyName "ProFlow Code Signing" `
    -Type CodeSigning `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -KeyLength 2048 `
    -NotBefore (Get-Date) `
    -NotAfter (Get-Date).AddYears(3) `
    -TextExtension "2.5.29.37={text}1.3.6.1.5.5.7.3.3"

Write-Host "Certificate created:"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  Subject:    $($cert.Subject)"

# Export as .pfx with a password
$password = ConvertTo-SecureString -String "proflow2024" -Force -AsPlainText
$pfxPath = Join-Path $PSScriptRoot "proflow-codesign.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password

# Also export the .cer for distribution
$cerPath = Join-Path $PSScriptRoot "proflow-codesign.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT

Write-Host ""
Write-Host "Exported:"
Write-Host "  PFX: $pfxPath"
Write-Host "  CER: $cerPath"
Write-Host ""
Write-Host "Certificate thumbprint: $($cert.Thumbprint)"
