const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Mock global variables if needed
global.redis = null;

async function testProvider(providerName) {
    console.log(`Testing provider: ${providerName}`);
    try {
        let providerModule;
        if (providerName.toLowerCase() === 'netmirror') {
            providerModule = require('./providers/netmirror.js');
        } else if (providerName.toLowerCase() === 'castle') {
            providerModule = require('./providers/castle.js');
        } else {
            console.error('Unknown provider');
            return;
        }

        // Test with a known movie (e.g., Interstellar or a recent one)
        // NetMirror and Castle might need specific IDs or queries
        // NetMirror uses search, Castle uses TMDB ID

        if (providerName.toLowerCase() === 'netmirror') {
            // NetMirror usually takes a query or TMDB ID depending on implementation
            // Looking at netmirror.js, getStreams takes (tmdbId, type, season, episode)
            const streams = await providerModule.getStreams(157336, 'movie');
            console.log(`NetMirror Streams: ${streams ? streams.length : 0}`);
            if (streams && streams.length > 0) console.log(streams[0]);
        } else {
            // Castle
            const streams = await providerModule.getStreams(157336, 'movie');
            console.log(`Castle Streams: ${streams ? streams.length : 0}`);
            if (streams && streams.length > 0) console.log(streams[0]);
        }

    } catch (error) {
        console.error(`Error testing ${providerName}:`, error);
    }
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node test_provider_nc.js <provider_name>');
} else {
    testProvider(args[0]);
}
