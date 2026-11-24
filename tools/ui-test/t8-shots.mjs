// Chụp các trang thử ở cỡ iPhone 15 (dpr 3) để so độ sắc nét trước/sau.
// Cần Vite dev ở cổng 5301 (hoặc --base). node tools/ui-test/t8-shots.mjs <thư mục ra> [tên,tên]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const args = process.argv.slice(2);
const bi = args.indexOf('--base'); const B = bi >= 0 ? args.splice(bi, 2)[1] : 'http://localhost:5301';
const out = args[0], only = args[1];
const pages = [
  ['sight', '/sight-test.html?id=dn_hoi_an', 9000],
  ['drive', '/drive-test.html?from=dt_caibe&to=ld_dalat&km=320', 9000],
  ['plane', '/drive-test.html?ride=may_bay&km=600&seconds=14', 4500],
  ['plane2', '/drive-test.html?ride=may_bay&km=600&seconds=14', 9000],
  ['train', '/drive-test.html?ride=tau_hoa&km=300&seconds=14', 6000],
  ['bus', '/drive-test.html?ride=xe_khach&km=300&seconds=14', 6000],
  ['boat', '/drive-test.html?ride=tau_thuy&km=60&seconds=14', 6000],
  ['ferry', '/sea-test.html?tuyen=hp_catba', 9000],
  ['jet', '/sea-test.html?che=jet&bai=my_khe', 8000],
  // tua tới giữa hành trình (ô cửa sổ): đợi stage 4, progress ≥ 0.45
  ['plane-win', '/drive-test.html?ride=may_bay&km=600&seconds=14', 'win'],
  ['train-win', '/drive-test.html?ride=tau_hoa&km=300&seconds=14', 'win'],
  ['bus-win', '/drive-test.html?ride=xe_khach&km=300&seconds=14', 'win'],
  ['boat-mid', '/drive-test.html?ride=tau_thuy&km=60&seconds=14', 'win'],
];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, url, wait] of pages) {
  if (only && !only.split(',').includes(name)) continue;
  const ctx = await browser.newContext({ ...devices['iPhone 15'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  if (wait === 'win') await p.addInitScript(() => { window.__rideStep = 0.25; });
  await p.goto(B + url);
  if (wait === 'win') { await p.waitForFunction(() => { const d = window.__ride?.debug?.(); return d && d.stage === 4 && d.progress >= 0.45; }, null, { timeout: 120000 }).catch(() => {}); await p.evaluate(() => window.__ride?.pause(true)); await p.waitForTimeout(600); }
  else await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}/${name}.png` });
  await p.screenshot({ path: `${out}/${name}-zoom.png`, clip: { x: 100, y: 330, width: 190, height: 190 } });
  const perf = await p.evaluate(() => (window.__perf ? JSON.stringify(window.__perf()) : '')).catch(() => '');
  console.log(name, errs.length ? 'LỖI ' + errs[0].slice(0, 160) : 'ok', perf.slice(0, 220));
  await ctx.close();
}
await browser.close();
