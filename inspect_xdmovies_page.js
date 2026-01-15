const { execSync } = require('child_process');
const cheerio = require('cheerio');
const fs = require('fs');

const URL = "https://link.xdmovies.site/download/1bdZnYYQAbxeQy6y1q1WHr2_Tsvde-JPRRg43z6EZ14";
const HEADERS = {
    "x-auth-token": "7297skkihkajwnsgaklakshuwd",
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

function makeRequestWithCurl(url, headers = {}, headOnly = false) {
    try {
        console.log(`Using curl for: ${url}`);
        let headerStr = '';
        for (const [key, value] of Object.entries(headers)) {
            headerStr += ` -H "${key}: ${value}"`;
        }
        const flags = headOnly ? '-I' : '-s -L';
        const command = `curl ${flags}${headerStr} "${url}"`;
        return execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } catch (error) {
        console.error(`curl failed: ${error.message}`);
        return null;
    }
}

console.log("--- Headers ---");
console.log(makeRequestWithCurl(URL, HEADERS, true));

const html = makeRequestWithCurl(URL, HEADERS);

if (html) {
    console.log("\n--- HubCloud Search ---");
    if (html.includes('hubcloud')) {
        console.log("Found 'hubcloud' in HTML.");
        const match = html.match(/https?:\/\/[^"'\s]*hubcloud[^"'\s]*/gi);
        if (match) {
            console.log("HubCloud URLs found:", match);
        }
    } else {
        console.log("'hubcloud' NOT found in HTML.");
    }
}
