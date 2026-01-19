# Quick SSL Setup - All-in-One Solution
# This script uses Win-ACME's built-in certificate installation which works with IIS
# For nginx on Windows, we'll use a simpler approach

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Nuvio Streams HTTPS Setup (Simplified)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Since extracting certificates from Win-ACME is complex," -ForegroundColor Yellow
Write-Host "let's use nginx for Windows with a simpler approach:" -ForegroundColor Yellow
Write-Host ""

# Stop here and provide manual instructions
Write-Host "MANUAL SETUP REQUIRED:" -ForegroundColor Red
Write-Host ""
Write-Host "1. Download OpenSSL for Windows:" -ForegroundColor Cyan
Write-Host "   https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
Write-Host "   (Download: Win64 OpenSSL v3.x Light)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Install OpenSSL (default location: C:\Program Files\OpenSSL-Win64)" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Extract the private key with OpenSSL:" -ForegroundColor Cyan
Write-Host ""
$pfxPath = "C:\ProgramData\win-acme\acme-v02.api.letsencrypt.org\Certificates\_sE89NZACUaZQ87-PYwO4w-main-b4cb836233f0a33aa19c4163d22c4e78212536f6-temp.pfx"
Write-Host '   cd "C:\Program Files\OpenSSL-Win64\bin"' -ForegroundColor White
Write-Host "   .\openssl.exe pkcs12 -in `"$pfxPath`" -nocerts -nodes -out `"C:\nginx\ssl\nuvio.duckdns.org.key`" -passin pass:" -ForegroundColor White
Write-Host "   .\openssl.exe pkcs12 -in `"$pfxPath`" -clcerts -nokeys -out `"C:\nginx\ssl\nuvio.duckdns.org.crt`" -passin pass:" -ForegroundColor White
Write-Host ""
Write-Host "4. Then run:" -ForegroundColor Cyan
Write-Host "   .\complete-ssl-setup.ps1" -ForegroundColor White
Write-Host ""

Write-Host "OR - EASIER ALTERNATIVE:" -ForegroundColor Green
Write-Host ""
Write-Host "Skip nginx and use Cloudflare Tunnel instead:" -ForegroundColor Cyan
Write-Host "  cd `"c:\Users\Administrator\Desktop\nuvio stream`"" -ForegroundColor White  
Write-Host "  .\cloudflared.exe tunnel --url http://localhost:7000" -ForegroundColor White
Write-Host ""
Write-Host "This gives you instant HTTPS without certificate hassle!" -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "Choose: [1] Continue with OpenSSL setup, [2] Use Cloudflare Tunnel (recommended)"

if ($response -eq "2") {
    Write-Host ""
    Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Cyan
    cd "c:\Users\Administrator\Desktop\nuvio stream"
    .\cloudflared.exe tunnel --url http://localhost:7000
} else {
    Write-Host ""
    Write-Host "Follow the manual steps above, then run: .\complete-ssl-setup.ps1" -ForegroundColor Cyan
}
