const { getStreams: getNetMirrorStreams } = require('./providers/netmirror');

async function test() {
    try {
        console.log('Testing Netmirror standalone...');
        // Avengers: Endgame (TMDB 299534)
        const streams = await getNetMirrorStreams('299534', 'movie');
        console.log('Streams found:', streams.length);
        if (streams.length > 0) {
            console.log(streams[0]);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
