const axios = require('axios');

async function run() {
    try {
        console.log('Fetching streams for Deadpool & Wolverine (tt6263850)...');
        const streamsUrl = 'http://localhost:7000/stream/movie/tt6263850.json';
        const streamsRes = await axios.get(streamsUrl);

        console.log('Streams found:', streamsRes.data.streams.length);

        streamsRes.data.streams.forEach(s => {
            if (s.url.includes('storm.vodvidl.site') || s.url.includes('videostr') || s.url.includes('sunmelt')) {
                console.log(`MATCH FOUND! Provider: ${s.name || s.provider}`);
                console.log(`URL: ${s.url}`);
                console.log(`Headers:`, s.behaviorHints?.headers || s.headers);
            }
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
