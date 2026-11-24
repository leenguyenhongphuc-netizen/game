// Chụp từng khung màn biển mở (Chromium giả lập, không GPU): tuyến tàu ra đảo tự lái hết luồng tới lúc cập bến,
// đổi góc nhìn, mở bản đồ lớn đặt điểm đến, va bờ; mô tô nước trong vùng phao. Ghi số lần vẽ mỗi khung.
// Cần Vite dev: (cd web && npx vite --port 5277). Chạy: node tools/ui-test/sea-shots.mjs [--base http://localhost:5277] [--out thư-mục]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:5277'), out = arg('--out', 'tools/ui-test/out-sea'), only = arg('--chi', '');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = [];
const errors = [];
async function page(url, w = 393, h = 852) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${url}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/presence|401|404|Failed to load resource/.test(m.text())) errors.push(`${url}: ${m.text()}`); });
  await p.goto(base + url); await p.waitForFunction(() => !!window.__sea, null, { timeout: 60_000 }); await p.waitForTimeout(1500);
  return p;
}
const dbg = (p) => p.evaluate(() => window.__sea.debug());
async function shot(p, name, note) { const d = await dbg(p); await p.screenshot({ path: path.join(out, `${name}.png`) }); log.push({ name, note, draws: d.draws, tris: d.tris, x: Math.round(d.x), z: Math.round(d.z), hull: d.hull, done: d.done }); console.log(name, note, `vẽ ${d.draws}`, `vỏ ${d.hull}`); }

if (!only || only === 'tau') {
  const p = await page('/sea-test.html?che=tau&tuyen=hp_catba&di=dao&tu=1&nhanh=3');
  await shot(p, 'tau-1-roi-ben', 'rời bến Bính, tự lái theo luồng');
  await p.waitForTimeout(6000); await shot(p, 'tau-2-tren-luong', 'giữa luồng, phao đỏ trái xanh phải');
  await p.evaluate(() => window.__sea.setView('far')); await p.waitForTimeout(2500); await shot(p, 'tau-3-tren-cao', 'góc nhìn trên cao: tàu bè, đảo đá vôi');
  await p.evaluate(() => window.__sea.setView('bridge')); await p.waitForTimeout(2500); await shot(p, 'tau-4-buong-lai', 'góc buồng lái');
  await p.evaluate(() => window.__sea.setView('chase'));
  await p.getByRole('button', { name: 'Bản đồ', exact: true }).click(); await p.waitForTimeout(800); await shot(p, 'tau-5-ban-do', 'bản đồ lớn');
  const box = await p.locator('.sea-map-box').boundingBox(); await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.82); await p.waitForTimeout(800);
  await shot(p, 'tau-6-dat-diem', 'chạm mặt nước đặt điểm đến: mũi tên tím dẫn hướng');
  log.push({ name: 'diem-den', note: JSON.stringify(await p.evaluate(() => window.__sea.waypoint)) });
  await p.evaluate(() => window.__sea.setWaypoint(null));
  // chờ tới bến (tự lái, chạy nhanh 3 bước mỗi khung)
  for (let i = 0; i < 90; i++) { const d = await dbg(p); if (d.docking || d.done) break; await p.waitForTimeout(2000); }
  await shot(p, 'tau-7-cap-ben', 'cập cảng Cát Bà');
  await p.waitForFunction(() => document.title === 'XONG', null, { timeout: 30_000 }).catch(() => errors.push('tàu: chưa báo xong chuyến'));
  log.push({ name: 'tau-ket-qua', note: JSON.stringify(await p.evaluate(() => window.__seaDone)), bumps: (await dbg(p)).bumps });
  console.log('va chạm:', (await dbg(p)).bumps.join(' | '));
  await p.context().close();
}
if (!only || only === 'va') {
  // va bờ: lái thẳng vào đất liền, vỏ tàu phải giảm và tàu dội lại
  const p = await page('/sea-test.html?che=tau&tuyen=qng_lyson&di=dao');
  await p.evaluate(() => { const s = window.__sea; s.setLever(4); });
  for (let i = 0; i < 40; i++) { const d = await dbg(p); if (d.hull < 100) break; await p.waitForTimeout(1000); await p.evaluate(() => window.__sea.setRudder(0)); }
  await shot(p, 'va-1-cham-bo', 'chạm bờ: vỏ tàu giảm, tàu dội lại');
  await p.context().close();
}
if (!only || only === 'jet') {
  const p = await page('/sea-test.html?che=jet&bai=my_khe');
  await shot(p, 'jet-1-ben', 'bến cho thuê mô tô nước Mỹ Khê');
  await p.evaluate(() => window.__sea.setGas(1)); await p.waitForTimeout(3500); await p.evaluate(() => window.__sea.setRudder(-1)); await p.waitForTimeout(2500); await p.evaluate(() => window.__sea.setRudder(0));
  await shot(p, 'jet-2-chay', 'ôm cua, nghiêng người');
  await p.evaluate(() => window.__sea.setView('far')); await p.waitForTimeout(2500); await shot(p, 'jet-3-vung-phao', 'vùng phao vàng, ca nô kéo phao chuối');
  await p.evaluate(() => { window.__sea.setView('chase'); window.__sea.setRudder(0); });
  await p.context().close();
  const q = await page('/sea-test.html?che=tau&tuyen=hp_catba&di=dao&tu=1', 852, 393);
  await q.waitForTimeout(4000); await shot(q, 'ngang-1-tau', 'màn ngang');
  await q.context().close();
}
fs.writeFileSync(path.join(out, 'ket-qua.json'), JSON.stringify({ log, errors }, null, 1));
console.log(errors.length ? `LỖI:\n${errors.join('\n')}` : 'Không có lỗi trang.');
await browser.close();
