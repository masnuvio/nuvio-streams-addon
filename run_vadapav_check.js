const { getStreams } = require('./providers/vadapav.js');

(async () => {
    console.log("Testing Vadapav provider...");
    try {
        const streams = await getStreams('movie', 'tt1375666', null, null);
        console.log("Streams found:", streams.length);
        console.log(JSON.stringify(streams, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
})();
