// Thử đi bộ trong một cảnh tham quan: đứng ở điểm dừng rồi tự đi tới (x, z), in vị trí sau mỗi giây.
//   node tools/ui-test/walk-probe.cjs <base> <id> <điểm dừng> <x> <z>
const { chromium } = require('playwright');
(async () => {
  const [base, id, stop, x, z] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  await p.goto(`${base}/sight-test.html?id=${id}&speed=3`); await p.waitForFunction(() => window.__sightScene, null, { timeout: 180000 }); await p.waitForTimeout(2500);
  await p.evaluate(([s, x, z]) => { const sc = window.__sightScene; sc.dismiss?.(); sc.goto(Number(s)); setTimeout(() => { sc.dismiss?.(); sc.walkTo({ x: Number(x), z: Number(z), y: 0.5 }); }, 1500); }, [stop, x, z]);
  for (let i = 0; i < 14; i++) { await p.waitForTimeout(1000); console.log(await p.evaluate(() => { const q = window.__sightScene.pos(); return [q.x.toFixed(1), q.y.toFixed(1), q.z.toFixed(1), !!window.__sightScene.goal].join(' '); })); }
  await p.screenshot({ path: '/tmp/claude-0/-home-user-game/1e835db3-e7fb-5289-b635-675a73176ff9/scratchpad/v4/probe.png' }); await b.close();
})();
