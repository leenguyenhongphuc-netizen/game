// Kiểm mặt cầu không bị nước sông vẽ đè: lái tới đoạn cầu vượt sông và đo màu mặt đường ngay trước xe.
// Dùng: node tools/ui-test/bridge-test.mjs [--base http://localhost:5173]  (cần vite dev hoặc bản dựng đang phục vụ drive-test.html)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const i = process.argv.indexOf('--base'), BASE = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 })).newPage();
await p.goto(`${BASE}/drive-test.html?from=dt_caibe&to=ld_dalat&km=320&seconds=60&police=0`);
await p.waitForFunction(() => window.__drive, null, { timeout: 60000 }); await p.waitForTimeout(2500);
const s = await p.evaluate(() => window.__drive.events.find((e) => e.type === 'feature' && e.kind === 'bridge')?.s ?? null);
if (s === null) { console.log('BỎ QUA  tuyến thử không có cầu vượt sông'); await b.close(); process.exit(0); }
let bad = 0;
for (const back of [28, 14, 2]) {
  await p.evaluate((v) => window.__drive.warp(v), s - back); await p.waitForTimeout(1500);
  const png = await p.screenshot({ clip: { x: 195, y: 300, width: 40, height: 60 } });
  const [r, g, bl] = await p.evaluate(async (d) => { const im = new Image(); im.src = 'data:image/png;base64,' + d; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const px = x.getImageData(0, 0, c.width, c.height).data; let R = 0, G = 0, B = 0, n = 0; for (let k = 0; k < px.length; k += 4) { R += px[k]; G += px[k + 1]; B += px[k + 2]; n++; } return [R / n, G / n, B / n]; }, png.toString('base64'));
  const water = bl > r + 35 && bl > 150; if (water) bad++;
  console.log(`${water ? 'LỖI ' : 'ĐẠT '}  cách cầu ${back} m: màu mặt đường rgb(${r.toFixed(0)}, ${g.toFixed(0)}, ${bl.toFixed(0)})${water ? ' — giống màu nước' : ''}`);
}
await b.close(); process.exit(bad ? 1 : 0);
