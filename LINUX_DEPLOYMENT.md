# Nuvio Streams Addon - Linux VPS Deployment Guide

Complete guide for deploying the Nuvio Streams Stremio addon on a Linux VPS with custom domain, SSL, and production-ready configuration.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deployment](#quick-deployment)
- [Manual Deployment](#manual-deployment)
- [Domain & SSL Setup](#domain--ssl-setup)
- [Process Management](#process-management)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)

## Prerequisites

### Server Requirements

- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM:** Minimum 1GB (2GB+ recommended)
- **CPU:** 1 core minimum (2+ cores recommended)
- **Storage:** 10GB minimum
- **Network:** Public IP address

### Software Requirements

- Node.js 18.x or higher
- Nginx (reverse proxy)
- PM2 (process manager)
- Git
- Certbot (for SSL)

### Domain (Optional but Recommended)

- A domain name pointed to your server's IP
- DNS A record configured

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
# Download and run deployment script
wget https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/deploy.sh
sudo bash deploy.sh
```

The script will:
- ✅ Install Node.js, PM2, and Nginx
- ✅ Clone the repository
- ✅ Install dependencies
- ✅ Configure Nginx
- ✅ Start the application
- ✅ Setup firewall

### Option 2: One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/masnuvio/nuvio-streams-addon/main/deploy.sh | sudo bash
```

## 📖 Manual Deployment

### Step 1: Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### Step 2: Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 3: Install Nginx

```bash
# Install Nginx
sudo apt-get update
sudo apt-get install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 4: Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www/nuvio-streams-addon
cd /var/www/nuvio-streams-addon

# Clone repository
sudo git clone https://github.com/masnuvio/nuvio-streams-addon.git .

# Set permissions
sudo chown -R $USER:$USER /var/www/nuvio-streams-addon
```

### Step 5: Install Dependencies

```bash
cd /var/www/nuvio-streams-addon
npm install --production
```

### Step 6: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Optional Environment Variables:**
```env
# Redis caching (recommended for production)
USE_REDIS_CACHE=false
# REDIS_URL=redis://localhost:6379

# Disable specific providers
# ENABLE_NETMIRROR_PROVIDER=false

# Server port (default: 7000)
PORT=7000
```

### Step 7: Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command that PM2 outputs
```

### Step 8: Configure Nginx

```bash
# Copy Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/nuvio-streams-addon

# Edit configuration with your domain
sudo nano /etc/nginx/sites-available/nuvio-streams-addon
# Replace 'your-domain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/nuvio-streams-addon /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 9: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## 🌐 Domain & SSL Setup

### Configure DNS

Point your domain to your server's IP address:

```
Type: A
Name: @ (or your subdomain)
Value: YOUR_SERVER_IP
TTL: 3600
```

Wait for DNS propagation (5-30 minutes).

### Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain and install certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot will automatically:
- ✅ Obtain SSL certificate
- ✅ Configure Nginx for HTTPS
- ✅ Setup auto-renewal

### Verify HTTPS

```bash
# Test your domain
curl https://your-domain.com/manifest.json
```

## 🧹 Maintenance & Cleanup

To keep your server clean and running smoothly, you can use the included cleanup script.

```bash
# Run cleanup script
sudo bash cleanup.sh
```

### Docker Cleanup

If you are using Docker, use the `docker-cleanup.sh` script instead:

```bash
# Run docker cleanup script
sudo bash docker-cleanup.sh
```

This will:
- ✅ Clear host log files
- ✅ Clean internal container cache
- ✅ Remove internal temporary files
- ✅ Optionally prune unused Docker resources

You can also set up a cron job:

```bash
# Run docker cleanup every Sunday at 3 AM
0 3 * * 0 bash /opt/nuvio-streams/docker-cleanup.sh >> /var/log/nuvio-cleanup.log 2>&1
```

This script will:
- ✅ Flush PM2 logs
- ✅ Clear application log files
- ✅ Clear stream cache
- ✅ Remove temporary files
- ✅ Optionally clear Nginx logs

You can also set up a cron job to run this periodically (e.g., weekly):

```bash
# Edit crontab
sudo crontab -e

# Add line to run cleanup every Sunday at 3 AM
0 3 * * 0 bash /var/www/nuvio-streams-addon/cleanup.sh >> /var/log/nuvio-cleanup.log 2>&1
```

## 🔧 Process Management

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs nuvio-streams-addon

# Restart application
pm2 restart nuvio-streams-addon

# Stop application
pm2 stop nuvio-streams-addon

# Start application
pm2 start nuvio-streams-addon

# Monitor resources
pm2 monit

# View detailed info
pm2 show nuvio-streams-addon
```

### Systemd Service (Alternative to PM2)

```bash
# Copy service file
sudo cp nuvio-streams.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Start service
sudo systemctl start nuvio-streams

# Enable on boot
sudo systemctl enable nuvio-streams

# Check status
sudo systemctl status nuvio-streams

# View logs
sudo journalctl -u nuvio-streams -f
```

## 📊 Monitoring & Logs

### Application Logs

```bash
# PM2 logs
pm2 logs nuvio-streams-addon

# PM2 logs (last 100 lines)
pm2 logs nuvio-streams-addon --lines 100

# PM2 error logs only
pm2 logs nuvio-streams-addon --err

# Application log files
tail -f /var/www/nuvio-streams-addon/logs/pm2-out.log
tail -f /var/www/nuvio-streams-addon/logs/pm2-error.log
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/nuvio-streams-access.log

# Error logs
sudo tail -f /var/log/nginx/nuvio-streams-error.log
```

### System Monitoring

```bash
# CPU and Memory usage
pm2 monit

# Detailed system stats
htop

# Disk usage
df -h

# Network connections
sudo netstat -tulpn | grep :7000
```

### Setup Monitoring Alerts

```bash
# Install PM2 monitoring (optional)
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🐛 Troubleshooting

### Application Won't Start

**Check logs:**
```bash
pm2 logs nuvio-streams-addon --err
```

**Common issues:**
- Port 7000 already in use: `sudo lsof -i :7000`
- Missing dependencies: `npm install`
- Permission issues: `sudo chown -R $USER:$USER /var/www/nuvio-streams-addon`

### Nginx 502 Bad Gateway

**Check if application is running:**
```bash
pm2 status
curl http://localhost:7000/health
```

**Check Nginx error logs:**
```bash
sudo tail -f /var/log/nginx/nuvio-streams-error.log
```

**Restart services:**
```bash
pm2 restart nuvio-streams-addon
sudo systemctl restart nginx
```

### SSL Certificate Issues

**Check certificate status:**
```bash
sudo certbot certificates
```

**Renew certificate manually:**
```bash
sudo certbot renew
```

**Test SSL configuration:**
```bash
sudo nginx -t
```

### High Memory Usage

**Check memory:**
```bash
pm2 monit
free -h
```

**Restart application:**
```bash
pm2 restart nuvio-streams-addon
```

**Reduce PM2 instances:**
Edit `ecosystem.config.js`:
```javascript
instances: 2  // Instead of 'max'
```

### Slow Response Times

**Enable Redis caching:**
```bash
# Install Redis
sudo apt-get install -y redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Update .env
echo "USE_REDIS_CACHE=true" >> .env
echo "REDIS_URL=redis://localhost:6379" >> .env

# Restart application
pm2 restart nuvio-streams-addon
```

### Port Already in Use

**Find process using port 7000:**
```bash
sudo lsof -i :7000
```

**Kill process:**
```bash
sudo kill -9 <PID>
```

**Or change port in .env:**
```bash
echo "PORT=8000" >> .env
pm2 restart nuvio-streams-addon
```

## 🔄 Updating

### Update Application

```bash
# Navigate to application directory
cd /var/www/nuvio-streams-addon

# Pull latest changes
git pull origin main

# Install new dependencies
npm install --production

# Restart application
pm2 restart nuvio-streams-addon
```

### Update Node.js

```bash
# Update to latest LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt-get install -y nodejs

# Restart application
pm2 restart nuvio-streams-addon
```

### Update PM2

```bash
# Update PM2
sudo npm install -g pm2@latest

# Update PM2 runtime
pm2 update
```

## 🎯 Production Checklist

- [ ] Server updated: `sudo apt-get update && sudo apt-get upgrade`
- [ ] Node.js 18+ installed
- [ ] PM2 installed and configured
- [ ] Nginx installed and configured
- [ ] Application running: `pm2 status`
- [ ] Domain DNS configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] PM2 startup enabled
- [ ] Logs rotating properly
- [ ] Redis caching enabled (optional)
- [ ] Monitoring setup (optional)

## 📞 Support

**Check logs first:**
```bash
pm2 logs nuvio-streams-addon
sudo tail -f /var/log/nginx/nuvio-streams-error.log
```

**Test endpoints:**
```bash
# Health check
curl http://localhost:7000/health

# Manifest
curl http://localhost:7000/manifest.json

# Streams
curl http://localhost:7000/stream/movie/tmdb:550.json
```

## 🔗 Useful Links

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Node.js Documentation](https://nodejs.org/docs/)

---

**Your addon is now running in production!** 🎉

Access your manifest at: `https://your-domain.com/manifest.json`
