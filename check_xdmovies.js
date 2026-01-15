const { getStreams } = require('./providers/xdmovies.js');

async function runTest() {
    console.log("=== Checking XDMovies Provider ===");

    // Test Movie: Avengers: Infinity War
    // TMDB ID: 299536
    const movieId = "299536";
    console.log(`\nTesting Movie (ID: ${movieId})...`);
    try {
        const streams = await getStreams(movieId, 'movie');
        console.log(`Found ${streams.length} streams.`);

        if (streams.length > 0) {
            console.log("First 3 streams:");
            streams.slice(0, 3).forEach(s => console.log(`- ${s.name} | ${s.url}`));
        } else {
            console.log("⚠ No streams found.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

runTest();
