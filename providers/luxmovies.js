const axios = require('axios');
const cheerio = require('cheerio');

const luxBase = "https://luxmovies.tax";
const cinemetaUrl = "https://v3-cinemeta.strem.io/meta";

const headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "cookie": "xla=s4t",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Microsoft Edge\";v=\"120\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Linux\"",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
};

async function getStreams(type, imdbId, season, episode) {
    try {
        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];

        const { title, year } = meta;
        const searchQuery = `${title} ${year}`;
        console.log(`[LuxMovies] Searching for: ${searchQuery}`);

        const searchUrl = `${luxBase}/page/1/?s=${encodeURIComponent(searchQuery)}`;
        const searchRes = await axios.get(searchUrl, { headers });
        const $ = cheerio.load(searchRes.data);

        const results = [];
        $('article.entry').each((i, el) => {
            const link = $(el).find('a').attr('href');
            const resultTitle = $(el).find('h2 > a').text().replace('Download ', '');
            if (link && resultTitle) {
                results.push({ title: resultTitle, link });
            }
        });

        // Simple fuzzy match or pick first
        const match = results.find(r => r.title.includes(title));
        if (!match) {
            console.log('[LuxMovies] No matching results found.');
            return [];
        }

        console.log(`[LuxMovies] Found match: ${match.title}`);
        const pageRes = await axios.get(match.link, { headers });
        const $$ = cheerio.load(pageRes.data);

        const streams = [];

        if (type === 'series') {
            // Series logic
            // Find quality tags (h3/h5) -> next p -> a tags
            const hTags = $$('h3, h5').filter((i, el) => {
                const text = $$(el).text();
                return (text.includes('4K') || text.match(/[0-9]*0p/)) && !text.includes('Zip');
            });

            for (let i = 0; i < hTags.length; i++) {
                const tag = hTags[i];
                const tagText = $$(tag).text();

                // Extract season from tag or title
                const seasonMatch = tagText.match(/(?:Season |S)(\d+)/i) || match.title.match(/(?:Season |S)(\d+)/i);
                const realSeason = seasonMatch ? parseInt(seasonMatch[1]) : 1; // Default to 1 if not found

                if (realSeason === parseInt(season)) {
                    let nextEl = $$(tag).next();
                    let aTags = [];
                    if (nextEl.is('p')) {
                        aTags = nextEl.find('a');
                    } else {
                        aTags = $$(tag).find('a');
                    }

                    // Find the correct link (V-Cloud, Episode, Download)
                    let targetLink = null;
                    aTags.each((j, el) => {
                        const text = $$(el).text();
                        if (text.match(/V-Cloud|Episode|Download/i)) {
                            targetLink = $$(el).attr('href');
                            return false; // break
                        }
                    });

                    if (!targetLink) {
                        aTags.each((j, el) => {
                            if ($$(el).text().match(/G-Direct/i)) {
                                targetLink = $$(el).attr('href');
                                return false;
                            }
                        });
                    }

                    if (targetLink) {
                        // Fetch the intermediate page
                        const intermediateRes = await axios.get(targetLink, { headers });
                        const $$$ = cheerio.load(intermediateRes.data);

                        const vcloudLinks = [];
                        $$$('p > a').each((k, el) => {
                            const href = $$$(el).attr('href');
                            if (href && href.includes('vcloud')) {
                                vcloudLinks.push(href);
                            }
                        });

                        if (vcloudLinks.length >= episode) {
                            const epLink = vcloudLinks[episode - 1];
                            streams.push({
                                name: 'LuxMovies',
                                title: `LuxMovies ${tagText}\n${match.title}`,
                                url: epLink
                            });
                        }
                    }
                }
            }

        } else {
            // Movie logic
            const buttons = $$('p > a:has(button)');
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const href = $$(btn).attr('href');
                const text = $$(btn).text();

                if (href) {
                    // Fetch intermediate page
                    const intermediateRes = await axios.get(href, { headers });
                    const $$$ = cheerio.load(intermediateRes.data);
                    const vcloudLink = $$$('a:contains(V-Cloud)').attr('href');

                    if (vcloudLink) {
                        streams.push({
                            name: 'LuxMovies',
                            title: `LuxMovies ${text}\n${match.title}`,
                            url: vcloudLink
                        });
                    }
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[LuxMovies] Error: ${e.message}`);
        return [];
    }
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
        console.error(`[LuxMovies] Metadata error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };
