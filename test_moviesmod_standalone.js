const { getMoviesModStreams } = require('./providers/moviesmod');

async function test() {
    try {
        console.log('Testing MoviesMod standalone (Movie)...');
        // Avatar (TMDB 19995)
        const streams = await getMoviesModStreams('19995', 'movie', null, null);
        console.log('Streams found:', streams.length);
        if (streams.length > 0) {
            console.log(streams[0]);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
