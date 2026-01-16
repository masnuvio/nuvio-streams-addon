#!/bin/bash

# Nuvio Streams - Docker Cleanup Script
# Cleans up logs, cache, and docker resources

set -e

echo "=========================================="
echo "Nuvio Streams - Docker Cleanup Utility"
echo "=========================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   echo "Please run: sudo bash docker-cleanup.sh"
   exit 1
fi

APP_CONTAINER="nuvio-streams-app"

# 1. Clean Host Logs (mounted volume)
if [ -d "logs" ]; then
    echo "Clearing host log files..."
    rm -f logs/*.log
    echo "✓ Host logs cleared"
fi

# 2. Clean Container Cache & Temp Files
if docker ps | grep -q $APP_CONTAINER; then
    echo "Cleaning inside container..."
    
    # Clean stream cache
    docker exec $APP_CONTAINER rm -rf /app/.streams_cache/*
    echo "✓ Container stream cache cleared"
    
    # Clean temp files
    docker exec $APP_CONTAINER find /app -name "*.tmp" -type f -delete
    docker exec $APP_CONTAINER find /app -name "temp_*" -type d -exec rm -rf {} +
    echo "✓ Container temp files removed"
else
    echo "Container $APP_CONTAINER is not running, skipping internal cleanup"
fi

# 3. Docker System Prune (Optional)
echo ""
read -p "Do you want to run 'docker system prune' to remove unused images/networks? (y/n): " PRUNE_DOCKER
if [ "$PRUNE_DOCKER" = "y" ]; then
    echo "Running docker system prune..."
    docker system prune -f
    echo "✓ Docker system pruned"
fi

echo ""
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
