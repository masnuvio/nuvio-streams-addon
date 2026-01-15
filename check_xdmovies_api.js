const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = "https://xdmovies.site";
const HEADERS = {
    "x-auth-token": "7297skkihkajwnsgaklakshuwd",
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

async function testXDMovies() {
    console.log("=== Testing XDMovies API ===");

    // 1. Search
    const query = "Inception";
    console.log(`\n1. Searching for: ${query}`);
    const searchUrl = `${BASE_URL}/php/search_api.php?query=${query}&fuzzy=true`;

    try {
        const searchRes = await axios.get(searchUrl, { headers: HEADERS });
        const results = searchRes.data;
        console.log(`Found ${results.length} results.`);

        if (results.length === 0) return;

        const firstResult = results[0];
        console.log("First result:", firstResult);

        // 2. Load Details
        const detailUrl = BASE_URL + firstResult.path;
        console.log(`\n2. Loading details from: ${detailUrl}`);

        const detailRes = await axios.get(detailUrl, { headers: HEADERS });
        const $ = cheerio.load(detailRes.data);

        // 3. Extract Links
        console.log("\n3. Extracting Download Links:");
        const links = [];
        $('div.download-item a').each((i, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().trim();
            if (link) {
                console.log(`- [${text}] ${link}`);
                links.push(link);
            }
        });

        if (links.length === 0) {
            console.log("No download links found in div.download-item a");
            // Try TV show selector just in case
            $('.season-section').each((i, el) => {
                console.log("Found season section...");
            });
        }

    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

testXDMovies();
