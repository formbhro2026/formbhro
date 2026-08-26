import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', (err) => {
    console.log('PAGE ERROR STR:', err.toString());
    console.log('PAGE ERROR STACK:', err.stack);
  });
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR STR:', msg.text());
      console.log('CONSOLE ERROR STACK:', msg.location());
    }
  });

  await page.goto('https://formbhro-oa2i.vercel.app/team/login', { waitUntil: 'networkidle0' }).catch(console.error);
  
  await browser.close();
})();
