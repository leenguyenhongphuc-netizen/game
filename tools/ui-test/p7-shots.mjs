// Ảnh kiểm nhánh P7: nút chat gọn trong HUD + thanh gõ dính trên bàn phím (giả lập bàn phím bằng cách thu nhỏ visualViewport),
// ẩn khi mở bảng; Tài sản/Sổ địa chính theo vai; Trung tâm hành chính công (cần điều khiển, xoay máy quay, danh sách quầy).
// Dùng: node tools/ui-test/p7-shots.mjs --base http://localhost:3170 --db postgres://vuon:vuon@localhost:5432/vuon_p7 --out <thư mục>
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const BASE = arg('base', 'http://localhost:3170'), DB = arg('db', 'postgres://vuon:vuon@localhost:5432/vuon_p7'), OUT = arg('out', 'tools/ui-test/out-p7');
const DEVICE = arg('device', 'iPhone 15 Pro Max');
execSync(`mkdir -p ${OUT}`);
const sql = (q) => execSync(`psql ${DB} -qtAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const browser = await chromium.launch();
const stamp = Date.now() % 100000;
const fails = [];
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${extra ? ` — ${extra}` : ''}`); if (!ok) fails.push(name); };

async function account(name, role, region = 'ld_dalat') {
  const ctx = await browser.newContext({ ...devices[DEVICE], deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const u = `${name}${stamp}`;
  let r = await page.request.post(`${BASE}/api/auth/register`, { data: { username: u, password: 'matkhau123', displayName: u } });
  if (!r.ok()) throw new Error(await r.text());
  sql(`update users set role = '${role}', role_assigned_at = now(), cash = 900000000, xp = 20000 where username = '${u}'`);
  r = await page.request.post(`${BASE}/api/onboard`, { data: { regionId: region } });
  if (!r.ok()) throw new Error(await r.text());
  await page.goto(BASE); await page.waitForTimeout(4500);
  return { page, ctx, u };
}
const shot = (page, f) => page.screenshot({ path: `${OUT}/${f}` });
/** Giả lập bàn phím iOS: visualViewport co lại `kb` điểm ảnh, vẽ một tấm xám đúng chỗ bàn phím để nhìn thấy trên ảnh. */
async function fakeKeyboard(page, kb) {
  await page.evaluate((kb) => {
    const vv = window.visualViewport, h = window.innerHeight - kb;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => h });
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 0 });
    vv.dispatchEvent(new Event('resize'));
    const k = document.createElement('div'); k.id = 'fake-kb';
    k.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${kb}px;background:#c9ced6;z-index:99999;display:grid;place-items:center;font:600 16px system-ui;color:#555`;
    k.textContent = 'bàn phím (giả lập)'; document.body.appendChild(k);
  }, kb);
  await page.waitForTimeout(400);
}
const rect = (page, sel) => page.locator(sel).first().boundingBox();

// ---- 1. chat
{
  const a = await account('p7chat', 'nong_dan');
  const { page } = a;
  await shot(page, '1-hud-nut-chat.png');
  const fabs = await page.locator('.chat-fab').count();
  check('chỉ một nút chat', fabs === 1, `${fabs} nút`);
  const inHud = await page.locator('.hud-sub .chat-fab').count();
  check('nút chat nằm trong thanh HUD', inHud === 1);
  check('không còn nút "Nói" riêng', (await page.locator('.chat-say-btn').count()) === 0);
  await page.locator('.chat-fab').click(); await page.waitForTimeout(600);
  await shot(page, '2-thanh-go-chua-phim.png');
  check('mở thanh gõ chat chung', await page.getByLabel('Tin nhắn chat chung').isVisible());
  for (const kb of [336, 300]) {
    await fakeKeyboard(page, kb);
    const bar = await rect(page, '.chat-compose'), vh = page.viewportSize().height;
    const ok = bar && bar.y + bar.height <= vh - kb + 1 && bar.y >= 0;
    check(`thanh gõ nằm trên bàn phím ${kb}px`, !!ok, bar ? `đáy ${Math.round(bar.y + bar.height)} / mép phím ${vh - kb}` : 'không thấy');
    await shot(page, `3-thanh-go-tren-ban-phim-${kb}.png`);
    await page.evaluate(() => document.getElementById('fake-kb')?.remove());
  }
  await page.getByLabel('Tin nhắn chat chung').fill('Chào cả xóm Đà Lạt!');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click(); await page.waitForTimeout(900);
  await shot(page, '4-da-gui.png');
  await page.getByRole('button', { name: 'Đóng ô chat' }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Kho', exact: true }).click(); await page.waitForTimeout(800);
  check('mở bảng Kho thì nút chat ẩn', (await page.locator('.chat-fab:visible').count()) === 0);
  await shot(page, '5-kho-khong-nut-chat.png');
  await a.ctx.close();
}

// ---- 2. tài sản theo vai
const WRONG = { nong_dan: ['Thương mại', 'Công nghiệp', 'Mở cửa hàng', 'Mở siêu thị', 'xưởng chi nhánh', 'Nhận giao 1 thửa'], thuong_lai: ['Công nghiệp', 'xưởng chi nhánh', 'Nông nghiệp'], xuong: ['Nông nghiệp'] };
for (const role of ['nong_dan', 'thuong_lai', 'xuong']) {
  const a = await account(`p7tai${role.slice(0, 3)}`, role, role === 'nong_dan' ? 'ld_dalat' : 'dt_caibe');
  const { page } = a;
  await page.getByRole('button', { name: 'Hồ sơ của tôi' }).click(); await page.waitForTimeout(1500);
  const land = page.locator('.properties');
  await land.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1500);
  const txt = await land.innerText().catch(() => '');
  const cards = await page.locator('.land-card .land-head strong').allInnerTexts();
  const bad = WRONG[role].filter((w) => cards.some((c) => c.includes(w)) || (w.startsWith('Mở') || w.includes('chi nhánh') || w.startsWith('Nhận') ? txt.includes(w) : false));
  check(`${role}: chỉ thấy loại đất của vai`, bad.length === 0, `thẻ đất: ${cards.join(', ')}${bad.length ? ` · thừa: ${bad.join(', ')}` : ''}`);
  await page.locator('.land-grid').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, `6-so-dia-chinh-${role}.png`);
  await a.ctx.close();
}

// ---- 3. trung tâm hành chính
{
  const a = await account('p7hc', 'nong_dan', 'hn_phudien');
  const { page } = a;
  await page.getByRole('button', { name: 'Xóm', exact: true }).click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Trung tâm hành chính công/ }).first().click(); await page.waitForTimeout(5000);
  await shot(page, '7-hanh-chinh-vao.png');
  const st0 = await page.evaluate(() => window.__admin?.state());
  check('chỉ còn 2 nút gọn ở trên (Lấy số, Các quầy)', (await page.locator('.admin-chips .chip').count()) === 2);
  // cần điều khiển: chạm góc trái dưới rồi kéo lên
  const vp = page.viewportSize(), sx = vp.width * 0.22, sy = vp.height * 0.78;
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 30, { steps: 3 }); await page.mouse.move(sx, sy - 70, { steps: 4 });
  await page.waitForTimeout(1800);
  await shot(page, '8-hanh-chinh-can-dieu-khien.png');
  await page.mouse.up(); await page.waitForTimeout(300);
  const st1 = await page.evaluate(() => window.__admin?.state());
  check('kéo cần điều khiển thì nhân vật đi', st0 && st1 && Math.hypot(st1.x - st0.x, st1.z - st0.z) > 1, st0 && st1 ? `(${st0.x},${st0.z}) → (${st1.x},${st1.z})` : '');
  // kéo nửa phải để xoay máy quay
  const rx = vp.width * 0.75, ry = vp.height * 0.4;
  await page.mouse.move(rx, ry); await page.mouse.down(); await page.mouse.move(rx - 60, ry, { steps: 4 }); await page.mouse.move(rx - 140, ry, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(900);
  const st2 = await page.evaluate(() => window.__admin?.state());
  check('kéo ngang thì máy quay xoay', st2 && Math.abs(st2.camYaw) > 0.2, st2 ? `camYaw ${st2.camYaw}` : '');
  await shot(page, '9-hanh-chinh-xoay.png');
  await page.getByRole('button', { name: /Các quầy/ }).click(); await page.waitForTimeout(400);
  await shot(page, '10-hanh-chinh-danh-sach-quay.png');
  await page.getByRole('menuitem').filter({ hasText: 'Thuế' }).click(); await page.waitForTimeout(6000);
  await shot(page, '11-hanh-chinh-toi-quay.png');
  const st3 = await page.evaluate(() => window.__admin?.state());
  check('chọn quầy trong danh sách thì tự đi tới', st3?.near === 'thue' || st3?.walking, JSON.stringify(st3?.near));
  await a.ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} lỗi: ${fails.join('; ')}` : '\nTất cả đạt.');
process.exit(fails.length ? 1 : 0);
