# ✅ Nuvio Streams Addon - Setup Complete!

Your Nuvio Streams addon is now running permanently on your Windows machine.

## 🎉 What Was Set Up

### ✅ Permanent Service Running
- **Process Manager**: PM2 with cluster mode
- **Multiple Instances**: Running in cluster mode for better performance
- **Auto-Recovery**: Automatically restarts if crash occurs
- **Memory Management**: Auto-restart if memory exceeds 1GB
- **Windows Startup**: Configured to start automatically on boot

### ✅ Service Details
- **Application Name**: `nuvio-streams-addon`
- **Port**: 7000
- **Execution Mode**: Cluster (multiple instances)
- **Logs Location**: `logs/pm2-error.log` and `logs/pm2-out.log`

## 🌐 Access Your Addon

### Local Access
- **Landing Page**: http://localhost:7000
- **Manifest URL**: http://localhost:7000/manifest.json
- **Health Check**: http://localhost:7000/health
- **Configure Page**: http://localhost:7000/configure

### Add to Stremio (Local)
1. Open Stremio
2. Go to Add-ons → Community Add-ons
3. Paste this URL: `http://localhost:7000/manifest.json`
4. Click "Install"

## 📊 Managing Your Service

### Check Status
```powershell
pm2 status
```

### View Live Logs
```powershell
pm2 logs
```

### Restart Service
```powershell
pm2 restart nuvio-streams-addon
```

### Stop Service
```powershell
pm2 stop nuvio-streams-addon
```

### Delete Service
```powershell
pm2 delete nuvio-streams-addon
pm2 save
```

### Monitor Performance
```powershell
pm2 monit
```

## 🌍 Making It Publicly Accessible

Your addon is currently only accessible on this machine (localhost). To make it accessible from anywhere:

### Option 1: Using DuckDNS (Recommended - Free)

1. **Set up DuckDNS**:
   - Visit https://www.duckdns.org
   - Sign in and create subdomain: `nuvio`
   - Point it to your **public IP** (not 192.168.x.x)

2. **Set up port forwarding on your router**:
   - Forward **External Port 80** → **Internal Port 7000** (this machine's IP)
   - Forward **External Port 443** → **Internal Port 7000** (this machine's IP)

3. **Access from anywhere**:
   - http://nuvio.duckdns.org
   - Add to Stremio: `http://nuvio.duckdns.org/manifest.json`

### Option 2: Using Cloudflare Tunnel (Free, No Port Forwarding)

Install Cloudflare Tunnel:
```powershell
# Install cloudflared
# Download from: https://github.com/cloudflare/cloudflared/releases

# Run tunnel
cloudflared tunnel --url http://localhost:7000
```

This gives you a public URL immediately without port forwarding!

### Option 3: Using ngrok (Quick Testing)

```powershell
# Install ngrok from https://ngrok.com/download

# Run ngrok
ngrok http 7000
```

You'll get a public URL like `https://abc123.ngrok.io`

## 🔧 Troubleshooting

### Service Not Running?
```powershell
pm2 restart nuvio-streams-addon
pm2 logs --err
```

### Port 7000 Already in Use?
```powershell
# Find what's using the port
netstat -ano | findstr :7000

# Kill the process (replace <PID> with actual ID)
taskkill /PID <PID> /F

# Restart PM2
pm2 restart nuvio-streams-addon
```

### Not Starting After Reboot?
```powershell
# Reinstall startup configuration
pm2-startup install
pm2 save
```

### Check Service Logs
```powershell
# View last 50 lines
pm2 logs --lines 50

# View errors only
pm2 logs --err

# View specific log files
type logs\pm2-error.log
type logs\pm2-out.log
```

## 📁 Important Files

- **WINDOWS_SETUP.md**: Complete Windows setup guide
- **DOMAIN_SETUP_INSTRUCTIONS.md**: DuckDNS domain setup
- **ecosystem.config.js**: PM2 configuration
- **logs/**: Application logs directory
- **.env**: Environment configuration (optional)

## 🚀 Next Steps

1. ✅ **Test locally**: Visit http://localhost:7000
2. ✅ **Add to Stremio**: Use `http://localhost:7000/manifest.json`
3. ⭐ **Optional**: Set up DuckDNS for public access
4. ⭐ **Optional**: Configure FebBox cookies via configure page

## 📝 Quick Reference Commands

```powershell
# View status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart nuvio-streams-addon

# Stop
pm2 stop nuvio-streams-addon

# Start
pm2 start nuvio-streams-addon

# Monitor
pm2 monit
```

## 🎯 Current Status

✅ PM2 Installed and Running  
✅ Application Started Successfully  
✅ Auto-Start on Boot Configured  
✅ Health Check: **PASSING** (http://localhost:7000/health)  
✅ Manifest: **AVAILABLE** (http://localhost:7000/manifest.json)  
✅ Logs: **ACTIVE** (logs/pm2-*.log)  

---

**🎊 Your Nuvio Streams addon is now running permanently!**

Need help? Check **WINDOWS_SETUP.md** for detailed instructions.
