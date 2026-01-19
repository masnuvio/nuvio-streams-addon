# Convert Win-ACME PFX to PEM format using Git's OpenSSL

Write-Host "Converting PFX certificate using Git OpenSSL..." -ForegroundColor Cyan
Write-Host ""

# Paths
$pfxPath = "C:\ProgramData\win-acme\acme-v02.api.letsencrypt.org\Certificates\_sE89NZACUaZQ87-PYwO4w-main-b4cb836233f0a33aa19c4163d22c4e78212536f6-temp.pfx"
$certDir = "C:\nginx\ssl"
$opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"

# Output files
$keyPath = "$certDir\nuvio.duckdns.org.key"
$certPath = "$certDir\nuvio.duckdns.org.crt"

# Verify OpenSSL exists
if (-not (Test-Path $opensslPath)) {
    Write-Host "ERROR: OpenSSL not found at $opensslPath" -ForegroundColor Red
    exit 1
}

# Create output directory
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

Write-Host "Found OpenSSL at: $opensslPath" -ForegroundColor Gray
Write-Host "PFX File: $pfxPath" -ForegroundColor Gray
Write-Host ""

try {
    # 1. Extract Private Key (no password on PFX usually for Win-ACME temp files)
    Write-Host "Extracting Private Key..." -ForegroundColor Yellow
    $process = Start-Process -FilePath $opensslPath -ArgumentList "pkcs12 -in `"$pfxPath`" -nocerts -nodes -out `"$keyPath`" -passin pass:" -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0) {
        Write-Host "  OK - Private key extracted to: $keyPath" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - Failed to extract private key (Exit Code: $($process.ExitCode))" -ForegroundColor Red
        exit 1
    }

    # 2. Extract Certificate
    Write-Host "Extracting Certificate..." -ForegroundColor Yellow
    $process = Start-Process -FilePath $opensslPath -ArgumentList "pkcs12 -in `"$pfxPath`" -clcerts -nokeys -out `"$certPath`" -passin pass:" -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -eq 0) {
        Write-Host "  OK - Certificate extracted to: $certPath" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - Failed to extract certificate (Exit Code: $($process.ExitCode))" -ForegroundColor Red
        exit 1
    }

    # 3. Update nginx config
    Write-Host ""
    Write-Host "Updating nginx configuration..." -ForegroundColor Cyan
    
    $configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
    $configContent = Get-Content $configPath -Raw
    
    # Use forward slashes for nginx
    $certPathNginx = $certPath -replace '\\', '/'
    $keyPathNginx = $keyPath -replace '\\', '/'
    
    # Replace the certificate lines
    # First, uncomment the key line if it was commented out
    $configContent = $configContent -replace '#\s*(ssl_certificate_key)', '$1'
    
    # Update paths
    $configContent = $configContent -replace 'ssl_certificate\s+.*;', "ssl_certificate $certPathNginx;"
    $configContent = $configContent -replace 'ssl_certificate_key\s+.*;', "ssl_certificate_key $keyPathNginx;"
    
    $configContent | Set-Content $configPath -Force
    
    Write-Host "  OK - nginx configuration updated" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Conversion Complete!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Now run: .\complete-ssl-setup.ps1" -ForegroundColor Green

} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
