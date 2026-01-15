const { getStreams } = require('./providers/videasy.js');
const { execSync } = require('child_process');

async function runTest() {
    console.log("=== Videasy Diagnosis ===");

    // Check for curl
    try {
        const curlVersion = execSync('curl --version', { encoding: 'utf8' }).split('\n')[0];
        console.log(`✓ curl is installed: ${curlVersion}`);
    } catch (e) {
        console.log("✗ curl is NOT installed or not found in PATH!");
        console.log("   -> This is likely why streams are failing if encryption API needs fallback.");
    }

    // Test Movie (Inception)
    const movieId = "27205";
    console.log(`\nRunning getStreams for Inception (ID: ${movieId})...`);

    try {
        const streams = await getStreams(movieId, 'movie');
        console.log(`\nResult: Found ${streams.length} streams.`);

        if (streams.length > 0) {
            console.log("✓ SUCCESS: Streams found.");
            streams.forEach(s => console.log(`- ${s.quality} | ${s.name}`));
        } else {
            console.log("✗ FAILURE: No streams found.");
            console.log("Check the logs above for 'WARNING: All ... streams were filtered out' to see if it's a filter issue.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

runTest();
