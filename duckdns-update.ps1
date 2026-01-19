# ============================================
# DuckDNS Auto-Update Script
# ============================================
# This script updates your DuckDNS domain with your current public IP
# Schedule this to run every 5 minutes for best results

# Configuration - UPDATE THESE VALUES
$DUCKDNS_TOKEN = "cee5cbe2-1d14-4080-bcc9-faf668913255"  # DuckDNS token
$DUCKDNS_DOMAIN = "nuvio"  # Your subdomain (without .duckdns.org)

# Get current public IP (optional - DuckDNS can auto-detect)
try {
    $currentIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()
    Write-Host "Current Public IP: $currentIP"
} catch {
    Write-Host "Could not detect IP, letting DuckDNS auto-detect..."
    $currentIP = ""
}

# Update DuckDNS
try {
    $updateUrl = "https://www.duckdns.org/update?domains=$DUCKDNS_DOMAIN&token=$DUCKDNS_TOKEN&ip=$currentIP"
    $response = Invoke-WebRequest -Uri $updateUrl -UseBasicParsing
    
    if ($response.Content -match "OK") {
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] DuckDNS update successful for $DUCKDNS_DOMAIN.duckdns.org"
        
        # Log to file
        $logFile = Join-Path $PSScriptRoot "duckdns-update.log"
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] SUCCESS - IP: $currentIP" | Out-File -FilePath $logFile -Append
    } else {
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] DuckDNS update failed: $($response.Content)"
        $logFile = Join-Path $PSScriptRoot "duckdns-update.log"
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] FAILED - Response: $($response.Content)" | Out-File -FilePath $logFile -Append
    }
} catch {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Error updating DuckDNS: $_"
    $logFile = Join-Path $PSScriptRoot "duckdns-update.log"
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR - $_" | Out-File -FilePath $logFile -Append
}
