# Nuvio Streams - Stremio Addon

High-performance Stremio addon providing streaming links from 34+ providers. Deploy on any Linux VPS in minutes.

## ⚡ Quick Start

### One-Command Deployment

```bash
wget https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/deploy.sh
sudo bash deploy.sh
```

That's it! The script installs everything and starts your addon.

## 🎯 Features

- **34+ Providers** - Multiple streaming sources
- **Smart Caching** - Redis & file-based caching
- **Quality Filtering** - Filter by resolution
- **Production Ready** - PM2, Nginx, SSL included
- **Easy Deploy** - Automated setup script

## 📦 What You Get

**Working Providers:**
- VidZee, MP4Hydra, UHDMovies
- 4KHDHub, Vixsrc, Castle
- StreamFlix, DahmerMovies
- VidLink, Videasy
- And 24 more!

## 🚀 Deployment

### Requirements

- Ubuntu 20.04+ / Debian 11+
- 1GB RAM minimum (2GB recommended)
- Domain name (optional, for SSL)

### Automated Setup

```bash
# Download and run
wget https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/deploy.sh
sudo bash deploy.sh
```

**What it does:**
1. Installs Node.js, PM2, Nginx
2. Clones and configures addon
3. Starts service with PM2
4. Configures firewall

### Manual Setup

See [LINUX_DEPLOYMENT.md](LINUX_DEPLOYMENT.md) for step-by-step guide.

## 🌐 Domain & SSL

### Setup Domain

1. Point your domain A record to server IP
2. Wait for DNS propagation (5-30 min)
3. Install SSL:

```bash
sudo certbot --nginx -d your-domain.com
```

Done! Your addon is now at `https://your-domain.com`

## 📱 Install in Stremio

1. Open Stremio
2. Go to **Add-ons** → **Community Add-ons**
3. Enter manifest URL:
   ```
   https://your-domain.com/manifest.json
   ```
4. Click **Install**

## 🔧 Management

### PM2 Commands

```bash
pm2 status                      # Check status
pm2 logs nuvio-streams-addon    # View logs
pm2 restart nuvio-streams-addon # Restart
pm2 monit                       # Monitor resources
```

### Update Addon

```bash
cd /var/www/nuvio-streams-addon
git pull origin main
npm install --production
pm2 restart nuvio-streams-addon
```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env`:

```env
# Enable Redis (recommended)
USE_REDIS_CACHE=true
REDIS_URL=redis://localhost:6379

# Server port
PORT=7000

# Disable specific providers
ENABLE_NETMIRROR_PROVIDER=false
```

See `.env.example` for all options.

## 🐛 Troubleshooting

### App Won't Start

```bash
pm2 logs nuvio-streams-addon --err
sudo lsof -i :7000
```

### Nginx 502 Error

```bash
pm2 status
curl http://localhost:7000/health
sudo systemctl restart nginx
```

### SSL Issues

```bash
sudo certbot certificates
sudo certbot renew
```

See [LINUX_DEPLOYMENT.md](LINUX_DEPLOYMENT.md) for complete troubleshooting.

## 📖 Documentation

- [Linux Deployment Guide](LINUX_DEPLOYMENT.md) - Complete setup guide
- [Quick Start](QUICK_START.md) - Get started fast
- [Proxy Setup](PROXY_SETUP.md) - Configure proxies
- [Environment Variables](.env.example) - All configuration options

## 🏗️ Project Structure

```
├── server.js              # Express server
├── addon.js               # Stremio addon logic
├── providers/             # 34+ provider implementations
├── utils/                 # Helper functions
├── views/                 # Web interface
├── ecosystem.config.js    # PM2 configuration
├── nginx.conf             # Nginx config template
└── deploy.sh              # Automated deployment
```

## 🔄 Development

### Local Development

```bash
git clone https://github.com/masnuvio/nuvio-streams-addon.git
cd nuvio-streams-addon
npm install
npm start
```

Access at `http://localhost:7000`

### Adding Providers

1. Create provider file in `providers/`
2. Export `getStreams` function
3. Import in `addon.js`
4. Add enable flag

## 📊 Performance

- **Caching:** File & Redis support
- **Parallel Fetching:** All providers run simultaneously
- **Timeout Protection:** 30s per provider
- **Clustering:** PM2 multi-core support

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## 📄 License

MIT License - Free to use and modify

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

## 🎯 Production Checklist

- [ ] Server setup complete
- [ ] Domain DNS configured
- [ ] SSL certificate installed
- [ ] PM2 running: `pm2 status`
- [ ] Nginx configured
- [ ] Firewall enabled
- [ ] Redis caching (optional)

---

**Deploy now:** `sudo bash deploy.sh`

Made with ❤️ for Stremio
