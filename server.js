const express = require('express');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Global browser instance for Puppeteer
let globalBrowser = null;

// Initialize browser
async function initBrowser() {
    if (!globalBrowser) {
        globalBrowser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        // Handle browser disconnection
        globalBrowser.on('disconnected', () => {
            globalBrowser = null;
        });
    }
    return globalBrowser;
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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

// Scrape Rotten Tomatoes using Puppeteer
async function scrapeRottenTomatoes(movieTitle) {
    let page;
    try {
        const browser = await initBrowser();
        page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Search for the movie
        const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(movieTitle)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for search results to load - try multiple selectors
        let firstResult = null;
        const searchSelectors = [
            'search-page-media-row',
            '[data-qa="search-result"]',
            'a[href*="/m/"]'
        ];
        
        for (const selector of searchSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                firstResult = await page.$(selector);
                if (firstResult) break;
            } catch (error) {
                continue;
            }
        }
        
        if (!firstResult) {
            console.log('No search results found on Rotten Tomatoes');
            return null;
        }
        
        // Get the movie URL - try different approaches
        let movieUrl = null;
        try {
            movieUrl = await firstResult.evaluate(el => {
                // Try to get url attribute or href
                return el.getAttribute('url') || el.getAttribute('href');
            });
        } catch (error) {
            console.log('Error extracting movie URL from Rotten Tomatoes result');
        }
        // Try to get the score directly from the search result first
        let score = await firstResult.evaluate(el => {
            const tomatometerScore = el.getAttribute('tomatometerscore');
            if (tomatometerScore && !isNaN(tomatometerScore)) {
                return parseInt(tomatometerScore);
            }
            return null;
        });
        
        // If we got the score from search results, return it
        if (score !== null) {
            console.log(`Found Rotten Tomatoes score from search results: ${score}`);
            return score;
        }
        
        // If no score in search results, try to navigate to movie page
        if (movieUrl) {
            const moviePageUrl = `https://www.rottentomatoes.com${movieUrl}`;
            await page.goto(moviePageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for the Tomatometer to load and extract the score
            try {
                await page.waitForSelector('[data-qa="tomatometer"], .tomatometer, .score', { timeout: 10000 });
                
                // Try multiple selectors for the Tomatometer score
                score = await page.evaluate(() => {
                    // Try different selectors that might contain the score
                    const selectors = [
                        '[data-qa="tomatometer"]',
                        '.tomatometer .percentage',
                        '.score .percentage',
                        '.tomatometer',
                        '.score'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const text = element.textContent.trim();
                            const match = text.match(/(\d+)%/);
                            if (match) {
                                return parseInt(match[1]);
                            }
                        }
                    }
                    
                    return null;
                });
                
                return score;
            } catch (error) {
                console.log('Tomatometer selector not found on movie page');
                return null;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Error scraping Rotten Tomatoes:', error.message);
        return null;
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Scrape Metacritic using Puppeteer
async function scrapeMetacritic(movieTitle) {
    let page;
    try {
        const browser = await initBrowser();
        page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Search for the movie
        const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(movieTitle)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for search results to load - try multiple selectors
        let firstResult = null;
        const searchSelectors = [
            '.c-pageSiteSearch-results-item',
            'a[href*="/movie/"]',
            '.search-result',
            '.result'
        ];
        
        for (const selector of searchSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                firstResult = await page.$(selector);
                if (firstResult) break;
            } catch (error) {
                continue;
            }
        }
        
        if (!firstResult) {
            console.log('No search results found on Metacritic');
            return null;
        }
        
        // Try to extract score directly from search results first
        let score = await firstResult.evaluate(el => {
            const text = el.textContent;
            
            // Split text into lines and look for the score
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            // The score should be on the last line, after filtering out empty lines
            if (lines.length > 0) {
                const lastLine = lines[lines.length - 1];
                const scoreMatch = lastLine.match(/^(\d{1,2}|100)$/);
                if (scoreMatch) {
                    const potentialScore = parseInt(scoreMatch[1]);
                    if (potentialScore >= 0 && potentialScore <= 100) {
                        return potentialScore;
                    }
                }
            }
            
            // Fallback: look for any number that could be a score, but filter out years
            const allNumbers = text.match(/(\d{1,2}|100)/g);
            if (allNumbers) {
                // Filter out obvious non-scores (like years, etc.)
                const potentialScores = allNumbers
                    .map(n => parseInt(n))
                    .filter(n => n >= 0 && n <= 100 && n !== 2010 && n !== 2008 && n !== 2012); // Filter out common years
                
                // Return the highest potential score
                if (potentialScores.length > 0) {
                    return Math.max(...potentialScores);
                }
            }
            
            return null;
        });
        
        // If we got a score from search results, return it
        if (score !== null) {
            console.log(`Found Metacritic score from search results: ${score}`);
            return score;
        }
        
        // Otherwise, try to navigate to the movie page
        let movieUrl = null;
        try {
            movieUrl = await firstResult.evaluate(el => {
                // Try to get href from the element itself or its children
                if (el.tagName === 'A') {
                    return el.getAttribute('href');
                }
                const link = el.querySelector('a');
                return link ? link.getAttribute('href') : null;
            });
        } catch (error) {
            console.log('Error extracting movie URL from Metacritic result');
        }
        
        if (movieUrl) {
            // Navigate to the movie page
            const moviePageUrl = `https://www.metacritic.com${movieUrl}`;
            await page.goto(moviePageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for the Metascore to load and extract the score
            try {
                await page.waitForSelector('.metascore_w.larger.movie, .metascore, .score', { timeout: 10000 });
                
                // Try multiple selectors for the Metascore
                score = await page.evaluate(() => {
                    // Try different selectors that might contain the score
                    const selectors = [
                        '.metascore_w.larger.movie',
                        '.metascore_w',
                        '.metascore',
                        '.score'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const text = element.textContent.trim();
                            const match = text.match(/(\d+)/);
                            if (match) {
                                const score = parseInt(match[1]);
                                if (score >= 0 && score <= 100) {
                                    return score;
                                }
                            }
                        }
                    }
                    
                    return null;
                });
                
                return score;
            } catch (error) {
                console.log('Metascore selector not found on movie page');
                return null;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Error scraping Metacritic:', error.message);
        return null;
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Scrape IMDb
async function scrapeIMDb(movieTitle) {
    try {
        // Search for the movie
        const searchUrl = `https://www.imdb.com/find?q=${encodeURIComponent(movieTitle)}&s=tt&ttype=ft`;
        const searchResponse = await makeRequest(searchUrl);
        const $ = cheerio.load(searchResponse.data);
        
        // Look for the first movie result
        const firstResult = $('.find-result-item').first();
        if (firstResult.length === 0) {
            return null;
        }
        
        // Get the movie URL
        const movieUrl = firstResult.find('a').attr('href');
        if (!movieUrl) {
            return null;
        }
        
        // Scrape the movie page
        const movieResponse = await makeRequest(`https://www.imdb.com${movieUrl}`);
        const movie$ = cheerio.load(movieResponse.data);
        
        // Extract the rating
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
        
        // Scrape all three sources concurrently
        const [rottenTomatoesScore, metacriticScore, imdbScore] = await Promise.allSettled([
            scrapeRottenTomatoes(movieTitle),
            scrapeMetacritic(movieTitle),
            scrapeIMDb(movieTitle)
        ]);
        
        // Extract values from promises
        const scores = {
            rottenTomatoes: rottenTomatoesScore.status === 'fulfilled' ? rottenTomatoesScore.value : null,
            metacritic: metacriticScore.status === 'fulfilled' ? metacriticScore.value : null,
            imdb: imdbScore.status === 'fulfilled' ? imdbScore.value : null
        };
        
        // Calculate unified score
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
            totalScore += scores.imdb * 10; // Convert IMDb 0-10 to 0-100
            validScores++;
        }
        
        const unifiedScore = validScores > 0 ? Math.round(totalScore / validScores) : 0;
        
        // Check if we have any scores
        if (validScores === 0) {
            return res.status(404).json({ 
                error: 'No scores found for this movie. Please try a different title.' 
            });
        }
        
        const result = {
            movieTitle,
            scores,
            unifiedScore,
            validScores,
            timestamp: new Date().toISOString()
        };
        
        console.log(`Results for ${movieTitle}:`, result);
        res.json(result);
        
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

const server = app.listen(PORT, () => {
    console.log(`🎬 Unified Movie Score server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
    console.log(`🔍 API endpoint: http://localhost:${PORT}/api/movie/:title`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (globalBrowser) {
        await globalBrowser.close();
        console.log('🌐 Browser closed');
    }
    server.close(() => {
        console.log('🚀 Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (globalBrowser) {
        await globalBrowser.close();
        console.log('🌐 Browser closed');
    }
    server.close(() => {
        console.log('🚀 Server closed');
        process.exit(0);
    });
});
