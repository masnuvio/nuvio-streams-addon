# Quick Setup Guide - Direct Public IP

Your server has a **direct public IP**: 163.223.52.102
No port forwarding needed! Much simpler setup.

## STEP 1: Set Up DuckDNS (2 minutes)

1. Go to: **https://www.duckdns.org**
2. Sign in with GitHub, Google, Reddit, or Twitter
3. In "sub domain" field: **nuvio**
4. In "current ip" field: **163.223.52.102**
5. Click **"add domain"**
6. Copy and save your **token**

Done! Domain is now: **nuvio.duckdns.org** ✅

## STEP 2: Update Auto-Update Script (1 minute)

1. Open: `duckdns-update.ps1`
2. Find line: `$DUCKDNS_TOKEN = "YOUR_DUCKDNS_TOKEN_HERE"`
3. Replace with your actual token
4. Save

## STEP 3: Install Auto-Update Task

Run PowerShell as Administrator:
```powershell
cd "c:\Users\Administrator\Desktop\nuvio stream"
.\install-duckdns-task.ps1
```

## STEP 4: Download Win-ACME (SSL Certificate Tool)

I'll download this for you automatically.

## STEP 5: Get SSL Certificate

Run Win-ACME:
```powershell
cd C:\win-acme
.\wacs.exe
```

Follow prompts:
- Create new certificate
- Domain: **nuvio.duckdns.org**
- Validation: HTTP (standalone)
- Email: your-email@example.com

## STEP 6: Set Up nginx (Reverse Proxy)

I'll set this up to:
- Listen on port 443 (HTTPS)
- Use your SSL certificate
- Forward to localhost:7000

## STEP 7: Test

- HTTP: http://nuvio.duckdns.org (should redirect to HTTPS)
- HTTPS: https://nuvio.duckdns.org
- Manifest: https://nuvio.duckdns.org/manifest.json

---

**Ready to proceed?** I'll:
1. Download Win-ACME
2. Download nginx for Windows
3. Configure nginx with SSL
4. Set up automatic certificate renewal

Let me start!
