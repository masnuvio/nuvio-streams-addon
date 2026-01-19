# Re-generate SSL Certificate with Direct PEM Output
# This avoids the Windows Certificate Store export issues

Write-Host "Re-generating SSL Certificate as PEM files..." -ForegroundColor Cyan
Write-Host ""

$wacsPath = "C:\win-acme\wacs.exe"
$certDir = "C:\nginx\ssl"
$email = "bdsngst@gmail.com" # From previous attempt

# Create output directory
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

Write-Host "Running Win-ACME..." -ForegroundColor Yellow
Write-Host "This will request a new certificate and save it directly to $certDir" -ForegroundColor Gray

# Run Win-ACME with arguments to force PEM output
# --source manual: Manual hostname input
# --host: The domain
# --validation http01: HTTP validation (port 80)
# --store pemfiles: Save as .pem files (what nginx needs)
# --pemfilespath: Where to save them
# --force: Force renewal if exists

$args = @(
    "--source", "manual",
    "--host", "nuvio.duckdns.org",
    "--validation", "SelfHosting",
    "--store", "pemfiles",
    "--pemfilespath", $certDir,
    "--installation", "none",
    "--accepttos",
    "--emailaddress", $email,
    "--force"
)

$process = Start-Process -FilePath $wacsPath -ArgumentList $args -Wait -PassThru -NoNewWindow

if ($process.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! Certificate saved to $certDir" -ForegroundColor Green
    
    # Check the files
    $files = Get-ChildItem $certDir
    $files | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor Gray }
    
    # Find the specific files (names might vary slightly)
    $keyFile = $files | Where-Object { $_.Name -like "*key.pem" } | Select-Object -First 1
    $certFile = $files | Where-Object { $_.Name -like "*chain.pem" } | Select-Object -First 1
    
    if ($keyFile -and $certFile) {
        Write-Host ""
        Write-Host "Updating nginx configuration..." -ForegroundColor Cyan
        
        $configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
        $configContent = Get-Content $configPath -Raw
        
        # Use forward slashes for nginx
        $certPathNginx = $certFile.FullName -replace '\\', '/'
        $keyPathNginx = $keyFile.FullName -replace '\\', '/'
        
        # Ensure key line is uncommented
        $configContent = $configContent -replace '#\s*(ssl_certificate_key)', '$1'
        
        $configContent = $configContent -replace 'ssl_certificate\s+.*;', "ssl_certificate $certPathNginx;"
        $configContent = $configContent -replace 'ssl_certificate_key\s+.*;', "ssl_certificate_key $keyPathNginx;"
        
        $configContent | Set-Content $configPath -Force
        Write-Host "  OK - nginx configuration updated" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Now run: .\complete-ssl-setup.ps1" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Could not identify key/cert files in $certDir" -ForegroundColor Red
    }
    
} else {
    Write-Host ""
    Write-Host "ERROR: Win-ACME failed with exit code $($process.ExitCode)" -ForegroundColor Red
}
