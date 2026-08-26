import puppeteer from 'puppeteer';
import { SourceMapConsumer } from 'source-map';
import fs from 'fs';
import path from 'path';

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
      
      try {
        const urlObj = new URL(loc.url);
        let filepath = path.join('.output/public', urlObj.pathname);
        if (!fs.existsSync(filepath)) {
           // try decoding
           filepath = decodeURIComponent(filepath);
        }
        const mapPath = filepath + '.map';
        console.log("Looking for map:", mapPath);
        
        if (fs.existsSync(mapPath)) {
          const rawSourceMap = fs.readFileSync(mapPath, 'utf8');
          await SourceMapConsumer.with(rawSourceMap, null, consumer => {
            const pos = consumer.originalPositionFor({
              line: loc.lineNumber,
              column: loc.columnNumber
            });
            console.log("ORIGINAL POSITION:", pos);
          });
        } else {
          console.log("No source map found at", mapPath);
        }
      } catch(e) {
        console.error("Error parsing sourcemap:", e);
      }
    }
  });

  console.log("Navigating to http://localhost:4174/team/login...");
  await page.goto('http://localhost:4174/team/login', { waitUntil: 'networkidle0' }).catch(console.error);
  console.log("Done.");
  
  if (!errorFound) {
    console.log("No 'Cannot access' error found on local build!");
  }
  
  await browser.close();
})();
