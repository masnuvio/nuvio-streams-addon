/**
 * Individual Provider Testing Script
 * Tests each provider one by one with detailed error reporting
 */

const path = require('path');
const fs = require('fs').promises;

// Test content
const TEST_CONTENT = {
    movie: {
        tmdbId: '550', // Fight Club
        title: 'Fight Club',
        mediaType: 'movie'
    },
    tv: {
        tmdbId: '1396', // Breaking Bad
        title: 'Breaking Bad',
        mediaType: 'tv',
        season: 1,
        episode: 1
    }
};

// All providers
const ALL_PROVIDERS = [
    '4khdhub', 'MP4Hydra', 'Showbox', 'VidZee', 'animekai', 'castle',
    'cinevibe', 'dahmermovies', 'dramadrip', 'dvdplay', 'hdhub4u', 'hdrezkas',
    'mallumv', 'mapple', 'moviebox', 'moviesdrive', 'moviesmod', 'netmirror',
    'soapertv', 'streamflix', 'topmovies', 'uhdmovies', 'videasy', 'vidlink',
    'vidnest', 'vidrock', 'vidsrc', 'vidsrcextractor', 'vixsrc', 'watch32',
    'xprime', 'yflix'
];

const statusEmoji = {
    'working': '✅',
    'no_streams': '⚠️',
    'file_not_found': '📁',
    'require_error': '🔴',
    'no_stream_function': '❓',
    'execution_error': '❌',
    'unexpected_error': '💥'
};

async function testSingleProvider(providerName, content, contentType) {
    const result = {
        provider: providerName,
        contentType,
        status: 'unknown',
        streamsFound: 0,
        error: null,
        errorType: null,
        responseTime: null,
        sampleStream: null
    };

    try {
        const providerPath = path.join(__dirname, 'providers', `${providerName}.js`);

        try {
            await fs.access(providerPath);
        } catch {
            result.status = 'file_not_found';
            result.error = 'Provider file does not exist';
            return result;
        }

        let provider;
        try {
            delete require.cache[require.resolve(providerPath)];
            provider = require(providerPath);
        } catch (requireError) {
            result.status = 'require_error';
            result.error = requireError.message;
            result.errorType = 'syntax_or_dependency';
            return result;
        }

        let getStreamsFunc = null;
        const possibleNames = [
            'getStreams',
            `get${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Streams`
        ];

        for (const funcName of possibleNames) {
            if (typeof provider[funcName] === 'function') {
                getStreamsFunc = provider[funcName];
                break;
            }
        }

        if (!getStreamsFunc && typeof provider === 'function') {
            getStreamsFunc = provider;
        }

        if (!getStreamsFunc) {
            result.status = 'no_stream_function';
            result.error = 'No stream function found';
            return result;
        }

        const startTime = Date.now();
        let streams;

        try {
            if (content.mediaType === 'tv') {
                streams = await getStreamsFunc(content.tmdbId, content.mediaType, content.season, content.episode);
            } else {
                streams = await getStreamsFunc(content.tmdbId, content.mediaType);
            }
        } catch (execError) {
            result.responseTime = Date.now() - startTime;
            result.status = 'execution_error';
            result.error = execError.message;

            if (execError.message.includes('ECONNRESET')) {
                result.errorType = 'connection_reset';
            } else if (execError.message.includes('timeout')) {
                result.errorType = 'timeout';
            } else if (execError.message.includes('ENOTFOUND')) {
                result.errorType = 'dns_error';
            } else {
                result.errorType = 'unknown_error';
            }

            return result;
        }

        result.responseTime = Date.now() - startTime;
        result.streamsFound = Array.isArray(streams) ? streams.length : 0;

        if (result.streamsFound > 0) {
            result.status = 'working';
            result.sampleStream = {
                name: streams[0].name || streams[0].title || 'Unknown',
                quality: streams[0].quality || 'Unknown'
            };
        } else {
            result.status = 'no_streams';
            result.error = 'Provider executed but returned no streams';
        }

    } catch (unexpectedError) {
        result.status = 'unexpected_error';
        result.error = unexpectedError.message;
    }

    return result;
}

async function testAllProviders() {
    console.log('\n' + '█'.repeat(80));
    console.log('COMPREHENSIVE INDIVIDUAL PROVIDER TEST');
    console.log('█'.repeat(80));
    console.log(`Testing ${ALL_PROVIDERS.length} providers\n`);

    const results = {
        movie: [],
        tv: [],
        summary: { working: [], noStreams: [], errors: [] }
    };

    let testNumber = 0;
    const totalTests = ALL_PROVIDERS.length * 2;

    // Test with movie
    console.log('\n' + '▓'.repeat(80));
    console.log(`TESTING WITH MOVIE: ${TEST_CONTENT.movie.title}`);
    console.log('▓'.repeat(80));

    for (const provider of ALL_PROVIDERS) {
        testNumber++;
        console.log(`\n[${testNumber}/${totalTests}] Testing ${provider}...`);

        const result = await testSingleProvider(provider, TEST_CONTENT.movie, 'movie');
        results.movie.push(result);

        const emoji = statusEmoji[result.status] || '❓';
        console.log(`${emoji} ${result.status.toUpperCase()}`);

        if (result.streamsFound > 0) {
            console.log(`   Streams: ${result.streamsFound} (${result.responseTime}ms)`);
        } else if (result.error) {
            console.log(`   Error: ${result.error.substring(0, 80)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Test with TV
    console.log('\n' + '▓'.repeat(80));
    console.log(`TESTING WITH TV: ${TEST_CONTENT.tv.title} S${TEST_CONTENT.tv.season}E${TEST_CONTENT.tv.episode}`);
    console.log('▓'.repeat(80));

    for (const provider of ALL_PROVIDERS) {
        testNumber++;
        console.log(`\n[${testNumber}/${totalTests}] Testing ${provider}...`);

        const result = await testSingleProvider(provider, TEST_CONTENT.tv, 'tv');
        results.tv.push(result);

        const emoji = statusEmoji[result.status] || '❓';
        console.log(`${emoji} ${result.status.toUpperCase()}`);

        if (result.streamsFound > 0) {
            console.log(`   Streams: ${result.streamsFound} (${result.responseTime}ms)`);
        } else if (result.error) {
            console.log(`   Error: ${result.error.substring(0, 80)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Summary
    console.log('\n' + '█'.repeat(80));
    console.log('SUMMARY');
    console.log('█'.repeat(80));

    for (const provider of ALL_PROVIDERS) {
        const movieResult = results.movie.find(r => r.provider === provider);
        const tvResult = results.tv.find(r => r.provider === provider);

        const movieWorks = movieResult?.status === 'working';
        const tvWorks = tvResult?.status === 'working';

        if (movieWorks && tvWorks) {
            results.summary.working.push(provider);
            console.log(`\n✅ ${provider}: WORKING (both)`);
        } else if (movieWorks || tvWorks) {
            results.summary.working.push(provider);
            console.log(`\n⚠️  ${provider}: PARTIAL (${movieWorks ? 'movie' : 'tv'} only)`);
        } else if (movieResult?.status === 'no_streams' || tvResult?.status === 'no_streams') {
            results.summary.noStreams.push(provider);
            console.log(`\n⚠️  ${provider}: NO STREAMS`);
        } else {
            results.summary.errors.push(provider);
            console.log(`\n❌ ${provider}: ERROR (${movieResult?.errorType || tvResult?.errorType})`);
        }
    }

    console.log('\n' + '█'.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('█'.repeat(80));
    console.log(`✅ Working: ${results.summary.working.length}/${ALL_PROVIDERS.length}`);
    console.log(`⚠️  No Streams: ${results.summary.noStreams.length}/${ALL_PROVIDERS.length}`);
    console.log(`❌ Errors: ${results.summary.errors.length}/${ALL_PROVIDERS.length}`);

    // Save results
    const reportPath = path.join(__dirname, 'individual_provider_results.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to: ${reportPath}`);

    return results;
}

if (require.main === module) {
    testAllProviders()
        .then((results) => {
            console.log(`\n✅ Testing complete! Working: ${results.summary.working.length}/${ALL_PROVIDERS.length}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testAllProviders, testSingleProvider };
