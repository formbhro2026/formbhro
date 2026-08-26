import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('https://formbhro-oa2i.vercel.app/admin', { waitUntil: 'networkidle0' }).catch(console.error);
  
  const content = await page.content();
  if (content.includes('Infrastructure Connection')) {
    console.log("LIVE SITE STILL HAS INFRASTRUCTURE GUIDE!");
  } else {
    console.log("Infrastructure guide is GONE from live site.");
  }
  
  await browser.close();
})();
