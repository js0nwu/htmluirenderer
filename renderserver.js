const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const app = express();
const port = 3000;
const restartFrequency = 100;

let browser = null;
let counter = 0;

async function initBrowser() {
    console.log("begin init browser");
    browser = await puppeteer.launch({
        headless: true,
        args: ['--single-process', '--no-zygote', '--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process']
    });
    console.log("end init browser");
}

async function teardownBrowser() {
    console.log("teardown browser");
    if (browser != null) {
        console.log("browser is not null");
        try {
            console.log("trying to close all pages");
            const pages = await browser.pages();
            for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
            }
        } catch (e) {
            console.error("couldn't close browser pages");
            console.log("error message");
            console.log(e);
        }
        try {
            console.log("trying to close browser")
            await browser.close();
            if (browser && browser.process() != null) browser.process().kill('SIGINT');
        } catch (e) {
            console.error("couldn't close the browser");
            console.log("error message");
            console.log(e);
        }
    }
    console.log("done with teardown");
}

// To handle JSON payloads
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let processing = false;

app.post('/render', async (req, res) => {
    while (processing) {
        // continue;
    }
    processing = true;
    if (!req.body.html) {
        res.status(400).send('No HTML content provided');
    } else {
        let page = null;
        try {
            const pages = await browser.pages();
            console.log("number of pages");
            console.log(pages.length);
            let numPages = pages.length;
            while (numPages > 0) {
                const pagesBefore = await browser.pages();
                for (let i = 0; i < pagesBefore.length; i++) {
                    await pagesBefore[i].close();
                }
                const pagesAfter = await browser.pages();
                numPages = pagesAfter.length;
            }
            page = await browser.newPage();
            // Set the HTML content
            await page.setContent(req.body.html);
            console.log("set html");
            // Taking screenshot
            const screenshotBuffer = await page.screenshot();
            console.log("took screenshot");
            // Resize the screenshot - max dimension 512px while maintaining aspect ratio
            const resizedScreenshot = await sharp(screenshotBuffer)
                .resize(512, 512, {
                    fit: 'inside'
                })
                .toBuffer();
            console.log("resized image");
    
            counter = counter + 1;
            if (counter % restartFrequency == 0) {
                console.log("hit restart frequency");
                await teardownBrowser();
                await initBrowser();
                console.log("done with restart");
            }
            // Return the screenshot in the response
            console.log("starting to send response");
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': resizedScreenshot.length
            });
            res.end(resizedScreenshot);
            console.log("sent response");
        } catch (error) {
            console.log("begin handling error");
            console.log("error message:");
            console.error(error);
            console.log("---");
            await teardownBrowser();
            await initBrowser();
            res.status(500).send('An error occurred while rendering the screenshot');
            console.log("end handling error");
        } finally {
            const pages = await browser.pages();
            for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
            }
        }
        processing = false;
    }
});

// Start server and initialize browser
app.listen(port, async () => {
    await initBrowser();
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
