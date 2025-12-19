# How to Check Server Logs

## Method 1: View Running Terminal
The easiest way is to **look at the terminal window where you ran `npm start`**. The server outputs logs in real-time there.

## Method 2: Test Stream Endpoint
Open a **new PowerShell window** and run:

```powershell
# Test Fight Club (TMDB ID: 550)
Invoke-WebRequest -Uri "http://localhost:7000/stream/movie/tmdb:550.json" -UseBasicParsing | Select-Object -ExpandProperty Content
```

Then **check the npm start terminal** - you should see logs like:
- `Stream request for Stremio type: 'movie', id: 'tmdb:550'`
- `[StreamFlix] Fetching streams for: Fight Club`
- `[VidZee] Searching for: Fight Club`

## Method 3: Check What You Should See

**Good logs (providers working):**
```
[StreamFlix] Successfully fetched 4 streams
[VidZee] Found 3 streams
[DahmerMovies] Extracted 2 streams
```

**Bad logs (providers not working):**
```
[StreamFlix] No streams returned
[VidZee] Skipping fetch: Not selected by user
[Provider] Error fetching streams: ...
```

## What to Look For

1. **Are providers being called?** Look for `[ProviderName] Fetching...` messages
2. **Are streams being found?** Look for `Successfully fetched X streams` messages
3. **Any errors?** Look for `Error:` or `failed` messages

## Current Status

Your server is running on **http://localhost:7000**

**Manifest URL:** `http://localhost:7000/manifest.json`

Try the test command above and **tell me what you see in the npm start terminal!**
