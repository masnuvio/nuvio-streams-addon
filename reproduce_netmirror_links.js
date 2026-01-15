const axios = require('axios');
const crypto = require('crypto');

const NETMIRROR_BASE = "https://net51.cc";
const BASE_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive"
};

// Hardcoded token from netmirror.js
const VALID_TOKEN = "233123f803cf02184bf6c67e149cdd50";
const RANDOM_TOKEN = crypto.randomBytes(16).toString('hex');

async function bypass() {
    console.log('[NetMirror] Bypassing authentication...');
    try {
        const response = await axios.post(`${NETMIRROR_BASE}/tv/p.php`, {}, {
            headers: BASE_HEADERS
        });

        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
            const match = cookieString.match(/t_hash_t=([^;]+)/);
            if (match) {
                console.log('[NetMirror] Got t_hash_t:', match[1]);
                return match[1];
            }
        }
        throw new Error("No t_hash_t cookie found");
    } catch (error) {
        console.error('[NetMirror] Bypass failed:', error.message);
        throw error;
    }
}

async function getLink(contentId, title, token, tokenName) {
    try {
        const tHashT = await bypass();

        const cookies = {
            "t_hash_t": tHashT,
            "user_token": token,
            "hd": "on",
            "ott": "nf"
        };
        const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');

        console.log(`\n[NetMirror] Testing with ${tokenName}: ${token}`);
        const playlistUrl = `${NETMIRROR_BASE}/tv/playlist.php`;
        const params = new URLSearchParams({
            id: contentId,
            t: title,
            tm: Math.floor(Date.now() / 1000)
        });

        const response = await axios.get(`${playlistUrl}?${params.toString()}`, {
            headers: {
                ...BASE_HEADERS,
                "Cookie": cookieString,
                "Referer": `${NETMIRROR_BASE}/tv/home`
            }
        });

        const playlist = response.data;
        if (Array.isArray(playlist) && playlist.length > 0) {
            const firstSource = playlist[0].sources[0];
            console.log('[NetMirror] Generated Link:', firstSource.file);

            if (firstSource.file.includes('::ni')) {
                console.log('[NetMirror] RESULT: ::ni (Valid)');
            } else if (firstSource.file.includes('::ti')) {
                console.log('[NetMirror] RESULT: ::ti (Invalid/Trial?)');
            } else {
                console.log('[NetMirror] RESULT: Unknown Suffix');
            }
        } else {
            console.log('[NetMirror] No streams found');
        }

    } catch (error) {
        console.error('[NetMirror] Error:', error.message);
    }
}

async function run() {
    // await getLink("81406419", "Stranger Things", VALID_TOKEN, "HARDCODED TOKEN");
    await getLink("81406419", "Stranger Things", RANDOM_TOKEN, "RANDOM TOKEN");
}

run();
