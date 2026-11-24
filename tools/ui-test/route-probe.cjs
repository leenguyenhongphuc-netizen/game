// Thử tìm đường trên lưới đi bộ giữa hai điểm.  node tools/ui-test/route-probe.cjs <base> <id> "x,y,z" "x,y,z"
const { chromium } = require('playwright');
(async () => {
  const [base, id, a, b] = process.argv.slice(2);
  const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: 393, height: 852 } });
  await p.goto(`${base}/sight-test.html?id=${id}`); await p.waitForFunction(() => window.__sightScene, null, { timeout: 180000 }); await p.waitForTimeout(2000);
  const r = await p.evaluate(([a, b]) => {
    const g = window.__sightScene.grid, V = (s) => { const [x, y, z] = s.split(',').map(Number); return { x, y, z, clone() { return { ...this }; } }; };
    const A = window.__sightScene.state.pos.clone(); const [ax, ay, az] = a.split(',').map(Number); A.set(ax, ay, az); const B = A.clone(); const [bx, by, bz] = b.split(',').map(Number); B.set(bx, by, bz);
    const t = g.nearest(bx, bz, by, 8); const route = g.route(A, t ?? B);
    const line = []; for (let i = 0; i <= 22; i++) { const x = ax + (bx - ax) * i / 22, z = az + (bz - az) * i / 22, id = g.cellLayer(x, z, 0.2, 1); line.push(id < 0 ? 'x' : (g.blocked[id] ? 'B' : '.')); }
    return { line: line.join(''), clear: g.clearLine(A, B), nearest: t && [t.x, t.y, t.z].map((v) => v.toFixed(1)), route: route ? route.length : null, fromH: g.height(ax, az, ay, 1.2), toH: g.height(bx, bz, by, 1.2), V: typeof V };
  }, [a, b]);
  console.log(JSON.stringify(r)); await br.close();
})();
