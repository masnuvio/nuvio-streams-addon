const netmirror = require('./netmirror.js');
const axios = require('axios');

async function testProvider() {
    try {
        console.log('Testing NetMirror provider...');
        // Search for a known movie
        const tmdbId = 603; // The Matrix

        console.log(`Fetching streams for TMDB ID: ${tmdbId}`);
        const streams = await netmirror.getStreams(tmdbId, 'movie');

        if (streams && streams.length > 0) {
            console.log(`Found ${streams.length} streams.`);
            const firstStream = streams[0];
            console.log('First stream URL:', firstStream.url);

            // Verify the URL is accessible
            console.log('Verifying stream URL accessibility...');
            try {
                const response = await axios.head(firstStream.url, {
                    headers: firstStream.headers,
                    validateStatus: status => status < 500
                });
                console.log(`Stream URL Status: ${response.status}`);

                if (response.status === 200) {
                    console.log('SUCCESS: Stream URL is valid and accessible.');
                } else {
                    console.log('WARNING: Stream URL returned non-200 status.');
                }
            } catch (err) {
                console.error('Error checking stream URL:', err.message);
            }
        } else {
            console.log('No streams found.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testProvider();
