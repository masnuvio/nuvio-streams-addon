const { getVidLinkStreams } = require('./providers/vidlink.js');

async function testVidLink() {
    const tmdbId = "550"; // Fight Club
    console.log(`Testing VidLink for TMDB ID: ${tmdbId}`);

    try {
        const streams = await getVidLinkStreams(tmdbId, "movie");
        console.log(`Found ${streams.length} streams:`);

        streams.forEach((stream, index) => {
            console.log(`\nStream ${index + 1}:`);
            console.log(`  Name: ${stream.name}`);
            console.log(`  URL: ${stream.url}`);
            console.log(`  Quality: ${stream.quality}`);
            console.log(`  Headers: ${JSON.stringify(stream.headers)}`);
        });

        if (streams.length > 0) {
            console.log("\nChecking first stream URL status...");
            const axios = require('axios');
            try {
                const response = await axios.head(streams[0].url, {
                    headers: streams[0].headers,
                    timeout: 5000
                });
                console.log(`  Status: ${response.status}`);
            } catch (err) {
                console.error(`  Error checking URL: ${err.message}`);
                if (err.response) {
                    console.error(`  Response Status: ${err.response.status}`);
                }
            }
        }
    } catch (error) {
        console.error(`Test failed: ${error.message}`);
    }
}

testVidLink();
