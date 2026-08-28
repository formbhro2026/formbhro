const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto("http://localhost:5173/admin/login");
  await page.type('input[type="email"]', "admin@formbhro.com");
  await page.type('input[type="password"]', "admin123"); // assuming standard login
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  console.log("Logged in");
  await page.goto("http://localhost:5173/admin/policies");
  await new Promise((r) => setTimeout(r, 2000));
  await browser.close();
})();
