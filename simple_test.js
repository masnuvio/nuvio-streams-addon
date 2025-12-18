const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('Starting simple test...');
try {
    const providerModule = require('./providers/moviesmod.js');
    console.log('MoviesMod loaded successfully.');
    if (providerModule.getMoviesModStreams) {
        console.log('getMoviesModStreams found.');
    } else {
        console.log('getMoviesModStreams NOT found.');
    }
} catch (e) {
    console.error('Error loading MoviesMod:', e);
}
console.log('Simple test finished.');
