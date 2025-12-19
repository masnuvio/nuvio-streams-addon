# Nuvio Streams - Stremio Addon

High-performance Stremio addon providing streaming links from 34+ providers. Deploy with Docker in one command.

## ⚡ Quick Start (Docker - Recommended)

### One-Command Deployment

```bash
wget https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/docker-deploy.sh
sudo bash docker-deploy.sh
```

That's it! Docker, containers, Nginx, and SSL all configured automatically.

## 🎯 Features

- **34+ Providers** - Multiple streaming sources
- **Smart Caching** - Redis & file-based caching
- **Quality Filtering** - Filter by resolution
- **Docker Ready** - One-command deployment
- **SSL Included** - Automatic HTTPS setup
- **Auto-restart** - Containers restart on failure

## 📦 What You Get

**Working Providers:**
- VidZee, MP4Hydra, UHDMovies
- 4KHDHub, Vixsrc, Castle
- StreamFlix, DahmerMovies
- VidLink, Videasy
- And 24 more!

## 🐳 Docker Deployment (Recommended)

### Requirements

- Ubuntu 20.04+ / Debian 11+
- 1GB RAM minimum (2GB recommended)
- Domain name (optional, for SSL)

### Automated Setup

```bash
# Download and run
wget https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/docker-deploy.sh
sudo bash docker-deploy.sh
```

**What it does:**
1. Installs Docker & Docker Compose
2. Clones repository
3. Builds and starts containers
4. Configures Nginx reverse proxy
5. Sets up SSL (if domain provided)
6. Configures firewall

### Manual Docker Setup

```bash
# Clone repository
git clone https://github.com/masnuvio/nuvio-streams-addon.git
cd nuvio-streams-addon

# Create .env file
cp .env.example .env

# Start containers
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🌐 Domain & SSL

The Docker deployment automatically handles SSL:

1. Enter your domain when prompted
2. Script obtains Let's Encrypt certificate
3. Nginx configured for HTTPS
4. Auto-renewal enabled

**Your addon will be at:** `https://your-domain.com/manifest.json`

## 📱 Install in Stremio

1. Open Stremio
2. Go to **Add-ons** → **Community Add-ons**
3. Enter manifest URL:
   ```
   https://your-domain.com/manifest.json
   ```
4. Click **Install**

## 🔧 Management

### Docker Commands

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f
docker-compose logs -f app    # App logs only

# Restart
docker-compose restart

# Stop
docker-compose down

# Start
docker-compose up -d

# Update
cd /opt/nuvio-streams
git pull origin main
docker-compose up -d --build
```

## ⚙️ Configuration

### Environment Variables

Edit `.env` file:

```env
# Enable Redis (recommended)
USE_REDIS_CACHE=true
REDIS_URL=redis://localhost:6379

# Server port (internal)
PORT=7000

# Disable specific providers
ENABLE_NETMIRROR_PROVIDER=false
```

See `.env.example` for all options.

## 🐛 Troubleshooting

### Containers Won't Start

```bash
docker-compose logs
docker-compose ps
```

### App Not Accessible

```bash
# Check if containers are running
docker-compose ps

# Check app health
docker-compose exec app wget -O- http://localhost:7000/health

# Restart containers
docker-compose restart
```

### SSL Issues

```bash
# Re-obtain certificate
docker-compose run --rm certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  -d your-domain.com

# Restart nginx
docker-compose restart nginx
```

## 📖 Documentation

- [Docker Deployment](DOCKER_DEPLOYMENT.md) - Complete Docker guide
- [Linux Deployment](LINUX_DEPLOYMENT.md) - PM2/systemd deployment
- [Quick Start](QUICK_START.md) - Get started fast
- [Environment Variables](.env.example) - All configuration options

## 🏗️ Project Structure

```
├── Dockerfile             # Docker image definition
├── docker-compose.yml     # Multi-container setup
├── docker-deploy.sh       # Automated deployment
├── server.js              # Express server
├── addon.js               # Stremio addon logic
├── providers/             # 34+ provider implementations
├── nginx/                 # Nginx configuration
└── views/                 # Web interface
```

## 🔄 Development

### Local Development (Docker)

```bash
git clone https://github.com/masnuvio/nuvio-streams-addon.git
cd nuvio-streams-addon
docker-compose up
```

Access at `http://localhost`

### Local Development (Node.js)

```bash
npm install
npm start
```

Access at `http://localhost:7000`

## 📊 Performance

- **Docker Isolation** - Clean environment
- **Auto-restart** - Containers restart on failure
- **Health Checks** - Automatic monitoring
- **Nginx Caching** - Static file optimization
- **SSL/TLS** - Automatic HTTPS

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
docker-compose logs -f
```

**Test endpoints:**
```bash
curl http://localhost/health
curl http://localhost/manifest.json
```

## 🎯 Production Checklist

- [ ] Docker installed
- [ ] Domain DNS configured
- [ ] Containers running: `docker-compose ps`
- [ ] SSL certificate obtained
- [ ] Firewall configured
- [ ] Tested in Stremio

---

**Deploy now:** `sudo bash docker-deploy.sh`

Made with ❤️ for Stremio
