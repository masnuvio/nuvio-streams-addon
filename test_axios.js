const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');

async function test() {
    console.log(JSON.stringify(process.env, null, 2));
    try {
        console.log('Testing axios connection to TMDB...');
        const url = 'https://api.themoviedb.org/3/movie/550?api_key=439c478a771f35c05022f9feabcca01c';
        const res = await axios.get(url);
        console.log('Status:', res.status);
        console.log('Data title:', res.data.title);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.code) console.error('Code:', e.code);
    }
}

test();
