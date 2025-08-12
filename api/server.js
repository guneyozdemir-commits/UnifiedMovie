const express = require('express');
const cheerio = require('cheerio');
const chromium = require('chrome-aws-lambda');
const puppeteerCore = require('puppeteer-core');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize browser for each request (Vercel's serverless functions are stateless)
async function initBrowser() {
    return puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: true,
        ignoreHTTPSErrors: true,
    });
}

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
async function scrapeRottenTomatoes(movieTitle, browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent(getRandomUserAgent());
        
        const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(movieTitle)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
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
        
        if (!firstResult) return null;
        
        let score = await firstResult.evaluate(el => {
            const tomatometerScore = el.getAttribute('tomatometerscore');
            return tomatometerScore && !isNaN(tomatometerScore) ? parseInt(tomatometerScore) : null;
        });
        
        if (score !== null) return score;
        
        const movieUrl = await firstResult.evaluate(el => 
            el.getAttribute('url') || el.getAttribute('href')
        );
        
        if (movieUrl) {
            await page.goto(`https://www.rottentomatoes.com${movieUrl}`, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForSelector('[data-qa="tomatometer"], .tomatometer, .score', { timeout: 10000 });
            
            score = await page.evaluate(() => {
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
                        const match = element.textContent.trim().match(/(\d+)%/);
                        if (match) return parseInt(match[1]);
                    }
                }
                return null;
            });
        }
        
        return score;
    } catch (error) {
        console.error('Error scraping Rotten Tomatoes:', error.message);
        return null;
    } finally {
        if (page) await page.close();
    }
}

// Scrape Metacritic using Puppeteer
async function scrapeMetacritic(movieTitle, browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent(getRandomUserAgent());
        
        const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(movieTitle)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
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
        
        if (!firstResult) return null;
        
        let score = await firstResult.evaluate(el => {
            const text = el.textContent;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length > 0) {
                const lastLine = lines[lines.length - 1];
                const scoreMatch = lastLine.match(/^(\d{1,2}|100)$/);
                if (scoreMatch) {
                    const potentialScore = parseInt(scoreMatch[1]);
                    if (potentialScore >= 0 && potentialScore <= 100) return potentialScore;
                }
            }
            
            const allNumbers = text.match(/(\d{1,2}|100)/g);
            if (allNumbers) {
                const potentialScores = allNumbers
                    .map(n => parseInt(n))
                    .filter(n => n >= 0 && n <= 100 && n !== 2010 && n !== 2008 && n !== 2012);
                if (potentialScores.length > 0) return Math.max(...potentialScores);
            }
            
            return null;
        });
        
        if (score !== null) return score;
        
        const movieUrl = await firstResult.evaluate(el => {
            if (el.tagName === 'A') return el.getAttribute('href');
            const link = el.querySelector('a');
            return link ? link.getAttribute('href') : null;
        });
        
        if (movieUrl) {
            await page.goto(`https://www.metacritic.com${movieUrl}`, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForSelector('.metascore_w.larger.movie, .metascore, .score', { timeout: 10000 });
            
            score = await page.evaluate(() => {
                const selectors = [
                    '.metascore_w.larger.movie',
                    '.metascore_w',
                    '.metascore',
                    '.score'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const match = element.textContent.trim().match(/(\d+)/);
                        if (match) {
                            const score = parseInt(match[1]);
                            if (score >= 0 && score <= 100) return score;
                        }
                    }
                }
                return null;
            });
        }
        
        return score;
    } catch (error) {
        console.error('Error scraping Metacritic:', error.message);
        return null;
    } finally {
        if (page) await page.close();
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
    let browser;
    try {
        const movieTitle = req.params.title;
        if (!movieTitle) {
            return res.status(400).json({ error: 'Movie title is required' });
        }
        
        browser = await initBrowser();
        
        const [rottenTomatoesScore, metacriticScore, imdbScore] = await Promise.allSettled([
            scrapeRottenTomatoes(movieTitle, browser),
            scrapeMetacritic(movieTitle, browser),
            scrapeIMDb(movieTitle)
        ]);
        
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
    } finally {
        if (browser) await browser.close();
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Export the Express app
module.exports = app;