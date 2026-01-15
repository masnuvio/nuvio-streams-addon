const fs = require('fs');
const axios = require('axios');
const path = require('path');

const NETMIRROR_FILE = path.join(__dirname, 'providers', 'netmirror.js');

async function runDiagnosis() {
    console.log("=== NetMirror Diagnosis ===");

    // 1. Check file content
    if (fs.existsSync(NETMIRROR_FILE)) {
        const content = fs.readFileSync(NETMIRROR_FILE, 'utf8');
        if (content.includes('/tv/playlist.php')) {
            console.log("✓ Code Check: providers/netmirror.js contains '/tv/playlist.php' (UPDATED)");
        } else {
            console.log("✗ Code Check: providers/netmirror.js DOES NOT contain '/tv/playlist.php' (OUTDATED)");
            console.log("   -> Please run 'git pull origin main' and restart.");
            return;
        }
    } else {
        console.log("✗ Code Check: providers/netmirror.js not found!");
        return;
    }

    // 2. Run the provider logic (simplified)
    try {
        const { getStreams } = require('./providers/netmirror.js');
        console.log("\nRunning getStreams for 'Stranger Things'...");

        const streams = await getStreams("66732", "tv", 1, 1); // Stranger Things TMDB ID

        if (streams && streams.length > 0) {
            const firstLink = streams[0].url;
            console.log(`\nGenerated Link: ${firstLink}`);

            if (firstLink.includes('::ni')) {
                console.log("✓ Result: Link ends with ::ni (VALID)");
            } else if (firstLink.includes('::ti')) {
                console.log("✗ Result: Link ends with ::ti (INVALID)");
            } else {
                console.log(`? Result: Unknown suffix`);
            }
        } else {
            console.log("✗ Result: No streams found");
        }

    } catch (error) {
        console.error(`\nError running provider: ${error.message}`);
    }
}

runDiagnosis();
