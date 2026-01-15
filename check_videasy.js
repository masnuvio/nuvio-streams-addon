const { getStreams } = require('./providers/videasy.js');

async function runTest() {
    console.log("=== Checking Videasy Provider ===");

    // Test Movie (Stranger Things is a TV show, let's use a movie like Inception or something popular)
    // Inception TMDB ID: 27205
    const movieId = "27205";
    console.log(`\nTesting Movie (ID: ${movieId})...`);
    try {
        const streams = await getStreams(movieId, 'movie');
        console.log(`Found ${streams.length} streams.`);

        if (streams.length > 0) {
            console.log("First 3 streams:");
            streams.slice(0, 3).forEach(s => console.log(`- ${s.quality} | ${s.name}`));

            const non1080p = streams.filter(s => s.quality !== '1080p');
            if (non1080p.length === 0) {
                console.log("✓ SUCCESS: All streams are 1080p.");
            } else {
                console.log(`✗ FAILURE: Found ${non1080p.length} non-1080p streams!`);
                non1080p.forEach(s => console.log(`  - ${s.quality}`));
            }
        } else {
            console.log("⚠ No streams found. Check connection or encryption API.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

runTest();
