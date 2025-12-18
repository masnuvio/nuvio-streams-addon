/**
 * Addon Verification Test
 * Tests the addon server endpoints to ensure it's working
 */

const axios = require('axios');

const ADDON_URL = 'http://localhost:7000';
const TEST_MOVIE_ID = '550'; // Fight Club
const TEST_TV_ID = '1396:1:1'; // Breaking Bad S01E01

async function testManifest() {
    console.log('\n📋 Testing Manifest Endpoint...');
    try {
        const response = await axios.get(`${ADDON_URL}/manifest.json`);
        if (response.status === 200 && response.data.id) {
            console.log(`✅ Manifest OK - Addon: ${response.data.name}`);
            console.log(`   ID: ${response.data.id}`);
            console.log(`   Version: ${response.data.version}`);
            return true;
        }
    } catch (error) {
        console.log(`❌ Manifest failed: ${error.message}`);
        return false;
    }
}

async function testStreamEndpoint(type, id) {
    console.log(`\n🎬 Testing Stream Endpoint (${type})...`);
    try {
        const response = await axios.get(`${ADDON_URL}/stream/${type}/${id}.json`, {
            timeout: 30000
        });

        if (response.status === 200 && response.data.streams) {
            const streamCount = response.data.streams.length;
            console.log(`✅ Streams found: ${streamCount}`);
            if (streamCount > 0) {
                console.log(`   Sample: ${response.data.streams[0].name || response.data.streams[0].title}`);
                return true;
            }
        }
        console.log(`⚠️  No streams returned`);
        return false;
    } catch (error) {
        console.log(`❌ Stream request failed: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('═'.repeat(60));
    console.log('ADDON VERIFICATION TEST');
    console.log('═'.repeat(60));
    console.log(`Testing addon at: ${ADDON_URL}`);

    const results = {
        manifest: false,
        movieStream: false,
        tvStream: false
    };

    // Test manifest
    results.manifest = await testManifest();

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test movie stream
    results.movieStream = await testStreamEndpoint('movie', TEST_MOVIE_ID);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test TV stream
    results.tvStream = await testStreamEndpoint('series', TEST_TV_ID);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Manifest: ${results.manifest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Movie Streams: ${results.movieStream ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`TV Streams: ${results.tvStream ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = results.manifest && (results.movieStream || results.tvStream);

    if (allPassed) {
        console.log('\n✅ ADDON IS WORKING!');
        console.log(`\nInstall in Stremio: stremio://${ADDON_URL}/manifest.json`);
    } else {
        console.log('\n⚠️  Some tests failed, but addon may still work partially');
    }

    return allPassed;
}

// Run tests
if (require.main === module) {
    setTimeout(() => {
        runTests()
            .then((success) => {
                process.exit(success ? 0 : 1);
            })
            .catch(error => {
                console.error('Test error:', error);
                process.exit(1);
            });
    }, 2000); // Wait 2 seconds for server to start
}

module.exports = { runTests };
