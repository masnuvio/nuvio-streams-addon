const axios = require('axios');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const imdbId = 'tt1375666';
const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

async function testKey() {
    console.log(`Testing TMDB Key: ${TMDB_API_KEY}`);
    console.log(`URL: ${url}`);
    try {
        const response = await axios.get(url);
        console.log('Success!');
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testKey();
