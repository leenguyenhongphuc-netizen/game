// Chụp hoạt cảnh lên trò ở khu vui chơi: trọn một lượt (giữa mỗi giai đoạn, góc trong cabin) và bốn góc nhìn ở đoạn chính,
// ghi thời lượng từng trò, tên giai đoạn, số lần vẽ.
//   (cd web && npx vite --port 5221) rồi: node tools/ui-test/ride-views.mjs [thư mục ra] [park:ride,park:ride…]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] || 'tools/ui-test/out-rides';
const BASE = process.env.BASE || 'http://localhost:5221';
const RIDES = (process.argv[3] || 'park_mw_da_nang:cap_treo_doi,park_mw_da_nang:vong_quay_trang,park_mw_da_nang:tau_luon_sao_bang,park_mw_da_nang:thap_roi_mat_troi,park_mw_da_nang:lau_dai_bong_dem,park_mw_da_nang:xe_dung_ngan_ha,park_mw_da_nang:mang_truot_xoay,park_mw_da_nang:ho_song_bac,park_bw_nha_trang:song_luoi_dao').split(',');
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const res = {};
const shot = async (name) => pg.screenshot({ path: `${OUT}/${name}.png` });
for (const spec of RIDES) {
  const [park, ride] = spec.split(':');
  await pg.goto(`${BASE}/park-test.html?park=${park}&ride=${ride}`);
  await pg.waitForFunction(() => window.__rideCut, null, { timeout: 60000 });
  await pg.waitForTimeout(800);
  const phases = await pg.evaluate(() => window.__rideCut.phases());
  const total = phases[phases.length - 1].b;
  res[ride] = { total: Math.round(total * 10) / 10, phases: phases.map((p) => `${p.n} ${(p.b - p.a).toFixed(1)}s`), views: {} };
  // bốn góc ở giữa đoạn chính (giai đoạn dài nhất)
  const mainI = phases.reduce((m, p, i) => (p.b - p.a > phases[m].b - phases[m].a ? i : m), 0);
  for (const v of ['trong', 'theo', 'toan', 'dien_anh']) {
    await pg.evaluate(([v, t]) => { window.__rideCut.seek(t); window.__rideCut.setView(v); }, [v, (phases[mainI].a + phases[mainI].b) / 2]);
    await pg.waitForTimeout(1300);
    res[ride].views[v] = await pg.evaluate(() => window.__rideCut.info().calls);
    await shot(`${ride}-${v}`);
  }
  // giữa mỗi giai đoạn, ngồi trong
  for (let i = 0; i < phases.length; i++) {
    await pg.evaluate((t) => { window.__rideCut.setView('trong'); window.__rideCut.seek(t); }, phases[i].a + (phases[i].b - phases[i].a) * 0.35);
    await pg.waitForTimeout(700);
    await shot(`${ride}-pha${i}`);
  }
}
writeFileSync(`${OUT}/ket-qua.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { total: v.total, calls: v.views }]))));
console.log('loi', errs.slice(0, 8));
await b.close();
