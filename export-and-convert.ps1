# Export from Windows Store and Convert with OpenSSL

Write-Host "Exporting and Converting Certificate..." -ForegroundColor Cyan
Write-Host ""

$certDir = "C:\nginx\ssl"
$tempPfx = "$certDir\temp_export.pfx"
$opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
$password = "nuvio123" # Temporary password for export/import

# Output files
$keyPath = "$certDir\nuvio.duckdns.org.key"
$certPath = "$certDir\nuvio.duckdns.org.crt"

# Create output directory
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

# 1. Export from Windows Certificate Store
Write-Host "1. Exporting from Windows Store..." -ForegroundColor Yellow
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*nuvio.duckdns.org*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "ERROR: Certificate not found in Windows Store!" -ForegroundColor Red
    exit 1
}

try {
    $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
    [System.IO.File]::WriteAllBytes($tempPfx, $pfxBytes)
    Write-Host "  OK - Exported to $tempPfx" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to export from Windows Store: $_" -ForegroundColor Red
    exit 1
}

# 2. Convert with OpenSSL
Write-Host "2. Converting with OpenSSL..." -ForegroundColor Yellow

# Extract Private Key
$process = Start-Process -FilePath $opensslPath -ArgumentList "pkcs12 -in `"$tempPfx`" -nocerts -nodes -out `"$keyPath`" -passin pass:$password" -Wait -PassThru -NoNewWindow
if ($process.ExitCode -eq 0) {
    Write-Host "  OK - Private key extracted" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to extract private key" -ForegroundColor Red
    exit 1
}

# Extract Certificate
$process = Start-Process -FilePath $opensslPath -ArgumentList "pkcs12 -in `"$tempPfx`" -clcerts -nokeys -out `"$certPath`" -passin pass:$password" -Wait -PassThru -NoNewWindow
if ($process.ExitCode -eq 0) {
    Write-Host "  OK - Certificate extracted" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to extract certificate" -ForegroundColor Red
    exit 1
}

# Clean up temp file
Remove-Item $tempPfx -ErrorAction SilentlyContinue

# 3. Update nginx config
Write-Host "3. Updating nginx configuration..." -ForegroundColor Yellow
$configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
$configContent = Get-Content $configPath -Raw

$certPathNginx = $certPath -replace '\\', '/'
$keyPathNginx = $keyPath -replace '\\', '/'

# Ensure key line is uncommented
$configContent = $configContent -replace '#\s*(ssl_certificate_key)', '$1'

$configContent = $configContent -replace 'ssl_certificate\s+.*;', "ssl_certificate $certPathNginx;"
$configContent = $configContent -replace 'ssl_certificate_key\s+.*;', "ssl_certificate_key $keyPathNginx;"

$configContent | Set-Content $configPath -Force
Write-Host "  OK - nginx configuration updated" -ForegroundColor Green

Write-Host ""
Write-Host "SUCCESS! Now run: .\complete-ssl-setup.ps1" -ForegroundColor Cyan
