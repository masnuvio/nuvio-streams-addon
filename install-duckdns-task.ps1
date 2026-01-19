# ============================================
# Install DuckDNS Auto-Update as Scheduled Task
# ============================================
# Run this script ONCE to set up automatic DuckDNS updates every 5 minutes

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run this script again."
    exit 1
}

# Configuration
$scriptPath = Join-Path $PSScriptRoot "duckdns-update.ps1"
$taskName = "DuckDNS-Auto-Update-Nuvio"

# Check if script exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "ERROR: duckdns-update.ps1 not found at $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Setting up DuckDNS auto-update scheduled task..." -ForegroundColor Cyan

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create scheduled task action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $PSScriptRoot

# Create trigger (every 5 minutes)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)

# Create settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

# Create principal (run as SYSTEM for reliability)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Updates DuckDNS domain (nuvio.duckdns.org) with current public IP every 5 minutes"
    
    Write-Host "✅ SUCCESS! Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  - Task Name: $taskName"
    Write-Host "  - Script: $scriptPath"  
    Write-Host "  - Frequency: Every 5 minutes"
    Write-Host "  - Runs as: SYSTEM"
    Write-Host ""
    Write-Host "The task will start automatically and run every 5 minutes."
    Write-Host "Logs will be saved to: $(Join-Path $PSScriptRoot 'duckdns-update.log')"
    Write-Host ""
    Write-Host "To view/manage the task:"
    Write-Host "  1. Open Task Scheduler (search in Windows)"
    Write-Host "  2. Look for '$taskName'"
    Write-Host ""
    
    # Run the task once immediately to test
    Write-Host "Running the task once now to test..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
    
    # Check log
    $logFile = Join-Path $PSScriptRoot "duckdns-update.log"
    if (Test-Path $logFile) {
        Write-Host "Recent log entries:" -ForegroundColor Cyan
        Get-Content $logFile -Tail 3
    }
    
} catch {
    Write-Host "❌ ERROR creating scheduled task: $_" -ForegroundColor Red
    exit 1
}
