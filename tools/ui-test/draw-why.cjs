// Liệt kê vật đang hiện (lưới, sprite, điểm) theo cha trực tiếp để biết lần vẽ đến từ đâu.  node tools/ui-test/draw-why.cjs <url> <điểm dừng>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  await p.goto(process.argv[2]); await p.waitForFunction(() => window.__sightScene, null, { timeout: 180000 }); await p.waitForTimeout(2500);
  await p.evaluate((k) => { const sc = window.__sightScene; sc.dismiss?.(); sc.goto(k); }, Number(process.argv[3] ?? 0)); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const sc = window.__sightScene, out = {}; let n = 0;
    sc.scene.traverseVisible((o) => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isInstancedMesh)) return; n++; const pp = o.parent?.parent; const k = (o.isSprite ? 'sprite' : o.isPoints ? 'points' : o.isInstancedMesh ? 'inst' : 'mesh') + ':' + (o.parent?.type) + '@' + (o.parent ? o.parent.position.toArray().map((v) => v.toFixed(0)).join(',') : '') + ' gp ' + (pp ? pp.type + '@' + pp.position.toArray().map((v) => v.toFixed(0)).join(',') : '-'); out[k] = (out[k] || 0) + 1; });
    return { n, calls: sc.info().calls, out };
  });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
