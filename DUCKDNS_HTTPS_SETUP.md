# DuckDNS HTTPS Setup Guide - nuvio.duckdns.org

Complete step-by-step guide to set up `nuvio.duckdns.org` with HTTPS for external access.

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- ✅ PM2 running your addon on port 7000 (already done!)
- ✅ Admin access to your Windows machine (already have!)
- ✅ Admin access to your router/modem (needed for port forwarding)
- ✅ Your router's admin credentials (username/password)
- ⬜ DuckDNS account (we'll create this)
- ⬜ Email address (for SSL certificate)

---

## 🚀 Part 1: DuckDNS Setup

### Step 1: Get Your Public IP

Your public IP will be detected automatically. You'll need this for DuckDNS.

### Step 2: Create DuckDNS Account & Domain

1. **Visit**: https://www.duckdns.org
2. **Sign in** with one of:
   - GitHub
   - Google  
   - Reddit
   - Twitter

3. **Create your subdomain**:
   - In the "sub domain" field, type: `nuvio`
   - In the "current ip" field, paste your public IP (we'll provide this)
   - Click **"add domain"**

4. **Save your token**:
   - At the top of the page, you'll see your token
   - Copy and save it somewhere safe
   - You'll need this later for auto-updates

**Result**: You now own `nuvio.duckdns.org`! ✅

### Step 3: Set Up Auto-Update Script

DuckDNS needs to know your current IP. If your ISP changes your IP, this script will update DuckDNS automatically.

**I'll create an automated script for you in the next step.**

---

## 🔌 Part 2: Router Configuration (Port Forwarding)

You need to forward internet traffic to your Windows machine.

### Step 1: Find Your Local IP Address

**Run this command** (we'll do this for you):
```powershell
ipconfig
```

Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet).
It will look like: `192.168.1.XXX` or `10.0.0.XXX`

### Step 2: Access Your Router

1. **Open a browser** and go to one of these addresses:
   - http://192.168.1.1
   - http://192.168.0.1
   - http://10.0.0.1
   - http://192.168.1.254

2. **Log in** with your router's admin credentials
   - Common defaults: admin/admin, admin/password
   - Check the sticker on your router if unsure

### Step 3: Configure Port Forwarding

Look for one of these menu sections:
- "Port Forwarding"
- "Virtual Server"
- "NAT Forwarding"
- "Applications & Gaming"

**Create TWO forwarding rules:**

#### Rule 1: HTTP (for SSL certificate verification)
- **Service Name**: Nuvio-HTTP
- **External Port**: 80
- **Internal IP**: YOUR_LOCAL_IP (from Step 1)
- **Internal Port**: 7000
- **Protocol**: TCP

#### Rule 2: HTTPS (for secure access)
- **Service Name**: Nuvio-HTTPS
- **External Port**: 443
- **Internal IP**: YOUR_LOCAL_IP (from Step 1)
- **Internal Port**: 7000  
- **Protocol**: TCP

**Save** the settings and restart your router if prompted.

---

## 🔒 Part 3: SSL Certificate Setup

We'll use **Win-ACME** to get a free SSL certificate from Let's Encrypt.

### Step 1: Download Win-ACME

**I'll download and set this up for you.**

### Step 2: Run Win-ACME

```powershell
cd C:\win-acme
.\wacs.exe
```

Follow the prompts:
1. Choose: **N** (Create new certificate)
2. Choose: **2** (Manual input)
3. Domain: **nuvio.duckdns.org**
4. Choose: **1** (HTTP validation - port 80)
5. Installation: Choose appropriate option for your setup

### Step 3: Configure Automatic Renewal

Win-ACME will create a scheduled task to auto-renew your certificate every 60 days.

---

## 🔧 Part 4: Reverse Proxy Setup

Since your app runs on port 7000, but HTTPS uses port 443, we need a reverse proxy.

### Option A: Use nginx for Windows (Recommended)

**I'll set this up for you using the nginx config already in your project.**

### Option B: Use Windows HTTP Platform

Alternative if you prefer built-in Windows features.

---

## ✅ Part 5: Testing & Verification

### Test 1: Local Access
```powershell
curl http://localhost:7000/health
```
Expected: `OK`

### Test 2: HTTP Access (from outside)
From your phone (using cellular data, not WiFi):
```
http://nuvio.duckdns.org
```
Expected: Your addon landing page

### Test 3: HTTPS Access  
```
https://nuvio.duckdns.org
```
Expected: Secure landing page with 🔒 lock icon

### Test 4: Stremio Manifest
```
https://nuvio.duckdns.org/manifest.json
```
Expected: JSON response with addon details

---

## 📱 Using in Stremio

Once HTTPS is working:

1. Open **Stremio**
2. Go to **Add-ons** → **Community Add-ons**
3. Paste: `https://nuvio.duckdns.org/manifest.json`
4. Click **Install**

---

## 🔧 Troubleshooting

### Domain Not Resolving?
```powershell
nslookup nuvio.duckdns.org
```
Should return your public IP. If not, wait 5 minutes and try again.

### Port Forwarding Not Working?
- Check Windows Firewall (allow ports 80, 443)
- Verify router rules are saved
- Restart router
- Test with: http://www.yougetsignal.com/tools/open-ports/

### SSL Certificate Fails?
- Port 80 must be forwarded and accessible
- Check firewall isn't blocking port 80
- Verify nuvio.duckdns.org resolves to your IP

---

## 🎯 Next Steps

I'll now:
1. Detect your public and local IP addresses
2. Create the DuckDNS auto-update script  
3. Download and configure Win-ACME
4. Set up nginx reverse proxy
5. Guide you through the router port forwarding

**Ready to continue?** Let me get your IP information first!
