// Cho xe tự làm hết một lượt ở trạm dừng / cây xăng / trạm sạc, báo kết quả: node tools/ui-test/stop-auto.mjs [base]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5291';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const [kind, ev] of [['rest', 0], ['fuel', 0], ['charger', 1], ['rest', 1]]) {
  const p = await b.newPage({ viewport: { width: 430, height: 932 } });
  p.on('pageerror', (e) => { bad++; console.log('LỖI', kind, e.message); });
  await p.goto(`${base}/drive-test.html?stop=${kind}&stopauto=1${ev ? '&ev=1' : ''}`);
  await p.evaluate(() => { window.__rideStep = 1; });
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < 150000) { await new Promise((res) => setTimeout(res, 1000)); r = await p.evaluate(() => window.__stopResult ?? null); if (r) break; }
  console.log(kind, ev ? 'điện' : 'xăng', r ? JSON.stringify(r) : 'CHƯA XONG', `${Math.round((Date.now() - t0) / 1000)} s`);
  if (!r) bad++;
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
