/**
 * Videasy Provider for Nuvio
 * Ported from yoruix/nuvio-providers
 */

const axios = require('axios');

// Constants
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Connection': 'keep-alive'
};

const API = 'https://enc-dec.app/api';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// VideoEasy server configurations
const SERVERS = {
    'Neon': { url: 'https://api.videasy.net/myflixerzupcloud/sources-with-title', language: 'Original' },
    'Sage': { url: 'https://api.videasy.net/1movies/sources-with-title', language: 'Original' },
    'Cypher': { url: 'https://api.videasy.net/moviebox/sources-with-title', language: 'Original' },
    'Yoru': { url: 'https://api.videasy.net/cdn/sources-with-title', language: 'Original', moviesOnly: true },
    'Reyna': { url: 'https://api2.videasy.net/primewire/sources-with-title', language: 'Original' },
    'Omen': { url: 'https://api.videasy.net/onionplay/sources-with-title', language: 'Original' },
    'Breach': { url: 'https://api.videasy.net/m4uhd/sources-with-title', language: 'Original' },
    'Vyse': { url: 'https://api.videasy.net/hdmovie/sources-with-title', language: 'Original' },
    'Killjoy': { url: 'https://api.videasy.net/meine/sources-with-title', language: 'German', params: { language: 'german' } },
    'Harbor': { url: 'https://api.videasy.net/meine/sources-with-title', language: 'Italian', params: { language: 'italian' } },
    'Chamber': { url: 'https://api.videasy.net/meine/sources-with-title', language: 'French', params: { language: 'french' }, moviesOnly: true },
    'Fade': { url: 'https://api.videasy.net/hdmovie/sources-with-title', language: 'Hindi' },
    'Gekko': { url: 'https://api2.videasy.net/cuevana-latino/sources-with-title', language: 'Latin' },
    'Kayo': { url: 'https://api2.videasy.net/cuevana-spanish/sources-with-title', language: 'Spanish' },
    'Raze': { url: 'https://api.videasy.net/superflix/sources-with-title', language: 'Portuguese' },
    'Phoenix': { url: 'https://api2.videasy.net/overflix/sources-with-title', language: 'Portuguese' },
    'Astra': { url: 'https://api.videasy.net/visioncine/sources-with-title', language: 'Portuguese' }
};

// Helper function for HTTP requests using axios
async function makeRequest(url, options = {}) {
    const config = {
        method: options.method || 'GET',
        url: url,
        headers: {
            ...HEADERS,
            ...options.headers
        },
        timeout: 15000
    };

    if (options.body) {
        config.data = options.body;
    }

    try {
        const response = await axios(config);
        return response;
    } catch (error) {
        console.error(`[Videasy] Request failed for ${url}: ${error.message}`);
        throw error;
    }
}

// Get JSON from URL
async function getJson(url) {
    const response = await makeRequest(url);
    return response.data;
}

// Get Text from URL
async function getText(url) {
    const response = await makeRequest(url);
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}

// Post JSON to URL
async function postJson(url, jsonBody, extraHeaders) {
    const response = await makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: jsonBody
    });
    return response.data;
}

// Decrypt VideoEasy data
async function decryptVideoEasy(encryptedText, tmdbId) {
    const response = await postJson(`${API}/dec-videasy`, { text: encryptedText, id: tmdbId });
    return response.result;
}

// Fetch media details from TMDB
async function fetchMediaDetails(tmdbId, mediaType = 'movie') {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const data = await getJson(url);

    return {
        id: data.id,
        title: mediaType === 'tv' ? data.name : data.title,
        year: (mediaType === 'tv' ? data.first_air_date : data.release_date)?.split('-')[0] || '',
        imdbId: data.external_ids?.imdb_id || '',
        mediaType: mediaType,
        overview: data.overview
    };
}

// Build VideoEasy API URL
function buildVideoEasyUrl(serverConfig, mediaType, title, year, tmdbId, imdbId, seasonId = null, episodeId = null) {
    const params = { title, mediaType, year, tmdbId, imdbId };
    if (serverConfig.params) Object.assign(params, serverConfig.params);
    if (mediaType === 'tv' && seasonId && episodeId) {
        params.seasonId = seasonId;
        params.episodeId = episodeId;
    }
    const queryString = Object.keys(params)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        .join('&');
    return `${serverConfig.url}?${queryString}`;
}

// Quality from URL helper
function extractQualityFromUrl(url) {
    const qualityPatterns = [
        /(\d{3,4})p/i, /quality[_-]?(\d{3,4})/i, /res[_-]?(\d{3,4})/i, /(\d{3,4})x\d{3,4}/i
    ];
    for (const pattern of qualityPatterns) {
        const match = url.match(pattern);
        if (match) {
            const qualityNum = parseInt(match[1]);
            if (qualityNum >= 240 && qualityNum <= 4320) return `${qualityNum}p`;
        }
    }
    if (url.includes('1080') || url.includes('1920')) return '1080p';
    if (url.includes('720') || url.includes('1280')) return '720p';
    if (url.includes('480')) return '480p';
    return 'unknown';
}

// Format streams for Nuvio
function formatStreamsForNuvio(mediaData, serverName, serverConfig, mediaDetails) {
    if (!mediaData || !mediaData.sources) return [];
    const streams = [];
    mediaData.sources.forEach((source) => {
        if (source.url) {
            let quality = source.quality || extractQualityFromUrl(source.url);
            if (quality === 'unknown') quality = 'Adaptive';

            const title = `${mediaDetails.title} (${mediaDetails.year})`;
            streams.push({
                name: `VIDEASY ${serverName} (${serverConfig.language}) - ${quality}`,
                title: title,
                url: source.url,
                quality: quality,
                size: 'Unknown',
                headers: { ...HEADERS, 'Referer': 'https://videasy.net/' },
                provider: 'videasy'
            });
        }
    });
    return streams;
}

// Fetch from single server
async function fetchFromServer(serverName, serverConfig, mediaType, title, year, tmdbId, imdbId, seasonId, episodeId) {
    if (mediaType === 'tv' && serverConfig.moviesOnly) return [];
    const url = buildVideoEasyUrl(serverConfig, mediaType, title, year, tmdbId, imdbId, seasonId, episodeId);
    try {
        const encryptedData = await getText(url);
        if (!encryptedData) throw new Error('No data');
        const decryptedData = await decryptVideoEasy(encryptedData, tmdbId);
        return formatStreamsForNuvio(decryptedData, serverName, serverConfig, { title, year });
    } catch (error) {
        return [];
    }
}

// Main function
async function getVideasyStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[Videasy] Starting extraction for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    try {
        const mediaDetails = await fetchMediaDetails(tmdbId, mediaType);
        const serverPromises = Object.keys(SERVERS).map(serverName =>
            fetchFromServer(serverName, SERVERS[serverName], mediaDetails.mediaType, mediaDetails.title, mediaDetails.year, tmdbId, mediaDetails.imdbId, seasonNum, episodeNum)
        );
        const results = await Promise.all(serverPromises);
        const allStreams = results.flat();

        // Remove duplicates
        const uniqueStreams = [];
        const seenUrls = new Set();
        allStreams.forEach(stream => {
            if (!seenUrls.has(stream.url)) {
                seenUrls.add(stream.url);
                uniqueStreams.push(stream);
            }
        });

        // Sort by quality
        const getQualityValue = (q) => {
            const val = parseInt(q.replace(/p$/, ''));
            if (q === 'Adaptive' || q === 'Auto') return 4000;
            return isNaN(val) ? 0 : val;
        };
        uniqueStreams.sort((a, b) => getQualityValue(b.quality) - getQualityValue(a.quality));

        console.log(`[Videasy] Total streams found: ${uniqueStreams.length}`);
        return uniqueStreams;
    } catch (error) {
        console.error(`[Videasy] Error: ${error.message}`);
        return [];
    }
}

module.exports = {
    getVideasyStreams,
    getStreams: getVideasyStreams
};
