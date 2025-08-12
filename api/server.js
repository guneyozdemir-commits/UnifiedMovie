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
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 10000
            });
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
        // First try direct movie URL format
        const formattedTitle = movieTitle.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
            
        const directUrl = `https://www.metacritic.com/movie/${formattedTitle}`;
        try {
            const directResponse = await makeRequest(directUrl);
            const direct$ = cheerio.load(directResponse.data);
            
            // Try multiple selector patterns
            const metascoreSelectors = [
                '.c-metascore',
                '.g-inner-rating-value',
                'span[data-v-12e11c30]',
                '.metascore_w'
            ];
            
            for (const selector of metascoreSelectors) {
                const score = direct$(selector).first().text().trim();
                const parsedScore = parseInt(score);
                if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
                    console.log(`Found Metacritic score ${parsedScore} for ${movieTitle} using selector ${selector}`);
                    return parsedScore;
                }
            }
        } catch (error) {
            console.log(`Direct URL approach failed for ${movieTitle}, trying search...`);
        }

        // If direct URL fails, try search
        const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(movieTitle)}/?category=movie`;
        const response = await makeRequest(searchUrl);
        const $ = cheerio.load(response.data);
        
        // Try multiple search result selectors
        const searchSelectors = [
            '.c-pageSiteSearch-results-item',
            '.search_results .result',
            '[data-v-12e11c30]'
        ];
        
        for (const selector of searchSelectors) {
            const firstResult = $(selector).first();
            if (firstResult.length) {
                const scoreText = firstResult.text();
                const scoreMatches = scoreText.match(/\b([0-9]{1,3})\b/g);
                
                if (scoreMatches) {
                    for (const match of scoreMatches) {
                        const score = parseInt(match);
                        if (score >= 0 && score <= 100) {
                            console.log(`Found Metacritic score ${score} for ${movieTitle} from search results`);
                            return score;
                        }
                    }
                }
                
                // If we found a result but no score, try to get the movie page URL
                const movieUrl = firstResult.find('a').attr('href');
                if (movieUrl) {
                    const movieResponse = await makeRequest(`https://www.metacritic.com${movieUrl}`);
                    const movie$ = cheerio.load(movieResponse.data);
                    
                    for (const selector of metascoreSelectors) {
                        const score = movie$(selector).first().text().trim();
                        const parsedScore = parseInt(score);
                        if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
                            console.log(`Found Metacritic score ${parsedScore} for ${movieTitle} from movie page`);
                            return parsedScore;
                        }
                    }
                }
            }
        }
        
        console.log(`No valid Metacritic score found for ${movieTitle}`);
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
                error: 'Failed to fetch movie scores. Please try again later.' 
            })
        };
    }
};