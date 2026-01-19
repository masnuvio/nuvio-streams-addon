# Export Win-ACME certificate from Windows Certificate Store for nginx

Write-Host "Exporting certificate from Windows Certificate Store..." -ForegroundColor Cyan
Write-Host ""

# Find the certificate by subject name
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*nuvio.duckdns.org*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "ERROR - Certificate not found in Windows Certificate Store" -ForegroundColor Red
    Write-Host "Looking for certificates with 'nuvio' in the name..." -ForegroundColor Yellow
    Get-ChildItem -Path Cert:\LocalMachine\My | ForEach-Object { Write-Host "  $($_.Subject)" }
    exit 1
}

Write-Host "Found certificate:" -ForegroundColor Green
Write-Host "  Subject: $($cert.Subject)" -ForegroundColor White
Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
Write-Host "  Expires: $($cert.NotAfter)" -ForegroundColor White
Write-Host ""

# Create directory for exported certificates
$certDir = "C:\nginx\ssl"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
    Write-Host "Created directory: $certDir" -ForegroundColor Gray
}

# Export certificate (public key) to PEM
$certPath = "$certDir\nuvio.duckdns.org.crt"
$certPem = @(
    '-----BEGIN CERTIFICATE-----'
    [System.Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
    '-----END CERTIFICATE-----'
)
$certPem | Out-File -FilePath $certPath -Encoding ASCII

Write-Host "Exported certificate to: $certPath" -ForegroundColor Green

# Export private key - this requires the certificate to have an exportable private key
Write-Host ""
Write-Host "Exporting private key..." -ForegroundColor Yellow

if ($cert.HasPrivateKey) {
    try {
        # Get private key
        $rsaKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
        
        if ($rsaKey) {
            # Export as PKCS#8 PEM format
            $keyBytes = $rsaKey.ExportPkcs8PrivateKey()
            $keyPem = @(
                '-----BEGIN PRIVATE KEY-----'
                [System.Convert]::ToBase64String($keyBytes, 'InsertLineBreaks')
                '-----END PRIVATE KEY-----'
            )
            
            $keyPath = "$certDir\nuvio.duckdns.org.key"
            $keyPem | Out-File -FilePath $keyPath -Encoding ASCII
            
            Write-Host "Exported private key to: $keyPath" -ForegroundColor Green
            
            # Update nginx configuration
            Write-Host ""
            Write-Host "Updating nginx configuration..." -ForegroundColor Cyan
            
            $configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
            $configContent = Get-Content $configPath -Raw
            
            # Use forward slashes for nginx
            $certPathNginx = $certPath -replace '\\', '/'
            $keyPathNginx = $keyPath -replace '\\', '/'
            
            $configContent = $configContent -replace 'ssl_certificate .*;', "ssl_certificate $certPathNginx;"
            $configContent = $configContent -replace 'ssl_certificate_key .*;', "ssl_certificate_key $keyPathNginx;"
            
            $configContent | Set-Content $configPath -Force
            
            Write-Host "  OK - nginx configuration updated" -ForegroundColor Green
            Write-Host ""
            Write-Host "Certificate files:" -ForegroundColor Cyan
            Write-Host "  Certificate: $certPath" -ForegroundColor White
            Write-Host "  Private Key: $keyPath" -ForegroundColor White
            Write-Host ""
            Write-Host "Now run: .\complete-ssl-setup.ps1" -ForegroundColor Green
            
        } else {
            Write-Host "ERROR - Could not access private key" -ForegroundColor Red
        }
    } catch {
        Write-Host "ERROR - Failed to export private key: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Win-ACME might have PFX file" -ForegroundColor Yellow
        
        # Search for PFX files
        $pfxFiles = Get-ChildItem "C:\ProgramData\win-acme" -Recurse -Filter "*.pfx" -ErrorAction SilentlyContinue
        if ($pfxFiles) {
            Write-Host "Found PFX files:" -ForegroundColor Cyan
            $pfxFiles | ForEach-Object { Write-Host "  $($_.FullName)" }
        }
    }
} else {
    Write-Host "ERROR - Certificate does not have a private key" -ForegroundColor Red
}
