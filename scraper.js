const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function scrapeProduct(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set realistic user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Add extra headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  });

  // Navigate to Amazon homepage first (more natural behavior)
  console.log("Visiting Amazon homepage...");
  await page.goto("https://www.amazon.com", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  // Then navigate to the product
  console.log("Navigating to product page...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait a bit more for content to load
  await new Promise((r) => setTimeout(r, 3000));

  // Take screenshot for debugging
  await page.screenshot({ path: "debug.png", fullPage: true });

  const html = await page.content();
  console.log("Page title:", await page.title());
  console.log("HTML length:", html.length);

  // Check if we hit bot detection
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (
    bodyText.includes("Enter the characters") ||
    bodyText.includes("click the button") ||
    bodyText.includes("Robot Check")
  ) {
    console.log("⚠️  Bot detection triggered!");
    console.log("Amazon has blocked this request.");
    console.log("\nAlternatives:");
    console.log("1. Use Amazon Product Advertising API (official)");
    console.log("2. Use a proxy/residential IP service");
    console.log("3. Try running with headless: false to see the page");
    await browser.close();
    return;
  }

  // --- Scrape Image URL ---
  const imgURL = await page.evaluate(() => {
    const img =
      document.querySelector("#landingImage") ||
      document.querySelector('img[data-a-dynamic-image]') ||
      document.querySelector(".a-dynamic-image") ||
      document.querySelector("#imgBlkFront") ||
      document.querySelector("#ebooksImgBlkFront");
    return img ? img.src : "No image found";
  });

  // --- Scrape Product Title ---
  const title = await page.evaluate(() => {
    const titleEl =
      document.querySelector("#productTitle") ||
      document.querySelector("#ebooksProductTitle");
    return titleEl ? titleEl.textContent.trim() : "No title found";
  });

  // --- Scrape Product Price ---
  const price = await page.evaluate(() => {
    const selectors = [
      ".a-price .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      'span.a-price span[aria-hidden="true"]',
      ".a-price-whole",
      "#kindle-price",
      ".a-color-price",
    ];

    for (const selector of selectors) {
      const priceEl = document.querySelector(selector);
      if (priceEl && priceEl.textContent.trim()) {
        return priceEl.textContent.trim();
      }
    }
    return "No price found";
  });

  // Log the scraped data
  console.log("\n--- Scraped Data ---");
  console.log({ imgURL, title, price });

  // Close the browser
  await browser.close();
}

// Example usage:
const url =
  "https://www.amazon.com/Black-Swan-Improbable-Robustness-Fragility/dp/081297381X/";

scrapeProduct(url).catch((error) => {
  console.error("Error:", error);
});