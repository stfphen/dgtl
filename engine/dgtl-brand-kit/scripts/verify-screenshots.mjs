import { chromium } from 'playwright';
const files = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async e => {
  const { chromium: c2 } = await import('playwright');
  return c2.launch();
});
for (const f of files) {
  const name = f.split('/').pop().replace('.html','');
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('JS: ' + e.message));
  page.on('requestfailed', r => { if (!r.url().includes('fonts.g')) errors.push('REQ FAIL: ' + r.url().slice(0,100)); });

  await page.route('**/logos/clients/**', route => {
    const n = route.request().url().split('/').pop().split('.')[0].replace(/-/g,' ').toUpperCase();
    route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="36"><text x="70" y="24" font-family="Arial" font-size="15" font-weight="bold" fill="white" text-anchor="middle">'+n+'</text></svg>' });
  });
  await page.goto('file://' + f, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push('NAV: ' + e.message));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/home/claude/landing-pages/shots/${name}-hero.png` });
  // mid-page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/home/claude/landing-pages/shots/${name}-mid.png` });
  // footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/home/claude/landing-pages/shots/${name}-footer.png` });
  // full page (capped)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/home/claude/landing-pages/shots/${name}-full.png`, fullPage: true });
  // mobile
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mp.route('**/logos/clients/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="36"><text x="70" y="24" font-family="Arial" font-size="15" fill="white" text-anchor="middle">LOGO</text></svg>' }));
  await mp.goto('file://' + f, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await mp.waitForTimeout(1000);
  await mp.screenshot({ path: `/home/claude/landing-pages/shots/${name}-mobile.png` });
  await mp.close();
  console.log(name, '| errors:', errors.length ? errors.join(' ; ') : 'none');
  await page.close();
}
await browser.close();
