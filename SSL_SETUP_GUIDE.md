# ============================================
# Step-by-Step SSL Setup Instructions
# ============================================

## Current Status
✅ Win-ACME installed at: C:\win-acme
✅ nginx ready at: C:\nginx  
✅ PM2 service running on port 7000
✅ Public IP: 163.223.52.102 (direct access)

## STEP 1: Set Up DuckDNS Domain (Do This First!)

1. Open browser: https://www.duckdns.org
2. Sign in with GitHub/Google/Reddit/Twitter
3. Create subdomain:
   - Sub domain: **nuvio**
   - Current IP: **163.223.52.102**
4. Click "add domain"
5. SAVE YOUR TOKEN!

Result: nuvio.duckdns.org now points to your server ✅

## STEP 2: Update DuckDNS Auto-Update Script

1. Open: `duckdns-update.ps1`
2. Find: `$DUCKDNS_TOKEN = "YOUR_DUCKDNS_TOKEN_HERE"`
3. Replace with your actual token from DuckDNS
4. Save the file

## STEP 3: Install Auto-Update Scheduled Task

Open PowerShell as Administrator:
```powershell
cd "c:\Users\Administrator\Desktop\nuvio stream"
.\install-duckdns-task.ps1
```

This will update your IP automatically every 5 minutes.

## STEP 4: Test DNS Resolution

Wait 2-3 minutes after setting up DuckDNS, then test:
```powershell
nslookup nuvio.duckdns.org
```

Should return: 163.223.52.102

## STEP 5: Obtain SSL Certificate with Win-ACME

Open PowerShell as Administrator:
```powershell
cd C:\win-acme
.\wacs.exe
```

Follow the wizard:
1. Choose: **N** (Create new certificate)
2. Choose: **2** (Manual input)
3. Domain name: **nuvio.duckdns.org**
4. Validation: Choose **1** (HTTP validation - Self Hosting)
5. Port: **80**
6. Installation: Choose **5** (No (additional) installation steps)

Win-ACME will:
- Start a temporary web server on port 80
- Request certificate from Let's Encrypt  
- Save certificate files
- Set up automatic renewal (every 60 days)

Certificate will be saved to: `C:\ProgramData\win-acme\httpsacme-v02.api.letsencrypt.org`

## STEP 6: Find Your Certificate Files

After Win-ACME completes, find the certificate files:
```powershell
dir "C:\ProgramData\win-acme\httpsacme-v02.api.letsencrypt.org\Certificates" /s
```

Look for files like:
- `nuvio.duckdns.org-chain.pem` (certificate)
- `nuvio.duckdns.org-key.pem` (private key)

Note the full paths - you'll need them for nginx.

## STEP 7: Update nginx Configuration

1. Open: `nginx-windows-ssl.conf`
2. Find these lines:
   ```nginx
   ssl_certificate C:/win-acme/certificates/nuvio.duckdns.org/certificate.crt;
   ssl_certificate_key C:/win-acme/certificates/nuvio.duckdns.org/private.key;
   ```
3. Replace with actual paths from Step 6
4. Save the file

## STEP 8: Copy nginx Configuration

```powershell
copy "nginx-windows-ssl.conf" "C:\nginx\nginx-1.27.3\conf\nginx.conf"
```

(Note: nginx version folder name may be different, check C:\nginx directory)

## STEP 9: Test nginx Configuration

```powershell
cd C:\nginx\nginx-1.27.3
.\nginx.exe -t
```

Should show: "test is successful"

## STEP 10: Start nginx

```powershell
cd C:\nginx\nginx-1.27.3
start nginx
```

Check if running:
```powershell
Get-Process nginx
```

## STEP 11: Test HTTPS Access

From your browser or phone:
- HTTP (should redirect): http://nuvio.duckdns.org
- HTTPS: https://nuvio.duckdns.org
- Manifest: https://nuvio.duckdns.org/manifest.json

All should work with HTTPS (🔒) lock icon!

## STEP 12: Set Up nginx as Windows Service (Optional but Recommended)

To make nginx start automatically on boot:

1. Download NSSM (Non-Sucking Service Manager):
   ```powershell
   Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "nssm.zip"
   Expand-Archive nssm.zip -DestinationPath C:\nssm
   ```

2. Install nginx as service:
   ```powershell
   cd C:\nssm\nssm-2.24\win64
   .\nssm.exe install nginx "C:\nginx\nginx-1.27.3\nginx.exe"
   .\nssm.exe set nginx AppDirectory "C:\nginx\nginx-1.27.3"
   .\nssm.exe start nginx
   ```

3. Set to auto-start:
   ```powershell
   sc.exe config nginx start=auto
   ```

## Troubleshooting

### Port 80 or 443 Already in Use
```powershell
# Check what's using the ports
netstat -ano | findstr :80
netstat -ano | findstr :443

# Stop nginx if needed
taskkill /F /IM nginx.exe
```

### Certificate Not Working
- Verify certificate paths in nginx.conf
- Check certificate files exist
- Restart nginx after config changes

### Can't Access from Outside
- Check Windows Firewall allows ports 80 and 443
- Verify DNS with: nslookup nuvio.duckdns.org
- Test locally first: curl https://localhost

### nginx Won't Start
- Check configuration: `nginx -t`
- Check logs: `type C:\nginx\nginx-1.27.3\logs\error.log`
- Ensure PM2 app is running on port 7000

## Quick Commands Reference

```powershell
# Start nginx
cd C:\nginx\nginx-1.27.3
start nginx

# Stop nginx
taskkill /F /IM nginx.exe

# Reload nginx config (after changes)
cd C:\nginx\nginx-1.27.3
.\nginx.exe -s reload

# Test nginx config
.\nginx.exe -t

# Check PM2 status
pm2 status

# View nginx error logs
type C:\nginx\nginx-1.27.3\logs\error.log
```

## Success Checklist

- [ ] DuckDNS domain created and pointing to 163.223.52.102
- [ ] Auto-update scheduled task installed
- [ ] DNS resolves correctly (nslookup test passes)
- [ ] Win-ACME certificate obtained successfully
- [ ] nginx configured with correct certificate paths
- [ ] nginx starts without errors
- [ ] HTTPS works: https://nuvio.duckdns.org  
- [ ] Stremio manifest accessible: https://nuvio.duckdns.org/manifest.json
- [ ] nginx set up as Windows service (optional)

## Final Setup

Once everything works:
- Both PM2 (app) and nginx (HTTPS proxy) will start on boot
- SSL certificate auto-renews every 60 days
- DuckDNS IP updates every 5 minutes
- Access your addon anywhere: **https://nuvio.duckdns.org**
