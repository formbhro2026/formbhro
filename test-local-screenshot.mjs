import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  console.log("Navigating to http://localhost:4174/team/login...");
  await page.goto('http://localhost:4174/team/login', { waitUntil: 'networkidle0' }).catch(console.error);
  await page.screenshot({ path: 'scratch/screen_test.png' });
  console.log("Screenshot saved.");
  
  await browser.close();
})();
