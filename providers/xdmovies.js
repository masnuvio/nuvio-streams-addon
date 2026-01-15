const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

const BASE_URL = "https://xdmovies.site";
const HEADERS = {
    "x-auth-token": "7297skkihkajwnsgaklakshuwd", // Decoded from Kotlin source
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

// Helper to use curl as a fallback for ECONNRESET
function makeRequestWithCurl(url, headers = {}) {
    try {
        console.log(`[XDMovies] Using curl for: ${url}`);
        // Construct header string
        let headerStr = '';
        for (const [key, value] of Object.entries(headers)) {
            headerStr += ` -H "${key}: ${value}"`;
        }

        const command = `curl -s -L${headerStr} "${url}"`;
        // Increase buffer to 10MB to handle large HTML pages
        const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        return output;
    } catch (error) {
        console.error(`[XDMovies] curl failed: ${error.message}`);
        return null;
    }
}

async function getStreams(tmdbId, type, season, episode) {
    console.log(`[XDMovies] Searching for TMDB ID: ${tmdbId} (${type})`);

    try {
        // 1. Get Metadata from TMDB
        const tmdbKey = 'd131017ccc6e5462a81c9304d21476de';
        let title = '';
        let year = '';

        try {
            const metaUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbKey}`;
            const metaRes = await axios.get(metaUrl);
            title = type === 'movie' ? metaRes.data.title : metaRes.data.name;
            year = (type === 'movie' ? metaRes.data.release_date : metaRes.data.first_air_date)?.split('-')[0];
            console.log(`[XDMovies] Resolved Title: ${title} (${year})`);
        } catch (e) {
            console.error(`[XDMovies] Failed to fetch TMDB metadata: ${e.message}`);
            return [];
        }

        // 2. Search XDMovies
        const searchUrl = `${BASE_URL}/php/search_api.php?query=${encodeURIComponent(title)}&fuzzy=true`;
        let searchData;

        try {
            const searchRes = await axios.get(searchUrl, { headers: HEADERS });
            searchData = searchRes.data;
        } catch (error) {
            console.warn(`[XDMovies] Axios search failed: ${error.message}. Trying curl...`);
            const curlOutput = makeRequestWithCurl(searchUrl, HEADERS);
            if (curlOutput) {
                try {
                    searchData = JSON.parse(curlOutput);
                } catch (e) {
                    console.error(`[XDMovies] Failed to parse curl output: ${e.message}`);
                }
            }
        }

        if (!searchData || !Array.isArray(searchData)) {
            console.log(`[XDMovies] No results found for: ${title}`);
            return [];
        }

        // 3. Find exact match by TMDB ID
        let match = searchData.find(item => item.tmdb_id == tmdbId);

        // Fallback: Match by title and year if TMDB ID mismatch
        if (!match) {
            console.log(`[XDMovies] No exact TMDB ID match. Trying fuzzy title match...`);
            match = searchData.find(item =>
                item.title.toLowerCase() === title.toLowerCase() &&
                (item.release_year == year || !year)
            );
        }

        if (!match) {
            console.log(`[XDMovies] No matching content found.`);
            return [];
        }

        console.log(`[XDMovies] Found match: ${match.title} (Path: ${match.path})`);

        // 4. Load Detail Page
        const detailUrl = BASE_URL + match.path;
        let htmlContent;

        try {
            const detailRes = await axios.get(detailUrl, { headers: HEADERS });
            htmlContent = detailRes.data;
        } catch (error) {
            console.warn(`[XDMovies] Axios detail page failed: ${error.message}. Trying curl...`);
            htmlContent = makeRequestWithCurl(detailUrl, HEADERS);
        }

        if (!htmlContent) {
            console.error(`[XDMovies] Failed to load detail page content.`);
            return [];
        }

        const $ = cheerio.load(htmlContent);
        const streams = [];

        if (type === 'movie') {
            // Extract Movie Links
            $('div.download-item a').each((i, el) => {
                const link = $(el).attr('href');
                const text = $(el).text().trim(); // e.g., "Download 1080p"
                if (link) {
                    streams.push({
                        name: `XDMovies - ${text}`,
                        title: `${title} - ${text}`,
                        url: link,
                        behaviorHints: {
                            notWebReady: true // Usually direct download links
                        }
                    });
                }
            });
        } else if (type === 'series' || type === 'tv') {
            // Extract TV Episode Links
            console.log(`[XDMovies] Looking for Season ${season}, Episode ${episode}`);

            $('.season-section').each((i, section) => {
                $(section).find('.episode-card').each((j, card) => {
                    const epTitle = $(card).find('.episode-title').text().trim();
                    const regex = new RegExp(`S0?${season}E0?${episode}`, 'i');

                    if (regex.test(epTitle) || epTitle.includes(`Episode ${episode}`)) {
                        $(card).find('a').each((k, linkEl) => {
                            const link = $(linkEl).attr('href');
                            const quality = $(linkEl).text().trim();
                            if (link) {
                                streams.push({
                                    name: `XDMovies S${season}E${episode} - ${quality}`,
                                    title: `${title} S${season}E${episode}`,
                                    url: link
                                });
                            }
                        });
                    }
                });
            });
        }

        console.log(`[XDMovies] Found ${streams.length} streams.`);
        return streams;

    } catch (error) {
        console.error(`[XDMovies] Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
