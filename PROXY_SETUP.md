# Provider Proxy Setup Guide

## Overview
This guide helps you set up proxy configuration for providers experiencing connection issues (ECONNRESET, timeout, etc.).

## Quick Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# MoviesMod Proxy (optional)
MOVIESMOD_PROXY_URL=http://your-proxy-server.com/proxy?url=

# General Proxy Settings (for all providers)
HTTP_PROXY=http://your-proxy-server:port
HTTPS_PROXY=http://your-proxy-server:port
```

### 2. Free Proxy Options

#### Option A: CORS Proxy (Simple, Free)
```env
MOVIESMOD_PROXY_URL=https://corsproxy.io/?
```

#### Option B: AllOrigins
```env
MOVIESMOD_PROXY_URL=https://api.allorigins.win/raw?url=
```

#### Option C: ThingProxy
```env
MOVIESMOD_PROXY_URL=https://thingproxy.freeboard.io/fetch/
```

### 3. Self-Hosted Proxy (Recommended)

If you have a VPS or cloud server:

```bash
# Install CORS Anywhere
npm install -g cors-anywhere

# Run proxy server
cors-anywhere
```

Then set:
```env
MOVIESMOD_PROXY_URL=http://your-server-ip:8080/
```

## Testing Proxy Configuration

Run the domain test script to verify:

```bash
node source/test_all_domains.js
```

## Provider-Specific Notes

### MoviesMod
- Supports `MOVIESMOD_PROXY_URL` environment variable
- Proxy URL should include the URL parameter placeholder
- Example: `https://proxy.com/?url=` (the actual URL will be appended)

### Netmirror
- Currently uses direct connections
- May need to add proxy support if issues persist

## Troubleshooting

### Still getting ECONNRESET?
1. Try different proxy services
2. Check if the provider domain is actually working (use test_all_domains.js)
3. Verify your network isn't blocking the proxy itself

### Slow responses?
- Free proxies can be slow
- Consider using a paid proxy service or self-hosted solution

### 403 Forbidden errors?
- The site may be detecting proxy usage
- Try rotating User-Agent headers
- Use residential proxies instead of datacenter proxies

## Alternative: Use Working Domains

Based on recent search results, try these alternative domains:

### MoviesMod
- `https://moviesmod.how` (official, recommended)
- `https://moviesmod.red`
- `https://moviesmod.co`

### Netmirror
- `https://netmirror.vip`
- `https://netmirrors.app`
- `https://netmirror.gg`

Update `source/domains.json` with working domains:

```json
{
  "moviesmod": "https://moviesmod.how",
  "netmirror": "https://netmirror.vip"
}
```

## Security Warning

⚠️ **Important**: Free proxy services may log your traffic. For sensitive operations, use:
- Self-hosted proxies
- Trusted VPN services
- Paid proxy services with privacy guarantees
