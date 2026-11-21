// Kiểm thử giao diện tự động trên nhiều thiết bị: đi qua các màn chính, chụp ảnh và soát lỗi bố cục.
// Dùng: node tools/ui-test/run.mjs [--base http://localhost:3100] [--out tools/ui-test/out] [--only iphone-15,desktop]
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'http://localhost:3100');
const OUT = arg('out', 'tools/ui-test/out');
const ONLY = arg('only', '').split(',').filter(Boolean);

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
    if (touch && !el.classList.contains('link') && (r.width < 38 || r.height < 38)) issues.push({ level: 'warn', rule: 'nut-qua-nho', detail: `${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}` });
  }
  // 2. Khối giao diện nổi tràn khỏi màn hình
  const blocks = ['.hud-top', '.chips', '.quest', '.plot-switch', '.toast', '.ctx-bar', '.ctx-detail', '.dock', '.modal', '.card', '.wheel-wrap', '.wheel-head', '.brand'];
  const rects = {};
  for (const sel of blocks) for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const r = box(el); rects[sel] = r;
    if (!scrollParent(el) && (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1)) issues.push({ level: 'error', rule: 'khoi-tran-man-hinh', detail: `${sel} tại [${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] ngoài ${Math.round(W)}×${Math.round(H)}` });
  }
  // 3. Các khối nổi đè lên nhau
  const hit = (a, b) => a && b && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
  for (const [a, b] of [['.hud-top', '.chips'], ['.hud-top', '.quest'], ['.chips', '.quest'], ['.quest', '.plot-switch'], ['.chips', '.plot-switch'], ['.ctx-bar', '.dock'], ['.ctx-detail', '.dock'], ['.modal', '.dock'], ['.modal', '.hud-top'], ['.toast', '.hud-top'], ['.wheel-wrap', '.wheel-head']]) {
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
