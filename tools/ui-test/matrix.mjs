// Ma trận thiết bị: soát bố cục MỌI cửa sổ, MỌI tab trên nhiều cỡ màn hình (iPhone, Safari trong trình duyệt,
// Android, iPad, máy tính). Nhanh hơn run.mjs vì bỏ các hoạt cảnh dài; dùng sau mỗi lần sửa CSS/bố cục.
// Dùng: node tools/ui-test/matrix.mjs [--base http://localhost:3100] [--out tools/ui-test/out-matrix] [--only android-360,ipad-mini] [--nhom dien-thoai|may-tinh-bang|may-tinh]
// Cần máy chủ thử (tools/ui-test/serve.sh) và quyền psql vào cơ sở dữ liệu thử (UI_TEST_DATABASE_URL).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { audit } from './audit.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'http://localhost:3100');
const OUT = arg('out', 'tools/ui-test/out-matrix');
const ONLY = arg('only', '').split(',').filter(Boolean);
const GROUP = arg('nhom', '');
// Trong game, sân sát hạch nằm dưới styles.css chung (luật input, nút…); trang thử không nạp tệp đó nên chèn vào cho giống thật
const GAME_CSS = readFileSync(new URL('../../web/src/styles.css', import.meta.url), 'utf8').replace(/^@import[^;]*;/m, '');
const EXAM_ONLY = process.argv.includes('--chi-sat-hach'); // chỉ soát màn giới thiệu sân sát hạch (nhanh)
// Trang thử riêng (sân sát hạch) chỉ có ở máy chủ Vite dev: cd web && npx vite --port 5190
const DEV = arg('dev', 'http://localhost:5190');
const DB = process.env.UI_TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_ui';

/**
 * Kích thước theo điểm CSS. "safari"/"chrome" = mở trong trình duyệt, chưa thêm vào màn hình chính: phần nhìn thấy thấp hơn
 * vì thanh địa chỉ và thanh công cụ (Safari iOS 17–18 thanh dưới ~ 50–83 px, thanh trên ~ 50 px).
 * dpr chỉ để làm tròn điểm ảnh giống máy thật (Android 2.625/2.75 hay lệch nửa điểm ảnh).
 */
export const DEVICES = [
  { id: 'iphone-se', group: 'dien-thoai', w: 375, h: 667, dpr: 2, touch: true },
  { id: 'iphone-se-safari', group: 'dien-thoai', w: 375, h: 548, dpr: 2, touch: true },
  { id: 'iphone-15', group: 'dien-thoai', w: 393, h: 852, dpr: 3, touch: true },
  { id: 'iphone-15-safari', group: 'dien-thoai', w: 393, h: 659, dpr: 3, touch: true },
  { id: 'iphone-15-pro-max', group: 'dien-thoai', w: 430, h: 932, dpr: 3, touch: true },
  { id: 'iphone-15-pro-max-safari', group: 'dien-thoai', w: 430, h: 739, dpr: 3, touch: true },
  { id: 'iphone-15-ngang', group: 'dien-thoai', w: 852, h: 393, dpr: 3, touch: true },
  { id: 'iphone-15-ngang-safari', group: 'dien-thoai', w: 852, h: 340, dpr: 3, touch: true },
  { id: 'android-360', group: 'dien-thoai', w: 360, h: 800, dpr: 3, touch: true },
  { id: 'android-360-chrome', group: 'dien-thoai', w: 360, h: 680, dpr: 3, touch: true },
  { id: 'android-412', group: 'dien-thoai', w: 412, h: 915, dpr: 2.625, touch: true },
  { id: 'android-412-chrome', group: 'dien-thoai', w: 412, h: 800, dpr: 2.625, touch: true },
  { id: 'android-ngang', group: 'dien-thoai', w: 800, h: 360, dpr: 3, touch: true },
  { id: 'ipad-mini', group: 'may-tinh-bang', w: 744, h: 1133, dpr: 2, touch: true },
  { id: 'ipad-mini-ngang', group: 'may-tinh-bang', w: 1133, h: 744, dpr: 2, touch: true },
  { id: 'ipad-pro', group: 'may-tinh-bang', w: 1024, h: 1366, dpr: 2, touch: true },
  { id: 'ipad-pro-ngang', group: 'may-tinh-bang', w: 1366, h: 1024, dpr: 2, touch: true },
  { id: 'laptop', group: 'may-tinh', w: 1366, h: 768, dpr: 1, touch: false },
  { id: 'desktop-rong', group: 'may-tinh', w: 1920, h: 1080, dpr: 1, touch: false },
].filter((d) => (ONLY.length === 0 || ONLY.includes(d.id)) && (!GROUP || d.group === GROUP));

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
const report = [];
rmSync(OUT, { recursive: true, force: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const dev of DEVICES) {
  const dir = join(OUT, dev.id); mkdirSync(dir, { recursive: true });
  // mặc định dpr 1 cho nhẹ (bố cục tính theo điểm CSS nên không đổi); thêm --dpr để giả lập cả cách làm tròn điểm ảnh của máy thật
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: process.argv.includes('--dpr') ? dev.dpr : 1, hasTouch: dev.touch, isMobile: dev.touch, geolocation: { latitude: 10.34, longitude: 106.03 }, permissions: ['geolocation'], locale: 'vi-VN' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000); // máy thử bận (nhiều trình duyệt chạy song song) có khi chậm
  await page.addInitScript(() => { try { localStorage.setItem('vv-quality', 'thap'); } catch { /* */ } window.__rideStep = 0.15; window.__driveAuto = true; window.__drivePolice = false; window.__sightAuto = true; });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('dialog', (d) => d.accept());
  let n = 0;
  const user = `ui_${slug(dev.id).replace(/-/g, '').slice(0, 8)}_${Date.now() % 100000}`;
  const shot = async (screen) => {
    await page.waitForTimeout(450);
    const file = `${String(++n).padStart(3, '0')}-${screen}.png`;
    await page.screenshot({ path: join(dir, file), scale: 'css' });
    const issues = await page.evaluate(audit, dev.touch);
    report.push({ device: dev.id, size: `${dev.w}×${dev.h}`, screen, file: join(dev.id, file), issues });
    const e = issues.filter((i) => i.level === 'error').length, w = issues.length - e;
    console.log(`${dev.id.padEnd(26)} ${screen.padEnd(34)} ${e} lỗi, ${w} cảnh báo`);
  };
  const fail = (name, e) => { report.push({ device: dev.id, size: `${dev.w}×${dev.h}`, screen: name, file: null, issues: [{ level: 'error', rule: 'khong-di-tiep-duoc', detail: String(e.message).split('\n')[0].slice(0, 200) }] }); console.log(`${dev.id.padEnd(26)} ${name.padEnd(34)} KHÔNG ĐI TIẾP ĐƯỢC: ${String(e.message).split('\n')[0].slice(0, 120)}`); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fail(name, e); await page.screenshot({ path: join(dir, `loi-${name}.png`) }).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); } };
  const world = (fn) => page.evaluate((f) => new Function('w', f)(window.__vuon), fn);
  const dock = (re) => page.locator('.dock button', { hasText: re }).click();
  const closeModal = async () => { const x = page.locator('.modal-head .round'); if (await x.count()) await x.first().click(); };
  const post = (path, body = {}) => page.evaluate(async ([path, body]) => { const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.status; }, [path, body]);
  const enter = async () => { await page.goto(`${BASE}/?gio=10`); await page.waitForFunction(() => window.__vuon); await page.waitForTimeout(2000); };

  /** Mở xong một cửa sổ: chụp, rồi bấm qua từng tab (và tab con một tầng), mỗi tab chụp và soát một lần. */
  const crawl = async (name, extra) => {
    await page.locator('.modal').first().waitFor();
    await shot(name);
    const top = page.locator('.modal-body .tabs').first();
    const nTop = await top.count() ? await top.locator('button').count() : 0;
    for (let i = 0; i < nTop; i++) {
      const b = page.locator('.modal-body .tabs').first().locator('button').nth(i);
      const t = slug(await b.innerText()); if (i > 0) { await b.click(); await page.waitForTimeout(350); await shot(`${name}-${t}`); }
      const inner = page.locator('.modal-body .tabs').nth(1);
      if (await inner.count()) {
        const nIn = Math.min(await inner.locator('button').count(), 8);
        for (let j = 1; j < nIn; j++) { const c = page.locator('.modal-body .tabs').nth(1).locator('button').nth(j); if (!(await c.isVisible())) continue; const ct = slug(await c.innerText()); await c.click(); await page.waitForTimeout(350); await shot(`${name}-${t}-${ct}`); }
      }
      if (extra) await extra(`${name}-${t}`);
    }
  };

  try {
    if (EXAM_ONLY) throw new Error('chi-sat-hach');
    await step('dang-nhap', async () => { await page.goto(`${BASE}/?gio=10`); await page.getByLabel('Tên tài khoản').waitFor(); await shot('dang-nhap'); });
    await step('dang-ky', async () => {
      await page.getByLabel('Tên tài khoản').fill(user);
      await page.getByLabel('Tên hiển thị').fill('Người thử giao diện có tên khá dài'); await page.getByLabel('Mật khẩu').fill('matkhau123');
      await page.locator('form button.primary').click();
      await page.getByRole('button', { name: /Chia sẻ vị trí/ }).waitFor(); await shot('buoc-1-vi-tri');
      await page.getByRole('button', { name: /Chia sẻ vị trí/ }).click();
      await page.waitForFunction(() => document.querySelectorAll('.ward select')[1]?.options.length > 3);
      await page.locator('.ward select').nth(1).selectOption({ index: 2 }); await shot('buoc-2-xac-nhan');
      await page.getByRole('button', { name: /Xác nhận và nhận vườn/ }).click(); await page.getByRole('button', { name: 'Quay', exact: true }).waitFor(); await shot('vong-quay');
      await page.getByRole('button', { name: 'Quay', exact: true }).click(); await page.getByRole('button', { name: 'Vào xóm' }).waitFor({ timeout: 40000 }); await shot('vong-quay-ket-qua');
      // chỉ đúng tài khoản của thiết bị này: các lượt chạy song song không được đổi vai của nhau (sẽ bỏ qua vòng quay)
      execFileSync('psql', [DB, '-qc', `update users set role = 'nong_dan', is_tester = true where username = '${user}'`]);
      await page.getByRole('button', { name: 'Vào xóm' }).click(); await page.waitForFunction(() => window.__vuon); await page.waitForTimeout(2000); await shot('xom');
    });
    await step('chuan-bi', async () => {
      await post('/api/test/cash', { amount: 2_000_000_000 }); await post('/api/test/truck');
      for (const [sp, kg] of [['sau_rieng_ngu_hiep', 1600], ['xoai_hoa_loc', 900], ['buoi_nam_roi', 1200], ['ca_phe_bmt', 700], ['cam_bu_huong_son', 500], ['thanh_long_binh_thuan', 800]]) await post('/api/test/stock', { specialtyId: sp, kg });
      await enter();
    });
    await step('vuon', async () => {
      await world('w.teleportToTile(0, 8)'); await page.locator('.seed-bar').waitFor(); await shot('dung-tren-o-trong');
      await page.locator('.seed:not([disabled])').first().click(); await page.waitForTimeout(300); await shot('chon-giong');
      const info = page.locator('.seed-i').first(); if (await info.count()) { await info.click(); await page.locator('.seed-info').waitFor(); await shot('thong-tin-giong'); await page.locator('.seed-info .round').click(); }
      await world('w.goHome()');
    });
    for (const role of ['nong_dan', 'xuong', 'thuong_lai']) {
      await step(`kho-${role}`, async () => {
        await post('/api/test/role', { role }); await enter(); await shot(`xom-${role}`);
        await dock(/Kho/);
        await crawl(`kho-${role}`, async (prefix) => {
          // giỏ xuất khẩu: chọn vài lô để thấy danh sách dài nhất
          const picks = page.locator('.modal .export .pick:not([disabled])');
          if (await picks.count() > 0) { for (let i = 0; i < Math.min(4, await picks.count()); i++) await page.locator('.modal .export .pick:not([disabled])').nth(0).click().catch(() => {}); await page.waitForTimeout(400); await shot(`${prefix}-gio`); await page.locator('.modal .route').first().scrollIntoViewIfNeeded().catch(() => {}); await shot(`${prefix}-duong`); }
        });
        await closeModal();
      });
    }
    await step('cho', async () => { await dock(/Chợ/); await crawl('cho'); await closeModal(); });
    await step('xom-lang', async () => { await dock(/Xóm/); await crawl('xom-lang'); await closeModal(); });
    await step('du-lich', async () => { await dock(/Du lịch/); await crawl('du-lich'); await closeModal(); });
    await step('trang-tri', async () => { await dock(/Trang trí/); await crawl('trang-tri'); await closeModal(); });
    await step('ho-so', async () => {
      await page.locator('.hud-top button.chip').first().click(); await crawl('ho-so');
      const body = page.locator('.modal-body'); const h = await body.evaluate((b) => b.scrollHeight - b.clientHeight);
      for (let k = 1; k <= 3 && h > 0; k++) { await body.evaluate((b, f) => { b.scrollTop = (b.scrollHeight - b.clientHeight) * f; }, k / 3); await shot(`ho-so-cuon-${k}`); }
      await closeModal();
    });
    await step('sat-hach', async () => {
      await page.goto(`${DEV}/exam-test.html?cls=CE`); await page.addStyleTag({ content: GAME_CSS }); await page.locator('.exam-card').waitFor({ timeout: 20000 }); await shot('sat-hach-gioi-thieu');
      await page.locator('.exam-link').click(); await page.locator('.exam-card').evaluate((c) => { c.scrollTop = c.scrollHeight; }); await shot('sat-hach-bang-diem');
    });
  } catch (e) { if (e.message !== 'chi-sat-hach') fail('loi-ngoai', e); }
  if (EXAM_ONLY) await step('sat-hach', async () => {
    await page.goto(`${DEV}/exam-test.html?cls=CE`); await page.addStyleTag({ content: GAME_CSS }); await page.locator('.exam-card').waitFor({ timeout: 20000 }); await shot('sat-hach-gioi-thieu');
    await page.locator('.exam-link').click(); await page.locator('.exam-card').evaluate((c) => { c.scrollTop = c.scrollHeight; }); await shot('sat-hach-bang-diem');
  });
  if (logs.length) report.push({ device: dev.id, size: `${dev.w}×${dev.h}`, screen: 'nhat-ky-trinh-duyet', file: null, issues: [...new Set(logs)].map((l) => ({ level: 'warn', rule: 'loi-console', detail: l })) });
  await ctx.close();
}
await browser.close();

const errors = report.flatMap((r) => r.issues.filter((i) => i.level === 'error').map((i) => ({ ...r, ...i })));
const warns = report.flatMap((r) => r.issues.filter((i) => i.level === 'warn').map((i) => ({ ...r, ...i })));
const byDev = {}; for (const e of errors) byDev[e.device] = (byDev[e.device] ?? 0) + 1;
let md = `# Ma trận thiết bị\n\n${report.filter((r) => r.file).length} màn trên ${DEVICES.length} thiết bị · **${errors.length} lỗi**, ${warns.length} cảnh báo\n\n`;
md += '| Thiết bị | Cỡ | Lỗi |\n|---|---|---|\n' + DEVICES.map((d) => `| ${d.id} | ${d.w}×${d.h} | ${byDev[d.id] ?? 0} |`).join('\n') + '\n\n';
for (const [title, list] of [['Lỗi', errors], ['Cảnh báo', warns]]) {
  md += `## ${title}\n\n`;
  md += list.length ? '| Thiết bị | Màn | Quy tắc | Chi tiết | Ảnh |\n|---|---|---|---|---|\n' + list.map((i) => `| ${i.device} | ${i.screen} | ${i.rule} | ${i.detail.replace(/\|/g, '/')} | ${i.file ?? ''} |`).join('\n') + '\n\n' : 'Không có.\n\n';
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'report.md'), md);
console.log(`\n${errors.length} lỗi, ${warns.length} cảnh báo. Báo cáo: ${join(OUT, 'report.md')}`);
process.exit(errors.length ? 1 : 0);
