const axios = require('axios');

async function run() {
    const url = 'https://storm.vodvidl.site/proxy/file2/EOH~6rVMI5e8zLYARt9bad141mwYzcqRvVKt7xPBhMugaHKDyR8Yl+RiIBHsAYk+BOAspKyrPMvSQrSafx7H4ZGYz3FjJ0IOCJwVNuoCm4L6mMhkiYJDcFafd4A7AIdxMchcpyqj8AfODjyBh9VWVIod7MbZcVm86Y0~iMYh+H4=/MTA4MA==/aW5kZXgubTN1OA==.m3u8?headers=%7B%22referer%22%3A%22https%3A%2F%2Fvideostr.net%2F%22%2C%22origin%22%3A%22https%3A%2F%2Fvideostr.net%22%7D&host=https%3A%2F%2Fsunmelt27.xyz';

    try {
        console.log('Fetching URL...');
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://storm.vodvidl.site/',
                'Origin': 'https://storm.vodvidl.site'
            },
            validateStatus: () => true
        });

        console.log('Status:', res.status);
        console.log('Headers:', res.headers);
        console.log('Data Preview:', res.data.substring(0, 500));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
