const axios = require('axios');
const fs = require('fs');

// Constants
const NETMIRROR_BASE = 'https://net51.cc';
const BASE_HEADERS = {
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1', // Mobile UA
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
};

let globalCookie = '';

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    const config = {
        method: options.method || 'GET',
        url: url,
        headers: {
            ...BASE_HEADERS,
            ...options.headers
        },
        timeout: 10000,
        validateStatus: function (status) {
            return status >= 200 && status < 500; // Allow 4xx to check for 403
        }
    };

    if (options.body) {
        config.data = options.body;
    }

    return axios(config).then(function (response) {
        return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            headers: {
                get: (name) => response.headers[name]
            },
            json: () => Promise.resolve(response.data),
            text: () => Promise.resolve(typeof response.data === 'string' ? response.data : JSON.stringify(response.data))
        };
    }).catch(function (error) {
        throw new Error(`HTTP ${error.response ? error.response.status : 'Unknown'}: ${error.message}`);
    });
}

function getUnixTime() {
    return Math.floor(Date.now() / 1000);
}

// Bypass authentication and get valid cookie
function bypass() {
    console.log('[NetMirror] Bypassing authentication...');

    function attemptBypass(attempts) {
        if (attempts >= 5) {
            throw new Error('Max bypass attempts reached');
        }

        // Use Mobile auth endpoint
        return makeRequest(`${NETMIRROR_BASE}/mobile/p.php`, {
            method: 'POST',
            headers: BASE_HEADERS
        }).then(function (response) {
            // Extract cookie from response headers before reading text
            const setCookieHeader = response.headers.get('set-cookie');
            // console.log('Set-Cookie Header:', setCookieHeader);

            let extractedCookie = null;

            if (setCookieHeader) {
                // Axios headers are usually lowercase and can be array or string
                const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
                // Support both t_hash_t (TV) and t_hash (Web/Mobile)
                const cookieMatch = cookieString.match(/t_hash(?:_t)?=([^;]+)/);
                if (cookieMatch) {
                    extractedCookie = cookieMatch[1];
                }
            }

            return response.text().then(function (responseText) {
                // Check if response contains success indicator
                if (!responseText.includes('"r":"n"')) {
                    console.log(`[NetMirror] Bypass attempt ${attempts + 1} failed, retrying...`);
                    return attemptBypass(attempts + 1);
                }

                if (extractedCookie) {
                    console.log('[NetMirror] Authentication successful');
                    console.log('Extracted Cookie:', extractedCookie);
                    globalCookie = extractedCookie;
                    return extractedCookie;
                }

                throw new Error('Failed to extract authentication cookie');
            });
        });
    }

    return attemptBypass(0);
}

function searchContent(query, platform) {
    console.log(`[NetMirror] Searching for "${query}" on ${platform}...`);

    const ottMap = {
        'netflix': 'nf',
        'primevideo': 'pv',
        'disney': 'hs'
    };

    const ott = ottMap[platform.toLowerCase()] || 'nf';

    const cookies = {
        't_hash': globalCookie,
        'user_token': '233123f803cf02184bf6c67e149cdd50',
        'hd': 'on',
        'ott': ott
    };

    const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

    const searchEndpoints = {
        'netflix': `${NETMIRROR_BASE}/mobile/search.php`,
        'primevideo': `${NETMIRROR_BASE}/mobile/pv/search.php`,
        'disney': `${NETMIRROR_BASE}/mobile/hs/search.php`
    };

    const searchUrl = searchEndpoints[platform.toLowerCase()] || searchEndpoints['netflix'];

    return makeRequest(
        `${searchUrl}?s=${encodeURIComponent(query)}&t=${getUnixTime()}`,
        {
            headers: {
                ...BASE_HEADERS,
                'Cookie': cookieString,
                'Referer': `${NETMIRROR_BASE}/`
            }
        }
    ).then(function (response) {
        return response.json();
    }).then(function (searchData) {
        if (searchData.searchResult && searchData.searchResult.length > 0) {
            console.log(`[NetMirror] Found ${searchData.searchResult.length} results`);
            return searchData.searchResult.map(item => ({
                id: item.id,
                title: item.t,
                posterUrl: `https://imgcdn.media/poster/v/${item.id}.jpg`
            }));
        } else {
            console.log('[NetMirror] No results found');
            return [];
        }
    });
}

function getStreamingLinks(contentId, title, platform) {
    console.log(`[NetMirror] Getting streaming links for: ${title}`);

    const ottMap = {
        'netflix': 'nf',
        'primevideo': 'pv',
        'disney': 'hs'
    };

    const ott = ottMap[platform.toLowerCase()] || 'nf';

    const cookies = {
        't_hash': globalCookie,
        'user_token': '233123f803cf02184bf6c67e149cdd50',
        'ott': ott,
        'hd': 'on'
    };

    const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

    const playlistEndpoints = {
        'netflix': `${NETMIRROR_BASE}/mobile/playlist.php`,
        'primevideo': `${NETMIRROR_BASE}/mobile/pv/playlist.php`,
        'disney': `${NETMIRROR_BASE}/mobile/hs/playlist.php`
    };

    const playlistUrl = playlistEndpoints[platform.toLowerCase()] || playlistEndpoints['netflix'];

    return makeRequest(
        `${playlistUrl}?id=${contentId}&t=${encodeURIComponent(title)}&tm=${getUnixTime()}`,
        {
            headers: {
                ...BASE_HEADERS,
                'Cookie': cookieString,
                'Referer': `${NETMIRROR_BASE}/`
            }
        }
    ).then(function (response) {
        return response.json();
    }).then(async function (playlist) {
        if (!Array.isArray(playlist) || playlist.length === 0) {
            console.log('[NetMirror] No streaming links found');
            return { sources: [], subtitles: [] };
        }

        const sources = [];
        let logContent = '';

        // Only test the first source to avoid spamming
        if (playlist.length > 0 && playlist[0].sources && playlist[0].sources.length > 0) {
            const source = playlist[0].sources[0];
            let fullUrl = source.file;

            if (fullUrl.includes('/tv/')) {
                fullUrl = fullUrl.replace('/tv/', '/');
            }

            if (!fullUrl.startsWith('/')) fullUrl = '/' + fullUrl;

            fullUrl = NETMIRROR_BASE + '/' + fullUrl;

            // 1. Encoded Token
            let encodedUrl = fullUrl;
            if (encodedUrl.includes('in=unknown::ni')) {
                encodedUrl = encodedUrl.replace('in=unknown::ni', `in=${globalCookie}`);
            }

            // 2. Decoded Token
            let decodedUrl = fullUrl;
            if (decodedUrl.includes('in=unknown::ni')) {
                decodedUrl = decodedUrl.replace('in=unknown::ni', `in=${decodeURIComponent(globalCookie)}`);
            }

            console.log('Testing Encoded URL:', encodedUrl);
            const encodedStatus = await checkUrl(encodedUrl);
            console.log('Encoded Status:', encodedStatus);

            console.log('Testing Decoded URL:', decodedUrl);
            const decodedStatus = await checkUrl(decodedUrl);
            console.log('Decoded Status:', decodedStatus);

            logContent += `Encoded URL: ${encodedUrl} -> Status: ${encodedStatus}\n`;
            logContent += `Decoded URL: ${decodedUrl} -> Status: ${decodedStatus}\n`;
        }

        fs.writeFileSync('netmirror_check_results.txt', logContent);
        console.log('Results written to netmirror_check_results.txt');

        return { sources };
    });
}

async function checkUrl(url) {
    try {
        const response = await makeRequest(url, { method: 'HEAD' });
        return response.status;
    } catch (error) {
        return error.message;
    }
}

async function run() {
    try {
        await bypass();
        const results = await searchContent('The Matrix', 'netflix');
        if (results.length > 0) {
            const firstResult = results[0];
            await getStreamingLinks(firstResult.id, firstResult.title, 'netflix');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
