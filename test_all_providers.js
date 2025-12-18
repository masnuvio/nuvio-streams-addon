/**
 * Comprehensive Provider Testing Script
 * Tests all available providers with sample content
 */

const path = require('path');
const fs = require('fs').promises;

// Test content
const TEST_CONTENT = {
    movie: {
        tmdbId: '299534', // Avengers: Endgame
        title: 'Avengers: Endgame',
        mediaType: 'movie'
    },
    tvShow: {
        tmdbId: '76479', // The Boys
        title: 'The Boys',
        mediaType: 'tv',
        season: 1,
        episode: 1
    }
};

// List of providers to test
const PROVIDERS = [
    'moviesmod',
    'netmirror',
    'vidsrc',
    'showbox',
    'moviebox',
    'yts',
    'moviesdrive',
    'vegamovies',
    'dotmovies',
    'hdmovies4u',
    'katmoviehd',
    'movieflix',
    'moviesda',
    'tamilblasters',
    'tamilmv',
    'tamilrockers',
    'cinevood',
    'uhdmovies'
];

async function testProvider(providerName, content) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${providerName.toUpperCase()}`);
    console.log(`Content: ${content.title} (${content.mediaType})`);
    console.log('='.repeat(80));

    const result = {
        provider: providerName,
        content: content.title,
        mediaType: content.mediaType,
        status: 'unknown',
        streamsFound: 0,
        error: null,
        responseTime: null,
        sampleStream: null
    };

    try {
        // Try to load the provider
        const providerPath = path.join(__dirname, 'providers', `${providerName}.js`);

        // Check if provider file exists
        try {
            await fs.access(providerPath);
        } catch {
            result.status = 'not_found';
            result.error = 'Provider file not found';
            console.log(`❌ Provider file not found: ${providerPath}`);
            return result;
        }

        const provider = require(providerPath);

        // Find the main export function
        let getStreamsFunc = null;
        if (typeof provider.getStreams === 'function') {
            getStreamsFunc = provider.getStreams;
        } else if (typeof provider[`get${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Streams`] === 'function') {
            getStreamsFunc = provider[`get${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Streams`];
        } else if (typeof provider === 'function') {
            getStreamsFunc = provider;
        } else {
            // Try to find any function that looks like a stream getter
            const funcNames = Object.keys(provider).filter(key =>
                typeof provider[key] === 'function' &&
                (key.toLowerCase().includes('stream') || key.toLowerCase().includes('get'))
            );
            if (funcNames.length > 0) {
                getStreamsFunc = provider[funcNames[0]];
            }
        }

        if (!getStreamsFunc) {
            result.status = 'no_export';
            result.error = 'No stream function found';
            console.log(`❌ No stream function found in provider`);
            return result;
        }

        // Test the provider
        const startTime = Date.now();
        let streams;

        if (content.mediaType === 'tv') {
            streams = await getStreamsFunc(content.tmdbId, content.mediaType, content.season, content.episode);
        } else {
            streams = await getStreamsFunc(content.tmdbId, content.mediaType);
        }

        result.responseTime = Date.now() - startTime;
        result.streamsFound = Array.isArray(streams) ? streams.length : 0;

        if (result.streamsFound > 0) {
            result.status = 'working';
            result.sampleStream = {
                name: streams[0].name || streams[0].title || 'Unknown',
                quality: streams[0].quality || 'Unknown',
                hasUrl: !!streams[0].url
            };
            console.log(`✅ SUCCESS - Found ${result.streamsFound} streams (${result.responseTime}ms)`);
            console.log(`   Sample: ${result.sampleStream.name} - ${result.sampleStream.quality}`);
        } else {
            result.status = 'no_streams';
            console.log(`⚠️  No streams found (${result.responseTime}ms)`);
        }

    } catch (error) {
        result.status = 'error';
        result.error = error.message;
        console.log(`❌ ERROR: ${error.message}`);

        // Categorize errors
        if (error.message.includes('ECONNRESET')) {
            result.status = 'connection_reset';
        } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
            result.status = 'timeout';
        } else if (error.message.includes('ENOTFOUND')) {
            result.status = 'dns_error';
        } else if (error.message.includes('403')) {
            result.status = 'blocked';
        } else if (error.message.includes('404')) {
            result.status = 'not_found_content';
        }
    }

    return result;
}

async function testAllProviders() {
    console.log('\n' + '█'.repeat(80));
    console.log('COMPREHENSIVE PROVIDER TEST');
    console.log('█'.repeat(80));
    console.log(`Testing ${PROVIDERS.length} providers with movie and TV show content\n`);

    const results = {
        movie: [],
        tvShow: [],
        timestamp: new Date().toISOString()
    };

    // Test with movie
    console.log('\n' + '▓'.repeat(80));
    console.log('TESTING WITH MOVIE CONTENT');
    console.log('▓'.repeat(80));

    for (const provider of PROVIDERS) {
        const result = await testProvider(provider, TEST_CONTENT.movie);
        results.movie.push(result);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test with TV show
    console.log('\n' + '▓'.repeat(80));
    console.log('TESTING WITH TV SHOW CONTENT');
    console.log('▓'.repeat(80));

    for (const provider of PROVIDERS) {
        const result = await testProvider(provider, TEST_CONTENT.tvShow);
        results.tvShow.push(result);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate summary
    console.log('\n' + '█'.repeat(80));
    console.log('SUMMARY REPORT');
    console.log('█'.repeat(80));

    const summary = {
        working: [],
        partiallyWorking: [],
        notWorking: [],
        errors: []
    };

    for (const provider of PROVIDERS) {
        const movieResult = results.movie.find(r => r.provider === provider);
        const tvResult = results.tvShow.find(r => r.provider === provider);

        const movieWorks = movieResult?.status === 'working';
        const tvWorks = tvResult?.status === 'working';

        if (movieWorks && tvWorks) {
            summary.working.push(provider);
        } else if (movieWorks || tvWorks) {
            summary.partiallyWorking.push({
                provider,
                works: movieWorks ? 'movie' : 'tv'
            });
        } else {
            summary.notWorking.push({
                provider,
                movieStatus: movieResult?.status,
                tvStatus: tvResult?.status,
                error: movieResult?.error || tvResult?.error
            });
        }
    }

    console.log(`\n✅ FULLY WORKING (${summary.working.length}):`);
    summary.working.forEach(p => console.log(`   - ${p}`));

    console.log(`\n⚠️  PARTIALLY WORKING (${summary.partiallyWorking.length}):`);
    summary.partiallyWorking.forEach(p => console.log(`   - ${p.provider} (${p.works} only)`));

    console.log(`\n❌ NOT WORKING (${summary.notWorking.length}):`);
    summary.notWorking.forEach(p => {
        console.log(`   - ${p.provider}`);
        console.log(`     Movie: ${p.movieStatus}, TV: ${p.tvStatus}`);
        if (p.error) console.log(`     Error: ${p.error}`);
    });

    // Save detailed results
    const reportPath = path.join(__dirname, 'provider_test_results.json');
    await fs.writeFile(reportPath, JSON.stringify({
        ...results,
        summary
    }, null, 2));

    console.log(`\n📄 Detailed results saved to: ${reportPath}`);

    // Create markdown report
    const markdownReport = generateMarkdownReport(results, summary);
    const mdPath = path.join(__dirname, 'PROVIDER_STATUS.md');
    await fs.writeFile(mdPath, markdownReport);
    console.log(`📄 Status report saved to: ${mdPath}`);

    return { results, summary };
}

function generateMarkdownReport(results, summary) {
    const timestamp = new Date().toLocaleString();

    let md = `# Provider Status Report\n\n`;
    md += `**Generated:** ${timestamp}\n\n`;
    md += `## Summary\n\n`;
    md += `- ✅ Fully Working: ${summary.working.length}\n`;
    md += `- ⚠️ Partially Working: ${summary.partiallyWorking.length}\n`;
    md += `- ❌ Not Working: ${summary.notWorking.length}\n\n`;

    md += `## Fully Working Providers\n\n`;
    if (summary.working.length > 0) {
        summary.working.forEach(p => {
            const movieResult = results.movie.find(r => r.provider === p);
            const tvResult = results.tvShow.find(r => r.provider === p);
            md += `### ${p}\n`;
            md += `- Movie: ${movieResult.streamsFound} streams (${movieResult.responseTime}ms)\n`;
            md += `- TV Show: ${tvResult.streamsFound} streams (${tvResult.responseTime}ms)\n\n`;
        });
    } else {
        md += `No fully working providers found.\n\n`;
    }

    md += `## Partially Working Providers\n\n`;
    if (summary.partiallyWorking.length > 0) {
        summary.partiallyWorking.forEach(p => {
            md += `### ${p.provider}\n`;
            md += `- Works for: ${p.works}\n\n`;
        });
    } else {
        md += `No partially working providers.\n\n`;
    }

    md += `## Not Working Providers\n\n`;
    if (summary.notWorking.length > 0) {
        summary.notWorking.forEach(p => {
            md += `### ${p.provider}\n`;
            md += `- Movie Status: \`${p.movieStatus}\`\n`;
            md += `- TV Status: \`${p.tvStatus}\`\n`;
            if (p.error) md += `- Error: \`${p.error}\`\n`;
            md += `\n`;
        });
    }

    md += `## Recommendations\n\n`;
    md += `1. **Working Providers**: Use these for production\n`;
    md += `2. **Connection Reset Errors**: Try using proxy configuration (see PROXY_SETUP.md)\n`;
    md += `3. **DNS Errors**: Check if domain is correct in domains.json\n`;
    md += `4. **No Streams**: Provider may have changed their structure or API\n\n`;

    return md;
}

// Run the test
if (require.main === module) {
    testAllProviders()
        .then(() => {
            console.log('\n✅ Provider testing complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error during testing:', error);
            process.exit(1);
        });
}

module.exports = { testAllProviders, testProvider };
