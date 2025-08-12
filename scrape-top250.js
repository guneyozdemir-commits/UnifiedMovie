const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs').promises;

// Delay helper to avoid rate limiting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeIMDbTop250() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto('https://www.imdb.com/chart/top/', {
            waitUntil: 'networkidle2'
        });

        // Wait for the movie list to load
        await page.waitForSelector('h3.ipc-title__text');

        const movies = await page.evaluate(() => {
            const movieElements = document.querySelectorAll('li.ipc-metadata-list-summary-item');
            return Array.from(movieElements).map((element, index) => {
                const titleElement = element.querySelector('h3.ipc-title__text');
                const ratingElement = element.querySelector('.ipc-rating-star--imdb');
                
                // Extract title and year from the format "1. The Shawshank Redemption (1994)"
                const fullTitle = titleElement.textContent;
                const match = fullTitle.match(/\d+\.\s(.+)\s\((\d{4})\)/);
                
                return {
                    rank: index + 1,
                    title: match ? match[1].trim() : fullTitle.split('.')[1].trim(),
                    year: match ? match[2] : 'N/A',
                    imdbRating: ratingElement ? parseFloat(ratingElement.textContent) : null
                };
            });
        });

        return movies;
    } catch (error) {
        console.error('Error scraping IMDb Top 250:', error);
        return [];
    } finally {
        await browser.close();
    }
}

async function getUnifiedScore(movie) {
    try {
        const response = await axios.get(`http://localhost:3000/api/movie/${encodeURIComponent(movie.title)}`, {
            timeout: 30000
        });
        
        const { scores } = response.data;
        return {
            ...movie,
            rottenTomatoes: scores.rottenTomatoes,
            metacritic: scores.metacritic,
            unifiedScore: response.data.unifiedScore
        };
    } catch (error) {
        console.error(`Error getting unified score for ${movie.title}:`, error.message);
        return movie;
    }
}

async function main() {
    console.log('🎬 Starting IMDb Top 250 scrape...');
    
    // Get IMDb Top 250
    const movies = await scrapeIMDbTop250();
    console.log(`📋 Found ${movies.length} movies in IMDb Top 250`);
    
    // Get unified scores for each movie
    const results = [];
    for (const movie of movies) {
        console.log(`🔍 Processing ${movie.rank}. ${movie.title} (${movie.year})`);
        const result = await getUnifiedScore(movie);
        results.push(result);
        
        // Save progress after each movie
        await fs.writeFile('top250-scores.json', JSON.stringify(results, null, 2));
        
        // Delay to avoid overwhelming the server
        await delay(2000);
    }
    
    // Sort by unified score
    const sortedResults = results
        .filter(movie => movie.unifiedScore !== null)
        .sort((a, b) => b.unifiedScore - a.unifiedScore);
    
    // Save final results
    await fs.writeFile('top250-scores-sorted.json', JSON.stringify(sortedResults, null, 2));
    
    console.log('✅ Scraping complete! Results saved to top250-scores-sorted.json');
    
    // Print top 20 movies by unified score
    console.log('\n🏆 Top 20 Movies by Unified Score:');
    sortedResults.slice(0, 20).forEach((movie, index) => {
        console.log(`${index + 1}. ${movie.title} (${movie.year}) - Unified Score: ${movie.unifiedScore}`);
        console.log(`   IMDb: ${movie.imdbRating}, RT: ${movie.rottenTomatoes}, Metacritic: ${movie.metacritic}\n`);
    });
}

main().catch(console.error);