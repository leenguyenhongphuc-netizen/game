// Kiểm nhiều người chơi cùng lúc: 3 tài khoản thử trong 3 trình duyệt riêng (Playwright, Chromium giả lập điện thoại, không GPU).
// Kiểm: thấy nhau trong làng (2 người sang thăm vườn người thứ nhất), trên cao tốc (hai chiều cùng tuyến), ở trạm dừng nghỉ,
// và chợ: cư dân ảo bày hàng, người này đăng bán, người kia mua.
//   node tools/multiplayer-test.mjs --base http://localhost:3300 --out <thư mục ảnh>
// Máy chủ thử phải có TESTER_USERNAMES chứa tiền tố tài khoản dùng ở đây (mp_a, mp_b, mp_c) và cư dân ảo bật (BOTS khác off).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:3300'), OUT = arg('out', 'tools/multiplayer-out'), RUN = Date.now() % 100000;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${detail ? ' — ' + detail : ''}`); };

const browsers = [];
const USERS = [
  { key: 'a', username: process.env.MP_A ?? 'mp_a', display: 'Lan Cái Bè', role: 'nong_dan' },
  { key: 'b', username: process.env.MP_B ?? 'mp_b', display: 'Tùng Hà Nội', role: 'thuong_lai' },
  { key: 'c', username: process.env.MP_C ?? 'mp_c', display: 'Mai Đà Lạt', role: 'xuong' },
];
const ctxs = [];
for (const u of USERS) {
  // mỗi người một trình duyệt riêng (như ba máy khác nhau); chung một trình duyệt thì ba cảnh WebGL phần mềm dễ làm sập tiến trình vẽ
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'vi-VN' });
  // phông chữ ngoài mạng có thể treo trong máy thử: chặn mọi yêu cầu ra ngoài máy chủ thử
  await ctx.route((url) => !url.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => console.log(`[${u.key}] pageerror ${e.message}`)); page.on('crash', () => console.log(`[${u.key}] TRANG BỊ SẬP`));
  console.log(`[${u.key}] mở trang`); await page.goto(`${BASE}/?gio=10`, { waitUntil: 'domcontentloaded' });
  const api = (method, path, body) => page.evaluate(async ([m, p, b]) => {
    const r = await fetch(p, { method: m, credentials: 'same-origin', headers: b === undefined ? {} : { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [method, path, body]);
  // đăng ký (hoặc đăng nhập nếu đã có), nhận vườn, đặt vai
  let r = await api('POST', '/api/auth/register', { username: u.username, password: 'matkhau123', displayName: u.display });
  if (r.status !== 200) r = await api('POST', '/api/auth/login', { username: u.username, password: 'matkhau123' });
  if (r.status !== 200) throw new Error(`[${u.key}] không vào được: ${JSON.stringify(r.body)}`);
  const me = await api('GET', '/api/me');
  if (!me.body.plots?.length) { const o = await api('POST', '/api/onboard', { regionId: 'dt_caibe' }); if (o.status !== 200) throw new Error(JSON.stringify(o.body)); }
  await api('POST', '/api/test/role', { role: u.role });
  ctxs.push({ ...u, ctx, page, api, id: (await api('GET', '/api/me')).body.user.id });
}
const [A, B, C] = ctxs;
const shot = (p, name) => p.page.screenshot({ path: join(OUT, `${name}.png`) });

console.log('đã đăng nhập 3 tài khoản');
// ---------------------------------------------------------------- 1. làng: B, C kết bạn với A rồi sang thăm vườn A
for (const X of [B, C]) {
  await A.api('POST', '/api/friends', { username: X.username });
  await X.api('POST', `/api/friends/${A.id}/accept`);
}
for (const X of ctxs) { await X.page.goto(`${BASE}/?gio=10`); await X.page.waitForFunction(() => window.__vuon, null, { timeout: 30000 }); }
console.log('đã vào làng');
for (const X of [B, C]) {
  await X.page.getByRole('button', { name: 'Xóm', exact: true }).click();
  await X.page.locator('li, .row-line, .friend').filter({ hasText: A.display }).getByRole('button', { name: 'Thăm vườn' }).first().click();
  await X.page.waitForTimeout(1500);
  await X.page.keyboard.press('Escape').catch(() => {});
  const close = X.page.getByRole('button', { name: /Đóng|✕/ }).first(); if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
}
// đưa ba người tới gần nhau trước cổng vườn A
await A.page.evaluate(() => window.__vuon.pos.set(-2, 0, 13));
await B.page.evaluate(() => window.__vuon.pos.set(1.5, 0, 13.5));
await C.page.evaluate(() => window.__vuon.pos.set(4.5, 0, 14));
const beats = (X) => X.page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/presence')).length);
const b0 = await Promise.all(ctxs.map(beats));
await A.page.waitForTimeout(16000); // ba cảnh WebGL phần mềm trên cùng máy làm bộ hẹn giờ chậm hẳn lại, nên chờ dư
const b1 = await Promise.all(ctxs.map(beats)); console.log("nhịp gửi trong 16 s:", ctxs.map((x, i) => `${x.key}=${b1[i] - b0[i]}`).join(' '));
for (const X of ctxs) {
  const list = await X.page.evaluate(() => window.__vuon.othersList());
  const want = ctxs.filter((y) => y !== X).map((y) => y.display);
  const real = list.filter((o) => !o.bot).map((o) => o.name);
  check(`làng: ${X.display} thấy ${want.join(', ')}`, want.every((n) => real.includes(n)), `thấy ${list.map((o) => o.name + (o.bot ? ' (cư dân)' : '')).join(', ') || 'không ai'}`);
}
await shot(A, '1-lang-a-thay-b-c'); await shot(C, '1-lang-c-thay-a-b');
// B đi vòng sang phải: A phải thấy B di chuyển
const before = (await A.page.evaluate(() => window.__vuon.othersList())).find((o) => o.name === B.display);
await B.page.evaluate(() => { window.__vuon.walkTo = null; window.__vuon.pos.set(9, 0, 15.5); });
await A.page.waitForTimeout(12000);
const afterB = (await A.page.evaluate(() => window.__vuon.othersList())).find((o) => o.name === B.display);
check('làng: B đi thì A thấy B di chuyển', !!before && !!afterB && Math.abs(afterB.x - before.x) > 3, `x ${before?.x} → ${afterB?.x}`);
await shot(B, '1-lang-b-tham-vuon-a'); await shot(A, '1-lang-a-thay-b-di');

// ---------------------------------------------------------------- 2. cao tốc: A, C đi Cái Bè → Đà Lạt; B chiều ngược lại
const drive = (X, from, to, seconds) => X.page.goto(`${BASE}/drive-test.html?from=${from}&to=${to}&km=120&seconds=${seconds}&auto=1&junctions=2&stations=0&tolls=0`);
await drive(A, "dt_caibe", "ld_dalat", 50); await drive(C, "dt_caibe", "ld_dalat", 44); await drive(B, "ld_dalat", "dt_caibe", 50);
for (const X of ctxs) await X.page.waitForFunction(() => window.__drive, null, { timeout: 30000 });
// lấy mẫu 2 giây một lần tới khi hai chiều gặp nhau (khoảng giữa chuyến); chụp khi xe ngược chiều ở gần
const seenHw = ctxs.map(() => new Map());
let shotOpp = false, shotSame = false;
for (let k = 0; k < 30; k++) {
  await A.page.waitForTimeout(2000);
  for (const [i, X] of ctxs.entries()) {
    const near = await X.page.evaluate(() => window.__drive?.othersNearby() ?? []);
    for (const n of near) if (!seenHw[i].has(n.name) || Math.abs(n.aheadKm) < Math.abs(seenHw[i].get(n.name).aheadKm)) seenHw[i].set(n.name, n);
    if (X === A && !shotOpp && near.some((n) => !n.bot && !n.sameDir && Math.abs(n.aheadKm) < 6)) { shotOpp = true; await shot(A, '2-cao-toc-a-gap-b-nguoc-chieu'); }
    if (X === A && !shotSame && near.some((n) => !n.bot && n.sameDir && Math.abs(n.aheadKm) < 2)) { shotSame = true; await shot(A, '2-cao-toc-a-canh-c'); }
  }
  if (k === 3) { await shot(A, '2-cao-toc-a'); await shot(B, '2-cao-toc-b'); }
  if (shotOpp && seenHw.every((m, i) => ctxs.filter((y) => y !== ctxs[i]).every((y) => m.has(y.display)))) break;
}
for (const [i, X] of ctxs.entries()) {
  const want = ctxs.filter((y) => y !== X).map((y) => y.display), m = seenHw[i];
  check(`cao tốc: ${X.display} gặp ${want.join(', ')} trên tuyến`, want.every((n) => m.has(n)), [...m.values()].map((n) => `${n.name}${n.bot ? '*' : ''} gần nhất ${n.aheadKm} km ${n.sameDir ? 'cùng' : 'ngược'} chiều`).join('; '));
}
check('cao tốc: có xe cư dân ảo', seenHw[0].size > 2 && [...seenHw[0].values()].some((n) => n.bot));

// ---------------------------------------------------------------- 3. trạm dừng nghỉ
for (const X of ctxs) await X.page.goto(`${BASE}/drive-test.html?stop=rest`);
for (const X of ctxs) await X.page.waitForFunction(() => window.__stop && window.__stopOthers, null, { timeout: 30000 });
await A.page.evaluate(() => window.__stop.park('lot'));
await B.page.evaluate(() => window.__stop.park('lot'));
await C.page.evaluate(() => window.__stop.park('lot'));
await A.page.waitForTimeout(5000);
await B.page.evaluate(() => { window.__stop.getOut(); window.__stop.walkTo('shop'); });
await A.page.waitForTimeout(16000); // ba cảnh WebGL phần mềm trên cùng máy làm bộ hẹn giờ chậm hẳn lại, nên chờ dư
for (const X of ctxs) {
  const list = await X.page.evaluate(() => window.__stopOthers());
  const want = ctxs.filter((y) => y !== X).map((y) => y.display), names = list.filter((o) => !o.bot).map((o) => o.name);
  check(`trạm dừng: ${X.display} thấy ${want.join(', ')}`, want.every((n) => names.includes(n)), list.map((o) => o.name + (o.bot ? '*' : '')).join(', '));
}
check('trạm dừng: có cư dân ảo ghé', (await A.page.evaluate(() => window.__stopOthers())).some((o) => o.bot));
await shot(A, '3-tram-dung-a'); await shot(C, '3-tram-dung-c');

// ---------------------------------------------------------------- 4. chợ
await A.page.goto(`${BASE}/?gio=10`); await A.page.waitForFunction(() => window.__vuon);
const tick = await A.api('POST', '/api/test/bots/tick', { all: true });
check('chợ: cư dân ảo chạy lượt', tick.status === 200, JSON.stringify(tick.body?.stats ?? tick.body));
const sp = process.env.MP_SPECIALTY ?? 'xoai_hoa_loc';
await A.api('POST', '/api/test/stock', { specialtyId: sp, kg: 200, grade: 'A' });
const prices = await A.api('GET', '/api/prices');
const ref = prices.body?.prices?.[sp]?.price ?? 40000;
const lst = await A.api('POST', '/api/market/listings', { specialtyId: sp, quality: 'A', kg: 60, price: Math.round(ref) });
check('chợ: A đăng bán', lst.status === 200, JSON.stringify(lst.body));
const mk = await B.api('GET', '/api/market');
const mine = mk.body.listings.find((l) => l.id === lst.body.listingId);
check('chợ: B thấy hàng của A', !!mine && mine.sellerName === A.display);
check('chợ: có hàng của cư dân ảo', mk.body.listings.filter((l) => l.sellerBot).length >= 5, `${mk.body.listings.filter((l) => l.sellerBot).length} tin của cư dân / ${mk.body.listings.length}`);
await B.api('POST', '/api/test/cash', { amount: 500_000_000 }).catch(() => {});
const buy = await B.api('POST', `/api/market/listings/${lst.body.listingId}/buy`, { kg: 20 });
check('chợ: B mua 20 kg của A', buy.status === 200, JSON.stringify(buy.body));
await C.page.goto(`${BASE}/?gio=10`); await C.page.waitForFunction(() => window.__vuon);
await C.page.getByRole('button', { name: 'Chợ', exact: true }).click(); await C.page.waitForTimeout(1500);
await shot(C, '4-cho-c');

writeFileSync(join(OUT, 'ket-qua.json'), JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} đạt. Ảnh: ${OUT}`);
for (const b of browsers) await b.close();
process.exit(bad.length ? 1 : 0);
