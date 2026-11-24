// In thông số các vùng biển (tuyến tàu ra đảo, bãi thuê mô tô nước): thời gian dựng, tỉ lệ đất, luồng, phao, tàu bè.
// Chạy: node tools/sea-world-check.ts
import { buildFerryWorld, buildJetSkiWorld, pathLength } from '../web/src/sea/seaWorld.ts';
import { JETSKI_BEACHES, SEA_ROUTE_IDS, seaRoute } from '../shared/sea.ts';

for (const id of SEA_ROUTE_IDS) {
  const t = performance.now(), w = buildFerryWorld(seaRoute(id)!, true);
  let landN = 0; for (const v of w.land) if (v) landN++;
  const onLand = w.isLand(w.start.x, w.start.z) || w.isLand(w.goal.x, w.goal.z);
  console.log(`${id}: ${Math.round(performance.now() - t)} ms, lưới ${w.nx}×${w.nz}, đất ${Math.round((landN / w.land.length) * 100)}%, ${w.rings.length} vòng bờ,`,
    `luồng ${w.path.length} điểm ${Math.round(pathLength(w.path))} đv, bến đi (${w.start.x | 0}, ${w.start.z | 0}) → bến đến (${w.goal.x | 0}, ${w.goal.z | 0})${onLand ? ' ⚠ BẾN TRÊN ĐẤT' : ''},`,
    `${w.buoys.length} phao, tàu: ${w.lanes.map((l) => l.kind).join(',')}, ${w.karsts.length} đá vôi, ${w.rocks.length} đá ngầm`);
}
for (const b of JETSKI_BEACHES) {
  const t = performance.now(), w = buildJetSkiWorld(b);
  let landN = 0; for (const v of w.land) if (v) landN++;
  console.log(`${b.id}: ${Math.round(performance.now() - t)} ms, đất ${Math.round((landN / w.land.length) * 100)}%, xuất phát (${w.start.x | 0}, ${w.start.z | 0})${w.isLand(w.start.x, w.start.z) ? ' ⚠ TRÊN ĐẤT' : ''}, vùng phao ${JSON.stringify(w.zone && { cx: Math.round(w.zone.cx), cz: Math.round(w.zone.cz) })}, ${w.lanes.length} tàu, ${w.buoys.length} phao`);
}
