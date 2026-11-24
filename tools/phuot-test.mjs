// Chạy trọn chuyến phượt trong trình duyệt (Chromium giả lập điện thoại, không GPU) với máy chủ thật:
//  1. đi một mình đèo Hải Vân, trời nắng rồi đổ mưa giữa đường: xuất phát → điểm chụp → quán (mua áo mưa) → đích → thưởng + tem
//  2. đi đoàn 2 tài khoản: lập đoàn, vào bằng mã, sẵn sàng, cả đoàn xuất phát, tập trung ở điểm chụp, về đích cùng nhau → thưởng thêm EXP
//  3. Hộ chiếu: trang Cung đường phượt có tem
// Cần: máy chủ thử với TESTER_USERNAMES=pt_a,pt_b (và BOTS=off cho nhanh), Vite dev phục vụ web/phuot-test.html với /api chuyển tới máy chủ đó.
//   node tools/phuot-test.mjs --base http://localhost:5246 --out <thư mục ảnh>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:5246'), OUT = arg('out', 'tools/phuot-out'), STEP = Number(arg('step', '14'));
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${detail ? ' — ' + detail : ''}`); };

const browsers = [];
async function player(username, display) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'vi-VN' });
  await ctx.route((url) => !url.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => console.log(`[${username}] pageerror ${e.message}`));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/phuot-test.html`, { waitUntil: 'domcontentloaded' });
  const api = (method, path, body) => page.evaluate(async ([m, p, b]) => {
    const r = await fetch(p, { method: m, credentials: 'same-origin', headers: b === undefined ? {} : { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [method, path, body]);
  let r = await api('POST', '/api/auth/register', { username, password: 'matkhau123', displayName: display });
  if (r.status !== 200) r = await api('POST', '/api/auth/login', { username, password: 'matkhau123' });
  if (r.status !== 200) throw new Error(`${username}: ${JSON.stringify(r.body)}`);
  const me = await api('GET', '/api/me');
  if (!me.body.plots?.length) await api('POST', '/api/onboard', { regionId: 'dt_caibe' });
  await api('POST', '/api/test/role', { role: 'thuong_lai' });
  const lic = await api('POST', '/api/test/license', { cls: 'A1' });
  if (lic.status !== 200) throw new Error(`bằng A1: ${JSON.stringify(lic.body)}`);
  await api('POST', '/api/test/energy', { value: 150 });
  await api('POST', '/api/test/cash', { amount: 50_000_000 });
  return { username, display, browser, ctx, page, api };
}
const open = async (P, qs) => { await P.page.goto(`${BASE}/phuot-test.html?${qs}`, { waitUntil: 'domcontentloaded' }); await P.page.getByText('Đèo Hải Vân').first().waitFor(); };
const pickRoute = async (P) => { await P.page.getByRole('button', { name: /Đèo Hải Vân/ }).first().click(); await P.page.locator('input[type=radio][value="thue:moto_so110"]').first().check(); };
/** Chụp khung đều đặn khi đang chạy, tới khi thấy bảng kết quả. */
async function rideFrames(P, tag, maxMs = 600_000) {
  const frames = [], t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < maxMs) {
    const done = await P.page.locator('.veh-card[role=status]').filter({ hasText: /Đã đi|Đã dừng/ }).count();
    if (done) break;
    if (n++ % 2 === 0 && await P.page.locator('.mr').count()) {
      const f = join(OUT, `${tag}-${String(frames.length).padStart(2, '0')}.png`);
      await P.page.screenshot({ path: f }).catch(() => null); frames.push(f);
    }
    await P.page.waitForTimeout(2500);
  }
  return { frames, ms: Date.now() - t0 };
}
const resultText = (P) => P.page.locator('.veh-card[role=status]').filter({ hasText: /Đã đi|Đã dừng/ }).first().innerText().catch(() => '');

// --chi-ho-chieu: chỉ kiểm trang Hộ chiếu (tài khoản pt_a đã đi xong từ lần chạy trước)
const ONLY_PASSPORT = process.argv.includes('--chi-ho-chieu');
const A = await player('pt_a', 'Hùng Phượt');
if (!ONLY_PASSPORT) {
// ---------------------------------------------------------------- 1. đi một mình, nắng rồi mưa
await open(A, `auto=1&step=${STEP}&nhanh=1&troi=doi`);
await pickRoute(A);
await A.page.screenshot({ path: join(OUT, '0-chon-tuyen.png') });
const xp0 = (await A.api('GET', '/api/me')).body.user.xp;
await A.page.getByRole('button', { name: /Lên đường một mình/ }).click();
await A.page.locator('.mr').waitFor({ timeout: 30000 });
const solo = await rideFrames(A, '1-mot-minh');
const soloTxt = await resultText(A);
console.log(soloTxt.replace(/\n/g, ' | '));
check('đi một mình: tới đích Hải Vân và có kết quả', /Đã đi Đèo Hải Vân/.test(soloTxt), `${Math.round(solo.ms / 1000)} s, ${solo.frames.length} khung`);
check('đi một mình: nhận tem chụp ảnh', /tem mới/.test(soloTxt));
check('đi một mình: lần đầu đi trọn tuyến có thưởng', /lần đầu đi trọn tuyến/.test(soloTxt));
check('trời mưa giữa đường: có mua áo mưa ở quán', /Áo mưa/.test(soloTxt), soloTxt.match(/🧥[^·\n]*/)?.[0] ?? '');
check('đi một mình: cộng EXP', (await A.api('GET', '/api/me')).body.user.xp > xp0);
await A.page.screenshot({ path: join(OUT, '1-mot-minh-ket-qua.png') });

// ---------------------------------------------------------------- 2. đi đoàn 2 tài khoản
const B = await player('pt_b', 'Lan Đà Nẵng');
await open(A, `auto=1&step=${STEP}&nhanh=1&troi=mua`); await open(B, `auto=1&step=${STEP}&nhanh=1&troi=mua`);
await pickRoute(A);
await A.page.getByRole('button', { name: 'Lập đoàn mới' }).click();
await A.page.getByText(/Đoàn [A-Z0-9]{6}/).first().waitFor();
const code = (await A.page.getByText(/Đoàn [A-Z0-9]{6}/).first().innerText()).match(/Đoàn ([A-Z0-9]{6})/)[1];
check('lập đoàn: có mã đoàn', !!code, code);
await A.page.locator('input[type=radio][value="thue:moto_so110"]').first().check();
await A.page.getByRole('button', { name: /Sẵn sàng với xe đã chọn/ }).click();
await pickRoute(B);
await B.page.getByLabel('Mã đoàn').fill(code);
await B.page.getByRole('button', { name: 'Vào đoàn' }).click();
await B.page.getByText(`Đoàn ${code}`).first().waitFor();
await B.page.locator('input[type=radio][value="thue:moto_so110"]').first().check();
await B.page.getByRole('button', { name: /Sẵn sàng với xe đã chọn/ }).click();
await A.page.waitForTimeout(3500);
await A.page.screenshot({ path: join(OUT, '2-doan-truong-cho.png') }); await B.page.screenshot({ path: join(OUT, '2-doan-vien-san-sang.png') });
check('đoàn: trưởng đoàn thấy 2 xe sẵn sàng', (await A.page.locator('.phuot-members li').filter({ hasText: 'sẵn sàng' }).count()) === 2);
await A.page.getByRole('button', { name: /Cả đoàn xuất phát/ }).click();
// máy B tự lên đường khi thấy lệnh xuất phát
await Promise.all([A.page.locator('.mr').waitFor({ timeout: 30000 }), B.page.locator('.mr').waitFor({ timeout: 30000 })]);
check('đoàn: cả hai máy cùng lên đường', true);
const [ra, rb] = await Promise.all([rideFrames(A, '3-doan-a'), rideFrames(B, '3-doan-b')]);
const ta = await resultText(A), tb = await resultText(B);
console.log('A:', ta.replace(/\n/g, ' | ')); console.log('B:', tb.replace(/\n/g, ' | '));
check('đoàn: cả hai tới đích', /Đã đi/.test(ta) && /Đã đi/.test(tb), `${Math.round(ra.ms / 1000)} s / ${Math.round(rb.ms / 1000)} s`);
check('đoàn: người về sau nhận thưởng đi đoàn', /về đích cùng nhau: \+\d+ EXP/.test(ta) || /về đích cùng nhau: \+\d+ EXP/.test(tb));
check('đoàn: dầm mưa hoặc có áo mưa được tính', /Áo mưa|Dầm mưa/.test(ta + tb));
await A.page.screenshot({ path: join(OUT, '3-doan-a-ket-qua.png') }); await B.page.screenshot({ path: join(OUT, '3-doan-b-ket-qua.png') });

}
// ---------------------------------------------------------------- 3. Hộ chiếu: trang Cung đường phượt
await A.page.goto(`${BASE}/phuot-test.html?ho_chieu=1`, { waitUntil: 'domcontentloaded' });
await A.page.getByRole('button', { name: 'Mở hộ chiếu' }).click();
await A.page.getByRole('button', { name: 'Trang sau' }).click();
await A.page.getByRole('button', { name: /Cung đường phượt/ }).click();
await A.page.getByRole('heading', { name: /CUNG ĐƯỜNG PHƯỢT/ }).waitFor();
const stamps = await A.page.locator('svg.pp-stamp').count();
check('hộ chiếu: trang Cung đường phượt có tem', stamps >= 3, `${stamps} con dấu`);
await A.page.screenshot({ path: join(OUT, '4-ho-chieu-phuot.png'), fullPage: true });

writeFileSync(join(OUT, 'ket-qua.json'), JSON.stringify(results, null, 2));
for (const b of browsers) await b.close();
const bad = results.filter((r) => !r.ok).length;
console.log(`${results.length - bad}/${results.length} đạt`);
process.exit(bad ? 1 : 0);
