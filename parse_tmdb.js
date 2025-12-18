const fs = require('fs');

try {
    const raw = fs.readFileSync('tmdb_response.json', 'utf8');
    // The file might contain the "Testing TMDB Key..." logs at the top, so we need to extract the JSON part.
    // Or better, let's just run the request again and print ONLY JSON.

    // Actually, let's just make a new request and print clean JSON.
    const axios = require('axios');
    const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
    const imdbId = 'tt1375666';
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

    axios.get(url).then(res => {
        console.log('Movie Results:', JSON.stringify(res.data.movie_results, null, 2));
        console.log('TV Results:', JSON.stringify(res.data.tv_results, null, 2));
    }).catch(err => console.error(err.message));

} catch (e) {
    console.error(e);
}
