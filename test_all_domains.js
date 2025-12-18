/**
 * Comprehensive Domain Testing Script
 * Tests all provider domains for connectivity and response
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Provider domains to test
const DOMAINS_TO_TEST = {
    moviesmod: [
        'https://moviesmod.bid',
        'https://moviesmod.how',
        'https://moviesmod.in',
        'https://moviesmod.city',
        'https://moviesmod.kids',
        'https://moviesmod.org'
    ],
    netmirror: [
        'https://netmirror.app',
        'https://net51.cc',
        'https://netmirror.to'
    ],
    vidsrc: [
        'https://vidsrc.to',
        'https://vidsrc.me',
        'https://vidsrc.net'
    ],
    showbox: [
        'https://www.showbox.media'
    ],
    moviebox: [
        'https://www.movieboxpro.app'
    ]
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
};

async function testDomain(url) {
    const result = {
        url,
        status: 'unknown',
        statusCode: null,
        responseTime: null,
        error: null,
        cloudflare: false,
        redirect: null
    };

    const startTime = Date.now();

    try {
        const response = await axios.get(url, {
            headers: HEADERS,
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: () => true // Accept any status code
        });

        result.responseTime = Date.now() - startTime;
        result.statusCode = response.status;

        // Check for Cloudflare
        const cfHeaders = ['cf-ray', 'cf-cache-status', 'server'];
        result.cloudflare = cfHeaders.some(header =>
            response.headers[header]?.toLowerCase().includes('cloudflare')
        );

        // Check for redirects
        if (response.request?.res?.responseUrl && response.request.res.responseUrl !== url) {
            result.redirect = response.request.res.responseUrl;
        }

        if (response.status >= 200 && response.status < 300) {
            result.status = 'working';
        } else if (response.status >= 300 && response.status < 400) {
            result.status = 'redirect';
        } else if (response.status === 403) {
            result.status = 'blocked';
        } else if (response.status === 404) {
            result.status = 'not_found';
        } else if (response.status >= 500) {
            result.status = 'server_error';
        } else {
            result.status = 'error';
        }

    } catch (error) {
        result.responseTime = Date.now() - startTime;
        result.error = error.message;

        if (error.code === 'ECONNRESET') {
            result.status = 'connection_reset';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            result.status = 'timeout';
        } else if (error.code === 'ENOTFOUND') {
            result.status = 'dns_error';
        } else if (error.code === 'ECONNREFUSED') {
            result.status = 'connection_refused';
        } else {
            result.status = 'error';
        }
    }

    return result;
}

async function testAllDomains() {
    console.log('='.repeat(80));
    console.log('PROVIDER DOMAIN CONNECTIVITY TEST');
    console.log('='.repeat(80));
    console.log();

    const results = {};
    const workingDomains = {};

    for (const [provider, domains] of Object.entries(DOMAINS_TO_TEST)) {
        console.log(`\n📡 Testing ${provider.toUpperCase()} domains...`);
        console.log('-'.repeat(80));

        results[provider] = [];
        workingDomains[provider] = null;

        for (const domain of domains) {
            process.stdout.write(`  Testing ${domain}... `);
            const result = await testDomain(domain);
            results[provider].push(result);

            // Status emoji
            const statusEmoji = {
                'working': '✅',
                'redirect': '🔄',
                'blocked': '🚫',
                'not_found': '❌',
                'server_error': '⚠️',
                'connection_reset': '🔌',
                'timeout': '⏱️',
                'dns_error': '🌐',
                'connection_refused': '🔒',
                'error': '❌'
            };

            const emoji = statusEmoji[result.status] || '❓';
            console.log(`${emoji} ${result.status.toUpperCase()} (${result.responseTime}ms)`);

            if (result.statusCode) {
                console.log(`    Status Code: ${result.statusCode}`);
            }
            if (result.cloudflare) {
                console.log(`    🛡️  Cloudflare Protection Detected`);
            }
            if (result.redirect) {
                console.log(`    Redirects to: ${result.redirect}`);
            }
            if (result.error) {
                console.log(`    Error: ${result.error}`);
            }

            // Mark first working domain
            if (result.status === 'working' && !workingDomains[provider]) {
                workingDomains[provider] = domain;
                console.log(`    ⭐ RECOMMENDED DOMAIN`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    for (const [provider, domain] of Object.entries(workingDomains)) {
        if (domain) {
            console.log(`✅ ${provider.toUpperCase()}: ${domain}`);
        } else {
            console.log(`❌ ${provider.toUpperCase()}: No working domains found`);
        }
    }

    // Save results
    const reportPath = path.join(__dirname, 'domain_test_results.json');
    await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        results,
        workingDomains
    }, null, 2));

    console.log(`\n📄 Full results saved to: ${reportPath}`);

    // Update domains.json if we have working domains
    const domainsJsonPath = path.join(__dirname, 'domains.json');
    try {
        const currentDomains = JSON.parse(await fs.readFile(domainsJsonPath, 'utf8'));
        let updated = false;

        for (const [provider, domain] of Object.entries(workingDomains)) {
            if (domain && currentDomains[provider] !== domain) {
                console.log(`\n🔄 Updating ${provider} domain: ${currentDomains[provider]} → ${domain}`);
                currentDomains[provider] = domain;
                updated = true;
            }
        }

        if (updated) {
            await fs.writeFile(domainsJsonPath, JSON.stringify(currentDomains, null, 2));
            console.log(`✅ domains.json updated successfully`);
        } else {
            console.log(`\nℹ️  domains.json is already up to date`);
        }
    } catch (error) {
        console.log(`\n⚠️  Could not update domains.json: ${error.message}`);
    }

    return { results, workingDomains };
}

// Run the test
if (require.main === module) {
    testAllDomains()
        .then(() => {
            console.log('\n✅ Domain testing complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error during testing:', error);
            process.exit(1);
        });
}

module.exports = { testAllDomains, testDomain };
