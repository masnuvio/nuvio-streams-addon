# Windows Permanent Setup Guide

This guide will help you run the Nuvio Streams addon permanently on your Windows machine.

## Prerequisites

✅ Node.js v18.x installed  
✅ npm installed  

## Quick Setup (Automated)

Run this PowerShell script to set everything up automatically:

```powershell
# Navigate to the project directory
cd "c:\Users\Administrator\Desktop\nuvio stream"

# Install dependencies
npm install

# Install PM2 globally (process manager)
npm install -g pm2 pm2-windows-startup

# Configure PM2 to start on Windows boot
pm2-startup install

# Start the application with PM2
pm2 start ecosystem.config.js

# Save the PM2 process list to resurrect on reboot
pm2 save

# Check status
pm2 status
```

## Manual Setup Steps

### Step 1: Install Dependencies

```powershell
cd "c:\Users\Administrator\Desktop\nuvio stream"
npm install
```

### Step 2: Install PM2 Process Manager

PM2 will keep your application running permanently, restart it if it crashes, and start it automatically on Windows boot.

```powershell
npm install -g pm2 pm2-windows-startup
```

### Step 3: Configure Windows Startup

```powershell
# This configures PM2 to start when Windows boots
pm2-startup install
```

### Step 4: Start the Application

```powershell
# Start with PM2 using the existing ecosystem config
pm2 start ecosystem.config.js

# Alternative: Start directly
pm2 start server.js --name "nuvio-streams"
```

### Step 5: Save PM2 Configuration

```powershell
# Save current processes to resurrect on reboot
pm2 save
```

## Managing the Application

### Check Status
```powershell
pm2 status
```

### View Logs
```powershell
# View all logs
pm2 logs

# View logs for specific app
pm2 logs nuvio-streams-addon

# View only errors
pm2 logs --err
```

### Restart Application
```powershell
pm2 restart nuvio-streams-addon
```

### Stop Application
```powershell
pm2 stop nuvio-streams-addon
```

### Remove from PM2
```powershell
pm2 delete nuvio-streams-addon
```

### Monitor Performance
```powershell
pm2 monit
```

## Access Your Addon

Once running, access your addon at:

- **Landing Page**: http://localhost:7000
- **Manifest**: http://localhost:7000/manifest.json
- **Health Check**: http://localhost:7000/health

## Using with DuckDNS Domain

If you want to access this from outside your network with `nuvio.duckdns.org`:

1. **Set up port forwarding** on your router:
   - Forward port 80 (HTTP) to your local machine's IP:7000
   - Forward port 443 (HTTPS) to your local machine's IP:7000

2. **Configure DuckDNS**:
   - Go to https://www.duckdns.org
   - Point `nuvio.duckdns.org` to your **public IP address**
   - Install DuckDNS Windows updater for dynamic IP

3. **Use nginx for SSL** (optional):
   - Install nginx for Windows
   - Use the nginx config from the `nginx/` folder
   - Get SSL certificate with Certbot for Windows

## Alternative: Simple npm start

If you just want to test without PM2:

```powershell
cd "c:\Users\Administrator\Desktop\nuvio stream"
npm install
npm start
```

**Note**: This won't start on boot and will stop when you close the terminal.

## Troubleshooting

### Port Already in Use
```powershell
# Check what's using port 7000
netstat -ano | findstr :7000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### PM2 Not Found After Install
```powershell
# Restart PowerShell or add npm global path to PATH
# Check npm global path:
npm config get prefix

# Add to PATH: C:\Users\Administrator\AppData\Roaming\npm
```

### Application Not Starting on Boot
```powershell
# Reinstall PM2 startup
pm2-startup uninstall
pm2-startup install

# Make sure processes are saved
pm2 save
```

### View Detailed Logs
```powershell
# Check PM2 logs
pm2 logs --lines 100

# Check application log files
type logs\pm2-error.log
type logs\pm2-out.log
```

## Uninstall

To completely remove the permanent setup:

```powershell
# Stop all PM2 processes
pm2 kill

# Remove PM2 from startup
pm2-startup uninstall

# Uninstall PM2 globally (optional)
npm uninstall -g pm2 pm2-windows-startup
```

## Performance Optimization

The `ecosystem.config.js` configuration includes:

- **Cluster Mode**: Runs multiple instances for better performance
- **Auto Restart**: Automatically restarts if it crashes
- **Memory Limit**: Restarts if memory usage exceeds 1GB
- **Log Management**: Logs stored in `logs/` directory

## Security Notes

⚠️ If exposing to the internet:
- Use HTTPS with SSL certificates
- Set up proper firewall rules
- Keep Node.js and dependencies updated
- Monitor logs for suspicious activity

## Next Steps

1. ✅ Run the Quick Setup commands
2. ✅ Verify it's running at http://localhost:7000
3. ✅ Check PM2 status with `pm2 status`
4. ✅ Test auto-restart by rebooting your PC
5. ✅ (Optional) Set up DuckDNS for external access
