const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const shell = require('shelljs');

const app = express();
const port = 3000;
const restartFrequency = 100;

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
    console.log("teardown browser");
    if (page != null) {
        try {
            await page.close();
        } catch (e) {
            console.error("couldn't close page");
        }
    }
    if (browser != null) {
        try {
            const pages = await browser.pages();
            for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
            }
        } catch (e) {
            console.error("couldn't close browser pages");
        }
        try {
            const childProcess = browser.process()
            if (childProcess) {
              childProcess.kill(9)
            }
        } catch (e) {
            console.error("couldn't kill browser");
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


        counter = counter + 1;
        if (counter % restartFrequency == 0) {
            if (page && !page.isClosed()) {
                await page.close();
                if (browser != null) {
                    page = await browser.newPage();
                }   
            }
            
        }
        
        // Return the screenshot in the response
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': resizedScreenshot.length
        });
        return res.end(resizedScreenshot);

    } catch (error) {
        console.error(error);
        await teardownBrowser();
        return res.status(500).send('An error occurred while rendering the screenshot');
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
