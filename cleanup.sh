#!/bin/bash

# Nuvio Streams Addon - Cleanup Script
# This script cleans up logs, cache, and temporary files

set -e

APP_NAME="nuvio-streams-addon"
APP_DIR="/var/www/$APP_NAME"
LOG_DIR="$APP_DIR/logs"
CACHE_DIR="$APP_DIR/.streams_cache"

echo "=========================================="
echo "Nuvio Streams Addon - Cleanup Utility"
echo "=========================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   echo "Please run: sudo bash cleanup.sh"
   exit 1
fi

# 1. Flush PM2 logs
if command -v pm2 &> /dev/null; then
    echo "Flushing PM2 logs..."
    pm2 flush $APP_NAME
    echo "✓ PM2 logs flushed"
else
    echo "PM2 not found, skipping..."
fi

# 2. Clear application logs
if [ -d "$LOG_DIR" ]; then
    echo "Clearing application log files..."
    rm -f $LOG_DIR/*.log
    echo "✓ Application logs cleared"
fi

# 3. Clear stream cache
if [ -d "$CACHE_DIR" ]; then
    echo "Clearing stream cache..."
    rm -rf $CACHE_DIR/*
    echo "✓ Stream cache cleared"
fi

# 4. Remove temporary files in app directory
if [ -d "$APP_DIR" ]; then
    echo "Removing temporary files..."
    find $APP_DIR -name "*.tmp" -type f -delete
    find $APP_DIR -name "temp_*" -type d -exec rm -rf {} +
    find $APP_DIR -name "*.log" -maxdepth 1 -type f -delete
    echo "✓ Temporary files removed"
fi

# 5. Clear Nginx logs (optional)
read -p "Do you want to clear Nginx logs? (y/n): " CLEAR_NGINX
if [ "$CLEAR_NGINX" = "y" ]; then
    echo "Clearing Nginx logs..."
    truncate -s 0 /var/log/nginx/nuvio-streams-access.log
    truncate -s 0 /var/log/nginx/nuvio-streams-error.log
    echo "✓ Nginx logs cleared"
fi

echo ""
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
