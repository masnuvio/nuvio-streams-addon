const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = "https://xdmovies.site";
const HEADERS = {
    "x-auth-token": "7297skkihkajwnsgaklakshuwd", // Decoded from Kotlin source
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

async function getStreams(tmdbId, type, season, episode) {
    console.log(`[XDMovies] Searching for TMDB ID: ${tmdbId} (${type})`);

    try {
        // 1. Get Metadata from TMDB to get the title (XDMovies search requires title)
        // We can use the addon's existing metadata or fetch it. 
        // For simplicity, we'll assume we need to fetch it or use a passed title if available.
        // Since getStreams signature only has IDs, we fetch from TMDB.
        const tmdbKey = 'd131017ccc6e5462a81c9304d21476de'; // Using key from other providers
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
        const searchRes = await axios.get(searchUrl, { headers: HEADERS });

        if (!searchRes.data || !Array.isArray(searchRes.data)) {
            console.log(`[XDMovies] No results found for: ${title}`);
            return [];
        }

        // 3. Find exact match by TMDB ID
        let match = searchRes.data.find(item => item.tmdb_id == tmdbId);

        // Fallback: Match by title and year if TMDB ID mismatch
        if (!match) {
            console.log(`[XDMovies] No exact TMDB ID match. Trying fuzzy title match...`);
            match = searchRes.data.find(item =>
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
        const detailRes = await axios.get(detailUrl, { headers: HEADERS });
        const $ = cheerio.load(detailRes.data);
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

            // Logic from Kotlin: Find season section, then episode card
            // Selector might need adjustment based on actual HTML structure
            // Kotlin: seasonSection.select(".episode-card")

            // Simple approach: Iterate all season sections
            $('.season-section').each((i, section) => {
                const seasonText = $(section).find('h3, .season-title').text(); // Guessing selector
                // Or try to find season number from button/header
                // Kotlin uses regex on "season-episodes-X" class or text

                // Let's try to find the specific episode card directly if possible
                // Or iterate all links and parse text "S01E01"

                $(section).find('.episode-card').each((j, card) => {
                    const epTitle = $(card).find('.episode-title').text().trim();
                    // Parse S01E01
                    const regex = new RegExp(`S0?${season}E0?${episode}`, 'i');

                    if (regex.test(epTitle) || epTitle.includes(`Episode ${episode}`)) {
                        // Found the episode
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
