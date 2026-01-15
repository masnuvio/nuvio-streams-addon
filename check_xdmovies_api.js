const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = "https://xdmovies.site";
const TOKEN = "7297skkihkajwnsgaklakshuwd"; // Decoded from Kotlin
const HEADERS = {
    "x-auth-token": TOKEN,
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

async function testXDMovies() {
    console.log("=== Testing XDMovies API (Deep Debug) ===");

    // 1. Check Homepage
    try {
        console.log(`\n1. Checking Homepage: ${BASE_URL}`);
        const homeRes = await axios.get(BASE_URL, {
            headers: HEADERS,
            validateStatus: () => true
        });
        console.log(`Status: ${homeRes.status}`);
        if (homeRes.status === 200) {
            const $ = cheerio.load(homeRes.data);
            const title = $('title').text().trim();
            console.log(`Page Title: ${title}`);
        }
    } catch (e) {
        console.log(`Homepage failed: ${e.message}`);
    }

    // 2. Search with Token
    const query = "Avengers";
    const searchUrl = `${BASE_URL}/php/search_api.php?query=${query}&fuzzy=true`;

    try {
        console.log(`\n2. Searching for '${query}' (With Token)`);
        console.log(`URL: ${searchUrl}`);
        const searchRes = await axios.get(searchUrl, {
            headers: HEADERS,
            validateStatus: () => true
        });

        console.log(`Status: ${searchRes.status}`);
        console.log(`Data:`, JSON.stringify(searchRes.data).substring(0, 200));
    } catch (e) {
        console.log(`Search failed: ${e.message}`);
    }

    // 3. Search WITHOUT Token (to check if token matters)
    try {
        console.log(`\n3. Searching for '${query}' (WITHOUT Token)`);
        const noTokenHeaders = { ...HEADERS };
        delete noTokenHeaders['x-auth-token'];

        const searchRes = await axios.get(searchUrl, {
            headers: noTokenHeaders,
            validateStatus: () => true
        });

        console.log(`Status: ${searchRes.status}`);
        console.log(`Data:`, JSON.stringify(searchRes.data).substring(0, 200));
    } catch (e) {
        console.log(`Search failed: ${e.message}`);
    }
}

testXDMovies();
