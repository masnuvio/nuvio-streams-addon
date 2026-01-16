const axios = require('axios');
const cheerio = require('cheerio');

const gdIndexBase = "https://a.111477.xyz";

async function getStreams(type, imdbId, season, episode) {
    try {
        // For GDIndex, we don't have a direct search API. We rely on listing directories.
        // We need to find the folder that matches the title.

        // 1. Get Metadata to know the title
        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];
        const { title, year } = meta;

        console.log(`[GDIndex] Searching for: ${title}`);

        // 2. List root directory
        const rootUrl = `${gdIndexBase}/`;
        const rootRes = await axios.get(rootUrl);
        const $ = cheerio.load(rootRes.data);

        const folders = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text();
            // Filter out parent directory links and non-folders if possible (trailing slash usually indicates folder)
            if (href && href !== '../' && text.endsWith('/')) {
                folders.push({
                    name: text.replace(/\/$/, ''), // Remove trailing slash for matching
                    path: href
                });
            }
        });

        // 3. Fuzzy match title
        // Simple inclusion match
        const match = folders.find(f => f.name.toLowerCase().includes(title.toLowerCase()));

        if (!match) {
            console.log('[GDIndex] No matching folder found.');
            return [];
        }

        console.log(`[GDIndex] Found match: ${match.name}`);

        // 4. Crawl the matched folder
        const streams = [];
        const folderUrl = `${gdIndexBase}/${match.path}`;

        if (type === 'movie') {
            // Look for video files in this folder or subfolders
            await crawlForVideos(folderUrl, streams, title);
        } else {
            // Series logic
            // We need to find the season folder or episodes
            // This can be complex if structure varies.
            // Let's try to find "Season X" folders or just crawl everything and filter by SxxExx
            await crawlForVideos(folderUrl, streams, title, season, episode);
        }

        return streams;

    } catch (e) {
        console.error(`[GDIndex] Error: ${e.message}`);
        return [];
    }
}

async function crawlForVideos(url, streams, title, season = null, episode = null) {
    try {
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);

        const items = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text();
            if (href && href !== '../') {
                items.push({ text, href });
            }
        });

        for (const item of items) {
            const fullPath = url + item.href; // url ends with / usually, href might be relative
            // Construct absolute URL properly
            // If url is https://base/Folder/, item.href is Subfolder/
            // We need to be careful with slashes.
            // Cheerio/Axios usually gives relative hrefs.

            // Let's assume simple concatenation works if we ensure trailing slash on parent
            const itemUrl = url.endsWith('/') ? url + item.href : url + '/' + item.href;

            if (item.text.endsWith('/')) {
                // It's a folder, recurse
                // Limit recursion depth?
                await crawlForVideos(itemUrl, streams, title, season, episode);
            } else if (item.text.match(/\.(mp4|mkv|avi)$/i)) {
                // It's a video file
                // Check if it matches our criteria

                if (season && episode) {
                    // Check for SxxExx
                    const sMatch = item.text.match(/S(\d+)/i) || item.text.match(/Season\s*(\d+)/i);
                    const eMatch = item.text.match(/E(\d+)/i) || item.text.match(/Episode\s*(\d+)/i);

                    const fileSeason = sMatch ? parseInt(sMatch[1]) : null;
                    const fileEpisode = eMatch ? parseInt(eMatch[1]) : null;

                    if (fileSeason === parseInt(season) && fileEpisode === parseInt(episode)) {
                        streams.push({
                            name: 'GDIndex',
                            title: `GDIndex\n${item.text}`,
                            url: itemUrl
                        });
                    }
                } else {
                    // Movie - just add it
                    streams.push({
                        name: 'GDIndex',
                        title: `GDIndex\n${item.text}`,
                        url: itemUrl
                    });
                }
            }
        }
    } catch (e) {
        console.error(`[GDIndex] Crawl error for ${url}: ${e.message}`);
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
        console.error(`[GDIndex] Metadata error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };
