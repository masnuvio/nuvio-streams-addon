/**
 * MovieBox streaming provider integration for Stremio
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');

const BASE_URL = 'https://api.inmoviebox.com/wefeed-mobile-bff';
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

// Get PRIMARY_KEY from environment
const PRIMARY_KEY = process.env.MOVIEBOX_PRIMARY_KEY;
if (!PRIMARY_KEY) {
    console.error('[MovieBox] MOVIEBOX_PRIMARY_KEY is missing from environment variables!');
}

async function axiosWithRetry(config, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await axios(config);
        } catch (err) {
            const isNetworkError = !err.response && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED');
            const is5xxError = err.response && err.response.status >= 500;

            if (i === maxRetries - 1 || (!isNetworkError && !is5xxError)) {
                throw err;
            }
            const delay = Math.pow(2, i) * 1000;
            console.warn(`[MovieBox] Request failed (${err.message}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function md5Hex(data) {
    return CryptoJS.MD5(data).toString(CryptoJS.enc.Hex);
}

function signRequest(keyB64, url, method = 'GET', body = '') {
    if (!keyB64) return { xTrSignature: '', xClientToken: '' };
    const timestamp = Date.now();

    const u = new URL(url);
    const path = u.pathname || '';
    const params = [];
    u.searchParams.forEach((value, key) => {
        params.push([decodeURIComponent(key), decodeURIComponent(value)]);
    });
    params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const qs = params.map(([k, v]) => `${k}=${v}`).join('&');
    const canonicalUrl = qs ? `${path}?${qs}` : path;

    let bodyHash = '';
    let bodyLength = '';
    if (body) {
        const bodyUtf8 = CryptoJS.enc.Utf8.parse(body);
        bodyLength = String(bodyUtf8.sigBytes);
        bodyHash = md5Hex(bodyUtf8);
    }

    const canonical = [
        method.toUpperCase(),
        'application/json',
        'application/json; charset=utf-8',
        bodyLength,
        String(timestamp),
        bodyHash,
        canonicalUrl,
    ].join('\n');

    const key = CryptoJS.enc.Base64.parse(keyB64);
    const sig = CryptoJS.HmacMD5(canonical, key).toString(CryptoJS.enc.Base64);

    const xTrSignature = `${timestamp}|2|${sig}`;
    const rev = String(timestamp).split('').reverse().join('');
    const xClientToken = `${timestamp},${md5Hex(rev)}`;

    return { xTrSignature, xClientToken };
}

function makeApiRequest(url, method = 'GET', body = '') {
    const { xTrSignature, xClientToken } = signRequest(PRIMARY_KEY, url, method, body);
    const headers = {
        'User-Agent': 'com.community.mbox.in/50020042 (Linux; Android 16; sdk_gphone64_x86_64; Cronet/133.0.6876.3)',
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'x-client-info': JSON.stringify({ package_name: 'com.community.mbox.in' }),
        'x-client-token': xClientToken,
        'x-tr-signature': xTrSignature,
        'x-client-status': '0',
    };

    const config = {
        method: method.toUpperCase(),
        url: url,
        headers: headers,
        timeout: 15000,
    };

    if (method.toUpperCase() === 'POST' && body) {
        config.data = body;
    }

    return axiosWithRetry(config).then(function (res) {
        return res.data;
    }).catch(function (err) {
        console.error(`[MovieBox] API request failed: ${err.message}`);
        return null;
    });
}

function search(keyword) {
    const url = `${BASE_URL}/subject-api/search/v2`;
    const body = JSON.stringify({ page: 1, perPage: 10, keyword });
    return makeApiRequest(url, 'POST', body)
        .then(function (res) {
            if (!res || !res.data) return [];
            const results = res.data.results || [];
            const subjects = [];
            for (const result of results) {
                if (result && result.subjects) {
                    subjects.push(...result.subjects);
                }
            }
            return subjects;
        });
}

function getPlayInfo(subjectId, season, episode) {
    let url;
    if (season && episode) {
        url = `${BASE_URL}/subject-api/play-info?subjectId=${subjectId}&se=${season}&ep=${episode}`;
    } else {
        url = `${BASE_URL}/subject-api/play-info?subjectId=${subjectId}`;
    }

    return makeApiRequest(url).then(function (res) {
        const data = res?.data || {};
        let streams = data.streams || [];
        if (!streams || streams.length === 0) {
            streams = data.playInfo?.streams || [];
        }
        for (const s of streams) {
            s.audioTracks = Array.isArray(s.audioTracks) ? s.audioTracks : [];
            if (Array.isArray(s.resolutions)) {
                // keep as-is
            } else if (typeof s.resolutions === 'string') {
                s.resolutions = s.resolutions.split(',').map(function (v) {
                    return v.trim();
                }).filter(Boolean);
            } else if (s.resolution) {
                s.resolutions = Array.isArray(s.resolution) ? s.resolution : [s.resolution];
            } else {
                s.resolutions = [];
            }
        }
        return streams;
    });
}

function extractQualityFields(stream) {
    const qualities = [];
    const candidates = [
        stream.quality,
        stream.definition,
        stream.label,
        stream.videoQuality,
        stream.profile,
    ].filter(Boolean);
    qualities.push(...candidates.map(String));
    if (Array.isArray(stream.resolutions) && stream.resolutions.length) {
        qualities.push(...stream.resolutions.map(v => String(v)));
    }
    const width = stream.width || (stream.video && stream.video.width);
    const height = stream.height || (stream.video && stream.video.height);
    if (width && height) {
        qualities.push(`${width}x${height}`);
    }
    const seen = new Set();
    return qualities.filter(q => {
        if (seen.has(q)) return false;
        seen.add(q);
        return true;
    });
}

function formatQuality(qualityString) {
    if (!qualityString) return 'Unknown';
    if (qualityString.includes('p')) return qualityString;
    const numberMatch = qualityString.match(/^(\d{3,4})$/);
    if (numberMatch) return `${numberMatch[1]}p`;
    const resolutionMatch = qualityString.match(/^\d+x(\d{3,4})$/);
    if (resolutionMatch) return `${resolutionMatch[1]}p`;
    return qualityString;
}

function normalizeTitle(title) {
    if (!title) return '';
    return title.toLowerCase()
        .replace(/[.,!?;:()[\]{}"'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(the|a|an)\s+/, '')
        .replace(/\s+(movie|film|show|series|part|chapter)\s+\d*$/i, '')
        .replace(/\s+\(\d{4}\)$/, '')
        .trim();
}

function calculateSimilarity(targetTitle, candidateTitle) {
    const normalizedTarget = normalizeTitle(targetTitle);
    const normalizedCandidate = normalizeTitle(candidateTitle);
    if (normalizedTarget === normalizedCandidate) return 1.0;

    const words1 = normalizedTarget.split(/\s+/).filter(w => w.length > 1);
    const words2 = normalizedCandidate.split(/\s+/).filter(w => w.length > 1);
    if (words1.length === 0 || words2.length === 0) return 0;

    let matches = 0;
    for (const w1 of words1) {
        if (words2.includes(w1)) {
            matches += 1.0;
        } else {
            for (const w2 of words2) {
                if (w1.includes(w2) || w2.includes(w1)) {
                    matches += 0.5;
                    break;
                }
            }
        }
    }
    return matches / Math.max(words1.length, words2.length);
}

function isRelevantMatch(targetTitle, candidateTitle) {
    const score = calculateSimilarity(targetTitle, candidateTitle);
    if (score >= 0.8) return { isRelevant: true, confidence: 'high', score };
    if (score >= 0.6) return { isRelevant: true, confidence: 'medium', score };
    return { isRelevant: false, confidence: 'none', score };
}

function parseQualityForSort(qualityString) {
    if (!qualityString) return 0;
    const match = qualityString.match(/(\d{3,4})p/i);
    return match ? parseInt(match[1], 10) : 0;
}

function getMovieBoxStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[MovieBox] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const config = {
        method: 'GET',
        url: tmdbUrl,
        timeout: 10000
    };

    return axiosWithRetry(config)
        .then(function (res) {
            const tmdbData = res.data;
            const title = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
            const year = mediaType === 'tv'
                ? (tmdbData.first_air_date || '').substring(0, 4)
                : (tmdbData.release_date || '').substring(0, 4);

            if (!title) throw new Error('Could not extract title from TMDB response');
            console.log(`[MovieBox] Searching for: "${title}" (${year})`);
            return search(title).then(function (results) {
                return { results, title, year, mediaType, seasonNum, episodeNum };
            });
        })
        .then(function (data) {
            const { results, title, mediaType, seasonNum, episodeNum } = data;
            if (!results || results.length === 0) return [];

            const relevantResults = results.map(r => {
                const match = isRelevantMatch(title, r.title);
                return { ...r, ...match };
            }).filter(r => r.isRelevant);

            relevantResults.sort((a, b) => b.score - a.score);

            const promises = relevantResults.map(result => {
                if (mediaType === 'tv') {
                    if (!seasonNum || !episodeNum) return Promise.resolve({ subject: result, streams: [] });
                    return getPlayInfo(result.subjectId, seasonNum, episodeNum).then(streams => ({ subject: result, streams }));
                } else {
                    return getPlayInfo(result.subjectId).then(streams => ({ subject: result, streams }));
                }
            });

            return Promise.all(promises);
        })
        .then(function (subjectsWithStreams) {
            const allStreams = [];
            subjectsWithStreams.forEach(data => {
                const { subject, streams } = data;
                if (!streams) return;

                streams.forEach(s => {
                    const qualities = extractQualityFields(s);
                    const rawQuality = qualities.find(q => q.includes('p') || q.includes('x')) || qualities[0] || 'Unknown';
                    const quality = formatQuality(rawQuality);

                    let languageInfo = '';
                    if (s.audioTracks && s.audioTracks.length > 0) {
                        languageInfo = s.audioTracks[0];
                    }

                    allStreams.push({
                        name: `MovieBox - ${quality}${languageInfo ? ' | ' + languageInfo : ''}`,
                        title: `${subject.title} - ${s.format || 'Stream'} - ${quality}`,
                        url: s.url,
                        quality: quality,
                        type: 'direct',
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            'Referer': 'https://api.inmoviebox.com'
                        }
                    });
                });
            });

            allStreams.sort((a, b) => parseQualityForSort(b.quality) - parseQualityForSort(a.quality));
            return allStreams;
        })
        .catch(function (error) {
            console.error(`[MovieBox] Error in getMovieBoxStreams: ${error.message}`);
            return [];
        });
}

module.exports = {
    getMovieBoxStreams,
    getStreams: getMovieBoxStreams
};
