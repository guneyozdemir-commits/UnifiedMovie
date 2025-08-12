const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// User agents to avoid being blocked
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

// Helper function to get random user agent
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Helper function to make HTTP requests with retry logic
async function makeRequest(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                timeout: 10000
            });
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Scrape Rotten Tomatoes
async function scrapeRottenTomatoes(movieTitle) {
    try {
        const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(movieTitle)}`;
        const response = await makeRequest(searchUrl);
        const $ = cheerio.load(response.data);
        
        // Try to find the movie in search results
        const movieLink = $('search-page-media-row').first();
        if (!movieLink.length) {
            return null;
        }
        
        // Try to get score from search result
        let score = movieLink.attr('tomatometerscore');
        if (score && !isNaN(score)) {
            return parseInt(score);
        }
        
        // If no score in search, try movie page
        const movieUrl = movieLink.attr('url') || movieLink.find('a[href*="/m/"]').attr('href');
        if (movieUrl) {
            const movieResponse = await makeRequest(`https://www.rottentomatoes.com${movieUrl}`);
            const movie$ = cheerio.load(movieResponse.data);
            
            const scoreText = movie$('[data-qa="tomatometer"], .tomatometer, .score').first().text();
            const match = scoreText.match(/(\d+)%/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error scraping Rotten Tomatoes:', error.message);
        return null;
    }
}

// Scrape Metacritic
async function scrapeMetacritic(movieTitle) {
    try {
        const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(movieTitle)}`;
        const response = await makeRequest(searchUrl);
        const $ = cheerio.load(response.data);
        
        const firstResult = $('.c-pageSiteSearch-results-item').first();
        if (!firstResult.length) {
            return null;
        }
        
        // Try to get score from search result
        const scoreText = firstResult.text();
        const scoreMatch = scoreText.match(/(\d{1,2}|100)/);
        if (scoreMatch) {
            const score = parseInt(scoreMatch[1]);
            if (score >= 0 && score <= 100) {
                return score;
            }
        }
        
        // If no score in search, try movie page
        const movieUrl = firstResult.find('a').attr('href');
        if (movieUrl) {
            const movieResponse = await makeRequest(`https://www.metacritic.com${movieUrl}`);
            const movie$ = cheerio.load(movieResponse.data);
            
            const metaScore = movie$('.metascore_w').first().text().trim();
            const score = parseInt(metaScore);
            if (!isNaN(score) && score >= 0 && score <= 100) {
                return score;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error scraping Metacritic:', error.message);
        return null;
    }
}

// Scrape IMDb
async function scrapeIMDb(movieTitle) {
    try {
        const searchUrl = `https://www.imdb.com/find?q=${encodeURIComponent(movieTitle)}&s=tt&ttype=ft`;
        const searchResponse = await makeRequest(searchUrl);
        const $ = cheerio.load(searchResponse.data);
        
        const firstResult = $('.find-result-item').first();
        if (firstResult.length === 0) return null;
        
        const movieUrl = firstResult.find('a').attr('href');
        if (!movieUrl) return null;
        
        const movieResponse = await makeRequest(`https://www.imdb.com${movieUrl}`);
        const movie$ = cheerio.load(movieResponse.data);
        
        const rating = movie$('[data-testid="hero-rating-bar__aggregate-rating__score"] span').first().text().trim();
        const score = parseFloat(rating);
        
        return isNaN(score) ? null : score;
    } catch (error) {
        console.error('Error scraping IMDb:', error.message);
        return null;
    }
}

// Main API endpoint
app.get('/api/movie/:title', async (req, res) => {
    try {
        const movieTitle = req.params.title;
        if (!movieTitle) {
            return res.status(400).json({ error: 'Movie title is required' });
        }
        
        console.log(`Searching for movie: ${movieTitle}`);
        
        const [rottenTomatoesScore, metacriticScore, imdbScore] = await Promise.allSettled([
            scrapeRottenTomatoes(movieTitle),
            scrapeMetacritic(movieTitle),
            scrapeIMDb(movieTitle)
        ]);
        
        console.log('Scores retrieved:', {
            rt: rottenTomatoesScore,
            mc: metacriticScore,
            imdb: imdbScore
        });
        
        const scores = {
            rottenTomatoes: rottenTomatoesScore.status === 'fulfilled' ? rottenTomatoesScore.value : null,
            metacritic: metacriticScore.status === 'fulfilled' ? metacriticScore.value : null,
            imdb: imdbScore.status === 'fulfilled' ? imdbScore.value : null
        };
        
        let totalScore = 0;
        let validScores = 0;
        
        if (scores.rottenTomatoes !== null) {
            totalScore += scores.rottenTomatoes;
            validScores++;
        }
        
        if (scores.metacritic !== null) {
            totalScore += scores.metacritic;
            validScores++;
        }
        
        if (scores.imdb !== null) {
            totalScore += scores.imdb * 10;
            validScores++;
        }
        
        const unifiedScore = validScores > 0 ? Math.round(totalScore / validScores) : 0;
        
        if (validScores === 0) {
            return res.status(404).json({ 
                error: 'No scores found for this movie. Please try a different title.' 
            });
        }
        
        res.json({
            movieTitle,
            scores,
            unifiedScore,
            validScores,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ 
            error: 'Failed to fetch movie scores. Please try again later.' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Export the Express app
module.exports = app;