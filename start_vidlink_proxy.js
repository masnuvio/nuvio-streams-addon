const { getVidLinkStreams } = require('./providers/vidlink.js');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const url = require('url');

const PORT = 7777;

async function startProxy() {
    console.log("Fetching VidLink streams...");
    const streams = await getVidLinkStreams('20453', 'movie');
    if (streams.length === 0) {
        console.log("No streams found.");
        return;
    }
    const streamUrl = streams[0].url;
    console.log("Original Stream URL:", streamUrl);

    const server = http.createServer(async (req, res) => {
        console.log(`Request: ${req.url}`);

        if (req.url === '/playlist.m3u8') {
            // Fetch original M3U8
            try {
                const m3u8Content = execSync(`curl -s -L "${streamUrl}"`, { encoding: 'utf8' });

                // Rewrite segments to point to proxy
                const effectiveUrl = execSync(`curl -s -L -I -w "%{url_effective}" "${streamUrl}"`, { encoding: 'utf8' }).split('\n').pop().trim();
                const baseUrl = new URL(effectiveUrl).origin;

                const modifiedM3U8 = m3u8Content.split('\n').map(line => {
                    if (line.trim().startsWith('/proxy/')) {
                        const originalSegmentUrl = baseUrl + line.trim();
                        const encodedUrl = encodeURIComponent(originalSegmentUrl);
                        return `http://localhost:${PORT}/segment?url=${encodedUrl}`;
                    }
                    return line;
                }).join('\n');

                res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
                res.end(modifiedM3U8);
            } catch (e) {
                console.error("Error fetching M3U8:", e.message);
                res.writeHead(500);
                res.end("Error fetching M3U8");
            }

        } else if (req.url.startsWith('/segment')) {
            const query = url.parse(req.url, true).query;
            const targetUrl = query.url;

            if (!targetUrl) {
                res.writeHead(400);
                res.end("Missing url param");
                return;
            }

            // Parse target URL to determine protocol
            const targetUrlObj = new URL(targetUrl);
            const client = targetUrlObj.protocol === 'https:' ? https : http;

            const proxyReq = client.get(targetUrl, (proxyRes) => {
                // Force Content-Type
                const headers = { ...proxyRes.headers };
                headers['content-type'] = 'video/mp2t';
                headers['access-control-allow-origin'] = '*';

                res.writeHead(proxyRes.statusCode, headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error("Proxy error:", e);
                res.writeHead(500);
                res.end("Proxy error");
            });

        } else {
            res.writeHead(404);
            res.end("Not found");
        }
    });

    server.listen(PORT, () => {
        console.log(`Proxy server running at http://localhost:${PORT}`);
    });
}

startProxy();
