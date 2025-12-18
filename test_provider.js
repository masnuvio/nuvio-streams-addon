const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Mock global variables if needed by providers
global.redis = null; // or mock redis client if needed

// Helper to run test
async function testProvider(providerName, tmdbId, type = 'movie', season = 1, episode = 1) {
    console.log(`Testing provider: ${providerName} for ID: ${tmdbId} (${type})`);
    try {
        let providerModule;
        let getStreamsFunc;

        switch (providerName.toLowerCase()) {
            case 'moviesmod':
                providerModule = require('./providers/moviesmod.js');
                getStreamsFunc = providerModule.getMoviesModStreams;
                break;
            case 'moviesdrive':
                providerModule = require('./providers/moviesdrive.js');
                getStreamsFunc = providerModule.getMoviesDriveStreams;
                break;
            case 'uhdmovies':
                providerModule = require('./providers/uhdmovies.js');
                getStreamsFunc = providerModule.getUHDMoviesStreams;
                break;
            case '4khdhub':
                providerModule = require('./providers/4khdhub.js');
                getStreamsFunc = providerModule.get4KHDHubStreams;
                break;
            case 'showbox':
                providerModule = require('./providers/showbox.js');
                getStreamsFunc = providerModule.getStreamsFromTmdbId;
                break;
            case 'vidsrc':
                providerModule = require('./providers/vidsrcextractor.js');
                getStreamsFunc = providerModule.getStreamContent;
                break;
            case 'soapertv':
                providerModule = require('./providers/soapertv.js');
                getStreamsFunc = providerModule.getSoaperTvStreams;
                break;
            case 'topmovies':
                providerModule = require('./providers/topmovies.js');
                getStreamsFunc = providerModule.getTopMoviesStreams;
                break;
            case 'netmirror':
                providerModule = require('./providers/netmirror.js');
                getStreamsFunc = providerModule.getStreams;
                break;
            default:
                console.error(`Unknown provider: ${providerName}`);
                return;
        }

        if (!getStreamsFunc) {
            console.error(`Function not found for provider: ${providerName}`);
            return;
        }

        const streams = await getStreamsFunc(tmdbId, type, season, episode);
        console.log(`\n--- Results for ${providerName} ---`);
        console.log(`Count: ${streams ? streams.length : 0}`);
        if (streams && streams.length > 0) {
            console.log('First stream sample:', JSON.stringify(streams[0], null, 2));
        } else {
            console.log('No streams returned.');
        }

    } catch (error) {
        console.error(`Error testing ${providerName}:`, error);
    }
}

// CLI args: node test_provider.js <provider> <tmdbId> [type] [season] [episode]
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node test_provider.js <provider> <tmdbId> [type] [season] [episode]');
    process.exit(1);
}

const [provider, id, type, season, episode] = args;
testProvider(provider, id, type, season, episode);
