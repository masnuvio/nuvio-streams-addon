const axios = require('axios');

// Constants
const rezkaBase = 'https://hdrezka.ag/';
const baseHeaders = {
    'X-Hdrezka-Android-App': '1',
    'X-Hdrezka-Android-App-Version': '2.2.0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Helper functions
function generateRandomFavs() {
    const randomHex = () => Math.floor(Math.random() * 16).toString(16);
    const generateSegment = (length) => Array.from({ length }, randomHex).join('');
    return `${generateSegment(8)}-${generateSegment(4)}-${generateSegment(4)}-${generateSegment(4)}-${generateSegment(12)}`;
}

function extractTitleAndYear(input) {
    const regex = /^(.*?),.*?(\d{4})/;
    const match = input.match(regex);
    if (match) {
        return { title: match[1].trim(), year: match[2] ? parseInt(match[2], 10) : null };
    }
    return null;
}

function parseVideoLinks(inputString) {
    if (!inputString) return {};
    const linksArray = inputString.split(',');
    const result = {};

    linksArray.forEach((link) => {
        let match = link.match(/\[([^<\]]+)\](https?:\/\/[^\s,]+\.mp4|null)/);
        if (!match) {
            const qualityMatch = link.match(/\[<span[^>]*>([^<]+)/);
            const urlMatch = link.match(/\][^[]*?(https?:\/\/[^\s,]+\.mp4|null)/);
            if (qualityMatch && urlMatch) {
                match = [null, qualityMatch[1].trim(), urlMatch[1]];
            }
        }

        if (match) {
            const qualityText = match[1].trim();
            const mp4Url = match[2];
            if (mp4Url !== 'null') {
                result[qualityText] = { type: 'mp4', url: mp4Url };
            }
        }
    });
    return result;
}

async function searchAndFindMediaId(title, year, type) {
    try {
        const searchUrl = `${rezkaBase}engine/ajax/search.php`;
        const response = await axios.get(searchUrl, {
            params: { q: title },
            headers: baseHeaders
        });

        const searchData = response.data;
        const itemRegexPattern = /<a href="([^"]+)"><span class="enty">([^<]+)<\/span> \(([^)]+)\)/g;
        const idRegexPattern = /\/(\d+)-[^/]+\.html$/;

        let match;
        while ((match = itemRegexPattern.exec(searchData)) !== null) {
            const url = match[1];
            const titleAndYear = match[3];
            const result = extractTitleAndYear(titleAndYear);

            if (result) {
                const id = url.match(idRegexPattern)?.[1];
                const isMovie = url.includes('/films/');
                const isShow = url.includes('/series/');
                const itemType = isMovie ? 'movie' : isShow ? 'tv' : 'unknown';

                // Simple matching logic
                if (itemType === type && (!year || result.year === year)) {
                    return { id, url, type: itemType };
                }
            }
        }
        return null;
    } catch (error) {
        console.error(`[HDRezka] Search error: ${error.message}`);
        return null;
    }
}

async function getTranslatorId(url, id, type) {
    try {
        const fullUrl = url.startsWith('http') ? url : `${rezkaBase}${url.startsWith('/') ? url.substring(1) : url}`;
        const response = await axios.get(fullUrl, { headers: baseHeaders });
        const responseText = response.data;

        if (responseText.includes(`data-translator_id="238"`)) {
            return '238';
        }

        const functionName = type === 'movie' ? 'initCDNMoviesEvents' : 'initCDNSeriesEvents';
        const regexPattern = new RegExp(`sof\\.tv\\.${functionName}\\(${id}, ([^,]+)`, 'i');
        const match = responseText.match(regexPattern);
        return match ? match[1] : null;
    } catch (error) {
        console.error(`[HDRezka] Translator ID error: ${error.message}`);
        return null;
    }
}

async function getStream(id, translatorId, type, season, episode) {
    try {
        const params = new URLSearchParams();
        params.append('id', id);
        params.append('translator_id', translatorId);

        if (type === 'tv') {
            params.append('season', season);
            params.append('episode', episode);
        }

        params.append('favs', generateRandomFavs());
        params.append('action', type === 'tv' ? 'get_stream' : 'get_movie');

        const response = await axios.post(`${rezkaBase}ajax/get_cdn_series/`, params.toString(), {
            headers: {
                ...baseHeaders,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!parsedResponse.url) return null;

        const qualities = parseVideoLinks(parsedResponse.url);
        return qualities;
    } catch (error) {
        console.error(`[HDRezka] Stream error: ${error.message}`);
        return null;
    }
}

const getHdrezkaStreams = async (tmdbId, type, season = 1, episode = 1) => {
    // We need title and year. Since we only have TMDB ID, we need to fetch metadata first.
    // Assuming the caller might pass title/year or we fetch it here.
    // For now, let's fetch from TMDB if possible, or skip if we can't.
    // But wait, the aggregator passes tmdbId.

    // Fetch TMDB info
    const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c'; // Using key from Showbox.js
    let title, year;

    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await axios.get(tmdbUrl);
        title = type === 'movie' ? tmdbRes.data.title : tmdbRes.data.name;
        const date = type === 'movie' ? tmdbRes.data.release_date : tmdbRes.data.first_air_date;
        year = date ? parseInt(date.split('-')[0]) : null;
    } catch (e) {
        console.error(`[HDRezka] Failed to fetch TMDB info: ${e.message}`);
        return [];
    }

    console.log(`[HDRezka] Searching for ${title} (${year})`);
    const media = await searchAndFindMediaId(title, year, type);
    if (!media) return [];

    const translatorId = await getTranslatorId(media.url, media.id, type);
    if (!translatorId) return [];

    const qualities = await getStream(media.id, translatorId, type, season, episode);
    if (!qualities) return [];

    return Object.entries(qualities).map(([quality, data]) => ({
        name: 'HDRezka',
        title: `${title} - ${quality}`,
        url: data.url,
        quality: quality
    }));
};

module.exports = { getHdrezkaStreams };
