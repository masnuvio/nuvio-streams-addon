const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// Constants
const PROXY_URL = process.env.SOAPERTV_PROXY_URL || process.env.SHOWBOX_PROXY_URL_VALUE;
const BASE_URL = 'https://soap2day.day';
const TMDB_API_KEY_SOAPERTV = "439c478a771f35c05022f9feabcca01c"; // Public TMDB API key used by this provider

// HTTPS Agent to ignore SSL certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Simple In-Memory Cache
const soaperCache = {
  search: {},
  episodes: {}
};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL for cache entries

// Function to get from cache
function getFromCache(type, key) {
  if (soaperCache[type] && soaperCache[type][key]) {
    const entry = soaperCache[type][key];
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      console.log(`[Soaper TV Cache] HIT for ${type} - ${key}`);
      return entry.data;
    }
    console.log(`[Soaper TV Cache] STALE for ${type} - ${key}`);
    delete soaperCache[type][key]; // Remove stale entry
  }
  console.log(`[Soaper TV Cache] MISS for ${type} - ${key}`);
  return null;
}

// Function to save to cache
function saveToCache(type, key, data) {
  if (!soaperCache[type]) soaperCache[type] = {};
  soaperCache[type][key] = {
    data: data,
    timestamp: Date.now()
  };
  console.log(`[Soaper TV Cache] SAVED for ${type} - ${key}`);
}

// Axios with retry helper for SoaperTV
async function axiosSoaper(url, options = {}, retries = 3, backoff = 1000) {
  const isHttpUrl = url.startsWith('http://') || url.startsWith('https://');
  const fullUrl = isHttpUrl ? url : `${BASE_URL}${url}`;

  let requestUrl;
  if (PROXY_URL && !isHttpUrl) {
    requestUrl = `${PROXY_URL}${encodeURIComponent(fullUrl)}`;
    console.log(`[Soaper TV] Fetching: ${url} (via proxy)`);
  } else {
    requestUrl = fullUrl;
    console.log(`[Soaper TV] Fetching: ${url} (direct request)`);
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios({
        url: requestUrl,
        httpsAgent: httpsAgent,
        ...options
      });
      return response.data;
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || (err.response && err.response.status >= 500);
      if (i === retries - 1 || !isRetryable) {
        console.error(`[Soaper TV] Request failed for ${url}:`, err.message);
        throw err;
      }
      console.warn(`[Soaper TV] Request failed (${err.code || err.response?.status}). Retrying in ${backoff}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }
}

// Compare media to find matching result
function compareMediaSoaper(media, title, year) {
  const normalizeString = (str) => String(str || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  const normalizedMediaTitle = normalizeString(media.title);
  const normalizedResultTitle = normalizeString(title);

  if (normalizedMediaTitle !== normalizedResultTitle) {
    return false;
  }

  if (year && media.year && media.year !== year) {
    return false;
  }

  return true;
}

async function getSoaperTvStreams(tmdbId, mediaType = 'movie', season = '', episode = '') {
  console.log(`[Soaper TV] Attempting to fetch streams for TMDB ID: ${tmdbId}, Type: ${mediaType}${mediaType === 'tv' ? `, S:${season}E:${episode}` : ''}`);
  try {
    const tmdbUrl = mediaType === 'movie'
      ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY_SOAPERTV}`
      : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY_SOAPERTV}`;

    console.log(`[Soaper TV] Fetching TMDB info from: ${tmdbUrl}`);
    const tmdbData = await axiosSoaper(tmdbUrl);

    const mediaInfo = {
      title: mediaType === 'movie' ? tmdbData.title : tmdbData.name,
      year: parseInt(mediaType === 'movie'
        ? (tmdbData.release_date || '').split('-')[0]
        : (tmdbData.first_air_date || '').split('-')[0], 10)
    };

    if (!mediaInfo.title) {
      console.error('[Soaper TV] Failed to get title from TMDB data:', tmdbData);
      throw new Error('Could not extract title from TMDB response.');
    }
    console.log(`[Soaper TV] TMDB Info: "${mediaInfo.title}" (${mediaInfo.year || 'N/A'})`);

    const searchCacheKey = mediaInfo.title.toLowerCase();
    let searchResults = getFromCache('search', searchCacheKey);

    if (!searchResults) {
      const searchUrl = `/search.html?keyword=${encodeURIComponent(mediaInfo.title)}`;
      const searchResultHtml = await axiosSoaper(searchUrl);
      const search$ = cheerio.load(searchResultHtml);

      searchResults = []; // Initialize to empty array before pushing
      search$('.thumbnail').each((_, element) => {
        const title = search$(element).find('h5 a').first().text().trim();
        const yearText = search$(element).find('.img-tip').first().text().trim();
        const url = search$(element).find('h5 a').first().attr('href');

        if (title && url) {
          searchResults.push({
            title,
            year: yearText ? parseInt(yearText, 10) : undefined,
            url
          });
        }
      });
      saveToCache('search', searchCacheKey, searchResults);
    } else {
      console.log(`[Soaper TV] Using cached search results for "${mediaInfo.title}".`);
    }

    console.log(`[Soaper TV] Found ${searchResults.length} search results for "${mediaInfo.title}".`);

    const matchingResult = searchResults.find(x => compareMediaSoaper(mediaInfo, x.title, x.year));

    if (!matchingResult) {
      console.log(`[Soaper TV] No matching content found on SoaperTV for "${mediaInfo.title}" (${mediaInfo.year || 'N/A'}).`);
      return [];
    }

    console.log(`[Soaper TV] Found matching SoaperTV content: "${matchingResult.title}" (${matchingResult.year || 'N/A'}) at ${matchingResult.url}`);
    let contentUrl = matchingResult.url;

    if (mediaType === 'tv') {
      console.log(`[Soaper TV] Finding Season ${season}, Episode ${episode} for TV show.`);

      const episodeCacheKey = `${contentUrl}-s${season}`.toLowerCase();
      let episodeLinks = getFromCache('episodes', episodeCacheKey);

      if (!episodeLinks) {
        const showPageHtml = await axiosSoaper(contentUrl);
        const showPage$ = cheerio.load(showPageHtml);

        const seasonBlock = showPage$('h4')
          .filter((_, el) => showPage$(el).text().trim().split(':')[0].trim().toLowerCase() === `season${season}`)
          .parent();

        if (seasonBlock.length === 0) {
          console.log(`[Soaper TV] Season ${season} not found on page.`);
          return [];
        }

        episodeLinks = []; // Initialize before pushing
        seasonBlock.find('a').each((_, el) => {
          const episodeNumText = showPage$(el).text().split('.')[0];
          const episodeUrl = showPage$(el).attr('href');
          if (episodeNumText && episodeUrl) {
            episodeLinks.push({
              num: parseInt(episodeNumText, 10),
              url: episodeUrl
            });
          }
        });
        saveToCache('episodes', episodeCacheKey, episodeLinks);
      } else {
        console.log(`[Soaper TV] Using cached episode links for Season ${season} of ${contentUrl}.`);
      }

      const targetEpisode = episodeLinks.find(ep => ep.num === parseInt(episode, 10));

      if (!targetEpisode) {
        console.log(`[Soaper TV] Episode ${episode} not found in Season ${season} (using ${episodeLinks.length} cached/parsed links).`);
        return [];
      }

      contentUrl = targetEpisode.url;
      console.log(`[Soaper TV] Found episode page (from cache/parse): ${contentUrl}`);
    }

    const contentPageHtml = await axiosSoaper(contentUrl);
    const contentPage$ = cheerio.load(contentPageHtml);
    const pass = contentPage$('#hId').attr('value');

    if (!pass) {
      console.error('[Soaper TV] Could not find pass value on content page.');
      return [];
    }
    console.log(`[Soaper TV] Found pass value: ${pass}`);

    const infoEndpoint = mediaType === 'tv' ? '/home/index/getEInfoAjax' : '/home/index/getMInfoAjax';
    const params = new URLSearchParams();
    params.append('pass', pass);
    params.append('e2', '0');
    params.append('server', '0');

    const headers = {
      'referer': `${BASE_URL}${contentUrl}`, // Critical for the API call
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Viewport-Width': '375',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest'
    };

    console.log(`[Soaper TV] Requesting stream info from ${infoEndpoint} with pass ${pass}.`);
    const streamInfo = await axiosSoaper(infoEndpoint, {
      method: 'POST',
      data: params.toString(),
      headers: headers
    });

    if (!streamInfo || !streamInfo.val || typeof streamInfo.val !== 'string') {
      console.error('[Soaper TV] No valid stream URL (val) found in response:', streamInfo);
      return [];
    }

    const streamPath = streamInfo.val;
    // Ensure streamPath doesn't already start with BASE_URL or http
    const finalStreamUrl = streamPath.startsWith('http') ? streamPath : (streamPath.startsWith('/') ? `${BASE_URL}${streamPath}` : `${BASE_URL}/${streamPath}`);

    console.log(`[Soaper TV] Found stream source: ${finalStreamUrl}`);

    const proxiedStreamUrl = PROXY_URL ? `${PROXY_URL}${encodeURIComponent(finalStreamUrl)}` : finalStreamUrl;

    return [{
      url: proxiedStreamUrl,
      quality: 'Auto Quality',
      provider: 'Soaper TV',
      title: `${mediaInfo.title}${mediaType === 'tv' ? ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : ''} - Soaper TV`,
      name: `Soaper TV - Auto`, // Shorter name for Stremio UI
      behaviorHints: {
        notWebReady: true
      },
      源: 'SoaperTV', // Using Chinese character for "source" as seen in other provider
      codecs: [], // SoaperTV does not provide detailed codec info easily
      size: 'N/A'
    }];

  } catch (error) {
    console.error(`[Soaper TV] Error in getSoaperTvStreams for TMDB ID ${tmdbId}:`, error.message, error.stack);
    return [];
  }
}

module.exports = {
  getSoaperTvStreams,
  getStreams: getSoaperTvStreams
};