# 🎬 WORKING STREMIO ADDON - QUICK START

## ✅ Your Addon is READY!

The Nuvio Streams addon is **running and functional** on your machine.

---

## 📦 Installation (2 Steps)

### Step 1: Keep Server Running
```bash
cd "c:\Users\Administrator\Desktop\nuvio stream\source"
npm start
```
**Keep this terminal window open!**

### Step 2: Install in Stremio
Open Stremio and install using this URL:
```
http://localhost:7000/manifest.json
```

**Or use the direct protocol link:**
```
stremio://localhost:7000/manifest.json
```

---

## 🎯 Quick Test

1. Open Stremio
2. Search for **"Fight Club"** or **"Breaking Bad"**
3. Click the title
4. Look for streams from **"Nuvio Streams"**
5. Click to play!

---

## ✨ Working Providers

- ✅ **VidSrc** - Primary (most reliable)
- ✅ **Showbox** - Secondary
- ✅ **YFlix** - Additional
- ✅ **VidLink** - Backup

---

## 🚀 Deploy to Production (Optional)

For permanent access without running locally:

### Vercel (Easiest)
```bash
npm i -g vercel
cd "c:\Users\Administrator\Desktop\nuvio stream\source"
vercel
```
Then use the Vercel URL in Stremio!

---

## 🔧 Troubleshooting

**No streams?**
- Ensure server is running (`npm start`)
- Check server logs for errors
- Try different movies/shows

**Can't install?**
- Verify URL: `http://localhost:7000/manifest.json`
- Check server is running on port 7000
- Try restarting Stremio

---

## 📊 Server Status

- **URL**: http://localhost:7000
- **Manifest**: http://localhost:7000/manifest.json
- **Status**: ✅ RUNNING

---

## 📝 Notes

- Server must be running for addon to work
- For permanent access, deploy to Vercel/Heroku
- See full walkthrough for detailed instructions
