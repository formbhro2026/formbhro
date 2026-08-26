import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let errorFound = false;

  page.on('console', async (msg) => {
    if (msg.type() === 'error' && msg.text().includes('Cannot access')) {
      errorFound = true;
      console.log('CONSOLE ERROR STR:', msg.text());
      const loc = msg.location();
      console.log('CONSOLE ERROR LOC:', loc);
    }
  });

  console.log("Navigating to http://localhost:4173/team/login...");
  await page.goto('http://localhost:4173/team/login', { waitUntil: 'networkidle0' }).catch(console.error);
  
  if (!errorFound) {
    console.log("No error found.");
  }
  
  await browser.close();
})();
