# Win-ACME SSL Certificate Setup Guide

## Current Status

✅ DNS Working: nuvio.duckdns.org → 163.223.52.102  
✅ Win-ACME Installed: C:\win-acme\wacs.exe  
✅ nginx Ready: C:\nginx\  
✅ PM2 Running: Port 7000  

## STEP 1: Get SSL Certificate with Win-ACME

**Run PowerShell as Administrator:**

```powershell
cd C:\win-acme
.\wacs.exe
```

### Follow the Wizard:

1. **Main Menu** - Choose: **N** (Create certificate with advanced options)

2. **Select target plugin** - Choose: **2** (Manual input)

3. **Host**: Enter **nuvio.duckdns.org**

4. **Validation** - Choose: **[http-01] Save verification files on (network) path**

5. **Path**: Enter: **C:\win-acme\wwwroot**
   (This directory will be created automatically)

6. **Validation site ID**: Press **Enter** to skip

7. **Additional validation sites**: Press **Enter** to skip

8. **Friendly name**: Press **Enter** (uses domain name)

9. **Installation** - Choose: **5** (No (additional) installation steps)
   (We'll configure nginx manually)

10. **Email for renewal notifications**: Enter your email address

11. **Accept Terms of Service**: Type **yes**

The process will:
- Start a temporary web server on port 80
- Request certificate from Let's Encrypt
- Validate domain ownership
- Save certificate files

**Expected Output:**
```
Certificate [nuvio.duckdns.org] created successfully
```

## STEP 2: Find Your Certificate Files

After successful creation, find the certificate location:

```powershell
dir "C:\ProgramData\win-acme\httpsacme-v02.api.letsencrypt.org\Certificates" /s /b | findstr nuvio
```

**Typical location:**
```
C:\ProgramData\win-acme\httpsacme-v02.api.letsencrypt.org\Certificates\nuvio.duckdns.org-chain.pem
C:\ProgramData\win-acme\httpsacme-v02.api.letsencrypt.org\Certificates\nuvio.duckdns.org-key.pem
```

**Note these paths!** You'll need them for nginx.

## STEP 3: Update nginx Configuration

1. Open: `nginx-windows-ssl.conf`

2. Find lines 36-37:
```nginx
ssl_certificate C:/win-acme/certificates/nuvio.duckdns.org/certificate.crt;
ssl_certificate_key C:/win-acme/certificates/nuvio.duckdns.org/private.key;
```

3. Replace with YOUR actual certificate paths:
```nginx
ssl_certificate C:/ProgramData/win-acme/httpsacme-v02.api.letsencrypt.org/Certificates/nuvio.duckdns.org-chain.pem;
ssl_certificate_key C:/ProgramData/win-acme/httpsacme-v02.api.letsencrypt.org/Certificates/nuvio.duckdns.org-key.pem;
```

4. Save the file

## STEP 4: Find nginx Directory

```powershell
dir C:\nginx /s /b | findstr nginx.exe
```

**Expected result:** Something like:
```
C:\nginx\nginx-1.27.3\nginx.exe
```

## STEP 5: Copy Configuration to nginx

Replace `nginx-1.27.3` with your actual version:

```powershell
copy "nginx-windows-ssl.conf" "C:\nginx\nginx-1.27.3\conf\nginx.conf"
```

## STEP 6: Test nginx Configuration

```powershell
cd C:\nginx\nginx-1.27.3
.\nginx.exe -t
```

**Expected result:**
```
nginx: the configuration file C:/nginx/nginx-1.27.3/conf/nginx.conf syntax is ok
nginx: configuration file C:/nginx/nginx-1.27.3/conf/nginx.conf test is successful
```

If you see errors, check certificate paths are correct.

## STEP 7: Start nginx

```powershell
cd C:\nginx\nginx-1.27.3
start nginx
```

**Verify running:**
```powershell
Get-Process nginx
```

Should show 2 nginx processes (master and worker).

## STEP 8: Test HTTPS Access

### From Your Browser:
- **HTTP** (should redirect): http://nuvio.duckdns.org
- **HTTPS**: https://nuvio.duckdns.org
- **Manifest**: https://nuvio.duckdns.org/manifest.json

All should work with 🔒 HTTPS!

### From Command Line:
```powershell
# Test redirect
curl http://nuvio.duckdns.org

# Test HTTPS
curl https://nuvio.duckdns.org/health

# Test manifest
curl https://nuvio.duckdns.org/manifest.json
```

## STEP 9: Add to Stremio

1. Open **Stremio**
2. Go to **Add-ons** → **Community Add-ons**
3. Paste: `https://nuvio.duckdns.org/manifest.json`
4. Click **Install**

Success! Your addon is now live with HTTPS! 🎉

## Troubleshooting

### Port 80 Already in Use
If Win-ACME fails because port 80 is in use:

```powershell
# Find what's using port 80
netstat -ano | findstr :80

# If it's another service, stop it temporarily
# Or use DNS validation instead of HTTP validation
```

### Certificate Not Found
```powershell
# List all certificate directories
dir "C:\ProgramData\win-acme" /s /b | findstr Certificates
```

### nginx Won't Start
```powershell
# Check error logs
type C:\nginx\nginx-1.27.3\logs\error.log

# Common issues:
# - Certificate paths wrong
# - Port 80/443 already in use
# - Config syntax error (run nginx -t)
```

### Can't Access from Outside
```powershell
# Test locally first
curl https://localhost

# Then from external network (use phone)
```

## Quick Commands Reference

```powershell
# Start nginx
cd C:\nginx\nginx-1.27.3
start nginx

# Stop nginx
taskkill /F /IM nginx.exe

# Reload config (after changes)
.\nginx.exe -s reload

# Test config
.\nginx.exe -t

# View error logs
type logs\error.log

# Check PM2 status
pm2 status

# Re-run Win-ACME (for renewals)
cd C:\win-acme
.\wacs.exe --renew
```

## Auto-Renewal

Win-ACME automatically creates a scheduled task for certificate renewal.

**Check scheduled task:**
```powershell
Get-ScheduledTask | Where-Object {$_.TaskName -like "*win-acme*"}
```

Certificates auto-renew every 60 days!

---

## Success Checklist

- [ ] Run Win-ACME and obtain certificate
- [ ] Note certificate file paths
- [ ] Update nginx-windows-ssl.conf with correct paths
- [ ] Copy config to nginx directory
- [ ] Test nginx config (nginx -t)
- [ ] Start nginx
- [ ] Test HTTPS access
- [ ] Install addon in Stremio
- [ ] Verify certificate auto-renewal is scheduled

**Once complete, your setup will:**
- Auto-start on boot (PM2 + nginx)
- Auto-renew SSL (every 60 days)
- Auto-update DuckDNS IP (every 5 minutes)
- Work from anywhere: **https://nuvio.duckdns.org**
