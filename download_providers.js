const fs = require('fs');
const path = require('path');
const https = require('https');

const providers = [
    'animekai.js',
    'cinevibe.js',
    'dahmermovies.js',
    'dvdplay.js',
    'hdhub4u.js',
    'mallumv.js',
    'mapple.js',
    'streamflix.js',
    'videasy.js',
    'vidlink.js',
    'vidnest-anime.js',
    'vidnest.js',
    'vidrock.js',
    'vidsrc.js',
    'watch32.js',
    'xprime.js',
    'yflix.js'
];

const baseUrl = 'https://raw.githubusercontent.com/tapframe/nuvio-providers/main/providers/';
const targetDir = path.join(__dirname, 'providers');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

async function downloadFile(filename) {
    const url = baseUrl + filename;
    const filePath = path.join(targetDir, filename);

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => { });
            reject(err);
        });
    });
}

async function downloadAll() {
    console.log('Starting downloads...');
    for (const provider of providers) {
        try {
            await downloadFile(provider);
        } catch (err) {
            console.error(`Error downloading ${provider}:`, err.message);
        }
    }
    console.log('All downloads complete.');
}

downloadAll();
