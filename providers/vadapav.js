const axios = require('axios');
const cheerio = require('cheerio');

const vadapavAPI = "https://vadapav.mov";

console.log("Vadapav Provider v2 Loaded (Metadata Parsing Enabled)");

async function getStreams(type, imdbId, season, episode) {
    try {
        // Need to resolve IMDB ID to title/year first. 
        // For this POC, we'll use Cinemeta or just assume we have title/year if possible.
        // But Stremio only gives us ID. We need a metadata resolver.
        // For simplicity in this POC, we'll use a hardcoded lookup or try to fetch from Cinemeta.

        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];

        const { title, year } = meta;

        // Logic from CineStreamExtractors.kt: invokeVadapav
        // val url = if(season == null) {
        //     "$vadapavAPI/movies/$title ($year)/"
        // } else {
        //     "$vadapavAPI/shows/$title ($year)/Season $seasonSlug/"
        // }

        let url;
        if (type === 'movie') {
            url = `${vadapavAPI}/movies/${title} (${year})/`;
        } else {
            const seasonSlug = season < 10 ? `0${season}` : season;
            url = `${vadapavAPI}/shows/${title} (${year})/Season ${seasonSlug}/`;
        }

        console.log(`Vadapav URL: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            validateStatus: false
        });

        if (response.status !== 200) return [];

        const $ = cheerio.load(response.data);
        let selector;

        if (type === 'series') {
            const episodeSlug = episode < 10 ? `0${episode}` : episode;
            selector = `a.wrap.directory-entry:contains(E${episodeSlug})`;
        } else {
            selector = "a.wrap.directory-entry";
        }

        // Vadapav usually lists files. For movies, we might pick the largest or first video file.
        // The Kotlin code selects specific entry.

        // Kotlin: val aTag = app.get(url).document.selectFirst(selector) ?: return

        let elements = $(selector);
        if (elements.length === 0 && type === 'movie') {
            // Fallback for movies if selector fails or multiple files
            elements = $("a.wrap.directory-entry").filter((i, el) => {
                return $(el).text().match(/\.(mp4|mkv|avi)$/i);
                return [];
            }
}

        function parseFilename(filename) {
            let quality = 'Unknown';
            let language = '';

            // Quality
            if (filename.match(/2160p|4k/i)) quality = '4K';
            else if (filename.match(/1080p/i)) quality = '1080p';
            else if (filename.match(/720p/i)) quality = '720p';
            else if (filename.match(/480p/i)) quality = '480p';

            // Language
            if (filename.match(/hindi|hin/i)) language += '🇮🇳 Hindi ';
            if (filename.match(/english|eng/i)) language += '🇺🇸 English ';
            if (filename.match(/dual|multi/i)) language += '🌎 Dual Audio ';
            if (filename.match(/tam|tamil/i)) language += 'Tamil ';
            if (filename.match(/tel|telugu/i)) language += 'Telugu ';

            // Codec/HDR
            const extras = [];
            if (filename.match(/x265|hevc/i)) extras.push('HEVC');
            if (filename.match(/10bit/i)) extras.push('10bit');
            if (filename.match(/hdr/i)) extras.push('HDR');
            if (filename.match(/dv|dolby vision/i)) extras.push('DV');

            return {
                quality,
                language: language.trim(),
                extras: extras.join(' ')
            };
        }

        async function getMetadata(type, id) {
            try {
                const metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
                const { data } = await axios.get(metaUrl);
                if (data && data.meta) {
                    return {
                        title: data.meta.name,
                        year: data.meta.year ? data.meta.year.split('-')[0] : ''
                    };
                }
            } catch (e) {
                console.error("Metadata Error:", e.message);
            }
            return null;
        }

        module.exports = { getStreams };
