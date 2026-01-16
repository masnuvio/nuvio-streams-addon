const axios = require('axios');
const cheerio = require('cheerio');

const bollyflixBase = "https://bollyflix.do";
const cinemetaUrl = "https://v3-cinemeta.strem.io/meta";

async function getStreams(type, imdbId, season, episode) {
    try {
        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];

        const { title, year } = meta;
        const searchQuery = `${title} ${year}`;
        console.log(`[Bollyflix] Searching for: ${searchQuery}`);

        const searchUrl = `${bollyflixBase}/search/${encodeURIComponent(searchQuery)}`;
        const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(searchRes.data);

        const results = [];
        $('div.post-cards > article').each((i, el) => {
            const link = $(el).find('a').attr('href');
            const resultTitle = $(el).find('a').attr('title').replace('Download ', '');
            if (link && resultTitle) {
                results.push({ title: resultTitle, link });
            }
        });

        // Simple fuzzy match or pick first
        const match = results.find(r => r.title.includes(title));
        if (!match) {
            console.log('[Bollyflix] No matching results found.');
            return [];
        }

        console.log(`[Bollyflix] Found match: ${match.title}`);
        const pageRes = await axios.get(match.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = cheerio.load(pageRes.data);

        const streams = [];

        if (type === 'series') {
            // Series logic
            // Find buttons for the specific season
            // This is complex as per Kotlin code: buttons -> bypass -> season page -> episode links
            // For now, implementing a simplified version or placeholder if too complex without more context
            console.log('[Bollyflix] Series support is experimental.');

            // Logic: Find season buttons
            // Kotlin: button.parent()?.previousElementSibling()?.text() -> Season X
            // Then bypass(id) -> season page -> h3 > a (episodes)

            const buttons = $$('a.maxbutton-download-links, a.dl, a.btnn');
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const href = $$(btn).attr('href');
                if (!href || !href.includes('id=')) continue;

                // Check season
                const seasonText = $$(btn).parent().prev().text(); // Heuristic
                const seasonMatch = seasonText.match(/Season\s*(\d+)/i) || $$(btn).text().match(/Season\s*(\d+)/i);

                if (seasonMatch && parseInt(seasonMatch[1]) === parseInt(season)) {
                    const id = href.split('id=')[1];
                    const seasonPageUrl = await bypass(id);
                    if (seasonPageUrl) {
                        const seasonRes = await axios.get(seasonPageUrl);
                        const $$$ = cheerio.load(seasonRes.data);
                        const epLinks = $$$('h3 > a');

                        epLinks.each((j, epEl) => {
                            const epText = $$$(epEl).text();
                            // Heuristic for episode matching
                            // Usually "Episode 1", "E01", etc.
                            if (epText.includes(`Episode ${episode}`) || epText.includes(`E${episode}`) || epText.includes(`Ep${episode}`)) {
                                const epHref = $$$(epEl).attr('href');
                                streams.push({
                                    name: 'Bollyflix',
                                    title: `Bollyflix ${epText}`,
                                    url: epHref // This might need further extraction if it's not a direct link
                                });
                            }
                        });
                    }
                }
            }

        } else {
            // Movie logic
            const buttons = $$('a.dl');
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const href = $$(btn).attr('href');
                const text = $$(btn).text();

                if (href && href.includes('id=')) {
                    const id = href.split('id=')[1];
                    const finalLink = await bypass(id);
                    if (finalLink) {
                        streams.push({
                            name: 'Bollyflix',
                            title: `Bollyflix ${text}\n${match.title}`,
                            url: finalLink
                        });
                    }
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[Bollyflix] Error: ${e.message}`);
        return [];
    }
}

async function bypass(id) {
    try {
        const url = `https://web.sidexfee.com/?id=${id}`;
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const match = res.data.match(/link":"([^"]+)"/);
        if (match && match[1]) {
            const encoded = match[1].replace(/\\/g, '');
            return Buffer.from(encoded, 'base64').toString('utf-8');
        }
    } catch (e) {
        console.error(`[Bollyflix] Bypass error: ${e.message}`);
    }
    return null;
}

async function getMetadata(type, id) {
    try {
        const { data } = await axios.get(`${cinemetaUrl}/${type}/${id}.json`);
        if (data && data.meta) {
            return {
                title: data.meta.name,
                year: data.meta.year ? data.meta.year.split('-')[0] : ''
            };
        }
    } catch (e) {
        console.error(`[Bollyflix] Metadata error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };
