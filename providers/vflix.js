const axios = require('axios');

const VFLIX_BASE_URL = 'https://stream.vflix.life/stremio/stream';
const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getStreams(tmdbId, type, season = null, episode = null) {
    try {
        let imdbId = null;

        // Convert TMDB ID to IMDb ID
        if (TMDB_API_KEY) {
            try {
                const externalIdsUrl = `${TMDB_API_URL}/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
                const response = await axios.get(externalIdsUrl);
                if (response.data && response.data.imdb_id) {
                    imdbId = response.data.imdb_id;
                }
            } catch (error) {
                console.error(`[VFlix] Error converting TMDB ID to IMDb ID: ${error.message}`);
            }
        }

        if (!imdbId) {
            console.log(`[VFlix] Could not find IMDb ID for TMDB ${tmdbId}. VFlix requires IMDb ID.`);
            return [];
        }

        let streamUrl;
        if (type === 'movie') {
            streamUrl = `${VFLIX_BASE_URL}/movie/${imdbId}.json`;
        } else if (type === 'series' || type === 'tv') {
            if (!season || !episode) {
                return [];
            }
            streamUrl = `${VFLIX_BASE_URL}/series/${imdbId}:${season}:${episode}.json`;
        } else {
            return [];
        }

        console.log(`[VFlix] Fetching streams from: ${streamUrl}`);
        const response = await axios.get(streamUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000 // 15 second timeout
        });

        if (response.data && response.data.streams && Array.isArray(response.data.streams)) {
            console.log(`[VFlix] Found ${response.data.streams.length} streams`);

            // Process streams to ensure they match Stremio format and have good titles
            return response.data.streams.map(stream => {
                // VFlix streams usually have good metadata already
                return {
                    name: stream.name || 'VFlix',
                    title: stream.title || stream.name,
                    url: stream.url,
                    behaviorHints: stream.behaviorHints || {}
                };
            });
        }

        return [];

    } catch (error) {
        console.error(`[VFlix] Error fetching streams: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
