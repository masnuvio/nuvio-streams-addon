const { convertImdbToTmdb } = require('./providers/Showbox');
require('dotenv').config();

// Ensure API Key
if (!process.env.TMDB_API_KEY) {
    process.env.TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
}

async function test() {
    console.log('Testing ID Conversion...');
    const imdbId = 'tt1375666'; // Inception
    try {
        console.log(`Converting ${imdbId}...`);
        const result = await convertImdbToTmdb(imdbId, 'movie');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

test();
