// ================================================================================
// Nuvio Streams Addon for Stremio
// ================================================================================
// 
// GOOGLE ANALYTICS SETUP:
// 1. Go to https://analytics.google.com/ and create a new GA4 property
// 2. Get your Measurement ID (format: G-XXXXXXXXXX)
// 3. Replace 'G-XXXXXXXXXX' in views/index.html with your actual Measurement ID
// 4. The addon will automatically track:
//    - Addon installations (install_addon_clicked)
//    - Manifest copies (copy_manifest_clicked)
//    - Provider configurations (apply_providers_clicked)
//    - Cookie configurations (set_cookie_clicked)
//    - Tutorial access (cookie_tutorial_opened)
//    - Stream requests (will be added to server-side logging)
//
// ================================================================================

const { addonBuilder } = require('stremio-addon-sdk');
require('dotenv').config(); // Ensure environment variables are loaded
const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');
const crypto = require('crypto'); // For hashing cookies
const Redis = require('ioredis');

// Add Redis client if enabled
const USE_REDIS_CACHE = process.env.USE_REDIS_CACHE === 'true';
let redis = null;
let redisKeepAliveInterval = null; // Variable to manage the keep-alive interval

if (USE_REDIS_CACHE) {
    try {
        console.log(`[Redis Cache] Initializing Redis in addon.js. REDIS_URL from env: ${process.env.REDIS_URL ? 'exists and has value' : 'MISSING or empty'}`);
        if (!process.env.REDIS_URL) {
            throw new Error("REDIS_URL environment variable is not set or is empty.");
        }

        // Check if this is a local Redis instance or remote
        const isLocal = process.env.REDIS_URL.includes('localhost') || process.env.REDIS_URL.includes('127.0.0.1');

        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 5,
            retryStrategy(times) {
                const delay = Math.min(times * 500, 5000);
                // Added verbose logging for each retry attempt
                console.warn(`[Redis Cache] Retry strategy activated. Attempt #${times}, will retry in ${delay}ms`);
                return delay;
            },
            reconnectOnError: function (err) {
                const targetError = 'READONLY';
                const shouldReconnect = err.message.includes(targetError);
                // Added detailed logging for reconnectOnError decisions
                console.warn(`[Redis Cache] reconnectOnError invoked due to error: "${err.message}". Decided to reconnect: ${shouldReconnect}`);
                return shouldReconnect;
            },
            // TLS is optional - only use if explicitly specified with rediss:// protocol
            tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
            enableOfflineQueue: true,
            enableReadyCheck: true,
            autoResubscribe: true,
            autoResendUnfulfilledCommands: true,
            lazyConnect: false
        });

        redis.on('error', (err) => {
            console.error(`[Redis Cache] Connection error: ${err.message}`);
            // --- BEGIN: Clear Keep-Alive on Error ---
            if (redisKeepAliveInterval) {
                clearInterval(redisKeepAliveInterval);
                redisKeepAliveInterval = null;
            }
            // --- END: Clear Keep-Alive on Error ---
        });

        redis.on('connect', () => {
            console.log('[Redis Cache] Successfully connected to Upstash Redis');

            // --- BEGIN: Redis Keep-Alive ---
            if (redisKeepAliveInterval) {
                clearInterval(redisKeepAliveInterval);
            }

            redisKeepAliveInterval = setInterval(() => {
                if (redis && redis.status === 'ready') {
                    redis.ping((err) => {
                        if (err) {
                            console.error('[Redis Cache Keep-Alive] Ping failed:', err.message);
                        }
                    });
                }
            }, 4 * 60 * 1000); // 4 minutes

            console.log('[Redis Cache] Upstash Redis client initialized');
        });
    } catch (err) {
        console.error(`[Redis Cache] Failed to initialize Redis: ${err.message}`);
        console.log('[Redis Cache] Will use file-based cache as fallback');
    }
}

// NEW: Read environment variable for TopMovies
const ENABLE_TOPMOVIES_PROVIDER = process.env.ENABLE_TOPMOVIES_PROVIDER !== 'false'; // Defaults to true
console.log(`[addon.js] TopMovies provider fetching enabled: ${ENABLE_TOPMOVIES_PROVIDER}`);

const USE_EXTERNAL_PROVIDERS = process.env.USE_EXTERNAL_PROVIDERS === 'true';
const EXTERNAL_TOPMOVIES_URL = USE_EXTERNAL_PROVIDERS ? process.env.EXTERNAL_TOPMOVIES_URL : null;

console.log(`[addon.js] External providers: ${USE_EXTERNAL_PROVIDERS ? 'enabled' : 'disabled'}`);
if (USE_EXTERNAL_PROVIDERS) {
    console.log(`[addon.js] External TopMovies URL: ${EXTERNAL_TOPMOVIES_URL || 'Not configured (using local)'}`);
} else {
    console.log(`[addon.js] All providers will use local implementations`);
}

// NEW: Stream caching config
const STREAM_CACHE_DIR = process.env.VERCEL ? path.join('/tmp', '.streams_cache') : path.join(__dirname, '.streams_cache');
const STREAM_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ENABLE_STREAM_CACHE = process.env.DISABLE_STREAM_CACHE !== 'true'; // Enabled by default
console.log(`[addon.js] Stream links caching ${ENABLE_STREAM_CACHE ? 'enabled' : 'disabled'}`);
console.log(`[addon.js] Redis caching ${redis ? 'available' : 'not available'}`);

const { getStreamContent } = require('./providers/vidsrcextractor.js');
const { getTopMoviesStreams } = require('./providers/topmovies.js');

// NEW: Read environment variable for 4KHDHub
const ENABLE_4KHDHUB_PROVIDER = process.env.ENABLE_4KHDHUB_PROVIDER !== 'false';
console.log(`[addon.js] 4KHDHub provider fetching enabled: ${ENABLE_4KHDHUB_PROVIDER}`);

const { get4KHDHubStreams } = require('./providers/4khdhub.js');

const ENABLE_HDHUB4U_PROVIDER = process.env.ENABLE_HDHUB4U_PROVIDER !== 'false';
const ENABLE_STREAMFLIX_PROVIDER = process.env.ENABLE_STREAMFLIX_PROVIDER !== 'false';
const ENABLE_VIDEASY_PROVIDER = process.env.ENABLE_VIDEASY_PROVIDER !== 'false';
const ENABLE_VIDLINK_PROVIDER = process.env.ENABLE_VIDLINK_PROVIDER !== 'false';


const { getStreams: getHDHub4uStreams } = require('./providers/hdhub4u.js');
const { getStreams: getStreamFlixStreams } = require('./providers/streamflix.js');
const { getStreams: getVideasyStreams } = require('./providers/videasy.js');
const { getStreams: getVidLinkStreams } = require('./providers/vidlink.js');


// NEW: Read environment variable for NetMirror
const ENABLE_NETMIRROR_PROVIDER = process.env.ENABLE_NETMIRROR_PROVIDER !== 'false';
console.log(`[addon.js] NetMirror provider fetching enabled: ${ENABLE_NETMIRROR_PROVIDER}`);
const { getStreams: getNetMirrorStreams } = require('./providers/netmirror.js');

// NEW: Read environment variable for Castle
const ENABLE_CASTLE_PROVIDER = process.env.ENABLE_CASTLE_PROVIDER !== 'false';
console.log(`[addon.js] Castle provider fetching enabled: ${ENABLE_CASTLE_PROVIDER}`);
const { getStreams: getCastleStreams } = require('./providers/castle.js');

// NEW: Read environment variable for Vadapav
const ENABLE_VADAPAV_PROVIDER = process.env.ENABLE_VADAPAV_PROVIDER !== 'false';
console.log(`[addon.js] Vadapav provider fetching enabled: ${ENABLE_VADAPAV_PROVIDER}`);
const { getStreams: getVadapavStreams } = require('./providers/vadapav.js');

// Helper function to make requests to external provider services
async function fetchFromExternalProvider(baseUrl, providerName, tmdbId, type, season = null, episode = null) {
    try {
        const endpoint = `/api/streams/${providerName.toLowerCase()}/${tmdbId}`;
        const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;

        // Build query parameters
        const queryParams = new URLSearchParams({ type });
        if (season !== null) queryParams.append('season', season);
        if (episode !== null) queryParams.append('episode', episode);

        const fullUrl = `${url}?${queryParams.toString()}`;
        console.log(`[External Provider] Making request to: ${fullUrl}`);

        const response = await axios.get(fullUrl, {
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': 'NuvioStreamsAddon/1.0'
            }
        });

        if (response.data && response.data.success) {
            return response.data.streams || [];
        } else {
            console.error(`[External Provider] Request failed:`, response.data?.error || 'Unknown error');
            return [];
        }
    } catch (error) {
        console.error(`[External Provider] Error making request to ${baseUrl}/api/streams/${providerName.toLowerCase()}/${tmdbId}:`, error.message);
        return [];
    }
}

// --- Analytics Configuration ---
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;
const ANALYTICS_ENABLED = GA_MEASUREMENT_ID && GA_API_SECRET;

if (ANALYTICS_ENABLED) {
    console.log(`[Analytics] GA4 Measurement Protocol is enabled. Tracking to ID: ${GA_MEASUREMENT_ID}`);
} else {
    console.log('[Analytics] GA4 Measurement Protocol is disabled. Set GA_MEASUREMENT_ID and GA_API_SECRET to enable.');
}

// --- Constants ---
const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Default to proxy/direct mode with Showbox.js
console.log('Using proxy/direct mode with Showbox.js');
const scraper = require('./providers/Showbox.js');

// Destructure the required functions from the selected scraper
const { getStreamsFromTmdbId, convertImdbToTmdb, sortStreamsByQuality } = scraper;

const manifest = require('./manifest.json');

// Initialize the addon
const builder = new addonBuilder(manifest);

// --- Helper Functions ---

// NEW: Helper function to parse quality strings into numerical values
function parseQuality(qualityString) {
    if (!qualityString || typeof qualityString !== 'string') {
        return 0; // Default for unknown or undefined
    }
    const q = qualityString.toLowerCase();

    if (q.includes('4k') || q.includes('2160')) return 2160;
    if (q.includes('1440')) return 1440;
    if (q.includes('1080')) return 1080;
    if (q.includes('720')) return 720;
    if (q.includes('576')) return 576;
    if (q.includes('480')) return 480;
    if (q.includes('360')) return 360;
    if (q.includes('240')) return 240;

    // Handle kbps by extracting number, e.g., "2500k" -> 2.5 (lower than p values)
    const kbpsMatch = q.match(/(\d+)k/);
    if (kbpsMatch && kbpsMatch[1]) {
        return parseInt(kbpsMatch[1], 10) / 1000; // Convert to a small number relative to pixel heights
    }

    if (q.includes('hd')) return 720; // Generic HD
    if (q.includes('sd')) return 480; // Generic SD

    // Lower quality tags
    if (q.includes('cam') || q.includes('camrip')) return 100;
    if (q.includes('ts') || q.includes('telesync')) return 200;
    if (q.includes('scr') || q.includes('screener')) return 300;
    if (q.includes('dvdscr')) return 350;
    if (q.includes('r5') || q.includes('r6')) return 400;

    if (q.includes('org')) return 4320; // Treat original uploads as higher than 4K

    return 0; // Default for anything else not recognized
}

// NEW: Helper function to parse size strings into a number (in MB)
function parseSize(sizeString) {
    if (!sizeString || typeof sizeString !== 'string') {
        return 0;
    }
    const match = sizeString.match(/([0-9.,]+)\s*(GB|MB|KB)/i);
    if (!match) {
        return 0;
    }
    const sizeValue = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2].toUpperCase();
    if (unit === 'GB') {
        return sizeValue * 1024;
    } else if (unit === 'MB') {
        return sizeValue;
    } else if (unit === 'KB') {
        return sizeValue / 1024;
    }
    return 0;
}

// NEW: Helper function to filter streams by minimum quality
function filterStreamsByQuality(streams, minQualitySetting, providerName) {
    if (!minQualitySetting || minQualitySetting.toLowerCase() === 'all') {
        console.log(`[${providerName}] No minimum quality filter applied (set to 'all' or not specified).`);
        return streams; // No filtering needed
    }

    const minQualityNumeric = parseQuality(minQualitySetting);
    if (minQualityNumeric === 0 && minQualitySetting.toLowerCase() !== 'all') { // Check if minQualitySetting was something unrecognized
        console.warn(`[${providerName}] Minimum quality setting '${minQualitySetting}' was not recognized. No filtering applied.`);
        return streams;
    }

    console.log(`[${providerName}] Filtering streams. Minimum quality: ${minQualitySetting} (Parsed as: ${minQualityNumeric}). Original count: ${streams.length}`);

    const filteredStreams = streams.filter(stream => {
        const streamQualityNumeric = parseQuality(stream.quality);
        return streamQualityNumeric >= minQualityNumeric;
    });

    console.log(`[${providerName}] Filtered count: ${filteredStreams.length}`);
    return filteredStreams;
}

// NEW: Helper function to filter streams by excluding specific codecs
function filterStreamsByCodecs(streams, excludeCodecSettings, providerName) {
    if (!excludeCodecSettings || Object.keys(excludeCodecSettings).length === 0) {
        console.log(`[${providerName}] No codec exclusions applied.`);
        return streams; // No filtering needed
    }

    const excludeDV = excludeCodecSettings.excludeDV === true;
    const excludeHDR = excludeCodecSettings.excludeHDR === true;

    if (!excludeDV && !excludeHDR) {
        console.log(`[${providerName}] No codec exclusions enabled.`);
        return streams;
    }

    console.log(`[${providerName}] Filtering streams. Exclude DV: ${excludeDV}, Exclude HDR: ${excludeHDR}. Original count: ${streams.length}`);

    const filteredStreams = streams.filter(stream => {
        if (!stream.codecs || !Array.isArray(stream.codecs)) {
            return true; // Keep streams without codec information
        }

        // Check for DV exclusion
        if (excludeDV && stream.codecs.includes('DV')) {
            console.log(`[${providerName}] Excluding stream with DV codec: ${stream.title || stream.url}`);
            return false;
        }

        // Check for HDR exclusion (including HDR, HDR10, HDR10+)
        if (excludeHDR && (stream.codecs.includes('HDR') || stream.codecs.includes('HDR10') || stream.codecs.includes('HDR10+'))) {
            console.log(`[${providerName}] Excluding stream with HDR codec: ${stream.title || stream.url}`);
            return false;
        }

        return true; // Keep the stream
    });

    console.log(`[${providerName}] After codec filtering count: ${filteredStreams.length}`);
    return filteredStreams;
}

// NEW: Helper function that combines both quality and codec filtering
function applyAllStreamFilters(streams, providerName, minQualitySetting, excludeCodecSettings) {
    // Apply quality filtering first
    let filteredStreams = filterStreamsByQuality(streams, minQualitySetting, providerName);
    // Then apply codec filtering
    filteredStreams = filterStreamsByCodecs(filteredStreams, excludeCodecSettings, providerName);
    return filteredStreams;
}

async function fetchWithRetry(url, options, maxRetries = MAX_RETRIES) {
    const { default: fetchFunction } = await import('node-fetch'); // Dynamically import
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchFunction(url, options); // Use the dynamically imported function
            if (!response.ok) {
                let errorBody = '';
                try {
                    errorBody = await response.text();
                } catch (e) { /* ignore */ }
                throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Body: ${errorBody.substring(0, 200)}`);
            }
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Fetch attempt ${attempt}/${maxRetries} failed for ${url}: ${error.message}`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1)));
            }
        }
    }
    console.error(`All fetch attempts failed for ${url}. Last error:`, lastError.message);
    throw lastError;
}

// --- NEW: Google Analytics Event Sending Function ---
async function sendAnalyticsEvent(eventName, eventParams) {
    if (!ANALYTICS_ENABLED) {
        return;
    }

    // Use a dynamically generated client_id for each event to ensure anonymity
    const clientId = crypto.randomBytes(16).toString("hex");

    const analyticsData = {
        client_id: clientId,
        events: [{
            name: eventName,
            params: {
                // GA4 standard parameters for better reporting
                session_id: crypto.randomBytes(16).toString("hex"),
                engagement_time_msec: '100',
                ...eventParams
            },
        }],
    };

    try {
        const { default: fetchFunction } = await import('node-fetch');
        // Use a proper timeout and catch any network errors to prevent crashes
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        // Fire-and-forget with proper error handling
        fetchFunction(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`, {
            method: 'POST',
            body: JSON.stringify(analyticsData),
            signal: controller.signal
        }).catch(err => {
            console.warn(`[Analytics] Network error sending event: ${err.message}`);
        }).finally(() => {
            clearTimeout(timeout);
        });

        console.log(`[Analytics] Sent event: ${eventName} for "${eventParams.content_title || 'N/A'}"`);
    } catch (error) {
        console.warn(`[Analytics] Failed to send event: ${error.message}`);
    }
}

// Helper function for fetching with a timeout
function fetchWithTimeout(promise, timeoutMs, providerName) {
    return new Promise((resolve) => { // Always resolve to prevent Promise.all from rejecting
        let timer = null;

        const timeoutPromise = new Promise(r => {
            timer = setTimeout(() => {
                console.log(`[${providerName}] Request timed out after ${timeoutMs}ms. Returning empty array.`);
                r({ streams: [], provider: providerName, error: new Error('Timeout') }); // Resolve with an object indicating timeout
            }, timeoutMs);
        });

        Promise.race([promise, timeoutPromise])
            .then((result) => {
                clearTimeout(timer);
                // Ensure the result is an object with a streams array, even if the original promise resolved with just an array
                if (Array.isArray(result)) {
                    resolve({ streams: result, provider: providerName });
                } else if (result && typeof result.streams !== 'undefined') {
                    resolve(result); // Already in the expected format (e.g. from timeoutPromise)
                } else {
                    // This case might happen if the promise resolves with something unexpected
                    console.warn(`[${providerName}] Resolved with unexpected format. Returning empty array. Result:`, result);
                    resolve({ streams: [], provider: providerName });
                }
            })
            .catch(error => {
                clearTimeout(timer);
                console.error(`[${providerName}] Error fetching streams: ${error.message}. Returning empty array.`);
                resolve({ streams: [], provider: providerName, error }); // Resolve with an object indicating error
            });
    });
}

// Define function to get streams from VidSrc
async function getVidSrcStreams(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
    try {
        console.log(`[VidSrc] Attempting to fetch streams for TMDB ID: ${tmdbId}, Type: ${mediaType}, Season: ${seasonNum}, Episode: ${episodeNum}`);

        // Convert TMDB ID to IMDb ID for VidSrc
        // This is a simplified example - you might need to implement proper TMDB to IMDb conversion
        // For now, assuming we have access to the IMDb ID from the caller
        let imdbId;
        if (tmdbId.startsWith('tt')) {
            imdbId = tmdbId; // Already an IMDb ID
        } else {
            // You would need to implement this conversion
            // For example, using the convertTmdbToImdb function if available
            // imdbId = await convertTmdbToImdb(tmdbId, mediaType);
            console.log(`[VidSrc] TMDB ID conversion not implemented yet. Skipping...`);
            return [];
        }

        // Format the ID according to VidSrc requirements
        let vidsrcId;
        if (mediaType === 'movie') {
            vidsrcId = imdbId;
        } else if (mediaType === 'tv' && seasonNum !== null && episodeNum !== null) {
            vidsrcId = `${imdbId}:${seasonNum}:${episodeNum}`;
        } else {
            console.log(`[VidSrc] Invalid parameters for TV show. Need season and episode numbers.`);
            return [];
        }

        // Call the getStreamContent function from vidsrcextractor.js
        const typeForVidSrc = mediaType === 'movie' ? 'movie' : 'series';
        const results = await getStreamContent(vidsrcId, typeForVidSrc);

        if (!results || results.length === 0) {
            console.log(`[VidSrc] No streams found for ${vidsrcId}.`);
            return [];
        }

        // Process the results into the standard stream format
        const streams = [];

        for (const result of results) {
            if (result.streams && result.streams.length > 0) {
                for (const streamInfo of result.streams) {
                    const quality = streamInfo.quality.includes('x')
                        ? streamInfo.quality.split('x')[1] + 'p' // Convert "1280x720" to "720p"
                        : streamInfo.quality; // Keep as is for kbps or unknown

                    streams.push({
                        title: result.name || "VidSrc Stream",
                        url: streamInfo.url,
                        quality: quality,
                        provider: "VidSrc",
                        // You can add additional metadata if needed
                        size: "Unknown size",
                        languages: ["Unknown"],
                        subtitles: [],
                        // If the referer is needed for playback
                        headers: result.referer ? { referer: result.referer } : undefined
                    });
                }
            }
        }

        console.log(`[VidSrc] Successfully extracted ${streams.length} streams.`);
        return streams;
    } catch (error) {
        console.error(`[VidSrc] Error fetching streams:`, error.message);
        return [];
    }
}

// --- Stream Caching Functions ---
// Ensure stream cache directory exists
const ensureStreamCacheDir = async () => {
    if (!ENABLE_STREAM_CACHE) return;

    try {
        await fs.mkdir(STREAM_CACHE_DIR, { recursive: true });
        console.log(`[Stream Cache] Cache directory ensured at ${STREAM_CACHE_DIR}`);
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.warn(`[Stream Cache] Warning: Could not create cache directory ${STREAM_CACHE_DIR}: ${error.message}`);
        }
    }
};

// Initialize stream cache directory on startup
ensureStreamCacheDir().catch(err => console.error(`[Stream Cache] Error creating cache directory: ${err.message}`));

// Generate cache key for a provider's streams
const getStreamCacheKey = (provider, type, id, seasonNum = null, episodeNum = null, region = null, cookie = null) => {
    // Basic key parts
    let key = `streams_${provider}_${type}_${id}`;

    // Add season/episode for TV series
    if (seasonNum !== null && episodeNum !== null) {
        key += `_s${seasonNum}e${episodeNum}`;
    }

    // For ShowBox with custom cookie/region, add those to the cache key
    if (provider.toLowerCase() === 'showbox' && (region || cookie)) {
        key += '_custom';
        if (region) key += `_${region}`;
        if (cookie) {
            // Hash the cookie to avoid storing sensitive info in filenames
            const cookieHash = crypto.createHash('md5').update(cookie).digest('hex').substring(0, 10);
            key += `_${cookieHash}`;
        }
    }

    return key;
};

// Get cached streams for a provider - Hybrid approach (Redis first, then file)
const getStreamFromCache = async (provider, type, id, seasonNum = null, episodeNum = null, region = null, cookie = null) => {
    if (!ENABLE_STREAM_CACHE) return null;
    // Exclude ShowBox and PStream from cache entirely
    try {
        if (provider && ['showbox', 'pstream'].includes(String(provider).toLowerCase())) {
            return null;
        }
    } catch (_) { }

    const cacheKey = getStreamCacheKey(provider, type, id, seasonNum, episodeNum, region, cookie);

    // Try Redis first if available
    if (redis) {
        try {
            const data = await redis.get(cacheKey);
            if (data) {
                const cached = JSON.parse(data);

                // Check if cache is expired (redundant with Redis TTL, but for safety)
                if (cached.expiry && Date.now() > cached.expiry) {
                    console.log(`[Redis Cache] EXPIRED for ${provider}: ${cacheKey}`);
                    await redis.del(cacheKey);
                    return null;
                }

                // Check for failed status - retry on next request
                if (cached.status === 'failed') {
                    console.log(`[Redis Cache] RETRY for previously failed ${provider}: ${cacheKey}`);
                    return null;
                }

                console.log(`[Redis Cache] HIT for ${provider}: ${cacheKey}`);
                return cached.streams;
            }
        } catch (error) {
            console.warn(`[Redis Cache] READ ERROR for ${provider}: ${cacheKey}: ${error.message}`);
            console.log('[Redis Cache] Falling back to file cache');
            // Fall back to file cache on Redis error
        }
    }

    // File cache fallback
    const fileCacheKey = cacheKey + '.json';
    const cachePath = path.join(STREAM_CACHE_DIR, fileCacheKey);

    try {
        const data = await fs.readFile(cachePath, 'utf-8');
        const cached = JSON.parse(data);

        // Check if cache is expired
        if (cached.expiry && Date.now() > cached.expiry) {
            console.log(`[File Cache] EXPIRED for ${provider}: ${fileCacheKey}`);
            await fs.unlink(cachePath).catch(() => { }); // Delete expired cache
            return null;
        }

        // Check for failed status - retry on next request
        if (cached.status === 'failed') {
            console.log(`[File Cache] RETRY for previously failed ${provider}: ${fileCacheKey}`);
            return null;
        }

        console.log(`[File Cache] HIT for ${provider}: ${fileCacheKey}`);
        return cached.streams;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn(`[File Cache] READ ERROR for ${provider}: ${fileCacheKey}: ${error.message}`);
        }
        return null;
    }
};

// Save streams to cache - Hybrid approach (Redis + file)
const saveStreamToCache = async (provider, type, id, streams, status = 'ok', seasonNum = null, episodeNum = null, region = null, cookie = null, ttlMs = null) => {
    if (!ENABLE_STREAM_CACHE) return;
    // Exclude ShowBox and PStream from cache entirely
    try {
        if (provider && ['showbox', 'pstream'].includes(String(provider).toLowerCase())) {
            return;
        }
    } catch (_) { }

    const cacheKey = getStreamCacheKey(provider, type, id, seasonNum, episodeNum, region, cookie);
    const effectiveTtlMs = ttlMs !== null ? ttlMs : STREAM_CACHE_TTL_MS; // Use provided TTL or default

    const cacheData = {
        streams: streams,
        status: status,
        expiry: Date.now() + effectiveTtlMs, // Use effective TTL
        timestamp: Date.now()
    };

    let redisSuccess = false;

    // Try Redis first if available
    if (redis) {
        try {
            // PX sets expiry in milliseconds
            await redis.set(cacheKey, JSON.stringify(cacheData), 'PX', effectiveTtlMs); // Use effective TTL
            console.log(`[Redis Cache] SAVED for ${provider}: ${cacheKey} (${streams.length} streams, status: ${status}, TTL: ${effectiveTtlMs / 1000}s)`);
            redisSuccess = true;
        } catch (error) {
            console.warn(`[Redis Cache] WRITE ERROR for ${provider}: ${cacheKey}: ${error.message}`);
            console.log('[Redis Cache] Falling back to file cache');
        }
    }

    // Also save to file cache as backup, or if Redis failed
    try {
        const fileCacheKey = cacheKey + '.json';
        const cachePath = path.join(STREAM_CACHE_DIR, fileCacheKey);
        await fs.writeFile(cachePath, JSON.stringify(cacheData), 'utf-8');

        // Only log if Redis didn't succeed to avoid redundant logging
        if (!redisSuccess) {
            console.log(`[File Cache] SAVED for ${provider}: ${fileCacheKey} (${streams.length} streams, status: ${status}, TTL: ${effectiveTtlMs / 1000}s)`);
        }
    } catch (error) {
        console.warn(`[File Cache] WRITE ERROR for ${provider}: ${cacheKey}.json: ${error.message}`);
    }
};

// Define stream handler for movies
builder.defineStreamHandler(async (args) => {
    const requestStartTime = Date.now(); // Start total request timer
    const providerTimings = {}; // Object to store timings

    const formatDuration = (ms) => {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        let str = "";
        if (minutes > 0) {
            str += `${minutes}m `;
        }

        if (seconds > 0 || minutes === 0) {
            let secStr = seconds.toFixed(2);
            if (secStr.endsWith('.00')) {
                secStr = secStr.substring(0, secStr.length - 3);
            }
            str += `${secStr}s`;
        }

        return str.trim();
    };

    const { type, id, config: sdkConfig } = args;

    // Read config from global set by server.js middleware
    const requestSpecificConfig = global.currentRequestConfig || {};
    // Mask sensitive fields for logs
    const maskedForLog = (() => {
        try {
            const clone = JSON.parse(JSON.stringify(requestSpecificConfig));
            if (clone.cookie) clone.cookie = '[PRESENT: ****]';
            if (clone.cookies && Array.isArray(clone.cookies)) clone.cookies = `[${clone.cookies.length} cookies]`;
            if (clone.scraper_api_key) clone.scraper_api_key = '[PRESENT: ****]';
            if (clone.chosenFebboxBaseCookieForRequest) clone.chosenFebboxBaseCookieForRequest = '[PRESENT: ****]';
            return clone;
        } catch (_) {
            return { masked: true };
        }
    })();
    console.log(`[addon.js] Read from global.currentRequestConfig: ${JSON.stringify(maskedForLog)}`);

    // NEW: Get minimum quality preferences
    const minQualitiesPreferences = requestSpecificConfig.minQualities || {};
    if (Object.keys(minQualitiesPreferences).length > 0) {
        console.log(`[addon.js] Minimum quality preferences: ${JSON.stringify(minQualitiesPreferences)}`);
    } else {
        console.log(`[addon.js] No minimum quality preferences set by user.`);
    }

    // NEW: Get codec exclude preferences
    const excludeCodecsPreferences = requestSpecificConfig.excludeCodecs || {};
    if (Object.keys(excludeCodecsPreferences).length > 0) {
        console.log(`[addon.js] Codec exclude preferences: ${JSON.stringify(excludeCodecsPreferences)}`);
    } else {
        console.log(`[addon.js] No codec exclude preferences set by user.`);
    }

    console.log("--- FULL ARGS OBJECT (from SDK) ---");
    console.log(JSON.stringify(args, null, 2));
    console.log("--- SDK ARGS.CONFIG (still logging for comparison) ---");
    console.log(JSON.stringify(sdkConfig, null, 2)); // Log the original sdkConfig
    console.log("---------------------------------");

    // Helper to get flag emoji from URL hostname
    const getFlagEmojiForUrl = (url) => {
        try {
            const hostname = new URL(url).hostname;
            // Match common patterns like xx, xxN, xxNN at the start of a part of the hostname
            const match = hostname.match(/^([a-zA-Z]{2,3})[0-9]{0,2}(?:[.-]|$)/i);
            if (match && match[1]) {
                const countryCode = match[1].toLowerCase();
                const flagMap = {
                    'us': '🇺🇸', 'usa': '🇺🇸',
                    'gb': '🇬🇧', 'uk': '🇬🇧',
                    'ca': '🇨🇦',
                    'de': '🇩🇪',
                    'fr': '🇫🇷',
                    'nl': '🇳🇱',
                    'hk': '🇭🇰',
                    'sg': '🇸🇬',
                    'jp': '🇯🇵',
                    'au': '🇦🇺',
                    'in': '🇮🇳',
                    // Add more as needed
                };
                return flagMap[countryCode] || ''; // Return empty string if no match
            }
        } catch (e) {
            // Invalid URL or other error
        }
        return ''; // Default to empty string
    };

    // Use values from requestSpecificConfig (derived from global)
    let userRegionPreference = requestSpecificConfig.region || null;
    let userCookie = requestSpecificConfig.cookie || null; // Already decoded by server.js
    let userScraperApiKey = requestSpecificConfig.scraper_api_key || null; // NEW: Get ScraperAPI Key

    // Combine single cookie + cookies array into unified list for ShowBox
    // This ensures both single cookie and multi-cookie setups work
    const cookiesFromArray = Array.isArray(requestSpecificConfig.cookies) ? requestSpecificConfig.cookies : [];
    const allCookies = [];

    // Add single cookie first (priority)
    if (userCookie && userCookie.trim()) {
        allCookies.push(userCookie.trim());
    }

    // Add cookies from array (deduplicate)
    for (const c of cookiesFromArray) {
        if (c && c.trim() && !allCookies.includes(c.trim())) {
            allCookies.push(c.trim());
        }
    }

    if (allCookies.length > 0) {
        console.log(`[addon.js] Combined ${allCookies.length} unique cookie(s) for ShowBox`);
    }

    // Log the request information in a more detailed way
    console.log(`Stream request for Stremio type: '${type}', id: '${id}'`);

    let selectedProvidersArray = null;
    if (requestSpecificConfig.providers) {
        selectedProvidersArray = requestSpecificConfig.providers.split(',').map(p => p.trim().toLowerCase());
    }

    // Detect presence of cookies (single or array)
    const hasCookiesArray = cookiesFromArray.length > 0;
    const hasAnyCookies = allCookies.length > 0;
    console.log(`Effective request details: ${JSON.stringify({
        regionPreference: userRegionPreference || 'none',
        hasCookie: hasAnyCookies,
        cookieCount: allCookies.length,
        selectedProviders: selectedProvidersArray ? selectedProvidersArray.join(', ') : 'all'
    })}`);

    if (userRegionPreference) {
        console.log(`[addon.js] Using region from global config: ${userRegionPreference}`);
    } else {
        console.log(`[addon.js] No region preference found in global config.`);
    }

    if (hasAnyCookies) {
        const cookieSource = userCookie ? 'single' : 'array';
        console.log(`[addon.js] Using personal cookie(s): ${allCookies.length} cookie(s) available (source: ${cookieSource})`);
    } else {
        console.log(`[addon.js] No cookie found in global config.`);
    }

    if (selectedProvidersArray) {
        console.log(`[addon.js] Using providers from global config: ${selectedProvidersArray.join(', ')}`);
    } else {
        console.log('[addon.js] No specific providers selected by user in global config, will attempt all.');
    }

    if (type !== 'movie' && type !== 'series' && type !== 'tv') {
        return { streams: [] };
    }

    let tmdbId;
    let tmdbTypeFromId;
    let seasonNum = null;
    let episodeNum = null;
    let initialTitleFromConversion = null;
    let isAnimation = false; // <--- New flag to track if content is animation

    const idParts = id.split(':');

    if (idParts[0] === 'tmdb') {
        tmdbId = idParts[1];
        tmdbTypeFromId = type === 'movie' ? 'movie' : 'tv';
        console.log(`  Received TMDB ID directly: ${tmdbId} for type ${tmdbTypeFromId}`);

        // Check for season and episode
        if (idParts.length >= 4 && (type === 'series' || type === 'tv')) {
            seasonNum = parseInt(idParts[2], 10);
            episodeNum = parseInt(idParts[3], 10);
            console.log(`  Parsed season ${seasonNum}, episode ${episodeNum} from Stremio ID`);
        }
    } else if (id.startsWith('tt')) {
        console.log(`  Received IMDb ID: ${id}. Attempting to convert to TMDB ID.`);

        const imdbParts = id.split(':');
        let baseImdbId = id; // Default to full ID for movies

        if (imdbParts.length >= 3 && (type === 'series' || type === 'tv')) {
            seasonNum = parseInt(imdbParts[1], 10);
            episodeNum = parseInt(imdbParts[2], 10);
            baseImdbId = imdbParts[0]; // Use only the IMDb ID part for conversion
            console.log(`  Parsed season ${seasonNum}, episode ${episodeNum} from IMDb ID parts`);
        }

        // Pass userRegionPreference and expected type to convertImdbToTmdb
        const conversionResult = await convertImdbToTmdb(baseImdbId, userRegionPreference, type);
        if (conversionResult && conversionResult.tmdbId && conversionResult.tmdbType) {
            tmdbId = conversionResult.tmdbId;
            tmdbTypeFromId = conversionResult.tmdbType;
            initialTitleFromConversion = conversionResult.title; // Capture title from conversion
            console.log(`  Successfully converted IMDb ID ${baseImdbId} to TMDB ${tmdbTypeFromId} ID ${tmdbId} (${initialTitleFromConversion || 'No title returned'})`);
        } else {
            console.log(`  Failed to convert IMDb ID ${baseImdbId} to TMDB ID.`);
            return { streams: [] };
        }
    } else {
        console.log(`  Unrecognized ID format: ${id}`);
        return { streams: [] };
    }

    if (!tmdbId || !tmdbTypeFromId) {
        console.log('  Could not determine TMDB ID or type after processing Stremio ID.');
        return { streams: [] };
    }

    let movieOrSeriesTitle = initialTitleFromConversion;
    let movieOrSeriesYear = null;
    let seasonTitle = null;

    if (tmdbId && TMDB_API_KEY) {
        try {
            let detailsUrl;
            if (tmdbTypeFromId === 'movie') {
                detailsUrl = `${TMDB_API_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
            } else { // 'tv'
                detailsUrl = `${TMDB_API_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
            }

            console.log(`Fetching details from TMDB: ${detailsUrl}`);
            const tmdbDetailsResponse = await fetchWithRetry(detailsUrl, {});
            if (!tmdbDetailsResponse.ok) throw new Error(`TMDB API error: ${tmdbDetailsResponse.status}`);
            const tmdbDetails = await tmdbDetailsResponse.json();

            if (tmdbTypeFromId === 'movie') {
                if (!movieOrSeriesTitle) movieOrSeriesTitle = tmdbDetails.title;
                movieOrSeriesYear = tmdbDetails.release_date ? tmdbDetails.release_date.substring(0, 4) : null;
            } else { // 'tv'
                if (!movieOrSeriesTitle) movieOrSeriesTitle = tmdbDetails.name;
                movieOrSeriesYear = tmdbDetails.first_air_date ? tmdbDetails.first_air_date.substring(0, 4) : null;
            }
            console.log(`  Fetched/Confirmed TMDB details: Title='${movieOrSeriesTitle}', Year='${movieOrSeriesYear}'`);

            // NEW: Fetch season-specific title for TV shows
            if (tmdbTypeFromId === 'tv' && seasonNum) {
                const seasonDetailsUrl = `${TMDB_API_URL}/tv/${tmdbId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=en-US`;
                console.log(`Fetching season details from TMDB: ${seasonDetailsUrl}`);
                try {
                    const seasonDetailsResponse = await fetchWithRetry(seasonDetailsUrl, {});
                    if (seasonDetailsResponse.ok) {
                        const seasonDetails = await seasonDetailsResponse.json();
                        seasonTitle = seasonDetails.name;
                        console.log(`  Fetched season title: "${seasonTitle}"`);
                    }
                } catch (e) {
                    console.warn(`Could not fetch season-specific title: ${e.message}`);
                }
            }

            // Check for Animation genre
            if (tmdbDetails.genres && Array.isArray(tmdbDetails.genres)) {
                if (tmdbDetails.genres.some(genre => genre.name.toLowerCase() === 'animation')) {
                    isAnimation = true;
                    console.log('  Content identified as Animation based on TMDB genres.');
                }
            }

        } catch (e) {
            console.error(`  Error fetching details from TMDB: ${e.message}`);
        }
    } else if (tmdbId && !TMDB_API_KEY) {
        console.warn("TMDB_API_KEY is not configured. Cannot fetch full title/year/genres.");
    }

    // --- Send Analytics Event ---
    if (movieOrSeriesTitle) {
        sendAnalyticsEvent('stream_request', {
            content_type: tmdbTypeFromId,
            content_id: tmdbId,
            content_title: movieOrSeriesTitle,
            content_year: movieOrSeriesYear || 'N/A',
            selected_providers: selectedProvidersArray ? selectedProvidersArray.join(',') : 'all',
            // Custom dimension for tracking if it's an animation
            is_animation: isAnimation ? 'true' : 'false',
        });
    }

    let combinedRawStreams = [];

    // --- Provider Selection Logic ---
    const shouldFetch = (providerId) => {
        if (!selectedProvidersArray) return true; // If no selection, fetch all
        return selectedProvidersArray.includes(providerId.toLowerCase());
    };

    // Helper for timing provider fetches
    const timeProvider = async (providerName, fetchPromise) => {
        console.error(`[timeProvider] Starting ${providerName}`);
        await fs.appendFile('debug_vadapav_force.txt', `[${new Date().toISOString()}] [timeProvider] Starting ${providerName}\n`).catch(() => { });
        const startTime = Date.now();
        const result = await fetchPromise;
        const endTime = Date.now();
        providerTimings[providerName] = formatDuration(endTime - startTime);
        return result;
    };

    // --- NEW: Asynchronous provider fetching with caching ---
    console.log('[Stream Cache] Checking cache for all enabled providers...');

    const providerFetchFunctions = {
        // ShowBox provider with cache integration
        showbox: async () => {
            if (!shouldFetch('showbox')) {
                console.log('[ShowBox] Skipping fetch: Not selected by user.');
                return [];
            }

            // Try to get cached streams first
            const cachedStreams = await getStreamFromCache('showbox', tmdbTypeFromId, tmdbId, seasonNum, episodeNum, userRegionPreference, userCookie);
            if (cachedStreams) {
                console.log(`[ShowBox] Using ${cachedStreams.length} streams from cache.`);
                return cachedStreams.map(stream => {
                    // Preserve original provider information for cached streams too
                    if (stream.provider === 'PStream') {
                        return stream; // Keep PStream provider as-is
                    } else {
                        return { ...stream, provider: 'ShowBox' }; // Set ShowBox for other streams
                    }
                });
            }

            // No cache or expired, fetch fresh with retry mechanism
            console.log(`[ShowBox] Fetching new streams...`);
            let lastError = null;
            const MAX_SHOWBOX_RETRIES = 3;

            // Retry logic for ShowBox
            for (let attempt = 1; attempt <= MAX_SHOWBOX_RETRIES; attempt++) {
                try {
                    console.log(`[ShowBox] Attempt ${attempt}/${MAX_SHOWBOX_RETRIES}`);
                    // Pass allCookies array to ShowBox - it will select the best cookie with fallback
                    const streams = await getStreamsFromTmdbId(tmdbTypeFromId, tmdbId, seasonNum, episodeNum, userRegionPreference, allCookies, userScraperApiKey);

                    if (streams && streams.length > 0) {
                        console.log(`[ShowBox] Successfully fetched ${streams.length} streams on attempt ${attempt}.`);
                        // Save to cache with success status
                        await saveStreamToCache('showbox', tmdbTypeFromId, tmdbId, streams, 'ok', seasonNum, episodeNum, userRegionPreference, userCookie);
                        // Preserve original provider information - don't override PStream streams
                        return streams.map(stream => {
                            // Only set provider to 'ShowBox' if it's not already set to 'PStream'
                            if (stream.provider === 'PStream') {
                                return stream; // Keep PStream provider as-is
                            } else {
                                return { ...stream, provider: 'ShowBox' }; // Set ShowBox for other streams
                            }
                        });
                    } else {
                        console.log(`[ShowBox] No streams returned for TMDB ${tmdbTypeFromId}/${tmdbId} on attempt ${attempt}`);
                        // Only save empty result if we're on the last retry
                        if (attempt === MAX_SHOWBOX_RETRIES) {
                            await saveStreamToCache('showbox', tmdbTypeFromId, tmdbId, [], 'failed', seasonNum, episodeNum, userRegionPreference, userCookie);
                        }
                        // If not last attempt, wait and retry
                        if (attempt < MAX_SHOWBOX_RETRIES) {
                            const delayMs = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
                            console.log(`[ShowBox] Waiting ${delayMs}ms before retry...`);
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                        }
                    }
                } catch (err) {
                    lastError = err;
                    console.error(`[ShowBox] Error fetching streams (attempt ${attempt}/${MAX_SHOWBOX_RETRIES}):`, err.message);

                    // If not last attempt, wait and retry
                    if (attempt < MAX_SHOWBOX_RETRIES) {
                        const delayMs = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
                        console.log(`[ShowBox] Waiting ${delayMs}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        // Only save error status to cache on the last retry
                        await saveStreamToCache('showbox', tmdbTypeFromId, tmdbId, [], 'failed', seasonNum, episodeNum, userRegionPreference, userCookie);
                    }
                }
            }

            // If we get here, all retries failed
            console.error(`[ShowBox] All ${MAX_SHOWBOX_RETRIES} attempts failed. Last error: ${lastError ? lastError.message : 'Unknown error'}`);
            return [];
        },

        // TopMovies provider with cache integration
        topmovies: async () => {
            if (!ENABLE_TOPMOVIES_PROVIDER) {
                console.log('[TopMovies] Skipping fetch: Disabled by environment variable.');
                return [];
            }
            if (!shouldFetch('topmovies')) {
                console.log('[TopMovies] Skipping fetch: Not selected by user.');
                return [];
            }

            // This provider only supports movies
            if (tmdbTypeFromId !== 'movie') {
                console.log('[TopMovies] Skipping fetch: Provider only supports movies.');
                return [];
            }

            // Try to get cached streams first
            const cachedStreams = await getStreamFromCache('topmovies', tmdbTypeFromId, tmdbId);
            if (cachedStreams) {
                console.log(`[TopMovies] Using ${cachedStreams.length} streams from cache.`);
                return cachedStreams.map(stream => ({ ...stream, provider: 'TopMovies' }));
            }

            // No cache or expired, fetch fresh
            try {
                console.log(`[TopMovies] Fetching new streams...`);
                let streams;

                // Check if external service URL is configured
                if (EXTERNAL_TOPMOVIES_URL) {
                    console.log(`[TopMovies] Using external service: ${EXTERNAL_TOPMOVIES_URL}`);
                    streams = await fetchFromExternalProvider(EXTERNAL_TOPMOVIES_URL, 'topmovies', tmdbId, tmdbTypeFromId);
                } else {
                    console.log(`[TopMovies] Using local provider`);
                    streams = await getTopMoviesStreams(tmdbId, tmdbTypeFromId);
                }

                if (streams && streams.length > 0) {
                    console.log(`[TopMovies] Successfully fetched ${streams.length} streams.`);
                    // Save to cache
                    await saveStreamToCache('topmovies', tmdbTypeFromId, tmdbId, streams, 'ok');
                    return streams.map(stream => ({ ...stream, provider: 'TopMovies' }));
                } else {
                    console.log(`[TopMovies] No streams returned.`);
                    // Save empty result
                    await saveStreamToCache('topmovies', tmdbTypeFromId, tmdbId, [], 'failed');
                    return [];
                }
            } catch (err) {
                console.error(`[TopMovies] Error fetching streams:`, err.message);
                // Save error status to cache
                await saveStreamToCache('topmovies', tmdbTypeFromId, tmdbId, [], 'failed');
                return [];
            }
        },

        // 4KHDHub provider with cache integration
        '4khdhub': async () => {
            if (!ENABLE_4KHDHUB_PROVIDER) {
                console.log('[4KHDHub] Skipping fetch: Disabled by environment variable.');
                return [];
            }
            if (!shouldFetch('4khdhub')) {
                console.log('[4KHDHub] Skipping fetch: Not selected by user.');
                return [];
            }

            // Try to get cached streams first
            const cachedStreams = await getStreamFromCache('4khdhub', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
            if (cachedStreams) {
                console.log(`[4KHDHub] Using ${cachedStreams.length} streams from cache.`);
                return cachedStreams.map(stream => ({ ...stream, provider: '4KHDHub' }));
            }

            // No cache or expired, fetch fresh
            try {
                console.log(`[4KHDHub] Fetching new streams...`);
                const streams = await get4KHDHubStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);

                if (streams && streams.length > 0) {
                    console.log(`[4KHDHub] Successfully fetched ${streams.length} streams.`);
                    // Save to cache
                    await saveStreamToCache('4khdhub', tmdbTypeFromId, tmdbId, streams, 'ok', seasonNum, episodeNum);
                    return streams.map(stream => ({ ...stream, provider: '4KHDHub' }));
                } else {
                    console.log(`[4KHDHub] No streams returned.`);
                    // Save empty result
                    await saveStreamToCache('4khdhub', tmdbTypeFromId, tmdbId, [], 'failed', seasonNum, episodeNum);
                    return [];
                }
            } catch (err) {
                console.error(`[4KHDHub] Error fetching streams:`, err.message);
                // Save error status to cache
                await saveStreamToCache('4khdhub', tmdbTypeFromId, tmdbId, [], 'failed', seasonNum, episodeNum);
                return [];
            }
        },

        // HDHub4u provider
        hdhub4u: async () => {
            if (!ENABLE_HDHUB4U_PROVIDER) return [];
            if (!shouldFetch('hdhub4u')) return [];
            try {
                const cached = await getStreamFromCache('hdhub4u', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                if (cached) return cached.map(s => ({ ...s, provider: 'HDHub4u' }));

                console.log(`[HDHub4u] Fetching new streams...`);
                const streams = await getHDHub4uStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);
                await saveStreamToCache('hdhub4u', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'HDHub4u' }));
            } catch (err) {
                console.error(`[HDHub4u] Error:`, err.message);
                return [];
            }
        },

        // StreamFlix provider
        streamflix: async () => {
            if (!ENABLE_STREAMFLIX_PROVIDER) return [];
            if (!shouldFetch('streamflix')) return [];
            try {
                const cached = await getStreamFromCache('streamflix', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                if (cached) return cached.map(s => ({ ...s, provider: 'StreamFlix' }));

                console.log(`[StreamFlix] Fetching new streams...`);
                const streams = await getStreamFlixStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);
                await saveStreamToCache('streamflix', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'StreamFlix' }));
            } catch (err) {
                console.error(`[StreamFlix] Error:`, err.message);
                return [];
            }
        },

        // Videasy provider
        videasy: async () => {
            if (!ENABLE_VIDEASY_PROVIDER) return [];
            if (!shouldFetch('videasy')) return [];
            try {
                const cached = await getStreamFromCache('videasy', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                if (cached) return cached.map(s => ({ ...s, provider: 'Videasy' }));

                console.log(`[Videasy] Fetching new streams...`);
                const streams = await getVideasyStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);
                await saveStreamToCache('videasy', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'Videasy' }));
            } catch (err) {
                console.error(`[Videasy] Error:`, err.message);
                return [];
            }
        },

        // VidLink provider
        vidlink: async () => {
            if (!ENABLE_VIDLINK_PROVIDER) return [];
            if (!shouldFetch('vidlink')) return [];
            try {
                const cached = await getStreamFromCache('vidlink', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                if (cached) return cached.map(s => ({ ...s, provider: 'VidLink' }));

                console.log(`[VidLink] Fetching new streams...`);
                const streams = await getVidLinkStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);
                await saveStreamToCache('vidlink', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'VidLink' }));
            } catch (err) {
                console.error(`[VidLink] Error:`, err.message);
                return [];
            }
        },

        // NetMirror provider
        netmirror: async () => {
            if (!ENABLE_NETMIRROR_PROVIDER) return [];
            if (!shouldFetch('netmirror')) return [];
            try {
                const cached = await getStreamFromCache('netmirror', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                if (cached) return cached.map(s => ({ ...s, provider: 'NetMirror' }));

                console.log(`[NetMirror] Fetching new streams...`);
                const streams = await getNetMirrorStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);
                await saveStreamToCache('netmirror', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'NetMirror' }));
            } catch (err) {
                console.error(`[NetMirror] Error:`, err.message);
                return [];
            }
        },

        // Castle provider
        castle: async () => {
            if (!ENABLE_CASTLE_PROVIDER) return [];
            if (!shouldFetch('castle')) return [];
            try {
                const cached = await getStreamFromCache('castle', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                if (cached) return cached.map(s => ({ ...s, provider: 'Castle' }));

                console.log(`[Castle] Fetching new streams...`);
                const streams = await getCastleStreams(tmdbId, tmdbTypeFromId, seasonNum, episodeNum);
                await saveStreamToCache('castle', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'Castle' }));
            } catch (err) {
                console.error(`[Castle] Error:`, err.message);
                return [];
            }
        },

        // Vadapav provider
        vadapav: async () => {
            console.error('[Vadapav] Function called!');
            try {
                fsSync.appendFileSync('debug_vadapav_force.txt', `[${new Date().toISOString()}] [Vadapav] Function called!\n`);
            } catch (e) { console.error('Logging failed', e); }

            try {
                await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Vadapav provider called. Type: ${tmdbTypeFromId}, ID: ${id}\n`);

                // const cached = await getStreamFromCache('vadapav', tmdbTypeFromId, tmdbId, seasonNum, episodeNum);
                // if (cached) {
                //     await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Cache hit: ${cached.length} streams\n`);
                //     return cached.map(s => ({ ...s, provider: 'Vadapav' }));
                // }
                console.log('[Vadapav] Cache disabled for debugging.');

                console.log(`[Vadapav] Fetching new streams...`);
                await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Fetching new streams...\n`);

                let imdbIdForProvider = null;
                if (id.startsWith('tt')) {
                    imdbIdForProvider = id.split(':')[0];
                }

                if (!imdbIdForProvider && id.startsWith('tt')) imdbIdForProvider = id.split(':')[0];

                if (!imdbIdForProvider) {
                    console.log('[Vadapav] Skipping: No IMDb ID available.');
                    await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Skipping: No IMDb ID\n`);
                    return [];
                }

                await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Calling getVadapavStreams with ${imdbIdForProvider}\n`);
                const streams = await getVadapavStreams(tmdbTypeFromId, imdbIdForProvider, seasonNum, episodeNum);
                await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Result: ${streams ? streams.length : 'null'} streams\n`);

                await saveStreamToCache('vadapav', tmdbTypeFromId, tmdbId, streams || [], streams && streams.length > 0 ? 'ok' : 'failed', seasonNum, episodeNum);
                return (streams || []).map(s => ({ ...s, provider: 'Vadapav' }));
            } catch (err) {
                console.error(`[Vadapav] Error:`, err.message);
                await fs.appendFile('debug_vadapav.txt', `[${new Date().toISOString()}] Error: ${err.message}\n`);
                return [];
            }
        },

    };

    // Execute all provider fetches in parallel
    console.log('Running parallel provider fetches with caching...');

    try {
        // Execute all provider functions in parallel with 15-second timeout
        const PROVIDER_TIMEOUT_MS = 15000; // 15 seconds
        const providerPromises = [
            timeProvider('ShowBox', providerFetchFunctions.showbox()),
            timeProvider('TopMovies', providerFetchFunctions.topmovies()),
            timeProvider('4KHDHub', providerFetchFunctions['4khdhub']()),
            timeProvider('HDHub4u', providerFetchFunctions.hdhub4u()),
            timeProvider('StreamFlix', providerFetchFunctions.streamflix()),
            timeProvider('Videasy', providerFetchFunctions.videasy()),
            timeProvider('VidLink', providerFetchFunctions.vidlink()),
            timeProvider('NetMirror', providerFetchFunctions.netmirror()),
            timeProvider('Castle', providerFetchFunctions.castle()),
            timeProvider('Vadapav', providerFetchFunctions.vadapav()),

        ];

        // Implement proper timeout that returns results immediately after 15 seconds
        let providerResults;
        let timeoutOccurred = false;

        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                timeoutOccurred = true;
                console.log(`[Timeout] 15-second timeout reached. Returning fetched links so far.`);
                resolve('timeout');
            }, PROVIDER_TIMEOUT_MS);
        });

        // Start all providers and race against timeout
        const settledPromise = Promise.allSettled(providerPromises);
        const raceResult = await Promise.race([settledPromise, timeoutPromise]);

        if (raceResult === 'timeout') {
            // Timeout occurred, collect results from completed providers only
            console.log(`[Timeout] Collecting results from completed providers...`);

            // Give a brief moment for any providers that might be just finishing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get current state of all promises
            const currentResults = await Promise.allSettled(providerPromises.map(p =>
                Promise.race([p, Promise.resolve([])])
            ));

            providerResults = currentResults.map((result, index) => {
                const providerNames = ['ShowBox', 'TopMovies', '4KHDHub', 'HDHub4u', 'StreamFlix', 'Videasy', 'VidLink', 'NetMirror', 'Castle', 'Vadapav'];
                if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
                    console.log(`[Timeout] Provider ${providerNames[index]} completed with ${result.value.length} streams.`);
                    return result.value;
                } else {
                    console.log(`[Timeout] Provider ${providerNames[index]} did not complete in time or returned no streams.`);
                    return []; // Return empty array for incomplete/failed providers
                }
            });
        } else {
            // All providers completed within timeout
            providerResults = raceResult.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return [];
                }
            });
        }

        // Process results into streamsByProvider object
        const streamsByProvider = {
            'ShowBox': shouldFetch('showbox') ? applyAllStreamFilters(providerResults[0], 'ShowBox', minQualitiesPreferences.showbox, excludeCodecsPreferences.showbox) : [],
            'TopMovies': ENABLE_TOPMOVIES_PROVIDER && shouldFetch('topmovies') ? applyAllStreamFilters(providerResults[1], 'TopMovies', minQualitiesPreferences.topmovies, excludeCodecsPreferences.topmovies) : [],
            '4KHDHub': ENABLE_4KHDHUB_PROVIDER && shouldFetch('4khdhub') ? applyAllStreamFilters(providerResults[2], '4KHDHub', minQualitiesPreferences['4khdhub'], excludeCodecsPreferences['4khdhub']) : [],
            'HDHub4u': ENABLE_HDHUB4U_PROVIDER && shouldFetch('hdhub4u') ? applyAllStreamFilters(providerResults[3], 'HDHub4u', minQualitiesPreferences.hdhub4u, excludeCodecsPreferences.hdhub4u) : [],
            'StreamFlix': ENABLE_STREAMFLIX_PROVIDER && shouldFetch('streamflix') ? applyAllStreamFilters(providerResults[4], 'StreamFlix', minQualitiesPreferences.streamflix, excludeCodecsPreferences.streamflix) : [],
            'Videasy': ENABLE_VIDEASY_PROVIDER && shouldFetch('videasy') ? applyAllStreamFilters(providerResults[5], 'Videasy', minQualitiesPreferences.videasy, excludeCodecsPreferences.videasy) : [],
            'VidLink': ENABLE_VIDLINK_PROVIDER && shouldFetch('vidlink') ? applyAllStreamFilters(providerResults[6], 'VidLink', minQualitiesPreferences.vidlink, excludeCodecsPreferences.vidlink) : [],
            'NetMirror': ENABLE_NETMIRROR_PROVIDER && shouldFetch('netmirror') ? applyAllStreamFilters(providerResults[7], 'NetMirror', minQualitiesPreferences.netmirror, excludeCodecsPreferences.netmirror) : [],
            'Castle': ENABLE_CASTLE_PROVIDER && shouldFetch('castle') ? applyAllStreamFilters(providerResults[8], 'Castle', minQualitiesPreferences.castle, excludeCodecsPreferences.castle) : [],
            'Vadapav': shouldFetch('vadapav') ? applyAllStreamFilters(providerResults[9], 'Vadapav', minQualitiesPreferences.vadapav, excludeCodecsPreferences.vadapav) : [],

        };

        // Sort streams for each provider by quality, then size
        console.log('Sorting streams for each provider by quality, then size...');
        for (const provider in streamsByProvider) {
            streamsByProvider[provider].sort((a, b) => {
                const qualityA = parseQuality(a.quality);
                const qualityB = parseQuality(b.quality);
                if (qualityB !== qualityA) {
                    return qualityB - qualityA; // Higher quality first
                }
                const sizeA = parseSize(a.size);
                const sizeB = parseSize(b.size);
                return sizeB - sizeA; // Larger file first if same quality
            });
        }

        // Combine streams in the preferred provider order
        combinedRawStreams = [];
        const providerOrder = ['ShowBox', 'NetMirror', 'Castle', 'Vadapav', '4KHDHub', 'TopMovies', 'HDHub4u', 'StreamFlix', 'Videasy', 'VidLink'];
        providerOrder.forEach(providerKey => {
            if (streamsByProvider[providerKey] && streamsByProvider[providerKey].length > 0) {
                combinedRawStreams.push(...streamsByProvider[providerKey]);
            }
        });

        console.log(`Total raw streams after provider-ordered fetch: ${combinedRawStreams.length}`);

    } catch (error) {
        console.error('Error during provider fetching:', error);
        // Continue with any streams we were able to fetch
    }

    if (combinedRawStreams.length === 0) {
        console.log(`  No streams found from any provider for TMDB ${tmdbTypeFromId}/${tmdbId}`);
        return { streams: [] };
    }

    console.log(`Total streams after provider-level sorting: ${combinedRawStreams.length}`);

    // Format and send the response
    const stremioStreamObjects = combinedRawStreams.map((stream) => {
        // --- NEW: Special handling for TopMovies to use its pre-formatted titles ---
        if (stream.provider === 'TopMovies') {
            return {
                name: stream.name,    // Use the name from the provider, e.g., "TopMovies - 1080p"
                title: stream.title,  // Use the title from the provider, e.g., "Filename.mkv\nSize"
                url: stream.url,
                type: 'url',
                availability: 2,
                behaviorHints: {
                    notWebReady: true
                }
            };
        }

        // --- NEW: VidLink Proxy Rewrite ---
        // Rewrite VidLink URLs to point to our local proxy to fix Content-Type headers
        if (stream.provider === 'VidLink' && global.currentRequestConfig && global.currentRequestConfig.baseUrl) {
            const baseUrl = global.currentRequestConfig.baseUrl;
            const encodedUrl = encodeURIComponent(stream.url);
            stream.url = `${baseUrl}/vidlink/m3u8?url=${encodedUrl}`;
            // Remove headers for proxied streams as the proxy handles them
            if (stream.headers) {
                delete stream.headers;
            }
        }

        const qualityLabel = stream.quality || 'UNK'; // UNK for unknown

        let displayTitle;

        if (stream.provider === 'ShowBox' && stream.title) {
            displayTitle = stream.title; // Use the raw filename from ShowBox
        } else if (stream.provider === '4KHDHub' && stream.title) {
            displayTitle = stream.title; // Use the enhanced title that includes filename and size
        } else if (tmdbTypeFromId === 'tv' && seasonNum !== null && episodeNum !== null && movieOrSeriesTitle) {
            displayTitle = `${movieOrSeriesTitle} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
        } else if (movieOrSeriesTitle) {
            if (tmdbTypeFromId === 'movie' && movieOrSeriesYear) {
                displayTitle = `${movieOrSeriesTitle} (${movieOrSeriesYear})`;
            } else {
                displayTitle = movieOrSeriesTitle;
            }
        } else {
            displayTitle = stream.title || "Unknown Title"; // Fallback to the title from the raw stream data
        }

        const flagEmoji = getFlagEmojiForUrl(stream.url);

        let providerDisplayName = stream.provider; // Default to the existing provider name
        if (stream.provider === 'ShowBox') {
            providerDisplayName = 'ShowBox';
            if (hasAnyCookies) {
                providerDisplayName += ' ⚡';
            } else {
                providerDisplayName += ' (SLOW)';
            }
        } else if (stream.provider === 'PStream') {
            providerDisplayName = '🌐 ShowBox ⚡'; // PStream streams should show as ShowBox with lightning
        }

        const finalName = `[${providerDisplayName}] ${qualityLabel} ${flagEmoji}`;

        const stremioStream = {
            name: finalName,
            title: displayTitle,
            url: stream.url,
            type: stream.type || 'url',
            availability: 2,
            behaviorHints: {
                notWebReady: true
            }
        };

        // Include headers if present (critical for providers like NetMirror)
        if (stream.headers) {
            stremioStream.behaviorHints.headers = stream.headers;
        }

        return stremioStream;
    });

    console.log("--- BEGIN Stremio Stream Objects to be sent ---");
    const streamSample = stremioStreamObjects.slice(0, 3);
    console.log(JSON.stringify(streamSample, null, 2));
    if (stremioStreamObjects.length > 3) {
        console.log(`... and ${stremioStreamObjects.length - 3} more streams`);
    }
    console.log("--- END Stremio Stream Objects to be sent ---");

    const requestEndTime = Date.now();
    const totalRequestTime = requestEndTime - requestStartTime;
    console.log(`Request for ${id} completed successfully`);
    console.log(`Total Request Time: ${totalRequestTime}ms`);

    return { streams: stremioStreamObjects };
});

// Build and export the addon
module.exports = builder.getInterface();
