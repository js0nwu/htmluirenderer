const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const shell = require('shelljs');


const app = express();
const port = 3000;

// Global browser instance
let browser = null;

// Initialize Puppeteer browser
async function initBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

let counter = 1;
let restartInterval = 100;

// To handle JSON payloads
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/render', async (req, res) => {
    console.log("start");
    counter = counter + 1;
    if (!req.body.html) {
        console.log("stop");
        return res.status(400).send('No HTML content provided');
    }
    processing = true;
    if (counter % restartInterval == 0) {
        shell.exec('pkill chrome');
        await initBrowser();
    }
    
    let page = null;
    try {
        
        page = await browser.newPage();
        // Emulate iPhone 13
        await page.emulate(puppeteer.devices['iPhone 13']);

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

        


        if (page != null) {
            try {
                await page.close();
            } catch (e) {
                console.log("can't close page try");
                console.log(e);
            }
        }
        console.log("stop");
        // Return the screenshot in the response
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': resizedScreenshot.length
        });
        res.end(resizedScreenshot);
    } catch (error) {
        console.error(error);
        if (page != null) {
            try {
                await page.close();
            } catch (e) {
                console.log("can't close page catch");
                console.log(e);
            }
        }
        console.log("stop");
        res.status(500).send('An error occurred while rendering the screenshot');
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
