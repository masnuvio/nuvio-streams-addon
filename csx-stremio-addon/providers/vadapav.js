const axios = require('axios');
const cheerio = require('cheerio');

const vadapavAPI = "https://vadapav.mov";

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
            });
        }

        const streams = [];

        elements.each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text();

            if (href) {
                streams.push({
                    name: 'Vadapav',
                    title: `Vadapav [${text}]`,
                    url: vadapavAPI + href
                });
            }
        });

        return streams;

    } catch (error) {
        console.error("Vadapav Error:", error.message);
        return [];
    }
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
