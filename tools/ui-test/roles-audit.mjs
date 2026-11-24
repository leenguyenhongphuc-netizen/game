// Rà chức năng theo vai trên giao diện: đăng nhập 3 vai, mở mọi bảng và mọi thẻ, đọc chữ trên nút, tiêu đề, thẻ đất,
// tìm chức năng của vai khác (danh sách đen theo vai, nguồn: shared/roles.ts). Báo lỗi kèm bảng/thẻ nơi thấy.
// Dùng: node tools/ui-test/roles-audit.mjs --base http://localhost:3170 --db postgres://vuon:vuon@localhost:5432/vuon_p7 [--out <thư mục ảnh lỗi>]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const BASE = arg('base', 'http://localhost:3100'), DB = arg('db', 'postgres://vuon:vuon@localhost:5432/vuon_ui'), OUT = arg('out', 'tools/ui-test/out-roles');
execSync(`mkdir -p ${OUT}`);
const sql = (q) => execSync(`psql ${DB} -qtAc "${q.replace(/"/g, '\\"')}"`).toString().trim();

/** Chữ KHÔNG được xuất hiện trên nút/tiêu đề/thẻ của vai đó (so khớp không phân biệt hoa thường). */
const DENY = {
  nong_dan: ['Xuất khẩu', 'Dung hợp', 'Xưởng', 'máy chế biến', 'Mua máy', 'Thu mua', 'Phối hộp quà', 'Ký gửi', 'Thương mại', 'Công nghiệp', 'xưởng chi nhánh', 'Mở cửa hàng', 'siêu thị đặc sản của bạn', 'Máy nhập khẩu', 'Tải nặng', 'Đầu kéo'],
  thuong_lai: ['Cánh đồng', 'Hợp tác xã', 'Lai giống', 'Xưởng', 'máy chế biến', 'Mua máy', 'Công nghiệp', 'xưởng chi nhánh', 'Máy nhập khẩu', 'Nông nghiệp', 'trực thăng'],
  xuong: ['Cánh đồng', 'Hợp tác xã', 'Lai giống', 'Thu mua', 'Nông nghiệp', 'trực thăng'],
};
/** Cụm được phép dù chứa từ cấm (tên riêng, câu giải thích chung). */
const ALLOW = [/Chợ/i, /Kho & Sạp/i, /thương lái/i, /Đơn hàng/i, /hợp đồng/i, /Siêu thị đặc sản ở/i, /Lời mời/i];

const browser = await chromium.launch();
const stamp = Date.now() % 100000;
const problems = [];
async function account(role) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro Max'], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const u = `ra${role.slice(0, 3)}${stamp}`;
  let r = await page.request.post(`${BASE}/api/auth/register`, { data: { username: u, password: 'matkhau123', displayName: u } });
  if (!r.ok()) throw new Error(await r.text());
  sql(`update users set role = '${role}', role_assigned_at = now(), cash = 900000000, xp = 200000 where username = '${u}'`);
  r = await page.request.post(`${BASE}/api/onboard`, { data: { regionId: 'dt_caibe' } });
  if (!r.ok()) throw new Error(await r.text());
  await page.goto(BASE); await page.waitForTimeout(4500);
  return { page, ctx };
}
async function harvest(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.modal button, .modal h3, .modal h4, .modal .land-head strong, .modal [role=tab], .hud button, .dock button, .ctx-btn')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(); if (t) out.push(t);
    }
    return out;
  });
}
function scan(role, where, texts) {
  for (const t of texts) {
    if (ALLOW.some((a) => a.test(t))) continue;
    for (const w of DENY[role]) if (t.toLowerCase().includes(w.toLowerCase())) problems.push({ role, where, word: w, text: t.slice(0, 90) });
  }
}
async function closeModal(page) { const x = page.locator('.modal .close, .modal [aria-label="Đóng"]').first(); if (await x.count()) await x.click().catch(() => {}); await page.waitForTimeout(400); }

for (const role of ['nong_dan', 'thuong_lai', 'xuong']) {
  const { page, ctx } = await account(role);
  scan(role, 'màn vườn', await harvest(page));
  for (const nav of ['Kho', 'Chợ', 'Xóm', 'Du lịch', 'Trang trí', 'Hồ sơ của tôi']) {
    await page.getByRole('button', { name: nav, exact: nav !== 'Hồ sơ của tôi' }).first().click().catch(() => {}); await page.waitForTimeout(1200);
    const tabs = await page.locator('.modal .tabs button').allInnerTexts().catch(() => []);
    if (!tabs.length) {
      for (let k = 0; k < 6; k++) { scan(role, nav, await harvest(page)); await page.mouse.wheel(0, 700); await page.locator('.modal-body').first().evaluate((e) => { e.scrollTop += 700; }).catch(() => {}); await page.waitForTimeout(500); }
    }
    for (let i = 0; i < tabs.length; i++) {
      await page.locator('.modal .tabs button').nth(i).click().catch(() => {}); await page.waitForTimeout(1100);
      for (let k = 0; k < 4; k++) { scan(role, `${nav} › ${tabs[i].replace(/\s+/g, ' ')}`, await harvest(page)); await page.locator('.modal-body').first().evaluate((e) => { e.scrollTop += 800; }).catch(() => {}); await page.waitForTimeout(400); }
      await page.locator('.modal-body').first().evaluate((e) => { e.scrollTop = 0; }).catch(() => {});
    }
    await closeModal(page);
  }
  if (problems.some((p) => p.role === role)) await page.screenshot({ path: `${OUT}/loi-${role}.png` });
  await ctx.close();
}
await browser.close();
const uniq = [...new Map(problems.map((p) => [`${p.role}|${p.where}|${p.word}|${p.text}`, p])).values()];
for (const p of uniq) console.log(`LỖI ${p.role} · ${p.where} · "${p.word}" trong: ${p.text}`);
console.log(uniq.length ? `\n${uniq.length} chỗ hiện chức năng của vai khác.` : '\nKhông vai nào thấy chức năng của vai khác.');
process.exit(uniq.length ? 1 : 0);
