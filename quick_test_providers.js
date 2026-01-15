const fs = require('fs');
const path = require('path');

// Suppress console output from providers
const originalLog = console.log;
const originalError = console.error;
console.log = () => { };
console.error = () => { };

const providers = [
    { name: 'MoviesDrive', file: './providers/moviesdrive.js', func: 'getMoviesDriveStreams' },
    { name: 'DVDPlay', file: './providers/dvdplay.js', func: 'getStreams' },
    { name: 'HDHub4u', file: './providers/hdhub4u.js', func: 'getStreams' },
    { name: 'MalluMV', file: './providers/mallumv.js', func: 'getStreams' },
    { name: 'MoviesMod', file: './providers/moviesmod.js', func: 'getMoviesModStreams' },
    { name: 'UHDMovies', file: './providers/uhdmovies.js', func: 'getUHDMoviesStreams' },
    { name: '4KHDHub', file: './providers/4khdhub.js', func: 'get4KHDHubStreams' },
    { name: 'TopMovies', file: './providers/topmovies.js', func: 'getTopMoviesStreams' },
    { name: 'SoaperTV', file: './providers/soapertv.js', func: 'getSoaperTvStreams' },
    { name: 'NetMirror', file: './providers/netmirror.js', func: 'getStreams' },
    { name: 'Mapple', file: './providers/mapple.js', func: 'getStreams' },
    { name: 'VidSrc', file: './providers/vidsrc.js', func: 'getStreams' },
    { name: 'Videasy', file: './providers/videasy.js', func: 'getStreams' },
    { name: 'MP4Hydra', file: './providers/MP4Hydra.js', func: 'getMP4HydraStreams' },
    { name: 'VidZee', file: './providers/VidZee.js', func: 'getVidZeeStreams' },
];

async function testProvider(provider) {
    try {
        const modulePath = path.resolve(__dirname, provider.file);
        if (!fs.existsSync(modulePath)) {
            return { name: provider.name, status: 'FILE_NOT_FOUND', count: 0 };
        }

        const module = require(modulePath);
        const func = module[provider.func];

        if (typeof func !== 'function') {
            return { name: provider.name, status: 'FUNCTION_NOT_FOUND', count: 0 };
        }

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 15000)
        );

        const streams = await Promise.race([
            func('603', 'movie'),
            timeoutPromise
        ]);

        if (streams && streams.length > 0) {
            return { name: provider.name, status: '✅ SUCCESS', count: streams.length };
        } else {
            return { name: provider.name, status: '❌ NO_STREAMS', count: 0 };
        }

    } catch (error) {
        const status = error.message === 'TIMEOUT' ? '⏱️ TIMEOUT' : '❌ ERROR';
        return { name: provider.name, status, count: 0, error: error.message.substring(0, 50) };
    }
}

async function testAllProviders() {
    originalLog('\n🔍 Testing All Providers (The Matrix - TMDB ID: 603)\n');
    originalLog('='.repeat(60));

    const results = [];

    for (const provider of providers) {
        originalLog(`\nTesting: ${provider.name}...`);
        const result = await testProvider(provider);
        results.push(result);

        const statusEmoji = result.status.includes('SUCCESS') ? '✅' :
            result.status.includes('TIMEOUT') ? '⏱️' : '❌';
        originalLog(`${statusEmoji} ${provider.name}: ${result.status} ${result.count > 0 ? `(${result.count} streams)` : ''}`);
    }

    originalLog('\n' + '='.repeat(60));
    originalLog('\n📊 SUMMARY:\n');

    const success = results.filter(r => r.status.includes('SUCCESS'));
    const failed = results.filter(r => !r.status.includes('SUCCESS'));

    originalLog(`✅ Working: ${success.length}/${results.length}`);
    success.forEach(r => originalLog(`   - ${r.name} (${r.count} streams)`));

    originalLog(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => originalLog(`   - ${r.name}: ${r.status}`));

    originalLog('\n' + '='.repeat(60));
}

testAllProviders().catch(err => {
    originalError('Fatal error:', err);
    process.exit(1);
});
