#!/bin/bash
echo "Building Docker image..."
docker build -t csx-stremio-addon .

echo "Running Docker container..."
docker run -d -p 7000:7000 --name csx-addon --restart always csx-stremio-addon

echo "Addon deployed on port 7000"
