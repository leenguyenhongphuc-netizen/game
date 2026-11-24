// Đi bộ trong trạm dừng nghỉ bằng cảm ứng: đỗ xe → xuống xe → chạm giữ nửa trái kéo lên (đi tới) → kéo bên phải (xoay máy quay).
// Ghi vị trí người, góc máy quay; chụp ảnh. Dùng: node tools/ui-test/stop-walk.mjs [--base URL] [--out thư-mục]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:5190'), out = arg('--out', 'tools/ui-test/out-stop-walk');
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/drive-test.html?stop=rest`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__stop?.state(), null, { timeout: 60000 });
const st = () => p.evaluate(() => window.__stop.state());
const until = async (f, n = 60) => { for (let i = 0; i < n; i++) { if (f(await st())) return true; await p.waitForTimeout(400); } return false; };
await p.evaluate(() => window.__stop.park('lot')); await until((s) => s.phase === 'parked');
await p.evaluate(() => window.__stop.getOut()); await until((s) => s.phase === 'walk');
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/1-xuong-xe.png` }); console.log('xuống xe', JSON.stringify(await p.evaluate(() => window.__stop.camInfo())));
const vp = p.viewportSize(), pos = () => p.evaluate(() => window.__stop.pos().person);
const cam = () => p.evaluate(() => { const c = document.querySelector('.sa-scene canvas'); return c ? 1 : 0; });
const p0 = await pos();
// kéo cần: chạm nửa trái dưới, kéo lên 70 px, giữ 2,5 s
const jx = vp.width * 0.25, jy = vp.height * 0.72;
await p.mouse.move(jx, jy); await p.mouse.down(); await p.mouse.move(jx, jy - 70, { steps: 6 });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/2-dang-di.png` });
await p.mouse.up();
const p1 = await pos();
const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
// kéo bên phải để xoay
const rx = vp.width * 0.75, ry = vp.height * 0.45;
const shot = async () => (await p.screenshot()).toString('base64').length;
await p.mouse.move(rx, ry); await p.mouse.down(); await p.mouse.move(rx - 180, ry, { steps: 10 }); await p.mouse.up();
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/3-xoay.png` }); console.log('sau xoay', JSON.stringify(await p.evaluate(() => window.__stop.camInfo())));
await p.evaluate(() => window.__stop.walkTo('food')); await until((s) => s.near === 'food');
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/4-truoc-quan.png` }); console.log('trước quán', JSON.stringify(await p.evaluate(() => window.__stop.camInfo())));
console.log(`đi được ${moved.toFixed(2)} m bằng cần cảm ứng`, cam() ? '' : '');
const bad = (moved < 1.5 ? 1 : 0) + errs.length;
if (errs.length) console.log('Lỗi trang:', errs.slice(0, 3));
console.log(bad ? `${bad} lỗi` : '0 lỗi');
await b.close(); process.exit(bad ? 1 : 0);
