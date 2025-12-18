/**
 * MoviesMod Provider for Stremio Addon
 * Supports both movies and TV series
 */

const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const { CookieJar } = require('tough-cookie');
const { URLSearchParams, URL } = require('url');
const fs = require('fs').promises;
const path = require('path');
const { findBestMatch } = require('string-similarity');
const RedisCache = require('../utils/redisCache');
const { followRedirectToFilePage, extractFinalDownloadFromFilePage } = require('../utils/linkResolver');

// Dynamic import for axios-cookiejar-support
let axiosCookieJarSupport = null;
const getAxiosCookieJarSupport = async () => {
    if (!axiosCookieJarSupport) {
        axiosCookieJarSupport = await import('axios-cookiejar-support');
    }
    return axiosCookieJarSupport;
};
const CACHE_ENABLED = process.env.DISABLE_CACHE !== 'true';
console.log(`[MoviesMod Cache] Internal cache is ${CACHE_ENABLED ? 'enabled' : 'disabled'}.`);
const CACHE_DIR = process.env.VERCEL ? path.join('/tmp', '.moviesmod_cache') : path.join(__dirname, '.cache', 'moviesmod');

// Initialize Redis cache
const redisCache = new RedisCache('MoviesMod');

// --- Caching Helper Functions ---
const ensureCacheDir = async () => {
    if (!CACHE_ENABLED) return;
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`[MoviesMod Cache] Error creating cache directory: ${error.message}`);
        }
    }
};

const getFromCache = async (key) => {
    if (!CACHE_ENABLED) return null;

    // Try Redis cache first, then fallback to file system
    const cachedData = await redisCache.getFromCache(key, '', CACHE_DIR);
    if (cachedData) {
        return cachedData.data || cachedData; // Support both new format (data field) and legacy format
    }

    return null;
};

const saveToCache = async (key, data) => {
    if (!CACHE_ENABLED) return;

    const cacheData = {
        data: data
    };

    // Save to both Redis and file system
    await redisCache.saveToCache(key, cacheData, '', CACHE_DIR);
};

// Initialize cache directory on startup
ensureCacheDir();

const MOVIESMOD_PROXY_URL = process.env.MOVIESMOD_PROXY_URL || '';

async function getMoviesModDomain() {
    try {
        const domainsPath = path.join(__dirname, '..', 'domains.json');
        const domainsData = await fs.readFile(domainsPath, 'utf8');
        const domains = JSON.parse(domainsData);
        return domains.moviesmod || 'https://moviesmod.bid';
    } catch (e) {
        console.warn('[MoviesMod] Could not load domains.json, using default');
        return 'https://moviesmod.bid';
    }
}

// Proxy wrapper function
const makeRequest = async (url, options = {}) => {
    console.log(`[MoviesMod] Requesting: ${url}`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers
    };

    const config = {
        ...options,
        headers
    };

    if (MOVIESMOD_PROXY_URL) {
        // Route through proxy
        const proxiedUrl = `${MOVIESMOD_PROXY_URL}${encodeURIComponent(url)}`;
        console.log(`[MoviesMod] Making proxied request to: ${url}`);
        return axios.get(proxiedUrl, config);
    } else {
        // Direct request
        console.log(`[MoviesMod] Making direct request to: ${url}`);
        return axios.get(url, config);
    }
};

// Helper function to create a proxied session for SID resolution
const createProxiedSession = async (jar) => {
    const { wrapper } = await getAxiosCookieJarSupport();

    const sessionConfig = {
        jar,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    };

    const session = wrapper(axios.create(sessionConfig));

    // Helper function to extract cookies from jar for a given URL
    const getCookiesForUrl = async (url) => {
        try {
            const cookies = await jar.getCookies(url);
            return cookies.map(cookie => `${cookie.key}=${cookie.value}`).join('; ');
        } catch (error) {
            console.error(`[MoviesMod] Error getting cookies for ${url}: ${error.message}`);
            return '';
        }
    };

    // If proxy is enabled, wrap the session methods to use proxy
    if (MOVIESMOD_PROXY_URL) {
        console.log(`[MoviesMod] Creating SID session with proxy: ${MOVIESMOD_PROXY_URL}`);
        const originalGet = session.get.bind(session);
        const originalPost = session.post.bind(session);

        session.get = async (url, options = {}) => {
            const proxiedUrl = `${MOVIESMOD_PROXY_URL}${encodeURIComponent(url)}`;
            console.log(`[MoviesMod] Making proxied SID GET request to: ${url}`);

            // Extract cookies from jar and add to headers
            const cookieString = await getCookiesForUrl(url);
            if (cookieString) {
                console.log(`[MoviesMod] Adding cookies to proxied request: ${cookieString}`);
                options.headers = {
                    ...options.headers,
                    'Cookie': cookieString
                };
            }

            return originalGet(proxiedUrl, options);
        };

        session.post = async (url, data, options = {}) => {
            const proxiedUrl = `${MOVIESMOD_PROXY_URL}${encodeURIComponent(url)}`;
            console.log(`[MoviesMod] Making proxied SID POST request to: ${url}`);

            // Extract cookies from jar and add to headers
            const cookieString = await getCookiesForUrl(url);
            if (cookieString) {
                console.log(`[MoviesMod] Adding cookies to proxied request: ${cookieString}`);
                options.headers = {
                    ...options.headers,
                    'Cookie': cookieString
                };
            }

            return originalPost(proxiedUrl, data, options);
        };
    }

    return session;
};

// Helper function to extract quality from text
function extractQuality(text) {
    if (!text) return 'Unknown';

    const qualityMatch = text.match(/(480p|720p|1080p|2160p|4k)/i);
    if (qualityMatch) {
        return qualityMatch[1];
    }

    // Try to extract from full text
    const cleanMatch = text.match(/(480p|720p|1080p|2160p|4k)[^)]*\)/i);
    if (cleanMatch) {
        return cleanMatch[0];
    }

    return 'Unknown';
}

function parseQualityForSort(qualityString) {
    if (!qualityString) return 0;
    const match = qualityString.match(/(\d{3,4})p/i);
    return match ? parseInt(match[1], 10) : 0;
}

function getTechDetails(qualityString) {
    if (!qualityString) return [];
    const details = [];
    const lowerText = qualityString.toLowerCase();
    if (lowerText.includes('10bit')) details.push('10-bit');
    if (lowerText.includes('hevc') || lowerText.includes('x265')) details.push('HEVC');
    if (lowerText.includes('hdr')) details.push('HDR');
    return details;
}

// Helper to get the MoviesMod domain
async function searchMoviesMod(query) {
    try {
        const baseUrl = await getMoviesModDomain();
        const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
        console.log(`[MoviesMod] Searching URL: ${searchUrl}`);
        const { data } = await makeRequest(searchUrl);
        const $ = cheerio.load(data);

        const results = [];
        $('.latestPost').each((i, element) => {
            const linkElement = $(element).find('a');
            const title = linkElement.attr('title');
            const url = linkElement.attr('href');
            if (title && url) {
                results.push({ title, url });
            }
        });

        if (results.length === 0) {
            console.log(`[MoviesMod] No results found. HTML snippet: ${data.substring(0, 1000)}...`);
            // Try to log what classes ARE present
            const classes = [];
            $('*').each((i, el) => {
                const cls = $(el).attr('class');
                if (cls) classes.push(cls);
            });
            console.log(`[MoviesMod] Classes found: ${[...new Set(classes)].slice(0, 20).join(', ')}`);
        }

        return results;
    } catch (error) {
        console.error(`[MoviesMod] Error searching: ${error.message}`);
        return [];
    }
}

// Extract download links from a movie/series page
async function extractDownloadLinks(moviePageUrl) {
    try {
        console.log(`[MoviesMod] Extracting links from: ${moviePageUrl}`);
        const { data } = await makeRequest(moviePageUrl);
        const $ = cheerio.load(data);
        const links = [];
        const contentBox = $('.thecontent');

        // Get all relevant headers (for movies and TV shows) in document order
        const headers = contentBox.find('h3:contains("Season"), h4');

        headers.each((i, el) => {
            const header = $(el);
            const headerText = header.text().trim();

            // Define the content block for this header
            const blockContent = header.nextUntil('h3, h4');

            if (header.is('h3') && headerText.toLowerCase().includes('season')) {
                // TV Show Logic
                const linkElements = blockContent.find('a.maxbutton-episode-links, a.maxbutton-batch-zip');
                linkElements.each((j, linkEl) => {
                    const buttonText = $(linkEl).text().trim();
                    const linkUrl = $(linkEl).attr('href');
                    if (linkUrl && !buttonText.toLowerCase().includes('batch')) {
                        links.push({
                            quality: `${headerText} - ${buttonText}`,
                            url: linkUrl
                        });
                    }
                });
            } else if (header.is('h4')) {
                // Movie Logic
                const linkElement = blockContent.find('a[href*="modrefer.in"]').first();
                if (linkElement.length > 0) {
                    const link = linkElement.attr('href');
                    const cleanQuality = extractQuality(headerText);
                    links.push({
                        quality: cleanQuality,
                        url: link
                    });
                }
            }
        });

        return links;
    } catch (error) {
        console.error(`[MoviesMod] Error extracting download links: ${error.message}`);
        return [];
    }
}

// Resolve intermediate links (dramadrip, episodes.modpro.blog, modrefer.in)
async function resolveIntermediateLink(initialUrl, refererUrl, quality) {
    try {
        const urlObject = new URL(initialUrl);

        if (urlObject.hostname.includes('dramadrip.com')) {
            const { data: dramaData } = await makeRequest(initialUrl, { headers: { 'Referer': refererUrl } });
            const $$ = cheerio.load(dramaData);

            let episodePageLink = null;
            const seasonMatch = quality.match(/Season \d+/i);
            // Extract the specific quality details, e.g., "1080p x264"
            const specificQualityMatch = quality.match(/(480p|720p|1080p|2160p|4k)[ \w\d-]*/i);

            if (seasonMatch && specificQualityMatch) {
                const seasonIdentifier = seasonMatch[0].toLowerCase();
                // Clean up the identifier to get only the essential parts
                let specificQualityIdentifier = specificQualityMatch[0].toLowerCase().replace(/msubs.*/i, '').replace(/esubs.*/i, '').replace(/\{.*/, '').trim();
                const qualityParts = specificQualityIdentifier.split(/\s+/); // -> ['1080p', 'x264']

                $$('a[href*="episodes.modpro.blog"], a[href*="cinematickit.org"]').each((i, el) => {
                    const link = $$(el);
                    const linkText = link.text().trim().toLowerCase();
                    const seasonHeader = link.closest('.wp-block-buttons').prevAll('h2.wp-block-heading').first().text().trim().toLowerCase();

                    const seasonIsMatch = seasonHeader.includes(seasonIdentifier);
                    // Ensure that the link text contains all parts of our specific quality
                    const allPartsMatch = qualityParts.every(part => linkText.includes(part));

                    if (seasonIsMatch && allPartsMatch) {
                        episodePageLink = link.attr('href');
                        console.log(`[MoviesMod] Found specific match for "${quality}" -> "${link.text().trim()}": ${episodePageLink}`);
                        return false; // Break loop, we found our specific link
                    }
                });
            }

            if (!episodePageLink) {
                console.error(`[MoviesMod] Could not find a specific quality match on dramadrip page for: ${quality}`);
                return [];
            }

            // Pass quality to recursive call
            return await resolveIntermediateLink(episodePageLink, initialUrl, quality);

        } else if (urlObject.hostname.includes('cinematickit.org')) {
            // Handle cinematickit.org pages
            const { data } = await makeRequest(initialUrl, { headers: { 'Referer': refererUrl } });
            const $ = cheerio.load(data);
            const finalLinks = [];

            // Look for episode links on cinematickit.org
            $('a[href*="driveseed.org"]').each((i, el) => {
                const link = $(el).attr('href');
                const text = $(el).text().trim();
                if (link && text && !text.toLowerCase().includes('batch')) {
                    finalLinks.push({
                        server: text.replace(/\s+/g, ' '),
                        url: link,
                    });
                }
            });

            // If no driveseed links found, try other patterns
            if (finalLinks.length === 0) {
                $('a[href*="modrefer.in"], a[href*="dramadrip.com"]').each((i, el) => {
                    const link = $(el).attr('href');
                    const text = $(el).text().trim();
                    if (link && text) {
                        finalLinks.push({
                            server: text.replace(/\s+/g, ' '),
                            url: link,
                        });
                    }
                });
            }

            return finalLinks;

        } else if (urlObject.hostname.includes('episodes.modpro.blog')) {
            const { data } = await makeRequest(initialUrl, { headers: { 'Referer': refererUrl } });
            const $ = cheerio.load(data);
            const finalLinks = [];

            $('.entry-content a[href*="driveseed.org"], .entry-content a[href*="tech.unblockedgames.world"], .entry-content a[href*="tech.creativeexpressionsblog.com"], .entry-content a[href*="tech.examzculture.in"]').each((i, el) => {
                const link = $(el).attr('href');
                const text = $(el).text().trim();
                if (link && text && !text.toLowerCase().includes('batch')) {
                    finalLinks.push({
                        server: text.replace(/\s+/g, ' '),
                        url: link,
                    });
                }
            });
            return finalLinks;
        } else {
            console.warn(`[MoviesMod] Unknown hostname: ${urlObject.hostname}`);
            return [];
        }
    } catch (error) {
        console.error(`[MoviesMod] Error resolving intermediate link: ${error.message}`);
        return [];
    }
}

// Function to resolve tech.unblockedgames.world links to driveleech URLs (adapted from UHDMovies)
async function resolveTechUnblockedLink(sidUrl) {
    console.log(`[MoviesMod] Resolving SID link: ${sidUrl}`);
    const { origin } = new URL(sidUrl);
    const jar = new CookieJar();

    // Create session with proxy support
    const { wrapper } = await getAxiosCookieJarSupport();
    const session = wrapper(axios.create({
        jar,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    }));

    try {
        // Step 0: Get the _wp_http value
        console.log("  [SID] Step 0: Fetching initial page...");
        const responseStep0 = await session.get(sidUrl);
        let $ = cheerio.load(responseStep0.data);
        const initialForm = $('#landing');
        const wp_http_step1 = initialForm.find('input[name="_wp_http"]').val();
        const action_url_step1 = initialForm.attr('action');

        if (!wp_http_step1 || !action_url_step1) {
            console.error("  [SID] Error: Could not find _wp_http in initial form.");
            return null;
        }

        // Step 1: POST to the first form's action URL
        console.log("  [SID] Step 1: Submitting initial form...");
        const step1Data = new URLSearchParams({ '_wp_http': wp_http_step1 });
        const responseStep1 = await session.post(action_url_step1, step1Data, {
            headers: { 'Referer': sidUrl, 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // Step 2: Parse verification page for second form
        console.log("  [SID] Step 2: Parsing verification page...");
        $ = cheerio.load(responseStep1.data);
        const verificationForm = $('#landing');
        const action_url_step2 = verificationForm.attr('action');
        const wp_http2 = verificationForm.find('input[name="_wp_http2"]').val();
        const token = verificationForm.find('input[name="token"]').val();

        if (!action_url_step2) {
            console.error("  [SID] Error: Could not find verification form.");
            return null;
        }

        // Step 3: POST to the verification URL
        console.log("  [SID] Step 3: Submitting verification...");
        const step2Data = new URLSearchParams({ '_wp_http2': wp_http2, 'token': token });
        const responseStep2 = await session.post(action_url_step2, step2Data, {
            headers: { 'Referer': responseStep1.request.res.responseUrl, 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // Step 4: Find dynamic cookie and link from JavaScript
        console.log("  [SID] Step 4: Parsing final page for JS data...");
        let finalLinkPath = null;
        let cookieName = null;
        let cookieValue = null;

        const scriptContent = responseStep2.data;
        const cookieMatch = scriptContent.match(/s_343\('([^']+)',\s*'([^']+)'/);
        const linkMatch = scriptContent.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);

        if (cookieMatch) {
            cookieName = cookieMatch[1].trim();
            cookieValue = cookieMatch[2].trim();
        }
        if (linkMatch) {
            finalLinkPath = linkMatch[1].trim();
        }

        if (!finalLinkPath || !cookieName || !cookieValue) {
            console.error("  [SID] Error: Could not extract dynamic cookie/link from JS.");
            return null;
        }

        const finalUrl = new URL(finalLinkPath, origin).href;
        console.log(`  [SID] Dynamic link found: ${finalUrl}`);
        console.log(`  [SID] Dynamic cookie found: ${cookieName}`);

        // Step 5: Set cookie and make final request
        console.log("  [SID] Step 5: Setting cookie and making final request...");
        await jar.setCookie(`${cookieName}=${cookieValue}`, origin);

        const finalResponse = await session.get(finalUrl, {
            headers: { 'Referer': responseStep2.request.res.responseUrl }
        });

        // Step 6: Extract driveleech URL from meta refresh tag
        $ = cheerio.load(finalResponse.data);
        const metaRefresh = $('meta[http-equiv="refresh"]');
        if (metaRefresh.length > 0) {
            const content = metaRefresh.attr('content');
            const urlMatch = content.match(/url=(.*)/i);
            if (urlMatch && urlMatch[1]) {
                const driveleechUrl = urlMatch[1].replace(/"/g, "").replace(/'/g, "");
                console.log(`  [SID] SUCCESS! Resolved Driveleech URL: ${driveleechUrl}`);
                return driveleechUrl;
            }
        }

        // Fallback to WorkerSeed logic if meta refresh failed
        console.log(`[MoviesMod] Meta refresh failed, trying WorkerSeed fallback...`);

        // We need a new session for WorkerSeed as it might be a different flow
        const jar2 = new CookieJar();
        const session2 = wrapper(axios.create({
            jar: jar2,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
        }));

        console.log(`[MoviesMod] Step 1 (Fallback): Fetching page to get script content and cookies...`);
        const { data: pageHtml } = await session2.get(sidUrl);

        const scriptTags = pageHtml.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/g);
        if (scriptTags) {
            const scriptContent = scriptTags.find(s => s.includes("formData.append('token'"));
            if (scriptContent) {
                const tokenMatch = scriptContent.match(/formData\.append\('token', '([^']+)'\)/);
                const idMatch = scriptContent.match(/fetch\('\/download\?id=([^']+)',/);

                if (tokenMatch && tokenMatch[1] && idMatch && idMatch[1]) {
                    const token = tokenMatch[1];
                    const correctId = idMatch[1];

                    // Make the actual WorkerSeed API request (inlined here)
                    const apiUrl = `https://workerseed.dev/download?id=${correctId}`;
                    const formData = new FormData();
                    formData.append('token', token);

                    console.log(`[MoviesMod] Step 3 (Fallback): POSTing to endpoint: ${apiUrl}`);
                    const { data: apiResponse } = await session2.post(apiUrl, formData, {
                        headers: {
                            ...formData.getHeaders(),
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Referer': sidUrl,
                            'x-requested-with': 'XMLHttpRequest'
                        }
                    });

                    if (apiResponse && apiResponse.url) {
                        console.log(`[MoviesMod] SUCCESS! Final video link from Worker-seed API: ${apiResponse.url}`);
                        return apiResponse.url;
                    }
                }
            }
        }

        return null;

    } catch (error) {
        console.error(`[MoviesMod] Error resolving SID link: ${error.message}`);
        return null;
    }
}

// Environment variable to control URL validation
const URL_VALIDATION_ENABLED = process.env.DISABLE_URL_VALIDATION !== 'true';
console.log(`[MoviesMod] URL validation is ${URL_VALIDATION_ENABLED ? 'enabled' : 'disabled'}.`);

// Validate if a video URL is working (not 404 or broken)
async function validateVideoUrl(url, timeout = 10000) {
    // Skip validation if disabled via environment variable
    if (!URL_VALIDATION_ENABLED) {
        console.log(`[MoviesMod] URL validation disabled, skipping validation for: ${url.substring(0, 100)}...`);
        return true;
    }

    try {
        console.log(`[MoviesMod] Validating URL: ${url.substring(0, 100)}...`);

        // Use proxy for URL validation if enabled
        let response;
        if (MOVIESMOD_PROXY_URL) {
            const proxiedUrl = `${MOVIESMOD_PROXY_URL}${encodeURIComponent(url)}`;
            console.log(`[MoviesMod] Making proxied HEAD request for validation to: ${url}`);
            response = await axios.head(proxiedUrl, {
                timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Range': 'bytes=0-1' // Just request first byte to test
                }
            });
        } else {
            response = await axios.head(url, {
                timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Range': 'bytes=0-1' // Just request first byte to test
                }
            });
        }

        // Check if status is OK (200-299) or partial content (206)
        if (response.status >= 200 && response.status < 400) {
            console.log(`[MoviesMod] ✓ URL validation successful (${response.status})`);
            return true;
        } else {
            console.log(`[MoviesMod] ✗ URL validation failed with status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`[MoviesMod] ✗ URL validation failed: ${error.message}`);
        return false;
    }
}

// Parallel URL validation for multiple URLs
async function validateUrlsParallel(urls, timeout = 10000) {
    if (!urls || urls.length === 0) return [];

    console.log(`[MoviesMod] Validating ${urls.length} URLs in parallel...`);

    const validationPromises = urls.map(async (url) => {
        try {
            // Use proxy for URL validation if enabled
            let response;
            if (MOVIESMOD_PROXY_URL) {
                const proxiedUrl = `${MOVIESMOD_PROXY_URL}${encodeURIComponent(url)}`;
                response = await axios.head(proxiedUrl, {
                    timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Range': 'bytes=0-1'
                    }
                });
            } else {
                response = await axios.head(url, {
                    timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Range': 'bytes=0-1'
                    }
                });
            }

            const isValid = response.status >= 200 && response.status < 400;
            return { url, isValid, status: response.status };
        } catch (error) {
            return { url, isValid: false, error: error.message };
        }
    });

    const results = await Promise.allSettled(validationPromises);
    const validationResults = results.map(r =>
        r.status === 'fulfilled' ? r.value : { url: 'unknown', isValid: false, error: 'Promise rejected' }
    );

    const validCount = validationResults.filter(r => r.isValid).length;
    console.log(`[MoviesMod] ✓ Parallel validation complete: ${validCount}/${urls.length} URLs valid`);

    return validationResults;
}

// Parallel episode processing for TV shows
async function processEpisodesParallel(finalFilePageLinks, episodeNum = null) {
    if (!finalFilePageLinks || finalFilePageLinks.length === 0) return [];

    console.log(`[MoviesMod] Processing ${finalFilePageLinks.length} episode links in parallel...`);

    const episodePromises = finalFilePageLinks.map(async (link) => {
        try {
            // Extract episode information from server name
            const serverName = link.server.toLowerCase();
            let extractedEpisodeNum = null;

            // Try multiple episode patterns
            const episodePatterns = [
                /episode\s+(\d+)/i,
                /ep\s+(\d+)/i,
                /e(\d+)/i,
                /\b(\d+)\b/
            ];

            for (const pattern of episodePatterns) {
                const match = serverName.match(pattern);
                if (match) {
                    extractedEpisodeNum = parseInt(match[1], 10);
                    break;
                }
            }

            return {
                ...link,
                episodeInfo: {
                    episode: extractedEpisodeNum,
                    originalServer: link.server
                }
            };
        } catch (error) {
            return {
                ...link,
                episodeInfo: {
                    episode: null,
                    originalServer: link.server,
                    error: error.message
                }
            };
        }
    });

    const processedLinks = await Promise.all(episodePromises);

    // Filter for specific episode if requested
    if (episodeNum !== null) {
        const filteredLinks = processedLinks.filter(link =>
            link.episodeInfo?.episode === episodeNum
        );
        console.log(`[MoviesMod] ✓ Parallel episode processing: Found ${filteredLinks.length} matches for episode ${episodeNum}`);
        return filteredLinks;
    }

    console.log(`[MoviesMod] ✓ Parallel episode processing complete: ${processedLinks.length} episodes processed`);
    return processedLinks;
}

// Parallel SID link resolution for multiple SID links
async function resolveSIDLinksParallel(sidUrls) {
    if (!sidUrls || sidUrls.length === 0) return [];

    console.log(`[MoviesMod] Resolving ${sidUrls.length} SID links in parallel...`);

    const sidPromises = sidUrls.map(async (sidUrl) => {
        try {
            const resolvedUrl = await resolveTechUnblockedLink(sidUrl);
            return { originalUrl: sidUrl, resolvedUrl, success: !!resolvedUrl };
        } catch (error) {
            console.log(`[MoviesMod] ✗ SID resolution failed for ${sidUrl}: ${error.message}`);
            return { originalUrl: sidUrl, resolvedUrl: null, success: false, error: error.message };
        }
    });

    const results = await Promise.allSettled(sidPromises);
    const resolvedResults = results.map(r =>
        r.status === 'fulfilled' ? r.value : { originalUrl: 'unknown', resolvedUrl: null, success: false, error: 'Promise rejected' }
    );

    const successCount = resolvedResults.filter(r => r.success).length;
    console.log(`[MoviesMod] ✓ Parallel SID resolution complete: ${successCount}/${sidUrls.length} SID links resolved`);

    return resolvedResults;
}

// Main function to get streams for TMDB content
async function getMoviesModStreams(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
    try {
        console.log(`[MoviesMod] Fetching streams for TMDB ${mediaType}/${tmdbId}${seasonNum ? `, S${seasonNum}E${episodeNum}` : ''}`);

        // Define a cache key based on the media type and ID. For series, cache per season.
        const cacheKey = `moviesmod_final_v17_${tmdbId}_${mediaType}${seasonNum ? `_s${seasonNum}` : ''}`;
        let resolvedQualities = await getFromCache(cacheKey);

        // Ensure resolvedQualities is properly structured
        if (resolvedQualities && !Array.isArray(resolvedQualities)) {
            console.log(`[MoviesMod] Cache data is not an array, attempting to extract data property:`, typeof resolvedQualities);
            if (resolvedQualities.data && Array.isArray(resolvedQualities.data)) {
                resolvedQualities = resolvedQualities.data;
            } else {
                console.log(`[MoviesMod] Cache data structure is invalid, treating as cache miss`);
                resolvedQualities = null;
            }
        }

        if (!resolvedQualities || resolvedQualities.length === 0) {
            if (resolvedQualities && resolvedQualities.length === 0) {
                console.log(`[MoviesMod] Cache contains empty data for ${cacheKey}. Refetching from source.`);
            } else {
                console.log(`[MoviesMod Cache] MISS for key: ${cacheKey}. Fetching from source.`);
            }

            // We need to fetch title and year from TMDB API
            const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

            // Use axios for TMDB request instead of node-fetch
            const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
            console.log(`[MoviesMod] Fetching TMDB metadata from: ${tmdbUrl}`);
            const { data: tmdbDetails } = await axios.get(tmdbUrl);

            const title = mediaType === 'tv' ? tmdbDetails.name : tmdbDetails.title;
            const year = mediaType === 'tv' ? tmdbDetails.first_air_date?.substring(0, 4) : tmdbDetails.release_date?.substring(0, 4);
            if (!title) throw new Error('Could not get title from TMDB');

            console.log(`[MoviesMod] Found metadata: ${title} (${year})`);
            const searchResults = await searchMoviesMod(title);
            if (searchResults.length === 0) throw new Error(`No search results found for "${title}"`);

            // --- NEW: Use string similarity to find the best match ---
            const titles = searchResults.map(r => r.title);
            const bestMatch = findBestMatch(title, titles);

            console.log(`[MoviesMod] Best match for "${title}" is "${bestMatch.bestMatch.target}" with a rating of ${bestMatch.bestMatch.rating.toFixed(2)}`);

            let selectedResult = null;
            // Set a minimum similarity threshold (e.g., 0.3) to avoid obviously wrong matches
            if (bestMatch.bestMatch.rating > 0.3) {
                selectedResult = searchResults[bestMatch.bestMatchIndex];

                // Additional check for year if it's a movie
                if (mediaType === 'movie' && year) {
                    if (!selectedResult.title.includes(year)) {
                        console.warn(`[MoviesMod] Title match found, but year mismatch. Matched: "${selectedResult.title}", Expected year: ${year}. Discarding match.`);
                        selectedResult = null; // Discard if year doesn't match
                    }
                }
            }

            if (!selectedResult) {
                // If no good match is found, try a stricter direct search using regex with word boundaries
                console.log('[MoviesMod] Similarity match failed or was below threshold. Trying stricter name/year search with word boundaries...');
                const titleRegex = new RegExp(`\\b${escapeRegExp(title.toLowerCase())}\\b`);

                if (mediaType === 'movie') {
                    selectedResult = searchResults.find(r =>
                        titleRegex.test(r.title.toLowerCase()) &&
                        (!year || r.title.includes(year))
                    );
                } else { // for 'tv'
                    // For TV, be more lenient on year, but check for title and 'season' keyword.
                    selectedResult = searchResults.find(r =>
                        titleRegex.test(r.title.toLowerCase()) &&
                        r.title.toLowerCase().includes('season')
                    );
                }
            }

            if (!selectedResult) {
                console.log(`[MoviesMod] No suitable match found for "${title}"`);
                return [];
            }

            console.log(`[MoviesMod] Selected result: ${selectedResult.title}`);

            // Extract download links
            const downloadLinks = await extractDownloadLinks(selectedResult.url);
            if (downloadLinks.length === 0) {
                console.log('[MoviesMod] No download links found');
                return [];
            }

            // Resolve intermediate links
            const qualityPromises = downloadLinks.map(async (link) => {
                try {
                    const intermediateLinks = await resolveIntermediateLink(link.url, selectedResult.url, link.quality);

                    // Filter for driveseed links
                    const driveseedPromises = intermediateLinks.map(async (intermediateLink) => {
                        if (intermediateLink.url.includes('driveseed.org')) {
                            return { quality: link.quality, driveseedRedirectUrl: intermediateLink.url };
                        }
                        return null;
                    });

                    const driveseedRedirectLinks = (await Promise.all(driveseedPromises)).filter(Boolean);
                    if (driveseedRedirectLinks.length > 0) {
                        return { quality: link.quality, driveseedRedirectLinks: driveseedRedirectLinks };
                    }
                    return null;
                } catch (error) {
                    console.error(`[MoviesMod] Error processing quality ${link.quality}: ${error.message}`);
                    return null;
                }
            });

            resolvedQualities = (await Promise.all(qualityPromises)).filter(Boolean);

            if (resolvedQualities.length > 0) {
                console.log(`[MoviesMod] Caching ${resolvedQualities.length} qualities with resolved driveseed redirect URLs for key: ${cacheKey}`);
            }
            await saveToCache(cacheKey, resolvedQualities);
        }

        if (!resolvedQualities || resolvedQualities.length === 0) {
            console.log('[MoviesMod] No final file page URLs found from cache or scraping.');
            return [];
        }

        // Ensure resolvedQualities is an array
        if (!Array.isArray(resolvedQualities)) {
            console.error('[MoviesMod] resolvedQualities is not an array:', typeof resolvedQualities, resolvedQualities);
            return [];
        }

        console.log(`[MoviesMod] Processing ${resolvedQualities.length} qualities with cached driveseed redirect URLs to get final streams.`);
        const streams = [];
        const processedFileNames = new Set();

        const qualityProcessingPromises = resolvedQualities.map(async (qualityInfo) => {
            const { quality, driveseedRedirectLinks } = qualityInfo;

            // Use parallel episode processing for TV shows
            let targetLinks = driveseedRedirectLinks;
            if ((mediaType === 'tv' || mediaType === 'series') && episodeNum !== null) {
                targetLinks = await processEpisodesParallel(driveseedRedirectLinks, episodeNum);
                if (targetLinks.length === 0) {
                    console.log(`[MoviesMod] No episode ${episodeNum} found for ${quality} after parallel processing`);
                    return [];
                }
            }

            const finalStreamPromises = targetLinks.map(async (targetLink) => {
                try {
                    const { driveseedRedirectUrl } = targetLink;
                    if (!driveseedRedirectUrl) return null;

                    // Process the cached driveseed redirect URL
                    if (driveseedRedirectUrl.includes('driveseed.org')) {
                        // Resolve redirect to final file page using shared util
                        const resFollow = await followRedirectToFilePage({
                            redirectUrl: driveseedRedirectUrl,
                            get: (url, opts) => makeRequest(url, opts),
                            log: console
                        });
                        const $ = resFollow.$;
                        const finalFilePageUrl = resFollow.finalFilePageUrl;
                        console.log(`[MoviesMod] Resolved redirect to final file page: ${finalFilePageUrl}`);

                        // Extract file size and name information
                        let driveseedSize = 'Unknown';
                        let fileName = null;

                        const sizeElement = $('li.list-group-item:contains("Size :")').text();
                        if (sizeElement) {
                            const sizeMatch = sizeElement.match(/Size\s*:\s*([0-9.,]+\s*[KMGT]B)/);
                            if (sizeMatch) {
                                driveseedSize = sizeMatch[1];
                            }
                        }

                        const nameElement = $('li.list-group-item:contains("Name :")');
                        if (nameElement.length > 0) {
                            fileName = nameElement.text().replace('Name :', '').trim();
                        } else {
                            const h5Title = $('div.card-header h5').clone().children().remove().end().text().trim();
                            if (h5Title) {
                                fileName = h5Title.replace(/\[.*\]/, '').trim();
                            }
                        }

                        if (fileName && processedFileNames.has(fileName)) {
                            console.log(`[MoviesMod] Skipping duplicate file: ${fileName}`);
                            return null;
                        }
                        if (fileName) processedFileNames.add(fileName);
                        // Use shared util to extract the final URL from file page
                        const origin = new URL(finalFilePageUrl).origin;
                        const finalDownloadUrl = await extractFinalDownloadFromFilePage($, {
                            origin,
                            get: (url, opts) => makeRequest(url, opts),
                            post: (url, data, opts) => axios.post(MOVIESMOD_PROXY_URL ? `${MOVIESMOD_PROXY_URL}${encodeURIComponent(url)}` : url, data, opts),
                            validate: (url) => validateVideoUrl(url),
                            log: console
                        });

                        if (!finalDownloadUrl) {
                            console.log(`[MoviesMod] ✗ Could not extract final link for ${quality}`);
                            return null;
                        }

                        let actualQuality = extractQuality(quality);
                        const sizeInfo = driveseedSize || quality.match(/\[([^\]]+)\]/)?.[1];
                        const cleanFileName = fileName ? fileName.replace(/\.[^/.]+$/, "").replace(/[._]/g, ' ') : `Stream from ${quality}`;
                        const techDetails = getTechDetails(quality);
                        const techDetailsString = techDetails.length > 0 ? ` • ${techDetails.join(' • ')}` : '';

                        return {
                            name: `MoviesMod\n${actualQuality}`,
                            title: `${cleanFileName}\n${sizeInfo || ''}${techDetailsString}`,
                            url: finalDownloadUrl,
                            quality: actualQuality,
                        };
                    } else {
                        console.warn(`[MoviesMod] Unsupported URL type for final processing: ${targetLink.url}`);
                        return null;
                    }
                } catch (e) {
                    console.error(`[MoviesMod] Error processing target link ${targetLink.url}: ${e.message}`);
                    return null;
                }
            });

            return (await Promise.all(finalStreamPromises)).filter(Boolean);
        });

        const allResults = await Promise.all(qualityProcessingPromises);
        allResults.flat().forEach(s => streams.push(s));

        // Sort by quality descending
        streams.sort((a, b) => {
            const qualityA = parseQualityForSort(a.quality);
            const qualityB = parseQualityForSort(b.quality);
            return qualityB - qualityA;
        });

        console.log(`[MoviesMod] Successfully extracted and sorted ${streams.length} streams`);
        return streams;

    } catch (error) {
        console.error(`[MoviesMod] Error getting streams: ${error.message}`);
        return [];
    }
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    getMoviesModStreams,
    getStreams: getMoviesModStreams
};
