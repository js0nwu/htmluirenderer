const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const shell = require('shelljs');

const app = express();
const port = 3000;
const restartFrequency = 10000;

let browser = null;
let page = null;
let counter = 0;

async function initBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--single-process', '--no-zygote', '--no-sandbox', '--disable-setuid-sandbox']
    });
    [page] = await browser.pages();
    // Emulate iPhone 13
    await page.emulate(puppeteer.devices['iPhone 13']);
}

async function teardownBrowser() {
    if (page != null) {
        await page.close();
    }
    if (browser != null) {
        const pages = await browser.pages();
        for (let i = 0; i < pages.length; i++) {
            await pages[i].close();
        }
        const childProcess = browser.process()
        if (childProcess) {
          childProcess.kill(9)
        }
    }
    browser = null;
    page = null;
}

// To handle JSON payloads
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/render', async (req, res) => {
    if (!req.body.html) {
        return res.status(400).send('No HTML content provided');
    }


    try {
        if (browser == null || page == null) {
            await initBrowser();
        }
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
        counter = counter + 1;
        if (counter % restartFrequency == 0) {
            await teardownBrowser();
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while rendering the screenshot');
        await teardownBrowser();
    }
});

// Start server and initialize browser
app.listen(port, async () => {
    console.log(`Server is listening at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (browser != null) {
        browser.close().then(() => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
    
});
