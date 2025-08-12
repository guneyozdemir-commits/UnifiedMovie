const cheerio = require('cheerio');
const axios = require('axios');

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
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 10000
            });
            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
            return response;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed for URL ${url}:`, error.message);
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
        // First try the search API
        const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(movieTitle)}/?category=movie`;
        console.log('Trying Metacritic search URL:', searchUrl);
        
        const searchResponse = await makeRequest(searchUrl);
        const $ = cheerio.load(searchResponse.data);
        
        // Try multiple search result selectors
        const searchSelectors = [
            '.c-pageSiteSearch-results-item',
            '.search_results .result',
            '.main_stats',
            '.result'
        ];
        
        for (const selector of searchSelectors) {
            const results = $(selector);
            
            for (let i = 0; i < results.length; i++) {
                const result = results.eq(i);
                const titleElement = result.find('h3, .title, .product_title');
                const resultTitle = titleElement.text().trim().toLowerCase();
                const searchTitle = movieTitle.toLowerCase();
                
                // Check if this is the movie we're looking for
                if (resultTitle.includes(searchTitle) || searchTitle.includes(resultTitle)) {
                    // Try to find the score in this result
                    const scoreElement = result.find('.metascore_w, .score, .metascore, [class*="score"], [class*="rating"]');
                    for (let j = 0; j < scoreElement.length; j++) {
                        const scoreText = scoreElement.eq(j).text().trim();
                        const score = parseInt(scoreText);
                        if (!isNaN(score) && score >= 0 && score <= 100) {
                            console.log(`Found Metacritic score ${score} for "${movieTitle}" in search results`);
                            return score;
                        }
                    }
                    
                    // If we found the right movie but no score, try to get its URL
                    const movieUrl = result.find('a').attr('href');
                    if (movieUrl) {
                        try {
                            const movieResponse = await makeRequest(`https://www.metacritic.com${movieUrl}`);
                            const movie$ = cheerio.load(movieResponse.data);
                            
                            // Try multiple score selectors on the movie page
                            const movieScoreSelectors = [
                                '.ms_wrapper .c-siteReviewScore',
                                '.c-metascore',
                                '.metascore_w',
                                '[class*="score"]',
                                '[class*="rating"]'
                            ];
                            
                            for (const scoreSelector of movieScoreSelectors) {
                                const movieScoreElement = movie$(scoreSelector);
                                for (let k = 0; k < movieScoreElement.length; k++) {
                                    const scoreText = movieScoreElement.eq(k).text().trim();
                                    const score = parseInt(scoreText);
                                    if (!isNaN(score) && score >= 0 && score <= 100) {
                                        console.log(`Found Metacritic score ${score} for "${movieTitle}" on movie page`);
                                        return score;
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Error fetching movie page:', error.message);
                        }
                    }
                }
            }
        }
        
        // If search fails, try direct URL approach
        const formattedTitle = movieTitle.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
            
        const directUrl = `https://www.metacritic.com/movie/${formattedTitle}`;
        try {
            const directResponse = await makeRequest(directUrl);
            const direct$ = cheerio.load(directResponse.data);
            
            const directScoreSelectors = [
                '.ms_wrapper .c-siteReviewScore',
                '.c-metascore',
                '.metascore_w',
                '[class*="score"]',
                '[class*="rating"]'
            ];
            
            for (const selector of directScoreSelectors) {
                const element = direct$(selector);
                for (let i = 0; i < element.length; i++) {
                    const scoreText = element.eq(i).text().trim();
                    const score = parseInt(scoreText);
                    if (!isNaN(score) && score >= 0 && score <= 100) {
                        console.log(`Found Metacritic score ${score} for "${movieTitle}" using direct URL`);
                        return score;
                    }
                }
            }
        } catch (error) {
            console.error('Direct URL approach failed:', error.message);
        }
        
        console.log(`No valid Metacritic score found for "${movieTitle}"`);
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

// Netlify function handler
exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Extract movie title from path parameter
        const movieTitle = decodeURIComponent(event.path.split('/').pop());
        if (!movieTitle) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Movie title is required' })
            };
        }

        console.log(`Searching for movie: ${movieTitle}`);

        // Execute scraping functions sequentially to avoid rate limiting
        const rottenTomatoesScore = await scrapeRottenTomatoes(movieTitle);
        console.log('RT Score:', rottenTomatoesScore);
        
        const metacriticScore = await scrapeMetacritic(movieTitle);
        console.log('MC Score:', metacriticScore);
        
        const imdbScore = await scrapeIMDb(movieTitle);
        console.log('IMDB Score:', imdbScore);

        const scores = {
            rottenTomatoes: rottenTomatoesScore,
            metacritic: metacriticScore,
            imdb: imdbScore
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
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'No scores found for this movie. Please try a different title.' 
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                movieTitle,
                scores,
                unifiedScore,
                validScores,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error processing request:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch movie scores. Please try again later.',
                details: error.message
            })
        };
    }
};