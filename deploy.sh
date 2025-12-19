#!/bin/bash

# Nuvio Streams Addon - Automated Deployment Script
# This script automates the deployment process on a Linux VPS

set -e  # Exit on error

echo "=========================================="
echo "Nuvio Streams Addon - Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="nuvio-streams-addon"
APP_DIR="/var/www/$APP_NAME"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/$APP_NAME"
SYSTEMD_SERVICE="/etc/systemd/system/$APP_NAME.service"
LOG_DIR="$APP_DIR/logs"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   echo "Please run: sudo bash deploy.sh"
   exit 1
fi

echo -e "${GREEN}✓${NC} Running as root"

# Update system
echo ""
echo "Updating system packages..."
apt-get update -qq

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

PM2_VERSION=$(pm2 --version)
echo -e "${GREEN}✓${NC} PM2 installed: $PM2_VERSION"

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get install -y nginx
fi

echo -e "${GREEN}✓${NC} Nginx installed"

# Create application directory
echo ""
echo "Setting up application directory..."
mkdir -p $APP_DIR
mkdir -p $LOG_DIR

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    echo "Updating existing repository..."
    cd $APP_DIR
    git pull origin main
else
    echo "Cloning repository..."
    read -p "Enter your GitHub repository URL: " REPO_URL
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

echo -e "${GREEN}✓${NC} Repository ready"

# Install dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install --production

echo -e "${GREEN}✓${NC} Dependencies installed"

# Setup environment file
if [ ! -f "$APP_DIR/.env" ]; then
    echo ""
    echo "Creating .env file..."
    if [ -f "$APP_DIR/.env.example" ]; then
        cp $APP_DIR/.env.example $APP_DIR/.env
        echo -e "${YELLOW}!${NC} Please edit $APP_DIR/.env with your configuration"
    else
        touch $APP_DIR/.env
    fi
fi

# Set permissions
echo ""
echo "Setting permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

echo -e "${GREEN}✓${NC} Permissions set"

# Configure Nginx
echo ""
read -p "Do you want to configure Nginx? (y/n): " CONFIGURE_NGINX

if [ "$CONFIGURE_NGINX" = "y" ]; then
    read -p "Enter your domain name (e.g., streams.example.com): " DOMAIN_NAME
    
    # Copy nginx config
    cp $APP_DIR/nginx.conf $NGINX_CONF
    
    # Replace domain placeholder
    sed -i "s/your-domain.com/$DOMAIN_NAME/g" $NGINX_CONF
    
    # Enable site
    ln -sf $NGINX_CONF $NGINX_ENABLED
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    echo -e "${GREEN}✓${NC} Nginx configured for $DOMAIN_NAME"
    echo -e "${YELLOW}!${NC} Remember to point your domain DNS to this server's IP"
    echo -e "${YELLOW}!${NC} Run 'sudo certbot --nginx -d $DOMAIN_NAME' to setup SSL"
fi

# Start application with PM2
echo ""
echo "Starting application with PM2..."
cd $APP_DIR
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u www-data --hp /var/www

echo -e "${GREEN}✓${NC} Application started with PM2"

# Setup firewall
echo ""
read -p "Do you want to configure UFW firewall? (y/n): " CONFIGURE_UFW

if [ "$CONFIGURE_UFW" = "y" ]; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}✓${NC} Firewall configured"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Application Status:"
pm2 status
echo ""
echo "Next Steps:"
echo "1. Edit .env file: nano $APP_DIR/.env"
echo "2. Configure your domain DNS to point to this server"
echo "3. Install SSL certificate: sudo certbot --nginx -d your-domain.com"
echo "4. Check logs: pm2 logs $APP_NAME"
echo ""
echo "Useful Commands:"
echo "  pm2 status              - Check application status"
echo "  pm2 logs $APP_NAME      - View application logs"
echo "  pm2 restart $APP_NAME   - Restart application"
echo "  pm2 stop $APP_NAME      - Stop application"
echo "  nginx -t                - Test Nginx configuration"
echo "  systemctl status nginx  - Check Nginx status"
echo ""
echo "Your addon should be accessible at:"
echo "  http://$(hostname -I | awk '{print $1}'):7000"
if [ ! -z "$DOMAIN_NAME" ]; then
    echo "  http://$DOMAIN_NAME (after DNS propagation)"
fi
echo ""
