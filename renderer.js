const puppeteer = require('puppeteer');
const fs = require('fs');
const sharp = require('sharp');

(async () => {
  // Launch the browser with the --no-sandbox flag
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // List of HTML file paths
  const htmlFiles = ['sample.html', 'anothertest.html']; // Add your file paths here
  const devices = puppeteer.devices;
  const iPhone13 = devices['iPhone 13'];
  for (const file of htmlFiles) {
    // Open a new page
    const page = await browser.newPage();
    await page.emulate(iPhone13);
    // Read the HTML file
    const content = fs.readFileSync(file, 'utf8');

    // Set the content of the page
    await page.setContent(content);

    // Take a screenshot (PNG format)
    // await page.screenshot({ path: `screenshot-${file}.jpg` });
    // Taking screenshot
    const screenshotBuffer = await page.screenshot();

    // Resize the screenshot - max dimension 512px while maintaining aspect ratio
    await sharp(screenshotBuffer)
      .resize(512, 512, {
        fit: 'inside'
      })
      .toFile(`screenshot-${file}.jpg`);

    // Close the page
    await page.close();
  }

  // Close the browser
  await browser.close();
})();
