// Kiểm trạm dừng nghỉ trong màn lái thật (DriveGame): đỗ xe → xuống xe → vào quán ăn → CHẠM THẬT vào nút Ăn/Bỏ túi
// (tap cảm ứng cỡ iPhone), rồi cửa hàng, WC. Báo lỗi nếu tổng tiền không tăng.
// Dùng: node tools/ui-test/stop-food.mjs [--base http://localhost:5190] [--out thư-mục]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:5190'), out = arg('--out', 'tools/ui-test/out-stop-food');
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/drive-test.html?from=dt_caibe&to=ld_dalat&km=320&seconds=20&rests=1&need=1&auto=1&kind=tai_990&fuel=200`, { waitUntil: 'load' });
// xe tự lái tới trạm (DriveScene đọc __driveAuto lúc dựng), rồi tắt cờ để DriveGame mở khu trạm cho người chơi
await p.waitForTimeout(2500); await p.evaluate(() => { window.__driveAuto = false; });
for (let i = 0; i < 400; i++) { if (await p.$('.sa')) break; if (i % 30 === 0) console.log('…', i, 's', await p.evaluate(() => document.querySelector('.dg-top')?.textContent?.slice(0, 60))); await p.waitForTimeout(1000); }
if (!(await p.$('.sa'))) { console.log('LỖI: không tới được trạm dừng'); process.exit(1); }
await p.waitForTimeout(1500);
const st = () => p.evaluate(() => window.__stop?.state());
const until = async (f, n = 60) => { for (let i = 0; i < n; i++) { if (f(await st())) return true; await p.waitForTimeout(500); } return false; };
await p.evaluate(() => window.__stop.park('lot'));
await until((s) => s?.phase === 'parked');
await p.evaluate(() => window.__stop.getOut());
await until((s) => s?.phase === 'walk');
let bad = 0;
for (const spot of ['food', 'shop']) {
  await p.evaluate((s) => window.__stop.walkTo(s), spot);
  await until((s) => s?.near === spot);
  await p.evaluate(() => window.__stop.act());
  await p.waitForSelector('.sa-shop', { timeout: 5000 }).catch(() => {});
  const before = await p.textContent('.sa-shop .tot').catch(() => null);
  const sel = '.sa-shop .dg-food button.eat';
  const bb = await (await p.$(sel))?.boundingBox();
  const top = bb ? await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 100), [bb.x + bb.width / 2, bb.y + bb.height / 2]) : null;
  if (bb) await p.tap(sel);
  await p.waitForTimeout(500);
  const pocket = await p.$('.sa-shop .dg-food button:not(.eat)');
  if (pocket) await pocket.tap();
  await p.waitForTimeout(500);
  const after = await p.textContent('.sa-shop .tot').catch(() => null);
  await p.screenshot({ path: `${out}/${spot}.png` });
  const ok = !!after && after !== before && !/^Đã mua 0/.test(after);
  if (!ok) bad++;
  console.log(`${spot}: ${ok ? 'đạt' : 'LỖI'} · trước "${before}" · sau "${after}" · phần tử ở chỗ chạm: ${top}`);
  const close = await p.$('.sa-shop .sa-btn.go'); if (close) await close.tap();
  await p.waitForTimeout(400);
}
await p.evaluate(() => window.__stop.walkTo('wc'));
await until((s) => s?.near === 'wc');
await p.evaluate(() => window.__stop.act());
const wc = await until((s) => !!s?.wc, 30);
console.log(`wc: ${wc ? 'đạt' : 'LỖI'}`); if (!wc) bad++;
await p.screenshot({ path: `${out}/wc.png` });
if (errs.length) { console.log('Lỗi trang:', errs.slice(0, 3)); bad++; }
console.log(bad ? `${bad} lỗi` : '0 lỗi');
await b.close();
process.exit(bad ? 1 : 0);
