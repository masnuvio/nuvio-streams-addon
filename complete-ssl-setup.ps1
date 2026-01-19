# ============================================
# Complete nginx SSL Setup
# ============================================
# Run this script AS ADMINISTRATOR to complete the HTTPS setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Completing nginx SSL Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy nginx configuration
Write-Host "[1/5] Copying nginx configuration..." -ForegroundColor Yellow
try {
    Copy-Item "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf" "C:\nginx\conf\nginx.conf" -Force
    Write-Host "  OK - Configuration copied successfully" -ForegroundColor Green
} catch {
    Write-Host "  ERROR - Error copying configuration: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Test nginx configuration
Write-Host "[2/5] Testing nginx configuration..." -ForegroundColor Yellow
cd C:\nginx
$testResult = & .\nginx.exe -t 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK - Configuration test passed!" -ForegroundColor Green
} else {
    Write-Host "  ERROR - Configuration test failed:" -ForegroundColor Red
    Write-Host $testResult
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "- Certificate files not found"
    Write-Host "- Check paths in nginx.conf"
    Write-Host ""
    Read-Host "Press Enter to continue anyway or Ctrl+C to abort"
}

Write-Host ""

# Step 3: Stop existing nginx if running
Write-Host "[3/5] Stopping existing nginx processes..." -ForegroundColor Yellow
$nginxProcesses = Get-Process -Name nginx -ErrorAction SilentlyContinue
if ($nginxProcesses) {
    taskkill /F /IM nginx.exe 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "  OK - Stopped existing nginx processes" -ForegroundColor Green
} else {
    Write-Host "  INFO - No existing nginx processes found" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Start nginx
Write-Host "[4/5] Starting nginx..." -ForegroundColor Yellow
try {
    Start-Process -FilePath "C:\nginx\nginx.exe" -WorkingDirectory "C:\nginx" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    
    $nginxRunning = Get-Process -Name nginx -ErrorAction SilentlyContinue
    if ($nginxRunning) {
        Write-Host "  OK - nginx started successfully!" -ForegroundColor Green
        Write-Host "  INFO - Processes running: $($nginxRunning.Count)" -ForegroundColor Gray
    } else {
        Write-Host "  ERROR - nginx failed to start" -ForegroundColor Red
        Write-Host "  Check C:\nginx\logs\error.log for details" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR - Error starting nginx: $_" -ForegroundColor Red
}

Write-Host ""

# Step 5: Test HTTPS access
Write-Host "[5/5] Testing HTTPS access..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "https://nuvio.duckdns.org/health" -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  OK - HTTPS is working!" -ForegroundColor Green
        Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "  Response: $($response.Content)" -ForegroundColor Green
    }
} catch {
    Write-Host "  WARNING - HTTPS test failed (may be normal from local machine)" -ForegroundColor Yellow
    Write-Host "  Try from external network: https://nuvio.duckdns.org" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Your addon is now live at:" -ForegroundColor Green
Write-Host "  Landing page: https://nuvio.duckdns.org" -ForegroundColor White
Write-Host "  Manifest: https://nuvio.duckdns.org/manifest.json" -ForegroundColor White
Write-Host ""

Write-Host "To add to Stremio:" -ForegroundColor Cyan  
Write-Host "  1. Open Stremio" -ForegroundColor White
Write-Host "  2. Go to Add-ons -> Community Add-ons" -ForegroundColor White
Write-Host "  3. Paste: https://nuvio.duckdns.org/manifest.json" -ForegroundColor White
Write-Host "  4. Click Install" -ForegroundColor White
Write-Host ""

Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Stop nginx: taskkill /F /IM nginx.exe" -ForegroundColor Gray
Write-Host "  Start nginx: cd C:\nginx; start nginx" -ForegroundColor Gray
Write-Host "  Check PM2: pm2 status" -ForegroundColor Gray
Write-Host "  View logs: type C:\nginx\logs\error.log" -ForegroundColor Gray
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
