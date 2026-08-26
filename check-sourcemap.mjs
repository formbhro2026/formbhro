import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let errorMsg = null;
  page.on('console', async (msg) => {
    if (msg.type() === 'error' && msg.text().includes('Cannot access')) {
      errorMsg = msg;
      console.log('CONSOLE ERROR STR:', msg.text());
      const loc = msg.location();
      console.log('CONSOLE ERROR LOC:', loc);
    }
  });

  console.log("Navigating to https://formbhro-oa2i.vercel.app/team/login...");
  await page.goto('https://formbhro-oa2i.vercel.app/team/login', { waitUntil: 'networkidle0' }).catch(console.error);
  
  if (!errorMsg) {
    console.log("NO ERROR FOUND ON LIVE SITE! It might have been fixed or not deployed yet.");
  } else {
    console.log("ERROR STILL PRESENT on live site.");
    // We will download the source map using curl if we have the URL
  }
  
  await browser.close();
})();
