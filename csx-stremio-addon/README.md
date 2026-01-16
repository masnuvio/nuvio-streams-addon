# CSX Stremio Addon

This is a Stremio addon ported from the CSX CineStream provider.

## Features
- **Vadapav Provider**: Fetches streams from Vadapav.mov.
- **Modular Architecture**: Easy to add more providers.

## Deployment

### Docker (Recommended)
1. Build and run using the helper script:
   ```bash
   ./deploy.sh
   ```
   
   OR manually:
   ```bash
   docker build -t csx-stremio-addon .
   docker run -d -p 7000:7000 --name csx-addon --restart always csx-stremio-addon
   ```

2. Access the addon at `http://YOUR_SERVER_IP:7000/manifest.json`.

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
