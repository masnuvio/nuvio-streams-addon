# Find Win-ACME certificate files and fix nginx config

Write-Host "Searching for certificate files..." -ForegroundColor Cyan

# Search for certificate files
$certFiles = Get-ChildItem "C:\ProgramData\win-acme" -Recurse -Include "*.pem","*.crt","*.key" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Found certificate files:" -ForegroundColor Yellow
foreach ($file in $certFiles) {
    Write-Host "  $($file.FullName)" -ForegroundColor Gray
}

# Find the specific files we need
$chainPem = $certFiles | Where-Object { $_.Name -like "*chain.pem" -or $_.Name -like "*fullchain.pem" -or $_.Name -like "*-crt.pem" } | Select-Object -First 1
$keyPem = $certFiles | Where-Object { $_.Name -like "*key.pem" -or $_.Name -like "*-key.pem" } | Select-Object -First 1

Write-Host ""
if ($chainPem -and $keyPem) {
    Write-Host "Certificate files found:" -ForegroundColor Green
    Write-Host "  Certificate: $($chainPem.FullName)" -ForegroundColor White
    Write-Host "  Private Key: $($keyPem.FullName)" -ForegroundColor White
    
    # Update nginx config
    Write-Host ""
    Write-Host "Updating nginx configuration..." -ForegroundColor Cyan
    
    $configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
    $configContent = Get-Content $configPath -Raw
    
    # Replace certificate paths with actual paths (escape backslashes for nginx)
    $certPath = $chainPem.FullName -replace '\\', '/'
    $keyPath = $keyPem.FullName -replace '\\', '/'
    
    $configContent = $configContent -replace 'ssl_certificate .*;', "ssl_certificate $certPath;"
    $configContent = $configContent -replace 'ssl_certificate_key .*;', "ssl_certificate_key $keyPath;"
    
    $configContent | Set-Content $configPath -Force
    
    Write-Host "  OK - nginx config updated with correct paths" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now run: .\complete-ssl-setup.ps1" -ForegroundColor Cyan
    
} else {
    Write-Host "ERROR - Could not find certificate files!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Found files:" -ForegroundColor Yellow
    $certFiles | ForEach-Object { Write-Host "  $($_.FullName)" }
}
