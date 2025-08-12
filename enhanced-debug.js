const puppeteer = require('puppeteer');

async function enhancedDebug() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false, // Show browser for debugging
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
        
        const page = await browser.newPage();
        
        // Test Rotten Tomatoes step by step
        console.log('🔍 Enhanced debugging of Rotten Tomatoes...');
        
        // Step 1: Search page
        console.log('\n📱 Step 1: Loading search page...');
        await page.goto('https://www.rottentomatoes.com/search?search=Inception', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 2: Check search results
        console.log('\n🔍 Step 2: Analyzing search results...');
        const searchResults = await page.evaluate(() => {
            const results = [];
            
            // Check for search-page-media-row elements
            const mediaRows = document.querySelectorAll('search-page-media-row');
            console.log(`Found ${mediaRows.length} search-page-media-row elements`);
            
            mediaRows.forEach((row, index) => {
                if (index < 3) { // Only log first 3
                    const score = row.getAttribute('tomatometerscore');
                    const title = row.getAttribute('title');
                    const url = row.getAttribute('url');
                    
                    results.push({
                        index,
                        title,
                        score,
                        url,
                        hasScore: score !== null,
                        scoreValue: score ? parseInt(score) : null
                    });
                }
            });
            
            return results;
        });
        
        console.log('Search results analysis:', searchResults);
        
        // Step 3: Try to get the first result with a score
        console.log('\n🎯 Step 3: Finding first result with score...');
        const firstResultWithScore = await page.evaluate(() => {
            const mediaRows = document.querySelectorAll('search-page-media-row');
            
            for (let i = 0; i < mediaRows.length; i++) {
                const row = mediaRows[i];
                const score = row.getAttribute('tomatometerscore');
                
                if (score && !isNaN(score)) {
                    return {
                        index: i,
                        title: row.getAttribute('title'),
                        score: parseInt(score),
                        url: row.getAttribute('url')
                    };
                }
            }
            
            return null;
        });
        
        console.log('First result with score:', firstResultWithScore);
        
        // Step 4: Test Metacritic with different approach
        console.log('\n🔍 Step 4: Testing Metacritic with different approach...');
        await page.goto('https://www.metacritic.com/search/Inception', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to find actual search results
        const metacriticResults = await page.evaluate(() => {
            const results = [];
            
            // Look for any elements that might contain movie information
            const allElements = document.querySelectorAll('*');
            const movieRelated = [];
            
            allElements.forEach(el => {
                const text = el.textContent;
                if (text && text.includes('Inception') && text.length < 200) {
                    movieRelated.push({
                        tagName: el.tagName,
                        className: el.className,
                        text: text.trim(),
                        href: el.href || null
                    });
                }
            });
            
            return movieRelated.slice(0, 10); // Return first 10
        });
        
        console.log('Metacritic movie-related elements:', metacriticResults);
        
        // Take final screenshots
        await page.screenshot({ path: 'enhanced-debug-final.png' });
        console.log('\n📸 Final screenshot saved as enhanced-debug-final.png');
        
    } catch (error) {
        console.error('Error during enhanced debugging:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

enhancedDebug();
