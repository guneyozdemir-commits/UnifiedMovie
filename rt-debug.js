const puppeteer = require('puppeteer');

async function rtDebug() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
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
        
        console.log('🔍 Debugging Rotten Tomatoes score extraction...');
        
        await page.goto('https://www.rottentomatoes.com/search?search=Inception', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Debug the exact extraction logic
        const debugInfo = await page.evaluate(() => {
            const firstResult = document.querySelector('search-page-media-row');
            if (!firstResult) {
                return { error: 'No search-page-media-row found' };
            }
            
            // Get all attributes
            const attributes = {};
            for (let attr of firstResult.attributes) {
                attributes[attr.name] = attr.value;
            }
            
            // Try to extract score using our current logic
            const tomatometerScore = firstResult.getAttribute('tomatometerscore');
            const score = tomatometerScore && !isNaN(tomatometerScore) ? parseInt(tomatometerScore) : null;
            
            return {
                attributes,
                tomatometerScore,
                extractedScore: score,
                hasScore: score !== null,
                textContent: firstResult.textContent.substring(0, 200)
            };
        });
        
        console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
        
        // Take a screenshot
        await page.screenshot({ path: 'rt-debug.png' });
        console.log('📸 Screenshot saved as rt-debug.png');
        
    } catch (error) {
        console.error('Error during Rotten Tomatoes debugging:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

rtDebug();
