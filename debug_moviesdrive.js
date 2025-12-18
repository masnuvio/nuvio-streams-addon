const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const http = require('http');

const mainUrl = 'https://moviesdrive.design';

function makeRequest(url, callback, allowRedirects = true) {
    console.log(`Fetching: ${url}`);
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    };

    const req = protocol.request(options, (res) => {
        if (allowRedirects && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
                const fullRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
                console.log(`Redirecting to: ${fullRedirectUrl}`);
                makeRequest(fullRedirectUrl, callback, allowRedirects);
                return;
            }
        }

        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log(`Response received. Status: ${res.statusCode}, Length: ${data.length}`);
            callback(null, data, res);
        });
    });

    req.on('error', (err) => {
        console.error(`Request error: ${err.message}`);
        callback(err, null, null);
    });

    req.end();
}

function searchContent(query) {
    const searchUrl = `${mainUrl}/page/1/?s=${encodeURIComponent(query)}`;
    makeRequest(searchUrl, (err, html) => {
        if (err) {
            console.error('Search error:', err);
            return;
        }

        const $ = cheerio.load(html);
        const movieElements = $('ul.recent-movies > li');
        console.log(`Found ${movieElements.length} movie elements.`);

        if (movieElements.length === 0) {
            console.log('HTML snippet:', html.substring(0, 500));
        }

        movieElements.each((index, element) => {
            const $element = $(element);
            const titleElement = $element.find('figure > img');
            const linkElement = $element.find('figure > a');

            const title = titleElement.attr('title');
            const href = linkElement.attr('href');

            console.log(`Item ${index}: Title="${title}", URL="${href}"`);
        });
    });
}

searchContent('Bad Boys II');
