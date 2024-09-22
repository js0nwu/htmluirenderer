const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const app = express();
const port = 3000;
const restartFrequency = 100;

let browser = null;
let page = null;
let counter = 0;

const requestQueue = [];

let processing = false;

// Function to process the next request in the queue
async function processNext() {
  if (requestQueue.length === 0 || processing) {
    return; // No pending requests or one is already processing
  }

  // Get the next request from the queue
  const { req, res, handler } = requestQueue.shift();
  
  // Set the processing flag
  processing = true;

  try {
    // Process the request (calling the handler directly)
    await handler(req, res);
  } catch (err) {
    res.status(500).send('An error occurred');
  } finally {
    // After processing, unlock and move to the next request
    processing = false;
    processNext();
  }
}

async function initPage() {
    console.log("begin init page");
    page = await browser.newPage();
    // Emulate iPhone 13
    await page.emulate(puppeteer.devices['iPhone 13']);
    console.log("end init page");
}

async function initBrowser() {
    console.log("begin init browser");
    browser = await puppeteer.launch({
        headless: true,
        args: ['--single-process', '--no-zygote', '--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process']
    });
    await initPage();
    console.log("end init browser");
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
    }
    console.log("done with teardown");
}

// To handle JSON payloads
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to add requests to the queue
app.use((req, res, next) => {
  // Define the handler as a wrapper for `next`
  const handler = async (req, res) => {
    try {
      await next();
    } catch (err) {
      res.status(500).send('An error occurred during request processing');
    }
  };

  // Push the request into the queue
  requestQueue.push({ req, res, handler });

  // If no requests are currently being processed, start processing
  if (!processing) {
    processNext();
  }
});

app.post('/render', async (req, res) => {
    if (!req.body.html) {
        res.status(400).send('No HTML content provided');
    } else {
        try {
            if (page == null || (page != null && page.isClosed())) {
                await initPage();
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
                        await initPage();
                    }   
                }
                
            }
            // Return the screenshot in the response
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': resizedScreenshot.length
            });
            res.end(resizedScreenshot);
    
        } catch (error) {
            console.log("begin handling error");
            console.error(error);
            // await teardownBrowser();
            // await initBrowser();
            try {
                if (page && !page.isClosed()) {
                    await page.close();
                    if (browser != null) {
                        await initPage();
                    }   
                }
            } catch (e) {
                console.log("fail to close page");
                await teardownBrowser();
                await initBrowser();
            }
            res.status(500).send('An error occurred while rendering the screenshot');
            console.log("end handling error");
        }
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
