# IMPORTANT: Complete DuckDNS Registration First!

## Issue Detected

The DuckDNS token is configured, but the domain **nuvio.duckdns.org** hasn't been registered yet at DuckDNS.org.

## STEP 1: Register Domain at DuckDNS (2 minutes)

1. **Open browser** and go to: **https://www.duckdns.org**

2. **Sign in** using one of these options:
   - GitHub
   - Google
   - Reddit  
   - Twitter

3. **Create your subdomain**:
   - Look for the input box labeled "sub domain"
   - Type: **nuvio** (don't include .duckdns.org)
   - In the "current ip" box, type: **163.223.52.102**
   - Click the **"add domain"** button

4. **Verify** your domain appears in the dashboard:
   - You should see **nuvio.duckdns.org** in your domains list
   - The IP should show: **163.223.52.102**
   - Status should be green/active

5. **Important**: Your token is already configured:
   - Token: cee5cbe2-1d14-4080-bcc9-faf668913255 ✅

## STEP 2: Test DuckDNS Update (After registering domain)

After creating the domain at DuckDNS.org, run:

```powershell
cd "c:\Users\Administrator\Desktop\nuvio stream"
powershell -ExecutionPolicy Bypass -File "duckdns-update.ps1"
```

You should see:
```
Current Public IP: 163.223.52.102
[2026-01-17 xx:xx:xx] DuckDNS update successful for nuvio.duckdns.org
```

## TEST 3: Verify DNS Resolution

Wait 2-3 minutes after registration, then test:

```powershell
nslookup nuvio.duckdns.org
```

Expected result:
```
Server:  UnKnown
Address:  163.223.52.1

Name:    nuvio.duckdns.org
Address:  163.223.52.102
```

## STEP 4: Install Auto-Update Scheduled Task

Once the test is successful, install the scheduled task:

```powershell
cd "c:\Users\Administrator\Desktop\nuvio stream"
powershell -ExecutionPolicy Bypass -File "install-duckdns-task.ps1"
```

**Run as Administrator!**

This will:
- Create a Windows scheduled task
- Update DuckDNS IP every 5 minutes automatically
- Start on boot
- Log all updates to `duckdns-update.log`

## STEP 5: Proceed with SSL Setup

Once DuckDNS is working, continue with SSL certificate:

```powershell
cd C:\win-acme
.\wacs.exe
```

Follow the prompts to create certificate for **nuvio.duckdns.org**

---

## Quick Checklist

- [ ] Go to duckdns.org and sign in
- [ ] Create subdomain "nuvio" pointing to 163.223.52.102
- [ ] Run duckdns-update.ps1 test (should show SUCCESS)
- [ ] Run nslookup test (should resolve to 163.223.52.102)
- [ ] Install scheduled task (run install-duckdns-task.ps1 as Admin)
- [ ] Run Win-ACME to get SSL certificate
- [ ] Configure and start nginx
- [ ] Test HTTPS access

---

## Status

✅ DuckDNS token configured  
⏳ Domain registration needed (do this now at duckdns.org)  
⏳ SSL certificate pending (after domain works)  
⏳ nginx configuration pending (after certificate)

**NEXT ACTION**: Register the domain at https://www.duckdns.org now!
