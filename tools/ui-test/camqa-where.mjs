// In vị trí (x, z) các khung bị camera-qa đánh lỗi cho một set: node tools/ui-test/camqa-where.mjs <id> [giây] [cổng]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [id, secs = '50', port = '5190'] = process.argv.slice(2);
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 393, height: 852 } });
await p.goto(`http://localhost:${port}/sight-test.html?id=${id}&auto=1&qa=1&speed=2`);
await p.waitForFunction(() => window.__camqa && window.__sightScene, null, { timeout: 120000 });
await p.waitForTimeout(Number(secs) * 1000);
console.log(JSON.stringify(await p.evaluate(() => window.__camqa.errors.map((e) => ({ x: +e.x.toFixed(1), z: +e.z.toFixed(1), err: e.err, occl: e.occl, cam: (() => { const c = window.__sightScene.camera; return c ? [+c.position.x.toFixed(1), +c.position.z.toFixed(1)] : null; })() })))));
await b.close();
