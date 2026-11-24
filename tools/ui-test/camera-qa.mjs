// Bài kiểm máy quay tham quan (BẮT BUỘC trước khi giao cảnh 3D tham quan / khu vui chơi):
// đi bộ tự động qua từng set, mỗi khung ghi góc quay, tỉ lệ màn hình bị vật chen giữa máy quay–nhân vật che, khoảng cách
// máy quay tới hình học gần nhất; báo lỗi + chụp ảnh khung lỗi.
//   node tools/ui-test/camera-qa.mjs [--base http://localhost:5190] [--ids dn_cu_lao_cham,park_mw_da_nang] [--secs 60] [--speed 2] [--out tools/ui-test/out-cam]
//   Đi theo lộ trình riêng thay vì tự đi dọc tuyến: --start 5 --route "16,10;14,27;22,27;19,40" (đứng ở điểm dừng 5 rồi lần lượt tự đi tới các điểm x,z).
// Ngưỡng: quay > 6°/khung (quy về 60 hình/giây) khi không kéo xoay, không mở thẻ; gầm mái: > 30% khung hình là mặt dưới mái/tán
// ở trên đầu; che > 30% điểm lưới có vật chen giữa máy quay và nhân vật; cắt: hình học gần ống kính hơn near.
// Cần Vite dev (trang sight-test.html chỉ có ở bản dev). Chromium giả lập không GPU: nhịp khung thấp, góc đã quy về 60 hình/giây.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:5190'), SECS = Number(arg('secs', '60')), SPEED = arg('speed', '2'), OUT = arg('out', 'tools/ui-test/out-cam');
const ALL = ['dn_hoi_an', 'dn_my_son', 'dn_cau_rong', 'dn_ngu_hanh_son', 'dn_ba_na', 'dn_son_tra', 'dn_cu_lao_cham', 'dn_hai_van', 'dn_my_khe', 'dn_thanh_ha', 'dn_bay_mau', 'dn_tam_thanh', 'qng_ly_son', 'park_mw_da_nang', 'park_bw_nha_trang', 'park_mw_ha_long'];
const IDS = (arg('ids', '') || ALL.join(',')).split(',').filter(Boolean), START = arg('start', ''), ROUTE = arg('route', '');
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch(), rows = [], md = ['# Kiểm máy quay tham quan', '', `Chromium giả lập (không GPU), ${new Date().toISOString()}, ${SECS} s mỗi set, tốc độ đi ×${SPEED}.`, '', '| Set | Khung | Đi (m) | Quay > 6° | Quay lớn nhất | Gầm mái > 30% (lớn nhất) | Che > 30% | Che TB | Cắt ống kính | Gần nhất | Ảnh |', '|---|---|---|---|---|---|---|---|---|---|---|'];
for (const id of IDS) {
  const p = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log(id, 'lỗi trang:', e.message));
  try {
    await p.goto(`${BASE}/sight-test.html?id=${id}${ROUTE ? '' : '&auto=1'}&qa=1&speed=${SPEED}`);
    await p.waitForFunction(() => window.__camqa && window.__sightScene, null, { timeout: 120000 });
    if (ROUTE) {
      await p.waitForTimeout(2500);
      await p.evaluate(({ start, route, speed }) => {
        const sc = window.__sightScene; sc.speedMul = Number(speed); if (start !== '') sc.goto(Number(start)); window.__camqa.frames.length = 0; window.__camqa.errors.length = 0;
        const pts = route.split(';').map((q) => q.split(',').map(Number)); let i = 0;
        const next = () => { if (i >= pts.length) { document.title = 'XONG'; return; } if (!sc.goal) { sc.dismiss?.(); sc.walkTo({ x: pts[i][0], z: pts[i][1] }); i++; } setTimeout(next, 400); };
        next();
      }, { start: START, route: ROUTE, speed: SPEED });
    }
    const shots = []; let seenErr = 0; const t0 = Date.now();
    while (Date.now() - t0 < SECS * 1000) {
      await p.waitForTimeout(700);
      const e = await p.evaluate(() => { const q = window.__camqa; return { n: q.errors.length, last: q.errors[q.errors.length - 1] ?? null, done: document.title === 'XONG' }; });
      if (e.n > seenErr && shots.length < 4) { const f = `${OUT}/${id}-${shots.length + 1}-${e.last.err.join('-')}.png`; await p.screenshot({ path: f }); shots.push(f); }
      seenErr = e.n; if (e.done) break;
    }
    const s = await p.evaluate(() => {
      const f = window.__camqa.frames, auto = f.filter((r) => !r.user && !r.card), occ = f.filter((r) => r.occl !== null), near = f.filter((r) => r.near !== null);
      return {
        frames: f.length, quay: auto.filter((r) => r.yaw60 > 6).length, maxYaw: Math.max(0, ...auto.map((r) => r.yaw60)),
        mai: occ.filter((r) => r.roof > 0.3).length, maiMax: Math.max(0, ...occ.map((r) => r.roof)),
        che: occ.filter((r) => r.occl > 0.3).length, cheTB: occ.reduce((a, r) => a + r.occl, 0) / Math.max(1, occ.length),
        cat: near.filter((r) => r.near < 0.3).length, gan: Math.min(9, ...near.map((r) => r.near)), di: f.slice(1).reduce((a, r, i) => a + Math.hypot(r.x - f[i].x, r.z - f[i].z), 0),
      };
    });
    rows.push({ id, ...s, shots });
    md.push(`| ${id} | ${s.frames} | ${Math.round(s.di)} | ${s.quay} | ${s.maxYaw.toFixed(1)}° | ${s.mai} (${(s.maiMax * 100).toFixed(0)}%) | ${s.che} | ${(s.cheTB * 100).toFixed(0)}% | ${s.cat} | ${s.gan.toFixed(2)} m | ${shots.map((x) => x.split('/').pop()).join(', ')} |`);
    console.log(id, JSON.stringify(s));
  } catch (e) { console.log(id, 'KHÔNG CHẠY ĐƯỢC', e.message.slice(0, 160)); rows.push({ id, fail: e.message }); md.push(`| ${id} | lỗi: ${e.message.slice(0, 60)} |||||||| `); }
  await p.close();
}
await b.close();
const bad = rows.filter((r) => r.fail || r.quay || r.mai || r.che || r.cat).length;
md.push('', bad ? `**${bad} set có lỗi máy quay.**` : '**Không set nào có lỗi máy quay.**');
writeFileSync(`${OUT}/report.md`, md.join('\n')); writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
console.log(`\n${bad} set có lỗi. Báo cáo: ${OUT}/report.md`);
