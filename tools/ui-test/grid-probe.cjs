// In cao độ lưới đi bộ (và đã loang tới chưa) tại các điểm trên một đoạn thẳng.  node tools/ui-test/grid-probe.cjs <base> <id> "x,y,z;x,y,z" [n]
const { chromium } = require('playwright');
(async () => {
  const [base, id, seg, n = '12'] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  await p.goto(`${base}/sight-test.html?id=${id}`); await p.waitForFunction(() => window.__sightScene, null, { timeout: 180000 }); await p.waitForTimeout(2000);
  const out = await p.evaluate(([seg, n]) => {
    const [a, b] = seg.split(';').map((q) => q.split(',').map(Number)), g = window.__sightScene.grid, rows = [];
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t; rows.push([x.toFixed(1), y.toFixed(1), z.toFixed(1), String(g.height(x, z, y, 1.2)), String(g.canStep(x, z, y))].join(' ')); }
    return rows.concat([JSON.stringify(window.__walkInfo)]);
  }, [seg, Number(n)]);
  console.log(out.join('\n')); await b.close();
})();
