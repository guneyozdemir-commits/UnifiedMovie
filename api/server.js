const cheerio = require('cheerio');
const axios = require('axios');

// User agents to avoid being blocked
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
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

// Helper function to clean and compare movie titles
function normalizeTitle(title) {
    return title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper function to check if titles match
function titlesMatch(title1, title2) {
    const norm1 = normalizeTitle(title1);
    const norm2 = normalizeTitle(title2);
    return norm1.includes(norm2) || norm2.includes(norm1);
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
        // First try the new Metacritic API
        const apiUrl = `https://www.metacritic.com/api/v1/search/movie?q=${encodeURIComponent(movieTitle)}`;
        console.log('Trying Metacritic API:', apiUrl);
        
        try {
            const apiResponse = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'application/json',
                    'Origin': 'https://www.metacritic.com',
                    'Referer': 'https://www.metacritic.com/',
                    'x-mc-device': 'desktop',
                    'x-mc-version': '1.0.0'
                }
            });
            
            if (apiResponse.data && apiResponse.data.hits && apiResponse.data.hits.length > 0) {
                // Find the best matching movie
                const hits = apiResponse.data.hits;
                for (const hit of hits) {
                    if (titlesMatch(hit.title, movieTitle) && hit.metaScore) {
                        console.log(`Found Metacritic score ${hit.metaScore} for "${movieTitle}" via API`);
                        return hit.metaScore;
                    }
                }
            }
        } catch (apiError) {
            console.log('API attempt failed:', apiError.message);
        }
        
        // If API fails, try the new Metacritic website
        const searchUrl = `https://www.metacritic.com/search/movie/${encodeURIComponent(movieTitle)}/results`;
        console.log('Trying Metacritic search:', searchUrl);
        
        const searchResponse = await makeRequest(searchUrl);
        const $ = cheerio.load(searchResponse.data);
        
        // Try to find the movie in search results
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
                const resultTitle = titleElement.text().trim();
                
                if (titlesMatch(resultTitle, movieTitle)) {
                    // Try to find the score in this result
                    const scoreElement = result.find('.c-siteReviewScore, .metascore_w, .score, .metascore');
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
                            
                            // Try to find the score on the movie page
                            const movieScoreSelectors = [
                                '.c-siteReviewScore',
                                '.metascore_w',
                                '.score',
                                '.metascore'
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
        // First try the search page
        const searchUrl = `https://www.imdb.com/find?q=${encodeURIComponent(movieTitle)}&s=tt&ttype=ft`;
        console.log('Trying IMDb search URL:', searchUrl);
        
        const searchResponse = await makeRequest(searchUrl);
        const $ = cheerio.load(searchResponse.data);
        
        // Try multiple search result selectors
        const searchSelectors = [
            '.find-result-item',
            '.findResult'
        ];
        
        let movieUrl = null;
        
        // Try to find the movie in search results
        for (const selector of searchSelectors) {
            const results = $(selector);
            
            for (let i = 0; i < results.length; i++) {
                const result = results.eq(i);
                const titleElement = result.find('.result_text, .findResult');
                const resultTitle = titleElement.text().trim();
                
                if (titlesMatch(resultTitle, movieTitle)) {
                    movieUrl = result.find('a').attr('href');
                    if (movieUrl) break;
                }
            }
            
            if (movieUrl) break;
        }
        
        if (!movieUrl) {
            console.log('No matching movie found on IMDb');
            return null;
        }
        
        // Get the movie page
        const movieResponse = await makeRequest(`https://www.imdb.com${movieUrl}`);
        const movie$ = cheerio.load(movieResponse.data);
        
        // Try multiple rating selectors
        const ratingSelectors = [
            '[data-testid="hero-rating-bar__aggregate-rating__score"] span',
            '.ratingValue strong span',
            '[itemprop="ratingValue"]',
            '.rating span',
            '.ipl-rating-star__rating'
        ];
        
        for (const selector of ratingSelectors) {
            const ratingElement = movie$(selector).first();
            if (ratingElement.length) {
                const ratingText = ratingElement.text().trim();
                const rating = parseFloat(ratingText);
                if (!isNaN(rating) && rating >= 0 && rating <= 10) {
                    console.log(`Found IMDb rating ${rating} for "${movieTitle}"`);
                    return rating;
                }
            }
        }
        
        // Try finding the rating in structured data
        const scriptTags = movie$('script[type="application/ld+json"]');
        for (let i = 0; i < scriptTags.length; i++) {
            try {
                const jsonData = JSON.parse(scriptTags.eq(i).html());
                if (jsonData.aggregateRating && jsonData.aggregateRating.ratingValue) {
                    const rating = parseFloat(jsonData.aggregateRating.ratingValue);
                    if (!isNaN(rating) && rating >= 0 && rating <= 10) {
                        console.log(`Found IMDb rating ${rating} for "${movieTitle}" in structured data`);
                        return rating;
                    }
                }
            } catch (e) {
                console.error('Error parsing JSON-LD:', e.message);
            }
        }
        
        console.log(`No valid IMDb rating found for "${movieTitle}"`);
        return null;
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