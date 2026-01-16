const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const manifest = require('./manifest');
const vadapav = require('./providers/vadapav');

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`Request for stream: ${type} ${id}`);

    // Parse ID (tt1234567 or tt1234567:1:1)
    let imdbId, season, episode;
    if (id.includes(':')) {
        const parts = id.split(':');
        imdbId = parts[0];
        season = parseInt(parts[1]);
        episode = parseInt(parts[2]);
    } else {
        imdbId = id;
    }

    // Fetch streams from providers
    // For now, only Vadapav is implemented as POC
    const streams = await vadapav.getStreams(type, imdbId, season, episode);

    return { streams: streams || [] };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
console.log(`Addon hosting on http://localhost:${port}`);
