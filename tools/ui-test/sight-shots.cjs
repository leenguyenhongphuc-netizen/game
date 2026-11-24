// Chụp nhanh một bộ cảnh tham quan: mọi điểm dừng ở màn dọc + một ảnh màn ngang, in số lần vẽ lớn nhất và thời gian dựng.
//   node tools/ui-test/sight-shots.cjs nt_kon_klor,nt_ky_co [thư mục ảnh] [--base http://localhost:5190]
// Cần Vite dev (trang sight-test.html chỉ có ở bản dev). Chromium giả lập không GPU.
const { chromium } = require('playwright');
const ids = process.argv[2].split(','), out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'tools/ui-test/out-sight';
const bi = process.argv.indexOf('--base'), BASE = bi > 0 ? process.argv[bi + 1] : 'http://localhost:5190';
require('node:fs').mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const id of ids) {
    for (const [w, h, tag] of [[393, 852, 'doc'], [852, 393, 'ngang']]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      const t0 = Date.now();
      await p.goto(`${BASE}/sight-test.html?id=${id}`);
      await p.waitForFunction(() => window.__sightScene, null, { timeout: 180000 });
      const ready = Date.now() - t0;
      await p.waitForTimeout(2500);
      const n = tag === 'doc' ? 5 : 1;
      let maxCalls = 0;
      for (let i = 0; i < n; i++) {
        if (tag === 'doc') { await p.evaluate((k) => { const sc = window.__sightScene; sc.dismiss?.(); sc.goto(k); }, i); await p.waitForTimeout(2200); }
        const info = await p.evaluate(async () => { const a = []; for (let k = 0; k < 8; k++) { await new Promise((r) => setTimeout(r, 150)); a.push(window.__sightScene.info().calls); } a.sort((x, y) => x - y); return { calls: a[4] }; });
        maxCalls = Math.max(maxCalls, info.calls); process.stdout.write(`[${i}:${info.calls}] `);
        await p.screenshot({ path: `${out}/${id}-${tag}-${i}.png` });
      }
      console.log(id, tag, 'san sang', ready, 'ms, lan ve lon nhat', maxCalls, errs.length ? 'LOI: ' + errs.join(' | ') : '');
      await p.close();
    }
  }
  await b.close();
})();
