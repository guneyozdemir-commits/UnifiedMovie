const puppeteer = require('puppeteer');

async function metacriticDebug() {
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
        
        console.log('🔍 Debugging Metacritic search results...');
        
        await page.goto('https://www.metacritic.com/search/Inception', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get detailed information about the first movie result
        const movieInfo = await page.evaluate(() => {
            const firstResult = document.querySelector('.c-pageSiteSearch-results-item');
            if (!firstResult) return null;
            
            const text = firstResult.textContent;
            const href = firstResult.href;
            
            // Split text into lines and analyze each
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            // Look for numbers in the text
            const numbers = text.match(/(\d+)/g);
            
            return {
                fullText: text,
                lines: lines,
                href: href,
                numbers: numbers ? numbers.map(n => parseInt(n)) : [],
                textLength: text.length
            };
        });
        
        console.log('Movie info:', JSON.stringify(movieInfo, null, 2));
        
        // Take a screenshot
        await page.screenshot({ path: 'metacritic-detailed.png' });
        console.log('📸 Screenshot saved as metacritic-detailed.png');
        
    } catch (error) {
        console.error('Error during Metacritic debugging:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

metacriticDebug();
