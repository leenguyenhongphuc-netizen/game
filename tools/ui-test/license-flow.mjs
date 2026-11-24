// Luồng bằng lái trong app thật: thẻ hạng A có nút "📝 Thi lý thuyết" → làm đủ đề (25 câu, có câu điểm liệt) → nộp → hiện
// "🏁 Thi sa hình (sát hạch thật)" + "🎓 Tập lái" + "🍀 Mua bùa may mắn" → mua bùa → mở sân thi xe máy có ô "Dùng bùa may mắn".
// Dùng: node tools/ui-test/license-flow.mjs --base http://localhost:3231 --db postgres://vuon:vuon@localhost:5432/vuon_s7 --out thư-mục
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:3100'), DB = arg('--db', 'postgres://vuon:vuon@localhost:5432/vuon_ui'), OUT = arg('--out', 'tools/ui-test/out-license');
mkdirSync(OUT, { recursive: true });
const sql = (q) => execFileSync('psql', [DB, '-qtAc', q], { encoding: 'utf8' });
const fails = []; const check = (n, ok, x = '') => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${n}${x ? ` — ${x}` : ''}`); if (!ok) fails.push(n); };
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const u = `lic${Date.now() % 100000}`;
let r = await page.request.post(`${BASE}/api/auth/register`, { data: { username: u, password: 'matkhau123', displayName: u } });
if (!r.ok()) throw new Error(await r.text());
sql(`update users set role = 'nong_dan', role_assigned_at = now(), cash = 900000000, xp = 20000 where username = '${u}'`);
r = await page.request.post(`${BASE}/api/onboard`, { data: { regionId: 'ld_dalat' } }); if (!r.ok()) throw new Error(await r.text());
await page.goto(BASE); await page.waitForTimeout(4000);
const shot = (f) => page.screenshot({ path: `${OUT}/${f}` });
// mở Trang trí → Bãi xe → Bằng lái
await page.getByRole('button', { name: /Trang trí/ }).last().click();
await page.getByRole('button', { name: /^Bãi xe$/ }).first().click();
await page.getByRole('tab', { name: /Bằng lái/ }).click();
const cardA = page.locator('.lic[data-cls="A"]');
await cardA.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await shot('1-the-hang-A.png');
check('thẻ hạng A có nút Thi lý thuyết', await cardA.getByRole('button', { name: /Thi lý thuyết/ }).isVisible());
check('thẻ hạng A có nút Ôn lý thuyết', await cardA.getByRole('button', { name: /Ôn lý thuyết/ }).isVisible());
// ôn thử một câu
await cardA.getByRole('button', { name: /Ôn lý thuyết/ }).click(); await page.waitForTimeout(300);
await page.locator('.quiz-opts button').first().click(); await page.waitForTimeout(200);
await shot('2-on-ly-thuyet.png');
check('ôn tập hiện giải thích ngay', await page.locator('.quiz-why').isVisible());
await page.locator('.quiz header .round').click();
// thi thật
await cardA.getByRole('button', { name: /Thi lý thuyết/ }).click();
await page.waitForFunction(() => window.__quiz?.n > 0);
const qz = await page.evaluate(() => window.__quiz);
check('đề hạng A đủ 25 câu, có câu điểm liệt', qz.n === 25 && qz.lie.some(Boolean), `${qz.n} câu, ${qz.lie.filter(Boolean).length} câu điểm liệt, đạt từ ${qz.pass}`);
await shot('3-de-thi.png');
for (let i = 0; i < qz.n; i++) {
  await page.locator('.quiz-opts button').nth(qz.ok[i]).click();
  if (i < qz.n - 1) await page.getByRole('button', { name: /Câu tiếp/ }).click();
}
await page.getByRole('button', { name: /Nộp bài/ }).click(); await page.waitForTimeout(300);
await shot('4-ket-qua.png');
await page.getByRole('button', { name: /Nộp kết quả/ }).click();
await page.waitForTimeout(6500);
await cardA.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await shot('5-sau-ly-thuyet.png');
check('sau khi đạt có nút Thi sa hình (sát hạch thật)', await cardA.getByRole('button', { name: /Thi sa hình/ }).isVisible());
check('có nút Mua bùa may mắn', await cardA.getByRole('button', { name: /bùa may mắn/ }).isVisible());
await cardA.getByRole('button', { name: /bùa may mắn/ }).click(); await page.waitForTimeout(1500);
check('mua bùa xong hiện số bùa', /có 1/.test(await cardA.getByRole('button', { name: /bùa may mắn/ }).textContent()));
await cardA.getByRole('button', { name: /Thi sa hình/ }).click(); await page.waitForTimeout(1200);
await shot('6-san-thi-co-bua.png');
check('sân thi có ô Dùng bùa may mắn', await page.locator('.mx-charm').isVisible());
if (errs.length) check('không lỗi trang', false, errs.slice(0, 2).join(' | '));
console.log(fails.length ? `${fails.length} lỗi` : '0 lỗi');
await b.close(); process.exit(fails.length ? 1 : 0);
