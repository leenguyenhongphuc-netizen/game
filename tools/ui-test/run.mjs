// Kiểm thử giao diện tự động trên nhiều thiết bị: đi qua các màn chính, chụp ảnh và soát lỗi bố cục.
// Dùng: node tools/ui-test/run.mjs [--base http://localhost:3100] [--out tools/ui-test/out] [--only iphone-15,desktop]
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'http://localhost:3100');
const OUT = arg('out', 'tools/ui-test/out');
const ONLY = arg('only', '').split(',').filter(Boolean);
const DB = process.env.UI_TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_ui';
const QUICK = process.argv.includes('--nhanh'); // bỏ các hoạt cảnh dài (lái xe, du lịch)

const DEVICES = [
  { id: 'iphone-se', w: 375, h: 667, touch: true },
  { id: 'iphone-15', w: 393, h: 852, touch: true },
  { id: 'iphone-15-pro-max', w: 430, h: 932, touch: true },
  { id: 'iphone-15-ngang', w: 852, h: 393, touch: true },
  { id: 'ipad-mini', w: 768, h: 1024, touch: true },
  { id: 'ipad-pro-ngang', w: 1366, h: 1024, touch: true },
  { id: 'desktop', w: 1280, h: 720, touch: false },
  { id: 'desktop-rong', w: 1920, h: 1080, touch: false },
].filter((d) => ONLY.length === 0 || ONLY.includes(d.id));

/** Chạy trong trang: trả về danh sách lỗi bố cục của màn hiện tại. */
function audit(touch) {
  const issues = [];
  const vv = window.visualViewport;
  // Mọi phép đo quy về phần màn hình đang nhìn thấy: khi trang bị phóng to, phần này nhỏ hơn và lệch so với khung trang.
  const X0 = vv ? vv.offsetLeft : 0, Y0 = vv ? vv.offsetTop : 0, W = vv ? vv.width : window.innerWidth, H = vv ? vv.height : window.innerHeight;
  if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push({ level: 'error', rule: 'tran-ngang', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}` });
  const box = (el) => { const q = el.getBoundingClientRect(); return { left: q.left - X0, top: q.top - Y0, right: q.right - X0, bottom: q.bottom - Y0, width: q.width, height: q.height }; };
  const visible = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 0 && r.height > 0; };
  const scrollParent = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return p; } return null; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  // 1. Phần tử thao tác được nằm ngoài màn hình hoặc quá nhỏ
  for (const el of document.querySelectorAll('button, a, input, select, [role="button"]')) {
    if (!visible(el)) continue;
    const r = box(el), sp = scrollParent(el);
    if (!sp && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) issues.push({ level: 'error', rule: 'nut-ngoai-man-hinh', detail: `${label(el)} tại [${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] ngoài ${Math.round(W)}×${Math.round(H)}` });
    if (touch && !el.closest('svg') && !el.classList.contains('link') && (r.width < 38 || r.height < 38)) issues.push({ level: 'warn', rule: 'nut-qua-nho', detail: `${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}` });
  }
  // 2. Khối giao diện nổi tràn khỏi màn hình
  const blocks = ['.dg-top', '.dg-hud', '.tr-cap', '.tr-hud', '.sw-top', '.sw-card', '.sw-guide', '.context', '.hud-top', '.chips', '.quest', '.plot-switch', '.toast', '.ctx-bar', '.ctx-detail', '.dock', '.modal', '.card', '.wheel-wrap', '.wheel-head', '.brand'];
  const rects = {};
  for (const sel of blocks) for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const r = box(el); rects[sel] = r;
    if (!scrollParent(el) && (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1)) issues.push({ level: 'error', rule: 'khoi-tran-man-hinh', detail: `${sel} tại [${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] ngoài ${Math.round(W)}×${Math.round(H)}` });
  }
  // 3. Các khối nổi đè lên nhau
  const hit = (a, b) => a && b && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
  for (const [a, b] of [['.hud-top', '.chips'], ['.hud-top', '.quest'], ['.chips', '.quest'], ['.quest', '.plot-switch'], ['.chips', '.plot-switch'], ['.ctx-bar', '.dock'], ['.ctx-detail', '.dock'], ['.modal', '.dock'], ['.modal', '.hud-top'], ['.toast', '.hud-top'], ['.toast', '.quest'], ['.toast', '.plot-switch'], ['.context', '.dock'], ['.wheel-wrap', '.wheel-head']]) {
    if (hit(rects[a], rects[b])) issues.push({ level: 'error', rule: 'khoi-de-nhau', detail: `${a} đè lên ${b}` });
  }
  // 4. Chữ bị cắt mà không có dấu ba chấm
  for (const el of document.querySelectorAll('h1, h2, h3, p, strong, small, span, button, label')) {
    if (!visible(el) || el.children.length > 0) continue;
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') issues.push({ level: 'warn', rule: 'chu-bi-cat', detail: label(el) });
  }
  return issues;
}

const report = [];
rmSync(OUT, { recursive: true, force: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const dev of DEVICES) {
  const dir = join(OUT, dev.id); mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: 1, hasTouch: dev.touch, isMobile: dev.touch, geolocation: { latitude: 10.34, longitude: 106.03 }, permissions: ['geolocation'], locale: 'vi-VN' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__rideStep = 0.15; window.__driveAuto = true; window.__drivePolice = false; window.__sightAuto = true; }); // hoạt cảnh du lịch: cho mỗi khung hình nhảy bước dài hơn vì máy thử không có GPU
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push(`console: ${m.text().slice(0, 200)}`); });
  // Phản hồi lỗi từ máy chủ, trừ 401 (chưa đăng nhập ở lần mở đầu) và 409 (từ chối theo luật chơi)
  page.on('response', (r) => { if (r.status() >= 400 && ![401, 409].includes(r.status())) logs.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  page.on('dialog', (d) => d.accept());
  let n = 0;
  const shot = async (screen) => {
    await page.waitForTimeout(500);
    const file = `${String(++n).padStart(2, '0')}-${screen}.png`;
    await page.screenshot({ path: join(dir, file) });
    const issues = await page.evaluate(audit, dev.touch);
    report.push({ device: dev.id, size: `${dev.w}×${dev.h}`, screen, file: join(dev.id, file), issues });
    console.log(`${dev.id.padEnd(16)} ${screen.padEnd(22)} ${issues.filter((i) => i.level === 'error').length} lỗi, ${issues.filter((i) => i.level === 'warn').length} cảnh báo`);
  };
  const step = async (name, fn) => { try { await fn(); } catch (e) { report.push({ device: dev.id, size: `${dev.w}×${dev.h}`, screen: name, file: null, issues: [{ level: 'error', rule: 'khong-di-tiep-duoc', detail: String(e.message).split('\n')[0].slice(0, 200) }] }); console.log(`${dev.id.padEnd(16)} ${name.padEnd(22)} KHÔNG ĐI TIẾP ĐƯỢC: ${String(e.message).split('\n')[0].slice(0, 120)}`); throw e; } };
  const world = (fn, a) => page.evaluate(([f, a]) => new Function('w', 'a', f)(window.__vuon, a), [fn, a]);
  const dock = (re) => page.locator('.dock button', { hasText: re }).click();
  const closeModal = () => page.locator('.modal-head .round').click();

  try {
    await step('dang-nhap', async () => { await page.goto(`${BASE}/?gio=10`); await page.getByLabel('Tên tài khoản').waitFor(); await shot('dang-nhap'); });
    await step('buoc-1-vi-tri', async () => {
      await page.getByLabel('Tên tài khoản').fill(`ui_${dev.id.replace(/\W/g, '').slice(0, 8)}_${Date.now() % 100000}`);
      await page.getByLabel('Tên hiển thị').fill('Người thử giao diện'); await page.getByLabel('Mật khẩu').fill('matkhau123');
      await page.locator('form button.primary').click();
      await page.getByRole('button', { name: /Chia sẻ vị trí/ }).waitFor(); await shot('buoc-1-vi-tri');
    });
    await step('buoc-2-xac-nhan', async () => {
      await page.getByRole('button', { name: /Chia sẻ vị trí/ }).click();
      await page.waitForFunction(() => document.querySelectorAll('.ward select')[1]?.options.length > 3);
      await page.locator('.ward select').nth(1).selectOption({ index: 2 }); await shot('buoc-2-xac-nhan');
    });
    await step('vong-quay', async () => { await page.getByRole('button', { name: /Xác nhận và nhận vườn/ }).click(); await page.getByRole('button', { name: 'Quay', exact: true }).waitFor(); await shot('vong-quay'); });
    await step('vong-quay-ket-qua', async () => { await page.getByRole('button', { name: 'Quay', exact: true }).click(); await page.getByRole('button', { name: 'Vào xóm' }).waitFor({ timeout: 40000 }); await shot('vong-quay-ket-qua'); });
    await step('xom', async () => { await page.getByRole('button', { name: 'Vào xóm' }).click(); await page.waitForFunction(() => window.__vuon); await page.waitForTimeout(2500); await shot('xom'); });
    await step('dung-tren-o-trong', async () => { await world('w.teleportToTile(0, 8)'); await page.locator('.ctx-btn').first().waitFor(); await shot('dung-tren-o-trong'); });
    await step('chon-giong', async () => { await page.locator('.ctx-btn.go').click(); await page.locator('.seed').first().waitFor(); await shot('chon-giong'); });
    await step('cay-dang-lon', async () => { await page.locator('.seed:not([disabled])').first().click(); await page.waitForTimeout(1200); await shot('cay-dang-lon'); await page.locator('.ctx-btn').first().click(); await shot('chi-tiet-cay'); });
    await step('kho', async () => { await world('w.goHome()'); await dock(/Kho/); await shot('kho'); await page.getByRole('button', { name: 'Đơn hàng', exact: true }).click(); await shot('don-hang'); await page.getByRole('button', { name: 'Xưởng', exact: true }).click(); await shot('xuong'); await closeModal(); });
    await step('cho', async () => { await dock(/Chợ/); await shot('cho'); await page.getByRole('button', { name: 'Bảng giá' }).click(); await shot('bang-gia'); await closeModal(); });
    await step('xom-lang', async () => { await dock(/Xóm/); await shot('ban-be'); await page.getByRole('button', { name: 'Hợp tác xã' }).click(); await shot('hop-tac-xa'); await closeModal(); });
    await step('du-lich', async () => { await dock(/Du lịch/); await shot('du-lich'); await page.locator('.row-toggle').nth(3).click(); await shot('chon-phuong-tien'); await page.getByRole('button', { name: /Sổ tem/ }).click(); await shot('so-tem'); await closeModal(); });
    await step('trang-tri', async () => { await dock(/Trang trí/); await shot('trang-tri'); await page.getByRole('button', { name: 'Sân vườn' }).click(); await shot('trang-tri-san'); await closeModal(); });
    await step('trang-bi-phong-to', async () => {
      // Safari trên iPhone bỏ qua maximum-scale/user-scalable. Ép trang phóng 115% và kéo lệch đi rồi kiểm xem giao diện còn nằm trọn trong phần nhìn thấy không.
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.15 });
      await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(dev.w / 2), y: Math.round(dev.h / 2), xDistance: -50, yDistance: -60, gestureSourceType: dev.touch ? 'touch' : 'mouse', speed: 1200 }).catch(() => {});
      await page.waitForTimeout(800);
      await world('w.teleportToTile(0, 8)'); await shot('phong-to-xom');
      await dock(/Kho/); await shot('phong-to-kho'); await closeModal();
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await page.waitForTimeout(500);
    });
    await step('ho-so', async () => { await page.locator('button.chip').click(); await shot('ho-so'); await closeModal(); });

    // ---- Phần dành cho tài khoản thử nghiệm: thương lái, xe tải, chuyến buôn, tham quan, mua đất, du lịch
    const post = (path, body = {}) => page.evaluate(async ([path, body]) => { const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; }, [path, body]);
    const enter = async (query = '') => { await page.goto(`${BASE}/?gio=10${query}`); await page.waitForFunction(() => window.__vuon); await page.waitForTimeout(2500); };
    /** Chụp đều đặn trong lúc một hoạt cảnh toàn màn hình (sel) đang chạy; fn trả về nhãn pha hiện tại. */
    const during = async (sel, prefix, phaseOf, { every = 5000, max = 12, timeout = 420000, hurry = null } = {}) => {
      await page.locator(sel).waitFor({ timeout: 30000 });
      const t0 = Date.now(); let last = null, k = 0, lastShot = 0;
      while (await page.locator(sel).count() > 0) {
        if (Date.now() - t0 > timeout) throw new Error(`${prefix}: hoạt cảnh không kết thúc sau ${timeout / 1000} giây`);
        const phase = await page.evaluate(phaseOf).catch(() => null);
        if (k < max && ((phase !== null && phase !== last) || Date.now() - lastShot > every)) { last = phase; lastShot = Date.now(); k++; await shot(`${prefix}-${String(k).padStart(2, '0')}${phase !== null ? `-${String(phase).replace(/[^\w-]/g, '')}` : ''}`); }
        else await page.waitForTimeout(400);
        // máy không có GPU chạy rất chậm: khi đã chụp đủ thì cho hoạt cảnh nhảy gần tới đoạn kết
        if (hurry && (k >= max || Date.now() - t0 > 150000)) { await page.evaluate(hurry).catch(() => {}); await page.waitForTimeout(1500); }
      }
    };
    await step('tai-khoan-thu', async () => {
      execFileSync('psql', [DB, '-qc', "update users set is_tester = true where username like 'ui\\_%'"]);
      const r = await post('/api/test/cash', { amount: 900_000_000 }); if (r.status !== 200) throw new Error(`không bật được tài khoản thử: ${r.status}`);
      await post('/api/test/role', { role: 'thuong_lai' }); await post('/api/test/truck'); await post('/api/test/stock', { specialtyId: 'sau_rieng_ngu_hiep', kg: 600 }); await post('/api/test/stock', { specialtyId: 'xoai_hoa_loc', kg: 300 });
      await enter(); await page.locator('button.chip').click(); await page.locator('.tester').scrollIntoViewIfNeeded(); await shot('cong-cu-thu-nghiem'); await closeModal();
    });
    await step('xe-tai', async () => {
      await world('w.pos.copy(w.truckPos)'); await page.getByRole('button', { name: /Lên xe tải/ }).waitFor(); await shot('canh-xe-tai');
      await page.getByRole('button', { name: /Lên xe tải/ }).click(); await page.locator('.truck-stats').waitFor(); await shot('tren-xe-tai');
      await page.getByRole('button', { name: 'Đi vùng khác' }).click(); await page.locator('.row-toggle').nth(4).click(); await page.locator('.trip-card').scrollIntoViewIfNeeded(); await shot('ke-hoach-chuyen-xe');
    });
    if (!QUICK) await step('lai-xe', async () => {
      await page.locator('.trip-card button.primary').click();
      await during('.dg', 'lai-xe', () => window.__drive?.debug?.().phase ?? null, { every: 8000, max: 14, hurry: () => { const w = window.__drive, d = w?.debug?.(); if (d && d.total - d.s > 90) w.warp(d.total - 70); } });
      // tới nơi: bảng "Buôn bán" tự mở để thấy ngay mua gì, bán gì
      await page.locator('.trade').waitFor({ timeout: 20000 }); await page.waitForTimeout(800); await shot('toi-noi-buon-ban');
      const buy = page.locator('.deal-buy .go').first(); if (await buy.count()) { await buy.scrollIntoViewIfNeeded(); await buy.click(); await page.waitForTimeout(900); await shot('thu-mua-si-xong'); }
      await page.locator('.trade .why').first().scrollIntoViewIfNeeded(); await page.locator('.trade .why summary').first().click(); await shot('ly-do-gioi-han');
      await closeModal(); await page.waitForTimeout(1500); await shot('toi-noi-sau-chuyen-xe');
    });
    else await step('tham-quan-nhanh', async () => { await closeModal(); await post('/api/test/role', { role: 'nong_dan' }); });
    if (!QUICK) await step('tham-quan', async () => {
      await world('w.teleportToTile(0, 8)'); await page.locator('.ctx-btn').first().waitFor(); await shot('vuon-mau');
      await page.locator('.ctx-btn').first().click(); await page.locator('.guide').waitFor(); await shot('cach-trong-buoc-1');
      await page.locator('.track button').nth(4).click(); await shot('cach-trong-buoc-5');
      await page.locator('.track button').last().click(); await shot('cach-trong-thu-hoach'); await page.locator('.guide .round').click();
      await world('w.pos.set(6.2, 0, 12.2)'); await page.getByRole('button', { name: /Vào quầy trưng bày/ }).waitFor(); await shot('truoc-quay-trung-bay');
      await page.getByRole('button', { name: /Vào quầy trưng bày/ }).click(); await page.getByRole('button', { name: /Quà, tem/ }).click(); await page.locator('.showcase').waitFor(); await shot('quay-trung-bay');
      const buy = page.getByRole('button', { name: /Mua một lô/ }); await buy.scrollIntoViewIfNeeded(); await shot('gia-dat'); await buy.click(); await page.getByText(/Bạn đã có đất/).waitFor(); await closeModal();
      await page.getByRole('button', { name: /Về nhà/ }).click(); await page.waitForTimeout(2500); await page.locator('.plot-switch').waitFor(); await shot('nhieu-vuon');
      await world('w.teleportToTile(0, 8)'); await page.locator('.ctx-btn').first().waitFor(); await shot('nhieu-vuon-dung-tren-o');
    });
    await step('xuat-khau', async () => {
      await enter(); await dock(/Kho/); await page.getByRole('button', { name: 'Xuất khẩu' }).click(); await page.locator('.export').waitFor(); await shot('xuat-khau-chon-hang');
      await page.locator('.export .pick').first().click(); await page.locator('.route').first().waitFor(); await page.locator('.route').first().scrollIntoViewIfNeeded(); await shot('xuat-khau-duong-di');
      const send = page.locator('.route .go').first(); if (await send.count() === 0) throw new Error('không có đường xuất khẩu nào gửi được');
      await send.scrollIntoViewIfNeeded(); await send.click();
      await during('.tr', 'xuat-khau-hoat-canh', () => { const d = window.__ride?.debug?.(); return d ? `canh-${d.stage}` : null; }, { every: 60000, max: 6 });
      await page.locator('.export').waitFor({ timeout: 20000 }); await page.waitForTimeout(600);
      await page.getByRole('heading', { name: /Lô hàng đang đi/ }).scrollIntoViewIfNeeded(); await shot('xuat-khau-lo-hang'); await closeModal();
    });
    if (!QUICK) for (const [i, mode] of [[0, 'chuyen-1'], [1, 'chuyen-2'], [2, 'chuyen-3']]) await step(`du-lich-${mode}`, async () => {
      await enter(); await dock(/Du lịch/);
      // chọn một vùng xa (cuối danh sách) để có nhiều phương tiện; mỗi lượt thử một phương tiện khác
      const rows = page.locator('.row-toggle'), nRows = await rows.count(); await rows.nth(nRows - 2 - i * 9).click();
      const picks = page.locator('.region-body .pick:not([disabled])'), nPicks = await picks.count(); if (nPicks === 0) throw new Error('không có phương tiện nào bấm được');
      const pick = picks.nth(Math.min(i, nPicks - 1)); await pick.scrollIntoViewIfNeeded(); if (i === 0) await shot('chon-ve');
      await pick.click();
      if (await page.locator('.tr button').filter({ hasText: /Bỏ qua/ }).count() > 0) throw new Error('hoạt cảnh du lịch vẫn còn nút Bỏ qua');
      await during('.tr', `du-lich-${mode}`, () => { const d = window.__ride?.debug?.(); return d ? `canh-${d.stage}` : null; }, { every: 60000, max: 8 });
      await page.waitForTimeout(2500); await shot(`du-lich-${mode}-toi-noi`);
    });
    await step('tham-quan', async () => {
      await post('/api/test/region', { regionId: 'dn_tienphuoc' }); await post('/api/test/stock', { specialtyId: 'sau_rieng_ngu_hiep', kg: 100 });
      await enter(); await dock(/Du lịch/); await page.locator('.vmap').waitFor(); await page.waitForTimeout(500); await shot('ban-do-viet-nam');
      await page.locator('.vmap-zoom button').first().click(); await page.locator('.vmap-zoom button').first().click(); await page.waitForTimeout(500); await shot('ban-do-phong-to');
      await page.getByRole('button', { name: 'Tham quan', exact: true }).click(); await page.locator('.sights').waitFor(); await page.waitForTimeout(500); await shot('tham-quan-ban-do-tinh');
      const go = page.locator('.sights .go:not([disabled])').first(); if (await go.count() === 0) { const head = page.locator('.sight-head').first(); await head.click(); }
      await go.waitFor(); await go.scrollIntoViewIfNeeded(); await shot('tham-quan-chon-dia-danh'); await go.click();
      await page.locator('.tr').waitFor({ timeout: 30000 });
      let k = 0; const t0 = Date.now();
      while (await page.locator('.sw').count() === 0) {
        if (Date.now() - t0 > 300000) throw new Error('taxi không tới nơi sau 300 giây');
        if (await page.locator('.taxi-cabin').count() > 0 && k < 3) { k++; if (k === 2) await page.getByRole('button', { name: 'Nhìn sang trái' }).click(); if (k === 3) await page.getByRole('button', { name: 'Nhìn sang phải' }).click(); await page.waitForTimeout(900); await shot(`taxi-ghe-sau-${['thang', 'trai', 'phai'][k - 1]}`); }
        else await page.waitForTimeout(500);
      }
      await page.waitForTimeout(2500); await shot('di-bo-vao-cong');
      const t1 = Date.now(); let seen = -1, n = 0;
      while (await page.locator('.sw').count() > 0) {
        if (Date.now() - t1 > 400000) throw new Error('đi bộ tham quan không kết thúc sau 400 giây');
        const out = page.locator('.sw-go', { hasText: /Siêu thị/ });
        if (await out.count() > 0) { await shot('di-bo-diem-cuoi'); await out.click(); break; }
        const cur = Number(await page.locator('.sw').getAttribute('data-seen').catch(() => '0'));
        if (cur !== seen && await page.locator('.sw-card').count() > 0 && n < 4) { seen = cur; n++; await shot(`di-bo-diem-dung-${n}`); }
        await page.waitForTimeout(400);
      }
      await page.locator('.super').waitFor({ timeout: 20000 }); await page.waitForTimeout(600); await shot('sieu-thi-mua-hang');
      const buy = page.locator('.super .go:not([disabled])').first(); if (await buy.count() > 0) { await buy.click(); await page.waitForTimeout(800); }
      await page.getByRole('tab', { name: /Ký gửi/ }).click(); await page.waitForTimeout(600); await shot('sieu-thi-ky-gui'); await closeModal();
    });
    await step('san-thuong', async () => { await post('/api/test/role', { role: 'nong_dan' }); await enter('&santhuong=1'); await shot('san-thuong'); await world('w.teleportToTile(0, 2)'); await page.waitForTimeout(600); await shot('san-thuong-gan'); });
    await step('ban-dem', async () => { await page.goto(`${BASE}/?gio=21`); await page.waitForFunction(() => window.__vuon); await page.waitForTimeout(2500); await shot('ban-dem'); await world('w.pos.set(6.2, 0, 12.2)'); await page.waitForTimeout(600); await shot('ban-dem-truoc-sap'); });
  } catch { /* đã ghi vào báo cáo */ }
  if (logs.length) report.push({ device: dev.id, size: `${dev.w}×${dev.h}`, screen: 'nhat-ky-trinh-duyet', file: null, issues: logs.map((l) => ({ level: 'error', rule: 'loi-console', detail: l })) });
  await ctx.close();
}
await browser.close();

const errors = report.flatMap((r) => r.issues.filter((i) => i.level === 'error').map((i) => ({ ...r, ...i })));
const warns = report.flatMap((r) => r.issues.filter((i) => i.level === 'warn').map((i) => ({ ...r, ...i })));
let md = `# Kết quả kiểm thử giao diện\n\n${report.filter((r) => r.file).length} màn trên ${DEVICES.length} thiết bị · **${errors.length} lỗi**, ${warns.length} cảnh báo\n\n`;
for (const [title, list] of [['Lỗi', errors], ['Cảnh báo', warns]]) {
  md += `## ${title}\n\n`;
  md += list.length ? '| Thiết bị | Màn | Quy tắc | Chi tiết | Ảnh |\n|---|---|---|---|---|\n' + list.map((i) => `| ${i.device} (${i.size}) | ${i.screen} | ${i.rule} | ${i.detail.replace(/\|/g, '/')} | ${i.file ?? ''} |`).join('\n') + '\n\n' : 'Không có.\n\n';
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'report.md'), md);
console.log(`\n${errors.length} lỗi, ${warns.length} cảnh báo. Báo cáo: ${join(OUT, 'report.md')}`);
process.exit(errors.length ? 1 : 0);
