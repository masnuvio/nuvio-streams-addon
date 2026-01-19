# Domain Setup Instructions for nuvio.duckdns.org

Your nginx configuration has been updated to use **nuvio.duckdns.org**

## Step 1: Configure DuckDNS

1. **Go to** https://www.duckdns.org
2. **Sign in** with GitHub, Google, Reddit, or Twitter
3. **Create subdomain**: Enter `nuvio` in the subdomain field
4. **Set your server IP**: Enter your server's public IP address
5. **Click "Add Domain"**
6. **Save your token**: You'll need this for automatic updates (optional)

## Step 2: Update DNS on DuckDNS

Make sure the DuckDNS record points to **this server's IP address**:
- Log into DuckDNS
- Find `nuvio.duckdns.org`
- Update the IP to your server's public IP
- Click "Update IP"

## Step 3: Obtain SSL Certificate (for HTTPS)

Once your domain is pointing to the server, obtain a Let's Encrypt SSL certificate:

### On your Linux server, run:

```bash
# Make sure certbot is installed
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx -y

# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain certificate for nuvio.duckdns.org
sudo certbot certonly --standalone -d nuvio.duckdns.org

# Start nginx again
sudo systemctl start nginx
```

**Alternative method if using Docker:**

```bash
# Navigate to your project directory
cd /path/to/nuvio-stream

# Run certbot in Docker
docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d nuvio.duckdns.org \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

## Step 4: Deploy Updated Configuration

### If using Docker:

```bash
# Copy the updated nginx.conf to your server
# Then restart the containers
docker-compose down
docker-compose up -d
```

### If using direct nginx:

```bash
# Copy the nginx.conf to your server's nginx directory
sudo cp nginx/nginx.conf /etc/nginx/sites-available/nuvio
sudo ln -sf /etc/nginx/sites-available/nuvio /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 5: Test Your Setup

1. **HTTP Test**: http://nuvio.duckdns.org
2. **HTTPS Test**: https://nuvio.duckdns.org
3. **Stremio Manifest**: https://nuvio.duckdns.org/manifest.json

## Troubleshooting

### Domain not resolving?
- Check DuckDNS dashboard - is the IP correct?
- Wait 5-10 minutes for DNS propagation
- Test with: `ping nuvio.duckdns.org`

### SSL certificate errors?
- Make sure port 80 and 443 are open in your firewall
- Verify domain points to correct IP: `nslookup nuvio.duckdns.org`
- Check certificate path matches in nginx.conf

### Still using HTTP-only?
If you don't need HTTPS yet, you can use the HTTP-only config:
```bash
# Copy the HTTP-only config instead
sudo cp nginx/nginx-http-only.conf /etc/nginx/sites-available/nuvio
```

## Auto-updating DuckDNS IP (Optional)

If your server IP changes, set up automatic updates:

```bash
# Create update script
mkdir -p ~/duckdns
cd ~/duckdns
echo "echo url=\"https://www.duckdns.org/update?domains=nuvio&token=YOUR_TOKEN&ip=\" | curl -k -o ~/duckdns/duck.log -K -" > duck.sh
chmod 700 duck.sh

# Add to crontab (updates every 5 minutes)
crontab -e
# Add this line:
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

Replace `YOUR_TOKEN` with your actual DuckDNS token from the dashboard.
