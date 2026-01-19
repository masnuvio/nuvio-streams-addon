# ============================================
# Network Information Script
# ============================================
# This script detects your network information needed for setup

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Network Information for Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Get Public IP
Write-Host "[1] Detecting Public IP Address..." -ForegroundColor Yellow
try {
    $publicIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 10).Content.Trim()
    Write-Host "    Public IP: $publicIP" -ForegroundColor Green
    Write-Host "    → Use this IP in DuckDNS setup" -ForegroundColor Cyan
} catch {
    Write-Host "    ERROR: Could not detect public IP" -ForegroundColor Red
    Write-Host "    → Visit https://whatismyipaddress.com to find it manually" -ForegroundColor Yellow
    $publicIP = "UNKNOWN"
}

Write-Host ""

# Get Local/Private IP
Write-Host "[2] Detecting Local IP Address..." -ForegroundColor Yellow
$networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"}

if ($networkAdapters) {
    foreach ($adapter in $networkAdapters) {
        $interfaceAlias = (Get-NetAdapter -InterfaceIndex $adapter.InterfaceIndex).Name
        Write-Host "    Interface: $interfaceAlias" -ForegroundColor Gray
        Write-Host "    Local IP: $($adapter.IPAddress)" -ForegroundColor Green
        Write-Host "    → Use this IP for port forwarding in your router" -ForegroundColor Cyan
    }
} else {
    Write-Host "    ERROR: Could not detect local IP" -ForegroundColor Red
}

Write-Host ""

# Get Default Gateway (Router IP)
Write-Host "[3] DetectingRouter IP Address..." -ForegroundColor Yellow
$gateway = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object -First 1).NextHop
if ($gateway) {
    Write-Host "    Router IP: $gateway" -ForegroundColor Green
    Write-Host "    → Open http://$gateway in your browser to access router settings" -ForegroundColor Cyan
} else {
    Write-Host "    ERROR: Could not detect router IP" -ForegroundColor Red
    Write-Host "    → Try: http://192.168.1.1 or http://192.168.0.1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Summary for Your Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "DuckDNS Configuration:" -ForegroundColor Yellow
Write-Host "  - Domain: nuvio.duckdns.org"
Write-Host "  - IP to set: $publicIP"
Write-Host ""
Write-Host "Router Port Forwarding:" -ForegroundColor Yellow
Write-Host "  - Router admin URL: http://$gateway"
if ($networkAdapters -and $networkAdapters.Count -gt 0) {
    $primaryIP = $networkAdapters[0].IPAddress
    Write-Host "  - Internal IP (this PC): $primaryIP"
    Write-Host ""
    Write-Host "  Port Forwarding Rules to Create:" -ForegroundColor Cyan
    Write-Host "  ┌─────────────────────────────────────────────┐"
    Write-Host "  │ Rule 1: HTTP (for SSL verification)        │"
    Write-Host "  │   External Port: 80                         │"
    Write-Host "  │   Internal IP: $primaryIP                   │" -NoNewline
    Write-Host (" " * (26 - $primaryIP.Length)) -NoNewline
    Write-Host "│"
    Write-Host "  │   Internal Port: 7000                       │"
    Write-Host "  │   Protocol: TCP                             │"
    Write-Host "  ├─────────────────────────────────────────────┤"
    Write-Host "  │ Rule 2: HTTPS (for secure access)          │"
    Write-Host "  │   External Port: 443                        │"
    Write-Host "  │   Internal IP: $primaryIP                   │" -NoNewline
    Write-Host (" " * (26 - $primaryIP.Length)) -NoNewline
    Write-Host "│"
    Write-Host "  │   Internal Port: 7000                       │"
    Write-Host "  │   Protocol: TCP                             │"
    Write-Host "  └─────────────────────────────────────────────┘"
}
Write-Host ""

# Save to file
$outputFile = Join-Path $PSScriptRoot "network-info.txt"
@"
NETWORK INFORMATION FOR SETUP
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

PUBLIC IP: $publicIP
LOCAL IP: $($networkAdapters[0].IPAddress)
ROUTER IP: $gateway

DUCKDNS SETUP:
- Go to: https://www.duckdns.org
- Domain: nuvio
- IP: $publicIP

PORT FORWARDING RULES:
Rule 1 - HTTP:
  External Port: 80
  Internal IP: $($networkAdapters[0].IPAddress)
  Internal Port: 7000
  Protocol: TCP

Rule 2 - HTTPS:
  External Port: 443
  Internal IP: $($networkAdapters[0].IPAddress)
  Internal Port: 7000
  Protocol: TCP

NEXT STEPS:
1. Set up DuckDNS domain at duckdns.org
2. Configure port forwarding in router at http://$gateway
3. Run: .\install-duckdns-task.ps1 (as Administrator)
4. Test external access from phone: http://nuvio.duckdns.org
"@ | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "ℹ️ This information has been saved to: $outputFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
