const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto("http://localhost:8080/admin/login");
  await page.type('input[type="email"]', "admin@formbhro.com");
  await page.type('input[type="password"]', "admin123"); // assuming standard login
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  console.log("Logged in");
  await page.goto("http://localhost:8080/admin/policies");
  await new Promise((r) => setTimeout(r, 2000));
  const content = await page.content();
  if (content.includes("Something went wrong")) {
    console.log("Found error boundary!");
  } else {
    console.log("No error boundary found");
  }
  await browser.close();
})();
