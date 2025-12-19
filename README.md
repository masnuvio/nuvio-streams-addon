# Nuvio Streams Addon for Stremio

A powerful Stremio addon providing high-quality streaming links from 34+ providers, optimized for Linux VPS deployment.

## ✨ Features

- **34 Providers** - Access streams from multiple sources
- **Smart Caching** - Redis and file-based caching for better performance
- **Quality Filtering** - Filter streams by minimum quality
- **Codec Filtering** - Exclude DV/HDR streams if needed
- **Custom Configuration** - Configure providers, quality, and more
- **Production Ready** - PM2 clustering, Nginx reverse proxy, SSL support
- **Easy Deployment** - Automated deployment script for Linux VPS

## 🚀 Quick Deploy on Linux VPS

### One-Command Deployment

```bash
wget https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/deploy.sh
sudo bash deploy.sh
```

The script will automatically:
- ✅ Install Node.js, PM2, and Nginx
- ✅ Clone and setup the application
- ✅ Configure reverse proxy
- ✅ Start the service
- ✅ Setup firewall

### Manual Deployment

See [LINUX_DEPLOYMENT.md](LINUX_DEPLOYMENT.md) for complete step-by-step guide including:
- Server setup
- Domain configuration
- SSL/HTTPS setup
- Process management
- Monitoring and logging
- Troubleshooting

## 📦 Working Providers

**Confirmed Working (14+ streams):**
- VidZee
- MP4Hydra
- UHDMovies
- 4KHDHub
- Vixsrc
- Castle
- StreamFlix
- DahmerMovies
- VidLink
- Videasy

**And 24 more providers!**

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Optional: Enable Redis caching (recommended for production)
USE_REDIS_CACHE=false
REDIS_URL=redis://localhost:6379

# Optional: Disable specific providers
ENABLE_VIDZEE_PROVIDER=true
ENABLE_STREAMFLIX_PROVIDER=true
# ... see .env.example for all options

# Server port (default: 7000)
PORT=7000
```

### Provider Configuration

Configure providers via the web interface at `http://your-domain.com/configure`

## 📖 Installation in Stremio

1. Open Stremio
2. Click **Add-ons** (puzzle icon)
3. Click **Community Add-ons**
4. Scroll to **Add-on Repository URL**
5. Enter your manifest URL:
   - Production: `https://your-domain.com/manifest.json`
   - Local: `http://localhost:7000/manifest.json`
6. Click **Install**

## 🛠️ Development

### Local Development

```bash
# Clone repository
git clone https://github.com/masnuvio/nuvio-streams-addon.git
cd nuvio-streams-addon

# Install dependencies
npm install

# Start development server
npm start
```

Access at: `http://localhost:7000`

### Project Structure

```
├── server.js              # Express server
├── addon.js               # Stremio addon logic
├── manifest.json          # Addon manifest
├── providers/             # Provider implementations
├── utils/                 # Utility functions
├── views/                 # Web interface
├── ecosystem.config.js    # PM2 configuration
├── nginx.conf             # Nginx configuration
└── deploy.sh              # Deployment script
```

## 🌐 Production Deployment

### Requirements

- **Server:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM:** 1GB minimum (2GB+ recommended)
- **CPU:** 1 core minimum (2+ cores recommended)
- **Domain:** Optional but recommended for SSL

### Deployment Options

**Option 1: Automated Script (Recommended)**
```bash
sudo bash deploy.sh
```

**Option 2: Manual Deployment**

See [LINUX_DEPLOYMENT.md](LINUX_DEPLOYMENT.md) for complete guide.

### Domain & SSL Setup

1. **Point your domain to server IP**
   ```
   Type: A
   Name: @
   Value: YOUR_SERVER_IP
   ```

2. **Install SSL certificate**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Access your addon**
   ```
   https://your-domain.com/manifest.json
   ```

## 📊 Performance

- **Caching:** File-based and optional Redis caching
- **Parallel Fetching:** All providers fetch simultaneously
- **Timeout Protection:** 30s timeout per provider
- **Smart Retries:** Automatic retries for failed requests
- **Clustering:** PM2 cluster mode for multi-core utilization

## 🔧 Management Commands

### PM2 Process Management

```bash
# View status
pm2 status

# View logs
pm2 logs nuvio-streams-addon

# Restart
pm2 restart nuvio-streams-addon

# Monitor resources
pm2 monit
```

### Nginx

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/nuvio-streams-access.log
```

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs nuvio-streams-addon --err

# Check if port is in use
sudo lsof -i :7000

# Restart application
pm2 restart nuvio-streams-addon
```

### Nginx 502 Error

```bash
# Check if app is running
pm2 status
curl http://localhost:7000/health

# Check Nginx logs
sudo tail -f /var/log/nginx/nuvio-streams-error.log
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew
```

See [LINUX_DEPLOYMENT.md](LINUX_DEPLOYMENT.md) for complete troubleshooting guide.

## 🔄 Updating

```bash
# Navigate to application directory
cd /var/www/nuvio-streams-addon

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Restart application
pm2 restart nuvio-streams-addon
```

## 📝 Environment Variables Reference

See `.env.example` for all available environment variables.

## 🎯 Production Checklist

- [ ] Server setup complete
- [ ] Node.js 18+ installed
- [ ] PM2 installed and configured
- [ ] Nginx installed and configured
- [ ] Application running: `pm2 status`
- [ ] Domain DNS configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] PM2 startup enabled
- [ ] Redis caching enabled (optional)

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🆘 Support

**Check logs:**
```bash
pm2 logs nuvio-streams-addon
sudo tail -f /var/log/nginx/nuvio-streams-error.log
```

**Test endpoints:**
```bash
curl http://localhost:7000/health
curl http://localhost:7000/manifest.json
```

## 🔗 Documentation

- [Linux Deployment Guide](LINUX_DEPLOYMENT.md) - Complete deployment guide
- [Environment Variables](.env.example) - Configuration options
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

Made with ❤️ for the Stremio community

**Deploy your own instance:** `sudo bash deploy.sh`
