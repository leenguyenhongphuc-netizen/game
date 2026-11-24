// Chụp khu trạm dừng / cây xăng / trạm sạc và sân thi ở cùng góc để so trước–sau.
// node tools/ui-test/stop-shots.mjs <thư-mục-ra> [base=http://127.0.0.1:5291]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'tools/ui-test/out-stop', base = process.argv[3] ?? 'http://127.0.0.1:5291';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const W = 430, H = 932;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function stop(kind, ev) {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log('LỖI', kind, e.message));
  await p.goto(`${base}/drive-test.html?stop=${kind}${ev ? '&ev=1' : ''}`); await sleep(4500);
  const tag = kind + (ev ? '-ev' : '');
  await p.screenshot({ path: `${out}/${tag}-0-vao.png` });
  const ok = await p.evaluate((k) => { window.__rideStep = 1; return window.__stop.park(k); }, kind === 'rest' ? 'lot' : ev ? 'charger' : 'pump');
  for (let i = 0; i < 60; i++) { await sleep(400); const s = await p.evaluate(() => window.__stop.state().phase); if (s === 'parked') break; }
  await p.evaluate(() => { delete window.__rideStep; }); await sleep(1500); await p.screenshot({ path: `${out}/${tag}-1-do.png` });
  await p.evaluate(() => window.__stop.getOut()); await sleep(1500);
  await p.screenshot({ path: `${out}/${tag}-2-xuong.png` });
  const ov = await p.evaluate(() => { const s = window.__stop; if (!s.cam) return false; s.cam(true); return true; });
  if (ov) { await sleep(1200); await p.screenshot({ path: `${out}/${tag}-3-toan.png` }); }
  const info = await p.evaluate(() => (window.__stop.info ? window.__stop.info() : null));
  console.log(tag, ok, JSON.stringify(info));
  await p.close();
}
await stop('rest'); await stop('fuel'); await stop('charger', true);
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('LỖI exam', e.message));
await p.goto(`${base}/exam-test.html?cls=B`); await sleep(2500);
await p.screenshot({ path: `${out}/exam-0-intro.png` });
await p.getByText('Tập cả bài').click(); await sleep(4000);
await p.screenshot({ path: `${out}/exam-1-tren.png` });
await p.evaluate(() => window.__exam.view('sau')); await sleep(2500); await p.screenshot({ path: `${out}/exam-2-sau.png` });
await p.evaluate(() => window.__exam.view('bac')); await sleep(2500); await p.screenshot({ path: `${out}/exam-3-bac.png` });
await p.evaluate(() => { window.__exam.view('tren'); window.__exam.auto(); window.__rideStep = 1; }); await sleep(9000);
await p.screenshot({ path: `${out}/exam-4-chay.png` });
const ov = await p.evaluate(() => (window.__exam.overview ? (window.__exam.overview(), true) : false));
if (ov) { await sleep(1500); await p.screenshot({ path: `${out}/exam-5-toan.png` }); }
console.log('exam', JSON.stringify(await p.evaluate(() => { const s = window.__exam.state(); return { calls: s.calls, tri: s.triangles }; })));
await b.close();
