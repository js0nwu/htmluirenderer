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
    shell.exec('pkill chrome');
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
let requestQueue = [];
let isProcessing = false;

// Middleware to handle sequential requests
function sequentialMiddleware(req, res, next) {
  // Push the current request and response objects to the queue
  requestQueue.push({ req, res, next });

  // If no request is being processed, start processing
  if (!isProcessing) {
    processNextRequest();
  }
}

// Function to process the next request in the queue
function processNextRequest() {
  if (requestQueue.length === 0) {
    // No requests left in the queue
    isProcessing = false;
    return;
  }

  // Mark as processing
  isProcessing = true;

  // Get the next request from the queue
  const { req, res, next } = requestQueue.shift();

  // Call the next middleware or route handler, and attach an event to run
  // after the response is finished to continue to the next request
  res.on('finish', () => {
    // Once the response is finished, process the next request
    processNextRequest();
  });

  // Call the next middleware/handler in the stack
  next();
}

app.use(express.json());

// Apply the sequential middleware only to the /process route
app.use('/render', sequentialMiddleware);

// Asynchronous route handler for /process endpoint
app.post('/render', async (req, res) => {
// Example of asynchronous code inside the handler
console.log('Received request:', req.body);

// Simulate an async operation (like a database call or external API call)
// await new Promise(resolve => setTimeout(resolve, 2000));
  // await processLogic(req, res);
    withTimeout(async () => processLogic(req, res), 10000);

console.log('Finished processing:', req.body);
});

async function withTimeout(asyncFn, timeoutMs) {
  // Create a timeout promise that rejects after the specified time
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
        // shell.exec('pkill chrome');
        // browser = null;
      reject(new Error(`Operation timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });

  // Use Promise.race to race between the async function and the timeout
  return Promise.race([asyncFn(), timeoutPromise]);
}

async function processLogic(req, res) {
    console.log("start");
    counter = counter + 1;
    if (!req.body.html) {
        console.log("stop");
        return res.status(400).send('No HTML content provided');
    }
    processing = true;

    
    let page = null;
    try {
        if (browser == null || counter % restartInterval == 0) {
            shell.exec('pkill chrome');
            await initBrowser();
        }
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
    
}

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
