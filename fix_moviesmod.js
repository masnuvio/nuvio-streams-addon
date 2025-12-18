// Helper to fix moviesmod.js
const fs = require('fs');

// Read the file
let content = fs.readFileSync('source/providers/moviesmod.js', 'utf8');

// Find where the corruption starts (the first ```)
const corruptionStart = content.indexOf('```');

if (corruptionStart > 0) {
    // Remove everything from the corruption point onwards
    content = content.substring(0, corruptionStart).trim();

    // Add the correct ending
    const correctEnding = `

// Helper function to escape special characters in regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
}

module.exports = {
    getMoviesModStreams,
    getStreams: getMoviesModStreams
};
`;

    content += correctEnding;

    // Write back
    fs.writeFileSync('source/providers/moviesmod.js', content);
    console.log('Fixed moviesmod.js!');
} else {
    console.log('No corruption found');
}
