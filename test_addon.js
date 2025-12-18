const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');

async function test() {
    console.log('Testing Addon...');

    try {
        const response = await axios.get('http://127.0.0.1:7000/stream/movie/tt1375666.json');
        const streams = response.data.streams || [];
        console.log(`\nStreams for tt1375666 (Inception): ${streams.length}`);
        streams.forEach(s => console.log(`- ${s.name}`));
    } catch (e) {
        console.error('Error fetching tt1375666:', e.message);
    }

    try {
        const response = await axios.get('http://127.0.0.1:7000/stream/movie/tmdb:27205.json');
        const streams = response.data.streams || [];
        console.log(`\nStreams for tmdb:27205 (Inception): ${streams.length}`);
        streams.forEach(s => console.log(`- ${s.name}`));
    } catch (e) {
        console.error('Error fetching tmdb:27205:', e.message);
    }
}

test();
