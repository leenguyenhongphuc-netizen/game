// Chụp ảnh một set tham quan (dọc: từng điểm dừng; ngang: toàn cảnh) và in số lần vẽ. node tools/ui-test/sight-shots.mjs <id> <thư mục> [số điểm dừng] [cổng]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [id, out, stops] = [process.argv[2], process.argv[3], Number(process.argv[4] ?? 5)];
const b = await chromium.launch();
for (const [vw, vh, tag] of [[393, 852, 'doc'], [852, 393, 'ngang']]) {
  const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const t0 = Date.now();
  await p.goto(`http://localhost:${process.argv[5] ?? 5190}/sight-test.html?id=${id}`);
  await p.waitForFunction(() => window.__sightScene, null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => { const sc = window.__sightScene; const r = sc.renderer; return { calls: r?.info?.render?.calls, tris: r?.info?.render?.triangles, walk: window.__walkInfo }; });
  console.log(id, tag, 'load', Date.now() - t0, 'ms', JSON.stringify(info), errs.join(' | '));
  await p.screenshot({ path: `${out}/${id}-${tag}-0.png` });
  if (tag === 'doc') for (let i = 0; i < stops; i++) {
    await p.evaluate((i) => { const sc = window.__sightScene; sc.dismiss?.(); sc.goto(i); }, i);
    await p.waitForTimeout(1800);
    const c = await p.evaluate(() => window.__sightScene.renderer?.info?.render?.calls);
    console.log(' stop', i, 'calls', c);
    await p.screenshot({ path: `${out}/${id}-${tag}-${i + 1}.png` });
  }
  await p.close();
}
await b.close();
