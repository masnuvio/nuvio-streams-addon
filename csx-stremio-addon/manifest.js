const { description, version } = require('./package.json');

const manifest = {
    id: 'org.csx.cinestream',
    version: version,
    name: 'CineStream (CSX)',
    description: description,
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

module.exports = manifest;
