const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
require('dotenv').config();
const fs = require('fs');
const simpleCache = require('./utils/simpleCache');

// Load cookies.txt if available
try {
    if (fs.existsSync('./cookies.txt')) {
        const cookie = fs.readFileSync('./cookies.txt', 'utf8').trim();
        if (cookie) {
            console.log('[Addon] Loaded ShowBox cookie from cookies.txt');
            process.env.SHOWBOX_COOKIE = cookie;
        }
    }
} catch (e) {
    console.warn('[Addon] Failed to load cookies.txt:', e.message);
}

// Ensure TMDB API Key is available for providers that rely on it (e.g., moviesdrive)
if (!process.env.TMDB_API_KEY) {
    console.log('[Addon] TMDB_API_KEY not found in env, using default fallback.');
    process.env.TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
}
const { convertImdbToTmdb } = require('./providers/Showbox');

// Import Providers
const providers = {
    '4khdhub': require('./providers/4khdhub').get4KHDHubStreams,
    'dramadrip': require('./providers/dramadrip').getDramaDripStreams,
    'moviesdrive': require('./providers/moviesdrive').getMoviesDriveStreams,
    'moviesmod': require('./providers/moviesmod').getMoviesModStreams,
    'mp4hydra': require('./providers/MP4Hydra').getMP4HydraStreams,
    'showbox': require('./providers/Showbox').getStreamsFromTmdbId,
    'soapertv': require('./providers/soapertv').getSoaperTvStreams,
    'topmovies': require('./providers/topmovies').getTopMoviesStreams,
    'uhdmovies': require('./providers/uhdmovies').getUHDMoviesStreams,
    'vidzee': require('./providers/VidZee').getVidZeeStreams,
    'vixsrc': require('./providers/vixsrc').getVixsrcStreams,
    'moviebox': require('./providers/moviebox').getMovieBoxStreams,
    'vidsrcextractor': require('./providers/vidsrcextractor').getStreamContent,
    'hdrezkas': require('./providers/hdrezkas_adapter').getHdrezkaStreams,
    'netmirror': require('./providers/netmirror').getStreams,
    'castle': require('./providers/castle').getStreams
};

const manifest = {
    id: 'org.nuvio.allproviders',
    version: '1.0.0',
    name: 'Nuvio All Providers',
    description: 'Aggregates streams from all available providers',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[Addon] Request received: ${type} ${id}`);
    let tmdbId = id;
    let season = null;
    let episode = null;

    // Handle ID parsing
    if (id.startsWith('tt')) {
        const parts = id.split(':');
        const imdbId = parts[0];
        season = parts[1] ? parseInt(parts[1]) : null;
        episode = parts[2] ? parseInt(parts[2]) : null;

        try {
            const conversionResult = await convertImdbToTmdb(imdbId, type === 'series' ? 'tv' : 'movie');
            if (conversionResult && conversionResult.tmdbId) {
                tmdbId = conversionResult.tmdbId;
                console.log(`[Addon] Converted IMDB ${imdbId} to TMDB ${tmdbId}`);
            } else {
                console.error(`[Addon] Failed to convert IMDB ID: ${imdbId}`);
                // Proceeding without conversion might fail for providers needing TMDB, 
                // but some might handle IMDB (though our analysis suggests most use TMDB).
                // We'll return empty for now to avoid errors.
                return { streams: [] };
            }
        } catch (error) {
            console.error(`[Addon] Failed to convert IMDB ID: ${error.message}`);
            return { streams: [] };
        }
    } else if (id.startsWith('tmdb:')) {
        const parts = id.split(':');
        tmdbId = parts[1];
        season = parts[2] ? parseInt(parts[2]) : null;
        episode = parts[3] ? parseInt(parts[3]) : null;
    }

    if (!tmdbId) {
        console.error('[Addon] No valid TMDB ID found');
        return { streams: [] };
    }

    const mediaType = type === 'series' ? 'tv' : 'movie';
    const providerPromises = [];

    // Check cache first
    const cacheKey = `stream:${type}:${id}`;
    const cachedStreams = simpleCache.get(cacheKey);
    if (cachedStreams && process.env.DISABLE_CACHE !== 'true') {
        console.log(`[Addon] Returning cached streams for ${id}`);
        return { streams: cachedStreams };
    }

    // Helper to wrap provider calls for safety and timeout
    const callProvider = async (name, providerFn) => {
        // Check if provider is enabled (default to true)
        const envVar = `ENABLE_${name.toUpperCase()}_PROVIDER`;
        if (process.env[envVar] === 'false') {
            console.log(`[Addon] Skipping provider ${name} (disabled via env)`);
            return [];
        }

        try {
            console.log(`[Addon] Calling provider: ${name}`);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            const providerPromise = providerFn(tmdbId, mediaType, season, episode);

            const streams = await Promise.race([providerPromise, timeoutPromise]);
            return streams.map(s => ({ ...s, name: `[${name}] ${s.name || ''}` }));
        } catch (error) {
            console.error(`[Addon] Provider ${name} failed: ${error.message}`);
            return [];
        }
    };

    // Queue all providers
    for (const [name, fn] of Object.entries(providers)) {
        providerPromises.push(callProvider(name, fn));
    }

    // Wait for all providers
    const results = await Promise.allSettled(providerPromises);

    // Aggregate streams
    let allStreams = [];
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            allStreams = allStreams.concat(result.value);
        }
    });

    // Deduplicate streams (basic deduplication by URL)
    const uniqueStreams = [];
    const seenUrls = new Set();

    for (const stream of allStreams) {
        if (!stream.url) continue;
        if (seenUrls.has(stream.url)) continue;

        seenUrls.add(stream.url);
        uniqueStreams.push(stream);
    }

    // Cache results
    if (uniqueStreams.length > 0) {
        simpleCache.set(cacheKey, uniqueStreams);
    }

    console.log(`[Addon] Returning ${uniqueStreams.length} streams`);
    return { streams: uniqueStreams };
});

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Explicit CORS headers
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

const addonInterface = builder.getInterface();

app.get('/manifest.json', (req, res) => {
    res.json(addonInterface.manifest);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await addonInterface.get('stream', type, id);
        res.json(result);
    } catch (error) {
        console.error(`[Addon] Error handling request: ${error.message}`);
        res.status(500).json({ streams: [] });
    }
});

const port = process.env.PORT || 7000;
app.listen(port, () => {
    console.log(`[Addon] Server running on http://localhost:${port}`);
});
