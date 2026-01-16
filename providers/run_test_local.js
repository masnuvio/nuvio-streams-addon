const http = require('http');

const options = {
    hostname: 'localhost',
    port: 7000,
    path: '/stream/movie/tt1375666.json', // Inception
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

console.log('Testing addon request to:', `http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let data = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('RESPONSE STRUCTURE:', Object.keys(json));
            if (json.streams) {
                console.log(`FOUND ${json.streams.length} STREAMS`);
                if (json.streams.length > 0) {
                    console.log('First stream:', JSON.stringify(json.streams[0], null, 2));
                }
            } else {
                console.log('NO STREAMS FIELD IN RESPONSE');
                console.log('FULL BODY:', data.substring(0, 500));
            }
        } catch (e) {
            console.log('COULD NOT PARSE JSON');
            console.log('BODY:', data.substring(0, 500));
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
