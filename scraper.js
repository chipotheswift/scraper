const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function scrapeJomashopProduct(url) {
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

  // Navigate to the product page with a more forgiving wait strategy
  console.log("Navigating to product page...");
  try {
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
  } catch (error) {
    console.log("Initial load timed out, but continuing anyway...");
  }

  // Wait for specific elements to appear
  console.log("Waiting for page elements...");
  try {
    await page.waitForSelector("#product-h1-product-name, .brand-name", { timeout: 10000 });
  } catch (error) {
    console.log("Some elements didn't load, continuing...");
  }

  // Additional wait for any dynamic content
  await new Promise((r) => setTimeout(r, 5000));

  // Take screenshot for debugging
  await page.screenshot({ path: "jomashop_debug.png", fullPage: true });

  console.log("Page title:", await page.title());

  // Check page content length
  const html = await page.content();
  console.log("HTML length:", html.length);

  // --- Scrape Image URL ---
  const imgURL = await page.evaluate(() => {
    const img = document.querySelector("#product-main-image-gallery");
    if (img && img.src) {
      return img.src.split('?')[0];
    }
    return "No image found";
  });

  // --- Scrape Product Title ---
  const title = await page.evaluate(() => {
    const titleEl = document.querySelector("#product-h1-product-name");
    return titleEl ? titleEl.textContent.trim() : "No title found";
  });

  // --- Scrape Brand Name ---
  const brand = await page.evaluate(() => {
    const brandEl = document.querySelector(".brand-name");
    return brandEl ? brandEl.textContent.trim() : "No brand found";
  });

  // --- Scrape Product Price (NOW PRICE with discount) ---
  const price = await page.evaluate(() => {
    // First, try to get the "now price" from the discount section
    const nowPriceDiv = document.querySelector(".now-price span");
    if (nowPriceDiv) {
      const priceText = nowPriceDiv.textContent.trim();
      if (priceText.includes("$")) {
        return priceText;
      }
    }

    // Fallback to other price selectors
    const selectors = [
      ".price-box .price",
      ".product-info-price .price",
      '[data-price-type="finalPrice"] .price',
      ".price-wrapper .price",
    ];

    for (const selector of selectors) {
      const priceEl = document.querySelector(selector);
      if (priceEl && priceEl.textContent.trim().includes("$")) {
        return priceEl.textContent.trim();
      }
    }

    return "No price found";
  });

  // Log the scraped data
  console.log("\n--- Scraped Data ---");
  console.log({
    brand,
    title,
    price,
    imgURL,
  });

  // Close the browser
  await browser.close();
}

// Correct URL:
const url =
  "https://www.jomashop.com/french-avenue-unisex-royal-taboo-aromatix-edp-spray-3-3-oz-fragrances-6290360379227.html";

scrapeJomashopProduct(url).catch((error) => {
  console.error("Error:", error);
});