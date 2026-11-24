// Chụp sân sa hình xe máy (moto-test.html?thi=A1) và ô tô (exam-test.html) ở vài thời điểm khi xe tự chạy.
// Dùng: node tools/ui-test/yard-shots.mjs --base http://localhost:5231 --out thư-mục [--tag truoc|sau]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:5190'), out = arg('--out', 'tools/ui-test/out-yard'), tag = arg('--tag', 'sau');
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/moto-test.html?thi=A1&auto=1`, { waitUntil: 'load' });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/${tag}-moto-0.png` });
const go = p.getByRole('button', { name: /Tập thử/ });
if (await go.count()) await go.first().click();
for (const [i, t] of [[1, 3000], [2, 6000], [3, 6000]]) { await p.waitForTimeout(t); await p.screenshot({ path: `${out}/${tag}-moto-${i}.png` }); }
const calls = await p.evaluate(() => window.__motoYard?.info?.() ?? null).catch(() => null);
await p.goto(`${base}/exam-test.html`, { waitUntil: 'load' });
await p.waitForTimeout(2500);
const t2 = p.getByRole('button', { name: /Tập cả bài/ });
if (await t2.count()) await t2.first().click();
await p.evaluate(() => { window.__examAuto = true; window.__exam?.auto?.(); });
for (const [i, t] of [[1, 3000], [2, 6000]]) { await p.waitForTimeout(t); await p.screenshot({ path: `${out}/${tag}-oto-${i}.png` }); }
console.log('draw', JSON.stringify(calls), 'lỗi trang', errs.slice(0, 3));
await b.close();
