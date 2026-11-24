// Kiểm trò chuyện với 3 tài khoản trong 3 trình duyệt (Playwright, Chromium giả lập điện thoại, không GPU):
// chat chung trong làng (bong bóng + nhật ký), thẻ người chơi → kết bạn → chấp nhận → nhắn riêng (chấm chưa đọc),
// loa phát thanh chạy chữ trên máy người khác, chặn. Cần App đã gắn <ChatLayer> (web/src/chat/ChatLayer.tsx).
//   node tools/chat-test.mjs --base http://localhost:3160 --out <thư mục ảnh>
// Máy chủ thử: TESTER_USERNAMES=chat_a,chat_b,chat_c (đặt vai qua /api/test/role).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:3160'), OUT = arg('out', 'tools/chat-out'), DB = arg('db', '');
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${detail ? ' — ' + detail : ''}`); };
const USERS = [
  { key: 'a', username: 'chat_a', display: 'Lan Cái Bè', role: 'nong_dan' },
  { key: 'b', username: 'chat_b', display: 'Tùng Hà Nội', role: 'thuong_lai' },
  { key: 'c', username: 'chat_c', display: 'Mai Đà Lạt', role: 'xuong' },
];
const ctxs = [], browsers = [];
for (const u of USERS) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'vi-VN' });
  await ctx.route((url) => !url.href.startsWith(BASE), (r) => r.abort());
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => console.log(`[${u.key}] pageerror ${e.message}`));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/?gio=10`, { waitUntil: 'domcontentloaded' });
  const api = (method, path, body) => page.evaluate(async ([m, p, b]) => {
    const r = await fetch(p, { method: m, credentials: 'same-origin', headers: b === undefined ? {} : { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [method, path, body]);
  let r = await api('POST', '/api/auth/register', { username: u.username, password: 'matkhau123', displayName: u.display });
  if (r.status !== 200) r = await api('POST', '/api/auth/login', { username: u.username, password: 'matkhau123' });
  const me = await api('GET', '/api/me');
  if (!me.body.plots?.length) await api('POST', '/api/onboard', { regionId: 'dt_caibe' });
  await api('POST', '/api/test/role', { role: u.role });
  ctxs.push({ ...u, page, api, id: (await api('GET', '/api/me')).body.user.id });
}
const [A, B, C] = ctxs; console.log('đã đăng nhập');
// chạy lại nhiều lần: xoá quan hệ, chặn, tin, loa của lần trước (cần --db)
if (DB) execSync(`psql "${DB}" -qc "delete from friendships where user_a in (${ctxs.map((x) => x.id)}) or user_b in (${ctxs.map((x) => x.id)}); delete from user_blocks; delete from chat_public; delete from chat_dm; delete from broadcasts; delete from chat_reports"`);
const shot = (X, name) => X.page.screenshot({ path: join(OUT, `${name}.png`) });
// B, C là bạn của A để sang thăm vườn A (cảnh làng chung); B và C chưa quen nhau
for (const X of [B, C]) { await A.api('POST', '/api/friends', { username: X.username }); await X.api('POST', `/api/friends/${A.id}/accept`); }
for (const X of ctxs) { await X.page.goto(`${BASE}/?gio=10`); await X.page.waitForFunction(() => window.__vuon, null, { timeout: 40000 }); }
for (const X of [B, C]) {
  await X.page.getByRole('button', { name: 'Xóm', exact: true }).click();
  await X.page.locator('li, .row-line, .friend').filter({ hasText: A.display }).getByRole('button', { name: 'Thăm vườn' }).first().click();
  await X.page.waitForTimeout(1200);
}
await A.page.waitForTimeout(6000);

// 1. chat chung: A nói, B thấy dòng gần nhất và bong bóng trên đầu A
await A.page.getByRole('button', { name: 'Nói với mọi người quanh đây' }).click();
await A.page.getByLabel('Tin nhắn chat chung').fill('Chào cả xóm! Vườn mình mới thu sầu riêng nè 🍈');
await shot(A, '1-a-go-chat');
await A.page.getByRole('button', { name: 'Gửi', exact: true }).click();
await A.page.waitForTimeout(400);
let ok = await B.page.locator('.chat-recent').filter({ hasText: 'Chào cả xóm' }).waitFor({ timeout: 15000 }).then(() => true, () => false);
check('B thấy tin chat chung của A (dòng gần nhất)', ok);
ok = await B.page.waitForFunction((n) => window.__vuon.othersList().some((o) => o.name === n && o.say), A.display, { timeout: 15000 }).then(() => true, () => false);
check('bong bóng chat hiện trên đầu A trong cảnh của B', ok);
await B.page.waitForTimeout(1500); await shot(B, '2-b-thay-bong-bong');
// lọc
await A.page.waitForTimeout(3200);
await A.page.getByRole('button', { name: 'Nói với mọi người quanh đây' }).isVisible().then((v) => v && A.page.getByRole('button', { name: 'Nói với mọi người quanh đây' }).click());
await A.page.getByLabel('Tin nhắn chat chung').fill('đm gọi 0912345678 nha');
await A.page.getByRole('button', { name: 'Gửi', exact: true }).click();
ok = await C.page.locator('.chat-recent').filter({ hasText: '*** gọi *** nha' }).waitFor({ timeout: 15000 }).then(() => true, () => false);
check('tin có từ tục và số điện thoại bị che ***', ok);

// 2. B mở Trò chuyện → Quanh đây → bấm C → thẻ → Kết bạn
await B.page.locator('.chat-fab').click();
await B.page.waitForTimeout(500); await shot(B, '3-b-quanh-day');
await B.page.locator('.chat-near-item').filter({ hasText: C.display }).click();
await B.page.locator('.chat-card').waitFor(); await shot(B, '4-b-the-nguoi-choi');
await B.page.getByRole('button', { name: '🤝 Kết bạn' }).click();
ok = await B.page.locator('.chat-card').getByText('Đã gửi lời mời').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
check('B gửi lời mời kết bạn cho C từ thẻ người chơi', ok);
await B.page.getByRole('button', { name: 'Đóng', exact: true }).click();
await B.page.getByRole('button', { name: 'Đóng trò chuyện' }).click();
ok = await C.page.locator('.chat-fab .chat-dot').waitFor({ timeout: 20000 }).then(() => true, () => false);
check('C thấy chấm đỏ lời mời trên nút 💬', ok);
await shot(C, '5-c-cham-do');
await C.page.locator('.chat-fab').click();
await C.page.locator('.chat-req .chat-near-item').filter({ hasText: B.display }).click();
await C.page.getByRole('button', { name: '✅ Chấp nhận kết bạn' }).click();
ok = await C.page.getByRole('button', { name: '✉️ Nhắn tin' }).waitFor({ timeout: 8000 }).then(() => true, () => false);
check('C chấp nhận, thẻ đổi sang Nhắn tin', ok);
await C.page.getByRole('button', { name: '✉️ Nhắn tin' }).click();
await C.page.getByLabel('Tin nhắn riêng').fill('Chào Tùng! Mai mình chở cà phê ra Hà Nội, anh có thu mua không? Mình có khoảng 2 tấn Arabica Cầu Đất loại 1, sấy kỹ, đóng bao 60 kg.');
await C.page.getByRole('button', { name: 'Gửi', exact: true }).click();
await C.page.waitForTimeout(800); await shot(C, '6-c-nhan-rieng');
ok = await B.page.locator('.chat-fab .chat-dot').waitFor({ timeout: 20000 }).then(() => true, () => false);
check('B thấy chấm tin chưa đọc', ok);
await B.page.locator('.chat-fab').click();
await B.page.waitForTimeout(600); await shot(B, '7-b-hop-thu');
await B.page.locator('.chat-thread').filter({ hasText: C.display }).click();
ok = await B.page.locator('.chat-bub').filter({ hasText: 'Arabica Cầu Đất' }).waitFor({ timeout: 8000 }).then(() => true, () => false);
check('B đọc được tin riêng của C', ok);
await B.page.getByLabel('Tin nhắn riêng').fill('Có chứ! Để mình gửi giá nhé 👍');
await B.page.getByRole('button', { name: 'Gửi', exact: true }).click();
await B.page.waitForTimeout(800); await shot(B, '8-b-tra-loi');
await B.page.getByRole('button', { name: 'Đóng trò chuyện' }).click();

// 3. loa: A đủ cấp và tiền (đặt qua CSDL thử), phát; B, C thấy chạy chữ
if (DB) execSync(`psql "${DB}" -qc "update users set xp = 100000, cash = cash + 20000000 where username = 'chat_a'"`);
await A.page.reload(); await A.page.waitForFunction(() => window.__vuon, null, { timeout: 40000 });
await A.page.locator('.chat-fab').click();
await A.page.getByRole('tab', { name: 'Loa' }).click();
await A.page.getByLabel('Nội dung loa').fill('Chợ phiên Cái Bè sáng mai 6 giờ, ghé vườn Lan mua sầu riêng nha cả nhà!');
await shot(A, '9-a-mua-loa');
await A.page.getByRole('button', { name: /Phát/ }).click();
ok = await B.page.locator('.chat-ticker').waitFor({ timeout: 20000 }).then(() => true, () => false);
check('B thấy loa phát thanh chạy chữ', ok);
await B.page.waitForTimeout(3000); await shot(B, '10-b-loa');
ok = await B.page.locator('.chat-ticker').isVisible();
check('loa vẫn chạy chữ vài giây sau khi nhận (đủ thời lượng trên máy người nhận)', ok);
await A.page.waitForTimeout(500); await shot(A, '11-a-lich-su-loa');

// 4. chặn: C chặn A → A không thấy... (C không thấy chat của A)
await C.page.getByRole('button', { name: 'Đóng trò chuyện' }).click().catch(() => {});
await C.page.locator('.chat-fab').click();
await C.page.getByRole('tab', { name: 'Quanh đây' }).click();
await C.page.locator('.chat-near-item').filter({ hasText: A.display }).click();
await C.page.getByRole('button', { name: '⚑ Báo cáo' }).click();
await shot(C, '12-c-bao-cao');
await C.page.getByRole('button', { name: 'Thôi' }).click();
await C.page.getByRole('button', { name: '🚫 Chặn' }).click();
ok = await C.page.getByRole('button', { name: 'Bỏ chặn' }).waitFor({ timeout: 8000 }).then(() => true, () => false);
check('C chặn A từ thẻ người chơi', ok);
const dm = await A.api('POST', `/api/chat/dm/${C.id}`, { text: 'alo' });
check('A không nhắn riêng được cho C sau khi bị chặn', dm.status === 403, String(dm.status));

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} đạt`);
for (const b of browsers) await b.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
