const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const app = express();
const port = 3000;
const restartFrequency = 100;
const TIMEOUT_LIMIT = 10000; // 10 seconds timeout

let browser = null;
let counter = 0;

let processing = false; // Mutex to ensure sequential processing
let queue = []; // Queue for storing requests

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

// Start server and initialize browser
app.listen(port, async () => {
    await initBrowser();
    console.log(`Server is listening at http://localhost:${port}`);
});


// Function to process the next request in the queue
const processNextRequest = async () => {
    if (queue.length > 0 && !processing) {
        processing = true;
        const { req, res } = queue.shift(); // Get the next request from the queue

        await handleRequestWithTimeout(req, res); // Process the request with timeout

        processing = false;
        processNextRequest(); // Process the next request
    }
};

// Function to handle the request with a timeout
const handleRequestWithTimeout = async (req, res) => {
    let responseSent = false; // Flag to check if the response has been sent

    try {
        await Promise.race([
            processRequest(req, res, () => responseSent = true), // Main request processing
            timeout(TIMEOUT_LIMIT, res, () => responseSent = true) // Timeout promise
        ]);
    } catch (error) {
        if (!responseSent) {  // Only send a response if it hasn’t been sent yet
            console.error('Error during request processing:', error);
            res.status(500).send('An unexpected error occurred.');
        }
    }
};

// Helper function to enforce a timeout
const timeout = (ms, res, markResponseSent) => {
    return new Promise((_, reject) => {
        setTimeout(() => {
            if (!res.headersSent) { // Check if headers were already sent
                console.log("Request timed out");
                res.status(408).send('Request timed out');
                markResponseSent(); // Mark that the response has been sent
            }
            reject(new Error('Timeout exceeded'));
        }, ms);
    });
};

// The main logic to process the /process request
const processRequest = async (req, res, markResponseSent) => {
    if (!req.body.html) {
        res.status(400).send('No HTML content provided');
        markResponseSent();
    } else {
        let page = null;
        try {
            const pages = await browser.pages();
            console.log("number of pages");
            console.log(pages.length);
            let numPages = pages.length;

            // Close all open pages before proceeding
            while (numPages > 0) {
                const pagesBefore = await browser.pages();
                for (let i = 0; i < pagesBefore.length; i++) {
                    await pagesBefore[i].close();
                }
                const pagesAfter = await browser.pages();
                numPages = pagesAfter.length;
            }

            // Create a new page and set the HTML content
            page = await browser.newPage();
            await page.setContent(req.body.html);
            console.log("set html");

            // Take a screenshot
            const screenshotBuffer = await page.screenshot();
            console.log("took screenshot");

            // Resize the screenshot
            const resizedScreenshot = await sharp(screenshotBuffer)
                .resize(512, 512, { fit: 'inside' })
                .toBuffer();
            console.log("resized image");

            // Restart browser if necessary
            counter = counter + 1;
            if (counter % restartFrequency == 0) {
                console.log("hit restart frequency");
                await teardownBrowser();
                await initBrowser();
                console.log("done with restart");
            }

            // Send the screenshot as the response
            if (!res.headersSent) {
                console.log("starting to send response");
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': resizedScreenshot.length
                });
                res.end(resizedScreenshot);
                console.log("sent response");
                markResponseSent(); // Mark that the response has been sent
            }

        } catch (error) {
            console.log("begin handling error");
            console.log("error message:");
            console.error(error);
            console.log("---");
            await teardownBrowser();
            await initBrowser();
            if (!res.headersSent) {
                res.status(500).send('An error occurred while rendering the screenshot');
                markResponseSent(); // Mark that the response has been sent
            }
            console.log("end handling error");

        } finally {
            // Ensure all pages are closed after processing
            const pages = await browser.pages();
            for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
            }
        }
    }
};

// The /process endpoint with queueing
app.post('/render', (req, res) => {
    // Add the request to the queue
    queue.push({ req, res });
    processNextRequest(); // Trigger the processing if idle
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
