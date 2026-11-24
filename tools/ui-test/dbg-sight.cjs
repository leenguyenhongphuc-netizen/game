// Gỡ lỗi trang thử tham quan: in lỗi trang/console, chụp ảnh sau 25 s.  node tools/ui-test/dbg-sight.cjs <url> <ảnh.png>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(process.argv[2]); await p.waitForTimeout(25000);
  console.log('scene', await p.evaluate(() => !!window.__sightScene), await p.title()); await p.screenshot({ path: process.argv[3] }); await b.close();
})();
