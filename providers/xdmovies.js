const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');
const bytes = require('bytes');
const rot13Cipher = require('rot13-cipher');

const BASE_URL = "https://xdmovies.site";
const HEADERS = {
    "x-auth-token": "7297skkihkajwnsgaklakshuwd",
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

// Polyfill for atob
const atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Helper to use curl as a fallback for ECONNRESET
function makeRequestWithCurl(url, headers = {}) {
    try {
        // console.log(`[XDMovies] Using curl for: ${url}`);
        let headerStr = '';
        for (const [key, value] of Object.entries(headers)) {
            headerStr += ` -H "${key}: ${value}"`;
        }

        const command = `curl -s -L${headerStr} "${url}"`;
        const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        return output;
    } catch (error) {
        console.error(`[XDMovies] curl failed: ${error.message}`);
        return null;
    }
}

// Helper to resolve final URL after redirects
function resolveFinalUrl(url) {
    try {
        const command = `curl -Ls -o /dev/null -w %{url_effective} "${url}"`;
        return execSync(command, { encoding: 'utf8' }).trim();
    } catch (error) {
        console.error(`[XDMovies] Failed to resolve final URL: ${error.message}`);
        return url;
    }
}

// HubCloud Extractor Logic (Adapted from 4KHDHub)
async function extractHubCloud(hubCloudUrl, baseMeta) {
    if (!hubCloudUrl) return [];

    console.log(`[XDMovies] Extracting HubCloud: ${hubCloudUrl}`);

    // 1. Fetch the HubCloud page (which contains the redirect logic)
    // We use the hubCloudUrl as Referer
    const headers = { ...HEADERS, Referer: hubCloudUrl };
    const redirectHtml = makeRequestWithCurl(hubCloudUrl, headers);

    if (!redirectHtml) return [];

    // 2. Find the 'var url = ...' pattern
    const redirectUrlMatch = redirectHtml.match(/var url ?= ?'(.*?)'/);
    if (!redirectUrlMatch) return [];

    const finalLinksUrl = redirectUrlMatch[1];
    console.log(`[XDMovies] Found final links URL: ${finalLinksUrl}`);

    // 3. Fetch the final links page
    const linksHtml = makeRequestWithCurl(finalLinksUrl, headers);
    if (!linksHtml) return [];

    const $ = cheerio.load(linksHtml);
    const results = [];
    const sizeText = $('#size').text();
    const titleText = $('title').text().trim();

    const currentMeta = {
        ...baseMeta,
        bytes: bytes.parse(sizeText) || baseMeta.bytes,
        title: titleText || baseMeta.title
    };

    // 4. Extract FSL / PixelServer links
    $('a').each((_i, el) => {
        const text = $(el).text();
        const href = $(el).attr('href');
        if (!href) return;

        if (text.includes('FSL') || text.includes('Download File') || text.includes('Fast Server')) {
            results.push({
                name: `XDMovies - FSL ${currentMeta.height ? currentMeta.height + 'p' : ''}`,
                title: `${currentMeta.title}\n${bytes.format(currentMeta.bytes || 0)}`,
                url: href,
                behaviorHints: {
                    notWebReady: true,
                    bingeGroup: `xdmovies-fsl`
                }
            });
        }
        else if (text.includes('PixelServer')) {
            const pixelUrl = href.replace('/u/', '/api/file/');
            results.push({
                name: `XDMovies - Pixel ${currentMeta.height ? currentMeta.height + 'p' : ''}`,
                title: `${currentMeta.title}\n${bytes.format(currentMeta.bytes || 0)}`,
                url: pixelUrl,
                behaviorHints: {
                    notWebReady: true,
                    bingeGroup: `xdmovies-pixel`
                }
            });
        }
    });

    return results;
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
            console.warn(`[XDMovies] Axios TMDB fetch failed: ${e.message}. Trying curl...`);
            try {
                const metaUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbKey}`;
                const curlOutput = makeRequestWithCurl(metaUrl);
                if (curlOutput) {
                    const data = JSON.parse(curlOutput);
                    title = type === 'movie' ? data.title : data.name;
                    year = (type === 'movie' ? data.release_date : data.first_air_date)?.split('-')[0];
                    console.log(`[XDMovies] Resolved Title (via curl): ${title} (${year})`);
                } else {
                    throw new Error("Curl returned empty response");
                }
            } catch (curlErr) {
                console.error(`[XDMovies] Failed to fetch TMDB metadata: ${curlErr.message}`);
                return [];
            }
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
        const linksToProcess = [];

        if (type === 'movie') {
            // Extract Movie Links
            $('div.download-item a').each((i, el) => {
                const link = $(el).attr('href');
                const text = $(el).text().trim(); // e.g., "Download 1080p"
                if (link) {
                    linksToProcess.push({ link, text });
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
                                linksToProcess.push({ link, text: quality });
                            }
                        });
                    }
                });
            });
        }

        console.log(`[XDMovies] Found ${linksToProcess.length} intermediate links. Processing...`);

        // Process links (resolve to HubCloud -> extract)
        for (const item of linksToProcess) {
            try {
                // Resolve the intermediate link (e.g., link.xdmovies.site -> hubcloud.fans)
                const finalUrl = resolveFinalUrl(item.link);

                if (finalUrl && finalUrl.includes('hubcloud')) {
                    // Extract quality from text if possible
                    let height = 0;
                    const heightMatch = item.text.match(/(\d{3,4})p/i);
                    if (heightMatch) height = parseInt(heightMatch[1]);

                    const baseMeta = {
                        title: title,
                        year: year,
                        height: height,
                        bytes: 0 // Will be updated by extractHubCloud
                    };

                    const extractedStreams = await extractHubCloud(finalUrl, baseMeta);
                    streams.push(...extractedStreams);
                } else {
                    console.log(`[XDMovies] Resolved URL is not HubCloud: ${finalUrl}`);
                }
            } catch (err) {
                console.error(`[XDMovies] Error processing link ${item.link}: ${err.message}`);
            }
        }

        console.log(`[XDMovies] Found ${streams.length} final streams.`);
        return streams;

    } catch (error) {
        console.error(`[XDMovies] Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
