// Thử khu vui chơi và tham quan nhiều người (nhánh H4): hai tài khoản cùng vào Moon World Đà Nẵng, thấy nhau, vẫy tay, chụp ảnh chung,
// mua vé, lên đu quay / tàu lượn / tháp rơi (chụp từng khung hoạt cảnh), vào khu trò chơi kỹ năng, chơi ném vòng, đổi quà.
// Cần: máy chủ trò chơi ở cổng 3000 (vite proxy /api), vite dev ở BASE (mặc định http://127.0.0.1:5274), Postgres của máy chủ ở DB.
//   node tools/park-test.mjs [--base URL] [--db postgres://…] [--out thư-mục]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const pg = require('pg');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:5274'), DB = arg('--db', 'postgres://vuon:vuon@localhost:5432/vuon_h4'), OUT = arg('--out', 'tools/ui-test/out-park');
mkdirSync(OUT, { recursive: true });
const db = new pg.Client({ connectionString: DB }); await db.connect();
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? '✔' : '✘'} ${name}${info ? ' — ' + info : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function player(user, w = 430, h = 932) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${BASE}/sight-test.html?id=none`);
  const reg = await p.evaluate(async (u) => { const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: 'matkhau123', displayName: u.toUpperCase() }) }); if (r.status !== 200) { await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: 'matkhau123' }) }); } return r.status; }, user);
  await db.query(`update users set role = 'thuong_lai', role_assigned_at = now() where username = $1`, [user]);
  await p.evaluate(async () => { await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ regionId: 'dn_tienphuoc' }) }); });
  await db.query(`update users set cash = 20000000, energy = 150, energy_at = now() where username = $1`, [user]);
  return { p, ctx, errs, reg };
}
const open = async (pl, id) => { await pl.p.goto(`${BASE}/sight-test.html?id=${id}&energy=150`); await pl.p.waitForSelector('.sw-scene canvas', { timeout: 30000 }); await wait(4500); };
const shot = (pl, name) => pl.p.screenshot({ path: `${OUT}/${name}.png` });
const card = (pl) => pl.p.locator('.sw-card');
const goto = async (pl, i) => { await pl.p.evaluate((k) => window.__sight.goto(k), i); await wait(1400); };

const A = await player('h4a'), B = await player('h4b');
await open(A, 'park_mw_da_nang'); await open(B, 'park_mw_da_nang');
await shot(A, '01-cong-vao');
// B đi tới cạnh A (cùng điểm dừng 1) — A phải thấy B và cư dân ảo
await goto(A, 1); await goto(B, 1);
await A.p.evaluate(() => window.__sight.close()); await B.p.evaluate(() => window.__sight.close());
await wait(9000);
const seen = await A.p.evaluate(() => window.__sightOthers?.() ?? []);
ok('A thấy người chơi B cùng khu', seen.some((x) => x.name === 'H4B'), JSON.stringify(seen.map((x) => x.name)));
ok('có cư dân ảo đi chơi cùng', seen.some((x) => x.bot), `${seen.filter((x) => x.bot).length} cư dân`);
await B.p.click('.sw-emotes button[aria-label="Biểu cảm 👋"]').catch(() => {});
await wait(7000);
await shot(A, '02-thay-nhau-vay-tay');
const group = await A.p.locator('.sw-group').count();
ok('hiện nút ảnh chung khi có người đứng gần', group > 0);
if (group) { await A.p.click('.sw-group'); await wait(1500); await shot(A, '03-anh-chung'); ok('chụp được ảnh chung', await A.p.locator('.sw-photo img').count() > 0); await A.p.click('.sw-photo .sw-later'); }
// vé cổng
await goto(A, 0); await shot(A, '04-cong-soat-ve');
const before = (await db.query(`select cash from users where username = 'h4a'`)).rows[0].cash;
await A.p.locator('.pk-tickets li').first().locator('button').click(); await wait(1500);
const after = (await db.query(`select cash from users where username = 'h4a'`)).rows[0].cash;
ok('mua vé trọn gói trừ đúng tiền', Number(before) - Number(after) === 900000, `${before} → ${after}`);
await shot(A, '05-da-co-ve');
await A.p.click('text=Qua cổng, đóng dấu'); await wait(1200);
// lên ba trò, chụp hoạt cảnh
const rides = [[1, 'cap-treo'], [2, 'du-quay'], [3, 'tau-luon'], [4, 'thap-roi'], [5, 'nha-ma'], [6, 'xe-dung'], [7, 'mang-truot'], [8, 'ho-song']];
for (const [i, name] of rides) {
  await goto(A, i); await shot(A, `1${i}-${name}-the`);
  const btn = A.p.locator('.pk-stop .sw-snap'); if (!(await btn.count())) { ok(`lên ${name}`, false, 'không có nút'); continue; }
  await btn.click(); await wait(2500); await shot(A, `1${i}-${name}-a`); await wait(4000); await shot(A, `1${i}-${name}-b`);
  await A.p.click('.pk-skip').catch(() => {}); await wait(1200);
  const n = (await db.query(`select n from park_rides r join users u on u.id = r.user_id where u.username = 'h4a' and r.ride_id = (select ride_id from park_rides r2 join users u2 on u2.id = r2.user_id where u2.username = 'h4a' order by last_at desc limit 1)`)).rows[0]?.n;
  ok(`lên ${name}`, !!n);
}
// khu trò chơi
await goto(A, 9); await A.p.click('text=Vào khu trò chơi'); await wait(800);
await A.p.locator('.pk-buy button', { hasText: '+5' }).click(); await wait(1000);
await shot(A, '20-khu-tro-choi');
await A.p.locator('.pk-games li').first().locator('button').click(); await wait(800);
await shot(A, '21-nem-vong');
// chạm đúng lúc vạch nằm trong vùng xanh: đọc vị trí vạch rồi chạm
for (let k = 0; k < 5; k++) {
  // canh trong trang: đợi khung hình vạch sáng vào giữa vùng xanh rồi chạm ngay (đọc từ ngoài trình duyệt quá chậm)
  await A.p.evaluate(() => new Promise((res) => { const t0 = performance.now(); const f = () => { const m = document.querySelector('.pk-meter .mark'), left = parseFloat(m?.style.left ?? '0'); if (Math.abs(left - 50) < 4 || performance.now() - t0 > 8000) { document.querySelector('.pk-game')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); res(); } else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  await wait(1000);
}
await wait(2500); await shot(A, '22-ket-qua');
const tickets = (await db.query(`select tickets from park_wallet w join users u on u.id = w.user_id where u.username = 'h4a'`)).rows[0]?.tickets ?? 0;
ok('chơi ném vòng được vé thưởng', tickets > 0, `${tickets} vé`);
await A.p.locator('.pk-tabs button', { hasText: 'Đổi quà' }).click(); await wait(500); await shot(A, '23-doi-qua');
await A.p.locator('.pk-prizes li').first().locator('button').click().catch(() => {}); await wait(900); await shot(A, '24-da-doi');
await A.p.click('.pk-x'); await wait(800);
// hai khu khác: toàn cảnh cổng
for (const id of ['park_bw_nha_trang', 'park_mw_ha_long']) { await open(B, id); await shot(B, `30-${id}-cong`); await goto(B, 2); await B.p.evaluate(() => window.__sight.close()); await wait(600); await shot(B, `31-${id}-tro`); await goto(B, 7); await B.p.evaluate(() => window.__sight.close()); await wait(600); await shot(B, `32-${id}-khu-nuoc`); }
const info = await B.p.evaluate(() => window.__sight.info()); ok('số lần vẽ khu vui chơi ≤ 60', info.calls <= 60, JSON.stringify(info));
// điện thoại ngang
const L = await player('h4a', 932, 430); await open(L, 'park_mw_da_nang'); await goto(L, 2); await shot(L, '40-ngang-the-tro'); await L.p.evaluate(() => window.__sight.close()); await wait(600); await shot(L, '41-ngang');
ok('không lỗi trang', ![A, B, L].some((x) => x.errs.length), [A, B, L].flatMap((x) => x.errs).slice(0, 3).join(' | '));
await b.close(); await db.end();
const bad = results.filter((r) => !r.pass).length;
console.log(`${results.length - bad}/${results.length} đạt`);
process.exit(bad ? 1 : 0);
