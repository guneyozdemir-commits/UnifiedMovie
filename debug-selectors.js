const puppeteer = require('puppeteer');

async function debugSelectors() {
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
        
        // Test Rotten Tomatoes
        console.log('🔍 Testing Rotten Tomatoes selectors...');
        await page.goto('https://www.rottentomatoes.com/search?search=Inception', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait a bit for content to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'rottentomatoes-debug.png' });
        
        // Try to find search results
        const searchResults = await page.evaluate(() => {
            const results = [];
            
            // Try different selectors
            const selectors = [
                'search-page-media-row',
                '.search-page-media-row',
                '.search-result',
                'a[href*="/m/"]',
                '[data-qa="search-result"]',
                '.search__result'
            ];
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    results.push({
                        selector,
                        count: elements.length,
                        firstElement: elements[0].outerHTML.substring(0, 200)
                    });
                }
            });
            
            return results;
        });
        
        console.log('Rotten Tomatoes search results:', searchResults);
        
        // Test Metacritic
        console.log('\n🔍 Testing Metacritic selectors...');
        await page.goto('https://www.metacritic.com/search/Inception', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait a bit for content to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'metacritic-debug.png' });
        
        // Try to find search results
        const metacriticResults = await page.evaluate(() => {
            const results = [];
            
            // Try different selectors
            const selectors = [
                '.result_wrap',
                '.search_results .result',
                '.search_result',
                '.result',
                'a[href*="/movie/"]',
                '.search-result',
                '.result-item'
            ];
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    results.push({
                        selector,
                        count: elements.length,
                        firstElement: elements[0].outerHTML.substring(0, 200)
                    });
                }
            });
            
            return results;
        });
        
        console.log('Metacritic search results:', metacriticResults);
        
        console.log('\n📸 Screenshots saved as rottentomatoes-debug.png and metacritic-debug.png');
        console.log('🔍 Check these files to see what the pages actually look like');
        
    } catch (error) {
        console.error('Error during debugging:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugSelectors();
