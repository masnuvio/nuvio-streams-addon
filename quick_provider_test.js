/**
 * Quick Provider Test - Tests specific providers with real content
 */

const path = require('path');

// Test content
const MOVIE_TEST = {
    tmdbId: '550', // Fight Club - widely available
    title: 'Fight Club',
    mediaType: 'movie'
};

const TV_TEST = {
    tmdbId: '1396', // Breaking Bad - widely available
    title: 'Breaking Bad',
    mediaType: 'tv',
    season: 1,
    episode: 1
};

// Providers to test (most likely to work)
const PRIORITY_PROVIDERS = [
    'vidsrc',
    'vidsrcextractor',
    'Showbox',
    'yflix',
    'vidlink',
    'vixsrc',
    'soapertv'
];

async function testProvider(providerName, content) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${providerName}`);
    console.log(`Content: ${content.title}`);
    console.log('='.repeat(60));

    try {
        const providerPath = path.join(__dirname, 'providers', `${providerName}.js`);
        const provider = require(providerPath);

        // Find the stream function
        let getStreamsFunc = provider.getStreams ||
            provider[`get${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Streams`] ||
            provider;

        if (typeof getStreamsFunc !== 'function') {
            const funcNames = Object.keys(provider).filter(key =>
                typeof provider[key] === 'function'
            );
            if (funcNames.length > 0) {
                getStreamsFunc = provider[funcNames[0]];
            }
        }

        if (typeof getStreamsFunc !== 'function') {
            console.log(`❌ No stream function found`);
            return null;
        }

        const startTime = Date.now();
        let streams;

        if (content.mediaType === 'tv') {
            streams = await getStreamsFunc(content.tmdbId, content.mediaType, content.season, content.episode);
        } else {
            streams = await getStreamsFunc(content.tmdbId, content.mediaType);
        }

        const responseTime = Date.now() - startTime;
        const streamCount = Array.isArray(streams) ? streams.length : 0;

        if (streamCount > 0) {
            console.log(`✅ SUCCESS - ${streamCount} streams (${responseTime}ms)`);
            console.log(`\nSample streams:`);
            streams.slice(0, 3).forEach((stream, i) => {
                console.log(`  ${i + 1}. ${stream.name || stream.title || 'Unknown'}`);
                console.log(`     Quality: ${stream.quality || 'Unknown'}`);
                console.log(`     URL: ${stream.url ? stream.url.substring(0, 60) + '...' : 'N/A'}`);
            });
            return { provider: providerName, streams: streamCount, sample: streams[0] };
        } else {
            console.log(`⚠️  No streams found (${responseTime}ms)`);
            return null;
        }

    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        return null;
    }
}

async function quickTest() {
    console.log('\n' + '█'.repeat(60));
    console.log('QUICK PROVIDER TEST - Finding Working Providers');
    console.log('█'.repeat(60));

    const workingProviders = [];

    // Test with movie
    console.log('\n\n📽️  TESTING WITH MOVIE: ' + MOVIE_TEST.title);
    console.log('─'.repeat(60));

    for (const provider of PRIORITY_PROVIDERS) {
        const result = await testProvider(provider, MOVIE_TEST);
        if (result) {
            workingProviders.push({ ...result, contentType: 'movie' });
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test with TV show
    console.log('\n\n📺 TESTING WITH TV SHOW: ' + TV_TEST.title);
    console.log('─'.repeat(60));

    for (const provider of PRIORITY_PROVIDERS) {
        const result = await testProvider(provider, TV_TEST);
        if (result) {
            const existing = workingProviders.find(p => p.provider === provider);
            if (existing) {
                existing.contentType = 'both';
                existing.tvStreams = result.streams;
            } else {
                workingProviders.push({ ...result, contentType: 'tv' });
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n\n' + '█'.repeat(60));
    console.log('WORKING PROVIDERS FOUND');
    console.log('█'.repeat(60));

    if (workingProviders.length > 0) {
        workingProviders.forEach(p => {
            console.log(`\n✅ ${p.provider}`);
            console.log(`   Content: ${p.contentType}`);
            console.log(`   Streams: ${p.streams}${p.tvStreams ? ` (movie), ${p.tvStreams} (tv)` : ''}`);
        });
    } else {
        console.log('\n❌ No working providers found');
    }

    return workingProviders;
}

// Run the test
if (require.main === module) {
    quickTest()
        .then((working) => {
            console.log(`\n\n✅ Test complete! Found ${working.length} working provider(s)`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { quickTest, testProvider };
