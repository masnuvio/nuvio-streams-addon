try {
    console.log('Loading Showbox...');
    require('./providers/Showbox.js');
    console.log('Loaded Showbox OK');
} catch (err) {
    console.error('FAILED to load Showbox:', err.message);
    console.error(err.stack);
}
