const axios = require('axios');
const cheerio = require('cheerio');

const omhBase = "https://111.90.159.132";
const cinemetaUrl = "https://v3-cinemeta.strem.io/meta";

async function getStreams(type, imdbId, season, episode) {
    try {
        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];

        const { title, year } = meta;
        const searchQuery = `${title}`; // Year might confuse this specific site search
        console.log(`[OnlineMoviesHindi] Searching for: ${searchQuery}`);

        const searchUrl = `${omhBase}/?s=${encodeURIComponent(searchQuery)}&post_type%5B%5D=post&post_type%5B%5D=tv`;
        const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(searchRes.data);

        const results = [];
        $('article').each((i, el) => {
            const link = $(el).find('a').attr('href');
            const resultTitle = $(el).find('p.entry-title').text().trim();
            if (link && resultTitle) {
                results.push({ title: resultTitle, link });
            }
        });

        // Simple fuzzy match or pick first
        const match = results.find(r => r.title.toLowerCase().includes(title.toLowerCase()));
        if (!match) {
            console.log('[OnlineMoviesHindi] No matching results found.');
            return [];
        }

        console.log(`[OnlineMoviesHindi] Found match: ${match.title}`);
        const pageRes = await axios.get(match.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = cheerio.load(pageRes.data);

        const streams = [];

        if (type === 'series') {
            // Series logic
            // Find episode buttons
            const buttons = $$('a.button-shadow');
            buttons.each((i, el) => {
                const text = $$(el).text();
                const href = $$(el).attr('href');

                // Parse S and E
                const seasonMatch = text.match(/S\s*(\d+)/i);
                const episodeMatch = text.match(/Eps\s*(\d+)/i) || text.match(/Episode\s*(\d+)/i);

                const s = seasonMatch ? parseInt(seasonMatch[1]) : 1;
                const e = episodeMatch ? parseInt(episodeMatch[1]) : 1;

                if (s === parseInt(season) && e === parseInt(episode)) {
                    streams.push({
                        name: 'OnlineMoviesHindi',
                        title: `OMH ${text}\n${match.title}`,
                        url: href
                    });
                }
            });

        } else {
            // Movie logic
            // Select last button-shadow
            const buttons = $$('a.button-shadow');
            if (buttons.length > 0) {
                const lastBtn = buttons.last();
                const href = lastBtn.attr('href');
                const text = lastBtn.text();

                if (href) {
                    streams.push({
                        name: 'OnlineMoviesHindi',
                        title: `OMH ${text}\n${match.title}`,
                        url: href
                    });
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[OnlineMoviesHindi] Error: ${e.message}`);
        return [];
    }
}

async function getMetadata(type, id) {
    try {
        const metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
        const { data } = await axios.get(metaUrl);
        if (data && data.meta) {
            return {
                title: data.meta.name,
                year: data.meta.year ? data.meta.year.split('-')[0] : ''
            };
        }
    } catch (e) {
        console.error(`[OnlineMoviesHindi] Metadata error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };
