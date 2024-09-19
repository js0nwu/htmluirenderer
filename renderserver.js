const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const app = express();
const port = 3000;

// Global browser instance
let browser;
let page;

// Initialize Puppeteer browser
async function initBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--single-process', '--no-zygote', '--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    // Emulate iPhone 13
    await page.emulate(puppeteer.devices['iPhone 13']);
}

// To handle JSON payloads
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/render', async (req, res) => {
    if (!req.body.html) {
        return res.status(400).send('No HTML content provided');
    }
    try {
        await initBrowser();
        // Set the HTML content
        await page.setContent(req.body.html);

        // Taking screenshot
        const screenshotBuffer = await page.screenshot();

        // Resize the screenshot - max dimension 512px while maintaining aspect ratio
        const resizedScreenshot = await sharp(screenshotBuffer)
            .resize(512, 512, {
                fit: 'inside'
            })
            .toBuffer();

        // Return the screenshot in the response
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': resizedScreenshot.length
        });
        res.end(resizedScreenshot);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while rendering the screenshot');

    } finally {
        if (page != null) {
            await page.close();
        }
        if (browser && browser.process() != null) {
            browser.process().kill('SIGINT');   
        }
    }
});

// Start server and initialize browser
app.listen(port, async () => {
    console.log(`Server is listening at http://localhost:${port}`);
    await initBrowser();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    browser.close().then(() => {
        process.exit(0);
    });
});
