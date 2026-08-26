import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', (err) => {
    console.log('Page error:', err.message);
  });
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });

  await page.goto('http://localhost:4174/team/login', { waitUntil: 'networkidle0' }).catch(console.error);
  
  await browser.close();
})();
