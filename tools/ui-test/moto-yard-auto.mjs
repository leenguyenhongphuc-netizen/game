// Xe tự chạy hết 4 bài sân sa hình xe máy (tập thử), báo điểm. Dùng: node tools/ui-test/moto-yard-auto.mjs [base] [A1|A]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://localhost:5190', cls = process.argv[3] ?? 'A1';
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices['iPhone 15'] })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/moto-test.html?thi=${cls}&auto=1&step=3`);
await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Tập thử/ }).first().click();
const t0 = Date.now(); let txt = '';
while (Date.now() - t0 < 240000) { txt = await p.locator('.mx-card').first().textContent().catch(() => '') ?? ''; if (/điểm|Đạt|Chưa đạt|truất/i.test(txt) && !/Đi liên hoàn/.test(txt)) break; await p.waitForTimeout(1000); }
console.log(cls, Math.round((Date.now() - t0) / 1000), 's ·', txt.replace(/\s+/g, ' ').slice(0, 140), errs.length ? `· lỗi trang: ${errs[0]}` : '');
await b.close();
