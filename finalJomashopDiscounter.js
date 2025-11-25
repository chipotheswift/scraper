const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

async function scrapeCatalog(catalogUrl, maxPages = 3) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1920, height: 1080 });

  let allProducts = [];
  let currentPage = 1;

  while (currentPage <= maxPages) {
    console.log(`\n========== Scraping Page ${currentPage} ==========`);

    // Construct URL with page number
    const pageUrl = currentPage === 1 ? catalogUrl : `${catalogUrl}?p=${currentPage}`;

    try {
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (error) {
      console.log("Page load timed out, continuing...");
    }

    // Wait for products to load
    await new Promise((r) => setTimeout(r, 3000));

    // Close any popups that might appear
    await closePopups(page);

    // Scroll down to load lazy-loaded products
    console.log("  Scrolling to load all products...");
    await autoScroll(page);

    // Wait a bit more after scrolling
    await new Promise((r) => setTimeout(r, 2000));

    // Scrape all products on current page
    const products = await page.evaluate(() => {
      const productCards = document.querySelectorAll(".productItemBlock");
      const results = [];

      productCards.forEach((card) => {
        // Product URL
        const link = card.querySelector(".productImg-link, .productName-link");
        const url = link ? link.href : null;

        // Skip if no URL (likely an ad or empty slot)
        if (!url) return;

        // Brand
        const brandEl = card.querySelector(".brand-name");
        const brand = brandEl ? brandEl.textContent.trim() : "No brand";

        // Title (full product name including brand)
        const titleEl = card.querySelector(".productName-link");
        const title = titleEl ? titleEl.getAttribute("title") || titleEl.textContent.trim() : "No title";

        // Image
        const imgEl = card.querySelector(".productImg");
        const imgURL = imgEl ? imgEl.src.split("?")[0] : "No image";

        // Regular price (was price)
        const wasPriceEl = card.querySelector(".was-wrapper span:last-child");
        const wasPrice = wasPriceEl ? wasPriceEl.textContent.trim() : "N/A";

        // Now price (discounted price)
        const nowPriceEl = card.querySelector(".now-price span:last-child");
        const nowPrice = nowPriceEl ? nowPriceEl.textContent.trim() : "No price";

        // Discount percentage
        const discountEl = card.querySelector(".discount-label");
        const discount = discountEl ? discountEl.textContent.trim() : "No discount";

        // Coupon info
        const couponEl = card.querySelector(".coupon-tag span");
        const coupon = couponEl ? couponEl.textContent.trim() : "No coupon";

        // After coupon price
        const afterCouponEl = card.querySelector(".after-price");
        const afterCouponPrice = afterCouponEl ? afterCouponEl.textContent.trim().replace("after coupon", "").trim() : "N/A";

        results.push({
          url,
          brand,
          title,
          imgURL,
          wasPrice,
          nowPrice,
          discount,
          coupon,
          afterCouponPrice,
        });
      });

      return results;
    });

    console.log(`Found ${products.length} products on page ${currentPage}`);
    allProducts = allProducts.concat(products);

    // Display sample of scraped data
    if (products.length > 0) {
      console.log("\nSample product:");
      console.log(products[0]);
    }

    // Check if there's a next page
    const hasNextPage = await page.evaluate(() => {
      const nextLink = document.querySelector('a.page-link[aria-label="Pagination next"]');
      return nextLink !== null;
    });

    if (!hasNextPage) {
      console.log("\n✅ No more pages found. Stopping.");
      break;
    }

    currentPage++;

    // Add delay between pages to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  // Save to JSON
  fs.writeFileSync("jomashop_products.json", JSON.stringify(allProducts, null, 2));
  console.log(`\n✅ Successfully scraped ${allProducts.length} products!`);
  console.log("💾 Data saved to jomashop_products.json");

  // Optional: Save to CSV
  saveToCSV(allProducts, "jomashop_products.csv");

  return allProducts;
}

// Function to auto-scroll the page to load lazy-loaded content
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// Function to close popups
async function closePopups(page) {
  try {
    // Wait a moment for popup to potentially appear
    await new Promise((r) => setTimeout(r, 1000));

    // Try to close the popup
    const popupClosed = await page.evaluate(() => {
      const closeButton = document.querySelector(".ltkpopup-close, .ltkpopup-close-button button");
      if (closeButton) {
        closeButton.click();
        return true;
      }
      return false;
    });

    if (popupClosed) {
      console.log("  ✓ Closed popup");
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (error) {
    // Popup might not exist, continue normally
  }
}

// Helper function to save data as CSV
function saveToCSV(products, filename) {
  if (products.length === 0) return;

  const headers = Object.keys(products[0]).join(",");
  const rows = products.map((product) => {
    return Object.values(product)
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [headers, ...rows].join("\n");
  fs.writeFileSync(filename, csv);
  console.log(`💾 Data also saved to ${filename}`);
}

// Run the scraper
const catalogUrl = "https://www.jomashop.com/fragrances.html";

// Change maxPages to scrape more pages (e.g., 10, 20, etc.)
scrapeCatalog(catalogUrl, 2).catch((error) => {
  console.error("Error:", error);
});