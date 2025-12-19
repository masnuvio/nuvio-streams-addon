#!/bin/bash

# Nuvio Streams - Docker Deployment Script
# One-command deployment with Docker Compose

set -e

echo "=========================================="
echo "Nuvio Streams - Docker Deployment"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   echo "Please run: sudo bash docker-deploy.sh"
   exit 1
fi

echo -e "${GREEN}✓${NC} Running as root"

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo ""
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}✓${NC} Docker installed"
else
    echo -e "${GREEN}✓${NC} Docker already installed"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo ""
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓${NC} Docker Compose installed"
else
    echo -e "${GREEN}✓${NC} Docker Compose already installed"
fi

# Clone or update repository
APP_DIR="/opt/nuvio-streams"

if [ -d "$APP_DIR/.git" ]; then
    echo ""
    echo "Updating existing repository..."
    cd $APP_DIR
    git pull origin main
else
    echo ""
    echo "Cloning repository..."
    rm -rf $APP_DIR
    git clone https://github.com/masnuvio/nuvio-streams-addon.git $APP_DIR
    cd $APP_DIR
fi

echo -e "${GREEN}✓${NC} Repository ready"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}!${NC} Please edit .env file if needed: nano $APP_DIR/.env"
    else
        touch .env
    fi
fi

# Ask for domain
echo ""
read -p "Enter your domain name (or press Enter to skip SSL): " DOMAIN_NAME

# Create certbot directories
mkdir -p certbot/conf certbot/www

# Start services
echo ""
echo "Starting Docker containers..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

echo -e "${GREEN}✓${NC} Containers started"

# Wait for containers to be healthy
echo ""
echo "Waiting for application to be ready..."
sleep 10

# Check if app is running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Application is running"
else
    echo -e "${RED}✗${NC} Application failed to start"
    echo "Check logs: docker-compose logs"
    exit 1
fi

# Setup SSL if domain provided
if [ ! -z "$DOMAIN_NAME" ]; then
    echo ""
    echo "Setting up SSL certificate..."
    
    # Get initial certificate
    docker-compose run --rm certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@$DOMAIN_NAME \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN_NAME
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} SSL certificate obtained"
        
        # Update nginx config with domain
        sed -i "s/YOUR_DOMAIN/$DOMAIN_NAME/g" nginx/nginx.conf
        
        # Uncomment HTTPS server block
        sed -i 's/# server {/server {/g' nginx/nginx.conf
        sed -i 's/#     /    /g' nginx/nginx.conf
        sed -i 's/# }/}/g' nginx/nginx.conf
        
        # Comment out HTTP proxy, uncomment redirect
        sed -i 's/    location \/ {/#    location \/ {/g' nginx/nginx.conf
        sed -i 's/    #     return 301/        return 301/g' nginx/nginx.conf
        
        # Reload nginx
        docker-compose restart nginx
        
        echo -e "${GREEN}✓${NC} SSL configured and enabled"
    else
        echo -e "${YELLOW}!${NC} SSL certificate setup failed"
        echo "You can set it up later with:"
        echo "docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN_NAME"
    fi
fi

# Configure firewall
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
echo "Container Status:"
docker-compose ps
echo ""
echo "Your addon is accessible at:"
echo "  http://$(hostname -I | awk '{print $1}')"
if [ ! -z "$DOMAIN_NAME" ]; then
    echo "  https://$DOMAIN_NAME"
    echo ""
    echo "Manifest URL:"
    echo "  https://$DOMAIN_NAME/manifest.json"
fi
echo ""
echo "Useful Commands:"
echo "  docker-compose ps              - Check container status"
echo "  docker-compose logs -f         - View logs"
echo "  docker-compose logs -f app     - View app logs only"
echo "  docker-compose restart         - Restart all containers"
echo "  docker-compose down            - Stop all containers"
echo "  docker-compose up -d           - Start all containers"
echo "  docker-compose pull && docker-compose up -d --build  - Update"
echo ""
