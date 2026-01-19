# Public HTTPS Access Setup - nuvio.duckdns.org

This guide will help you set up **nuvio.duckdns.org** with HTTPS for external access.

## 🎯 Goal

Make your Nuvio Streams addon accessible from anywhere with:
- Domain: `nuvio.duckdns.org`
- Protocol: HTTPS (secure)
- No localhost restrictions

## 🚀 Recommended: Cloudflare Tunnel (Easiest)

**Why Cloudflare Tunnel?**
✅ No port forwarding needed  
✅ Automatic HTTPS (free SSL)  
✅ Works behind routers/firewalls  
✅ DDoS protection included  
✅ 100% free  
✅ Works on Windows easily  

### Step 1: Install Cloudflare Tunnel

```powershell
# Download cloudflared for Windows
# Visit: https://github.com/cloudflare/cloudflared/releases
# Download: cloudflared-windows-amd64.exe

# Or use this direct download link (latest stable):
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
```

### Step 2: Authenticate with Cloudflare

```powershell
# Run authentication (opens browser)
.\cloudflared.exe tunnel login
```

This will:
1. Open your browser
2. Ask you to log in to Cloudflare (create free account if needed)
3. Select a domain (or create one)
4. Save credentials locally

### Step 3: Create a Tunnel

```powershell
# Create tunnel named 'nuvio-streams'
.\cloudflared.exe tunnel create nuvio-streams

# Note the Tunnel ID that appears
```

### Step 4: Configure the Tunnel

Create a config file: `C:\Users\Administrator\.cloudflared\config.yml`

```yaml
tunnel: YOUR_TUNNEL_ID_HERE
credentials-file: C:\Users\Administrator\.cloudflared\YOUR_TUNNEL_ID_HERE.json

ingress:
  - hostname: nuvio.duckdns.org
    service: http://localhost:7000
  - service: http_status:404
```

Replace `YOUR_TUNNEL_ID_HERE` with the actual tunnel ID from Step 3.

### Step 5: Route DNS to Your Tunnel

```powershell
.\cloudflared.exe tunnel route dns nuvio-streams nuvio.duckdns.org
```

**WAIT!** Before this works, you need to:
1. Go to https://www.duckdns.org
2. Create subdomain `nuvio` 
3. Set it as a CNAME pointing to: `YOUR_TUNNEL_ID.cfargotunnel.com`

OR use Cloudflare's own domain (easier):
- Register a free domain at Cloudflare
- Use `nuvio.yourdomain.com` instead

### Step 6: Run the Tunnel

```powershell
# Test run (foreground)
.\cloudflared.exe tunnel run nuvio-streams

# If it works, set up as Windows service
.\cloudflared.exe service install
.\cloudflared.exe service start
```

### Step 7: Test Access

Visit: `https://nuvio.duckdns.org`

Should show your Nuvio Streams landing page with HTTPS! 🎉

---

## 🔧 Alternative: Traditional Port Forwarding + DuckDNS

**Choose this if:**
- You have admin access to your router
- You're comfortable with port forwarding
- You want full control

### Step 1: Get Your Public IP

```powershell
# Get your current public IP
curl https://api.ipify.org
```

### Step 2: Set Up DuckDNS

1. **Visit**: https://www.duckdns.org
2. **Sign in** with GitHub, Google, Reddit, or Twitter
3. **Create subdomain**: Enter `nuvio`
4. **Set IP**: Paste your public IP from Step 1
5. **Click**: "Add Domain"
6. **Save your token**: You'll need this for auto-updates

### Step 3: Configure Port Forwarding

Access your router's admin panel (usually http://192.168.1.1 or http://192.168.0.1)

**Create these port forwarding rules:**

| External Port | Internal IP | Internal Port | Protocol |
|---------------|-------------|---------------|----------|
| 80 | YOUR_PC_IP | 7000 | TCP |
| 443 | YOUR_PC_IP | 7000 | TCP |

**Find YOUR_PC_IP:**
```powershell
ipconfig | findstr IPv4
```

### Step 4: Install Win-ACME (for SSL certificates)

```powershell
# Download Win-ACME
Invoke-WebRequest -Uri "https://github.com/win-acme/win-acme/releases/latest/download/win-acme.v2.2.9.1701.x64.pluggable.zip" -OutFile "win-acme.zip"

# Extract
Expand-Archive -Path win-acme.zip -DestinationPath "C:\win-acme"
cd C:\win-acme

# Run Win-ACME
.\wacs.exe
```

Follow prompts to:
1. Create a new certificate
2. Choose "HTTP validation"
3. Domain: `nuvio.duckdns.org`
4. Choose "Start new installation script"

### Step 5: Configure Reverse Proxy

**Option A: Use nginx for Windows**

Download nginx for Windows: http://nginx.org/en/download.html

Configure with the nginx config files already in your project:
```powershell
# Copy nginx config
copy "c:\Users\Administrator\Desktop\nuvio stream\nginx\nginx.conf" "C:\nginx\conf\"

# Update SSL paths in nginx.conf to point to Win-ACME certificates
# Start nginx
nginx
```

**Option B: Use IIS (if installed)**

Configure IIS as reverse proxy to localhost:7000

### Step 6: Auto-Update DuckDNS IP

Create scheduled task to update IP every 5 minutes:

```powershell
# Create update script
$scriptPath = "C:\duckdns-update.ps1"
@"
`$token = 'YOUR_DUCKDNS_TOKEN'
`$domain = 'nuvio'
Invoke-WebRequest -Uri "https://www.duckdns.org/update?domains=`$domain&token=`$token&ip=" -UseBasicParsing
"@ | Out-File $scriptPath

# Create scheduled task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File $scriptPath"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "DuckDNS-Update" -Action $action -Trigger $trigger -User "SYSTEM"
```

### Step 7: Test External Access

From your phone (on cellular data, not WiFi):
- Visit: `https://nuvio.duckdns.org`

---

## 🎯 Quick Comparison

| Feature | Cloudflare Tunnel | Port Forwarding |
|---------|------------------|-----------------|
| Setup Time | 10 minutes | 30-60 minutes |
| Port Forwarding | Not needed | Required |
| SSL Certificate | Automatic | Manual setup |
| Router Access | Not needed | Required |
| DDoS Protection | Included | No |
| IP Changes | Not a problem | Need auto-update |
| Best For | Quick, easy, secure | Full control |

## 📝 Recommendation

**Start with Cloudflare Tunnel** - it's by far the easiest and most reliable option for Windows.

If you need to use DuckDNS specifically (not Cloudflare's domain), you can:
1. Set up Cloudflare DNS
2. Point nuvio.duckdns.org CNAME to your Cloudflare Tunnel

## 🆘 Need Help?

I can guide you through either setup interactively. Which method do you prefer?

1. **Cloudflare Tunnel** (recommended - easiest)
2. **Port Forwarding + DuckDNS** (traditional method)

Let me know and I'll help you set it up step by step!
