# Convert Win-ACME PFX to PEM format for nginx

Write-Host "Converting PFX certificate for nginx..." -ForegroundColor Cyan
Write-Host ""

$pfxPath = "C:\ProgramData\win-acme\acme-v02.api.letsencrypt.org\Certificates\_sE89NZACUaZQ87-PYwO4w-main-b4cb836233f0a33aa19c4163d22c4e78212536f6-temp.pfx"
$certDir = "C:\nginx\ssl"

# Win-ACME PFX files typically have no password
$password = ""

Write-Host "Loading PFX file..." -ForegroundColor Yellow
try {
    # Load the PFX
    $pfxCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $password, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
    
    Write-Host "  OK - PFX loaded successfully" -ForegroundColor Green
    Write-Host "  Subject: $($pfxCert.Subject)" -ForegroundColor Gray
    Write-Host ""
    
    # Export certificate (public key)
    Write-Host "Exporting certificate..." -ForegroundColor Yellow
    $certPath = "$certDir\nuvio.duckdns.org.crt"
    $certPem = @(
        '-----BEGIN CERTIFICATE-----'
        [System.Convert]::ToBase64String($pfxCert.RawData, 'InsertLineBreaks')
        '-----END CERTIFICATE-----'
    )
    $certPem | Out-File -FilePath $certPath -Encoding ASCII
    Write-Host "  OK - Certificate exported: $certPath" -ForegroundColor Green
    
    # Export private key using OpenSSL (if available) or alternative method
    Write-Host ""
    Write-Host "Exporting private key..." -ForegroundColor Yellow
    
    # Try to use the PFX directly with nginx by converting via intermediate step
    $keyPath = "$certDir\nuvio.duckdns.org.key"
    
    # Export the private key in PKCS#1 format
    $rsaKey = $pfxCert.PrivateKey
    
    if ($rsaKey) {
        # Export to XML then convert
        $keyXml = $rsaKey.ToXmlString($true)
        
        # For nginx, we need to export as PEM
        # Use certutil or openssl if available
        
        # Alternative: Export PFX to a temporary location that nginx can use
        $pfxForNginx = "$certDir\nuvio.duckdns.org.pfx"
        $pfxBytes = $pfxCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
        [System.IO.File]::WriteAllBytes($pfxForNginx, $pfxBytes)
        
        Write-Host "  PFX exported to: $pfxForNginx" -ForegroundColor Gray
        
        # Check if OpenSSL is available
        $opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
        
        if ($opensslPath) {
            Write-Host "  Using OpenSSL to convert..." -ForegroundColor Gray
            
            # Convert PFX to PEM with OpenSSL
            & openssl pkcs12 -in $pfxForNginx -nocerts -nodes -out $keyPath -passin pass:
            & openssl pkcs12 -in $pfxForNginx -clcerts -nokeys -out $certPath -passin pass:
            
            Write-Host "  OK - Certificate and key exported with OpenSSL" -ForegroundColor Green
            
        } else {
            Write-Host "  OpenSSL not found, using alternative method..." -ForegroundColor Yellow
            
            # For nginx on Windows, we can use the certificate from the Windows store directly
            # Update nginx to use the PFX file instead
            Write-Host "  Configuring nginx to use PFX file..." -ForegroundColor Yellow
            
            $configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
            $configContent = Get-Content $configPath -Raw
            
            # nginx can't use PFX directly, but we can use the cert from Windows store
            # Alternative: Just use the exported certificate and skip private key for now
            # Actually, let's try to manually extract the key
            
            # Manual RSA key extraction (basic PKCS#1 format)
            Write-Host "  Attempting manual key extraction..." -ForegroundColor Yellow
            
            try {
                # Export as PKCS#1 RSA format (basic PEM)
                $keyBytes = $rsaKey.ExportCspBlob($true)
                $keyBase64 = [System.Convert]::ToBase64String($keyBytes, 'InsertLineBreaks')
                
                # This is CSP blob format, not PEM - won't work directly
                # We need proper PKCS#8 or PKCS#1 format
                
                Write-Host "  WARNING - Manual extraction not fully compatible" -ForegroundColor Yellow
                Write-Host "  Recommendation: Use the certificate with openssl on the server" -ForegroundColor Yellow
                
            } catch {
                Write-Host "  ERROR - Could not extract key: $_" -ForegroundColor Red
            }
        }
        
    } else {
        Write-Host "  ERROR - No private key found in PFX" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Updating nginx configuration with exported certificate..." -ForegroundColor Cyan
    
    $configPath = "c:\Users\Administrator\Desktop\nuvio stream\nginx-final.conf"
    $configContent = Get-Content $configPath -Raw
    
    # Use forward slashes for nginx  
    $certPathNginx = $certPath -replace '\\', '/'
    
    # For now, update just the certificate path
    # The key will need OpenSSL or we use Windows certificate store
    $configContent = $configContent -replace 'ssl_certificate .*;', "ssl_certificate $certPathNginx;"
    
    # Comment out the key line temporarily
    $configContent = $configContent -replace '(\s+)(ssl_certificate_key .*;)', '$1# $2 # Need to extract key from PFX'
    
    $configContent | Set-Content $configPath -Force
    
    Write-Host "  Configuration updated (partial)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ACTION REQUIRED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "To complete the setup, we need to extract the private key from the PFX file." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Install OpenSSL for Windows (Recommended)" -ForegroundColor Cyan
    Write-Host "  Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
    Write-Host "  Then run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Extract manually with these commands:" -ForegroundColor Cyan
    Write-Host "  # If you have openssl:" -ForegroundColor Gray
    Write-Host "  openssl pkcs12 -in `"$pfxForNginx`" -nocerts -nodes -out `"$keyPath`" -passin pass:" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR - Failed to process PFX: $_" -ForegroundColor Red
}
