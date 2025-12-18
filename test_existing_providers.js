const providers = [
    'soapertv',
    'vidsrcextractor',
    'VidZee',
    'MP4Hydra',
    'uhdmovies',
    'moviesmod',
    'topmovies',
    'moviesdrive',
    '4khdhub',
    'vixsrc',
    'moviebox'
];

console.log('Testing existing providers imports...');

for (const provider of providers) {
    try {
        console.log(`Loading ${provider}...`);
        require(`./providers/${provider}.js`);
        console.log(`Loaded ${provider} OK`);
    } catch (err) {
        console.error(`FAILED to load ${provider}:`, err.message);
        console.error(err.stack);
    }
}

console.log('Test complete.');
