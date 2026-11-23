// Thi thử sân sa hình bằng lái mẫu trong trình duyệt (một chế độ duy nhất): node tools/ui-test/exam-check.mjs [B|C1|C] [base] [ảnh-ra]
import { chromium } from 'playwright';
const cls = process.argv[2] ?? 'B', base = process.argv[3] ?? 'http://127.0.0.1:5291', shot = process.argv[4];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 932 } });
p.on('pageerror', (e) => console.log('LỖI', e.message));
await p.goto(`${base}/exam-test.html?cls=${cls}&auto=1`); await new Promise((r) => setTimeout(r, 2000));
const modes = await p.locator('.exam-intro [role=radio], .exam-intro input[type=checkbox]').count();
await p.getByText('Vào thi').click(); await new Promise((r) => setTimeout(r, 2500));
if (shot) { await p.evaluate(() => window.__exam.view('sau')); await new Promise((r) => setTimeout(r, 2000)); await p.screenshot({ path: shot }); await p.evaluate(() => window.__exam.view('tren')); }
await p.evaluate(() => { window.__rideStep = 1; });
const t0 = Date.now(); let res = null, k = 0;
while (Date.now() - t0 < 900000) { await new Promise((r) => setTimeout(r, 2000)); res = await p.evaluate(() => { const v = document.querySelector(".exam-result .exam-verdict"); return v ? JSON.stringify(v.textContent) : null; }); if (res) break; if (++k % 10 === 0) console.log(JSON.stringify(await p.evaluate(() => { const s = window.__exam?.state(); return s && { item: s.item, t: Math.round(s.t), score: s.score, calls: s.calls }; }))); }
console.log(cls, 'nút chọn mức còn lại:', modes, res ? JSON.stringify(JSON.parse(res)) : 'CHƯA XONG');
await b.close();
