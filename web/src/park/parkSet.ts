// Dựng một khu vui chơi thành bộ cảnh đi bộ (SightSet): lối dạo chính uốn lượn từ cổng soát vé qua từng trò tới khu trò chơi và cổng ra.
// Mỗi trò đặt lệch sang một bên lối đi, mặt quay về lối; bên kia là quầy ăn uống, xe bóng bay, bồn hoa. Khu nước lát gạch xanh.
// Trục: z âm là hướng đi vào trong (bắc), x là ngang.
import * as THREE from 'three';
import type { Sight } from '../../../shared/sights.ts';
import { parkOfSight } from '../../../shared/parks.ts';
import type { Park, RideKind } from '../../../shared/parks.ts';
import { Kit, V, box, cone, cyl, forestMountain, label, lampPost, mountain, palm, tree } from '../sight/SightKit.ts';
import type { SightSet, SightStopAt } from '../sight/SightKit.ts';
import { arcadeHall, balloonCart, bumperArena, cableCar, coaster, dropTower, ferrisWheel, flowerBed, gate, hauntedHouse, kiosk, lazyRiver, slideTower, wavePool } from './ParkKit.ts';

export type ParkEnv = 'nui' | 'dao' | 'vinh';
const ENV: Record<string, ParkEnv> = { park_mw_da_nang: 'nui', park_bw_nha_trang: 'dao', park_mw_ha_long: 'vinh' };
/** Bề ngang chiếm dọc lối đi (m) và khoảng lệch tâm khỏi mép lối đi của từng loại trò. */
const FOOT: Record<RideKind, { along: number; off: number }> = {
  du_quay: { along: 34, off: 7 }, tau_luon: { along: 56, off: 17 }, thap_roi: { along: 22, off: 7 }, nha_ma: { along: 28, off: 12 },
  xe_dung: { along: 24, off: 9 }, mang_truot: { along: 22, off: 6 }, ho_song: { along: 36, off: 13 }, song_luoi: { along: 34, off: 16 }, cap_treo: { along: 24, off: 9 },
};
const HALF = 3;

export function parkSet(kit: Kit, sight: Sight): SightSet {
  const p = parkOfSight(sight.id) as Park, env = ENV[sight.id] ?? 'nui', r = kit.r, { main, accent, roof } = p.palette;
  // ---- nền, môi trường xung quanh
  kit.ground(env === 'dao' ? 0x9ccf7a : 0x86c26a, 1400);
  if (env === 'nui') {
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.9 + i * 0.32; kit.add(forestMountain(0x3f7a4e, Math.cos(a) * 420, Math.sin(a) * 380 - 120, 140 + r() * 60, 120 + r() * 120, r)); }
    kit.add(mountain(0x4d8c58, -320, -520, 220, 260, r));
  } else {
    // biển một phía (đông với Nha Trang, tây với Hạ Long), bờ cát
    const sx = env === 'dao' ? 1 : -1;
    kit.add(box(0xf4e6c0, sx * 86, -0.45, -150, 30, 1, 900)); kit.water(0x1f8fd0, sx * 460, -150, 760, 1400, -0.3, 0.9);
    if (env === 'vinh') for (let i = 0; i < 26; i++) { const x = -150 - r() * 600, z = -700 + r() * 1100, h = 40 + r() * 90; kit.add(cone(0x5f7a5a, x, h / 2 - 2, z, 14 + r() * 18, h), cone(0x4d6a4a, x + 6, h * 0.35, z + 4, 10 + r() * 8, h * 0.7)); }
    else for (let i = 0; i < 6; i++) kit.add(mountain(0x4d8c58, 320 + r() * 400, -600 + i * 220, 120 + r() * 80, 70 + r() * 80, r));
    kit.add(mountain(0x3f7a4e, -sx * 380, -500, 260, 200, r));
  }
  // ---- lối đi: đi lần lượt qua các điểm dừng
  type Item = { kind: 'gate' | 'ride' | 'arcade' | 'exit'; id: string; along: number; off: number; ride?: Park['rides'][number] };
  const items: Item[] = [{ kind: 'gate', id: 'cong_ve', along: 26, off: 0 },
    ...p.rides.map((x): Item => ({ kind: 'ride', id: x.id, ride: x, ...FOOT[x.kind] })),
    ...(p.arcade ? [{ kind: 'arcade', id: 'khu_tro_choi', along: 24, off: 9 } as Item] : []),
    { kind: 'exit', id: 'loi_ra', along: 16, off: 0 }];
  const path: THREE.Vector3[] = [V(0, 0, 64)], stops: SightStopAt[] = [];
  let z = 30, side = env === 'dao' ? -1 : 1;
  const wiggle = (i: number) => Math.sin(i * 1.25) * 8;
  items.forEach((it, i) => {
    const prevZ = z; z -= i === 0 ? 0 : (items[i - 1].along + it.along) / 2;
    const x = wiggle(i), at = V(x, 0, z);
    // điểm giữa hai điểm dừng để lối đi cong mềm
    if (i > 0) path.push(V((x + wiggle(i - 1)) / 2 + Math.sin(i) * 3, 0, (z + prevZ) / 2));
    path.push(at);
    // hướng lối đi tại điểm này và pháp tuyến
    const dirAng = 0; void dirAng;
    const cx = x + side * (HALF + it.off + 2), look = V(cx, 4, z);
    const face = side > 0 ? -Math.PI / 2 : Math.PI / 2; // quay mặt về lối đi (trục +z cục bộ hướng vào lối)
    const water = it.ride?.zone === 'nuoc';
    if (water) kit.add(box(0x9fd8e8, x + side * (HALF + it.off), 0.04, z, it.off * 2 + 4, 0.08, it.along));
    if (it.kind === 'gate') {
      gate(kit, x, z - 2, 0, p.name, main, accent, roof, p.chain);
      stops.push({ id: it.id, at: V(x, 0, z + 4), look: V(x, 8, z - 2), cam: V(x + 3, 3.2, z + 24) });
      return;
    }
    if (it.kind === 'exit') { kit.add(box(main, x, 4, z - 6, 10, 0.6, 1), cyl(main, x - 5, 2, z - 6, 0.4, 4), cyl(main, x + 5, 2, z - 6, 0.4, 4)); kit.live(label('Cổng ra · siêu thị đặc sản', x, 6, z - 6, '#7a4a22', 0.8)); stops.push({ id: it.id, at, look: V(x, 3, z - 6) }); return; }
    if (it.kind === 'arcade') { arcadeHall(kit, cx, z, face, main, accent); stops.push({ id: it.id, at, look }); side = -side; return; }
    const rd = it.ride!;
    let lookAt = look;
    switch (rd.kind) {
      case 'du_quay': { const w = ferrisWheel(kit, cx, z, Math.PI / 2, 15, main, accent); lookAt = w.hub; break; }
      case 'tau_luon': coaster(kit, cx, z, Math.PI / 2, 46, 26, 22, accent, main); lookAt = V(cx, 12, z); break;
      case 'thap_roi': dropTower(kit, cx, z, 46, main, accent, env === 'dao'); lookAt = V(cx, 26, z); break;
      case 'nha_ma': hauntedHouse(kit, cx, z, face, 0x4a3a5a, 0x2a1f3a, env === 'dao' ? 'tau' : env === 'vinh' ? 'hang' : 'lau_dai'); lookAt = V(cx, 6, z); break;
      case 'xe_dung': bumperArena(kit, cx, z, face, main, accent, rd.name); lookAt = V(cx, 2, z); break;
      case 'mang_truot': slideTower(kit, x + side * (HALF + 5), z, side > 0 ? Math.PI / 2 : -Math.PI / 2, [0xff8a3d, 0x2ec4b6, 0xffd23f, 0xe04a7a], env === 'dao' ? 4 : 2); lookAt = V(x + side * 10, 10, z); break;
      case 'ho_song': wavePool(kit, cx, z, face, 30, 20); lookAt = V(cx, 1, z); break;
      case 'song_luoi': lazyRiver(kit, cx, z, 12); lookAt = V(cx, 2, z); break;
      case 'cap_treo': {
        const to = env === 'nui' ? V(side * 260, 150, z - 420) : V(-side * 0 + (env === 'vinh' ? -520 : 520), 60, z - 260);
        cableCar(kit, cx, z, to, main, accent); lookAt = V(cx, 9, z); break;
      }
    }
    if (rd.kind !== 'xe_dung' && rd.kind !== 'nha_ma') kit.live(label(`${rd.emoji} ${rd.name}`, x + side * (HALF + 1.2), 4.6, z + 3, '#2a3f99', 0.7));
    // trò cao: đặt máy ảnh "bưu thiếp" lùi về phía bên kia lối đi, nâng cao để thấy trọn
    const big = rd.kind === 'du_quay' || rd.kind === 'tau_luon' || rd.kind === 'thap_roi' || rd.kind === 'cap_treo' || rd.kind === 'mang_truot';
    stops.push({ id: it.id, at, look: lookAt, ...(big ? { cam: V(x - side * (HALF + 2), rd.kind === 'tau_luon' ? 9 : 5, z + (rd.kind === 'du_quay' || rd.kind === 'tau_luon' ? 26 : 16)) } : {}) });
    side = -side;
  });
  path.push(V(wiggle(items.length) * 0.5, 0, z - 14));
  // lát lối đi: khu khô gạch đỏ cam, khu nước gạch xanh nhạt
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b), ang = Math.atan2(b.x - a.x, b.z - a.z);
    kit.add(box(0xd98a5a, mid.x, 0.02, mid.z, HALF * 2 + 0.6, 0.06, len + 0.6, ang), box(0xe8c9a0, mid.x, 0.05, mid.z, HALF * 2 - 1.4, 0.04, len + 0.2, ang));
  }
  // ---- dọc hai bên: đèn, cây, quầy ăn uống, bồn hoa, xe bóng bay (phía không có trò)
  const KIOSKS = ['Kem · nước mía', 'Bắp rang', 'Bánh mì', 'Nước dừa', 'Xúc xích', 'Trà sữa'];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = a.distanceTo(b), nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
    for (let k = 0; k < Math.floor(len / 9); k++) {
      const f = (k + 0.5) / Math.floor(len / 9), px = a.x + (b.x - a.x) * f, pz = a.z + (b.z - a.z) * f;
      for (const s of [-1, 1]) {
        kit.add(lampPost(px + nx * s * (HALF + 0.6), 0, pz + nz * s * (HALF + 0.6), 4, 0xfff3c4));
        if ((k + i) % 2) { const t2 = env === 'nui' ? tree(r, 0.8) : palm(r, 6); t2.position.set(px + nx * s * (HALF + 2.2), 0, pz + nz * s * (HALF + 2.2)); kit.add(t2); }
      }
    }
  }
  // quầy và trang trí đặt ở phía đối diện trò chơi của từng điểm dừng
  stops.forEach((st, i) => {
    if (i === 0) return;
    const sideOf = st.look ? Math.sign(st.look.x - st.at.x) || 1 : 1, ox = -sideOf * (HALF + 3.6);
    if (i % 3 === 1) kiosk(kit, st.at.x + ox, st.at.z + 6, sideOf > 0 ? Math.PI / 2 : -Math.PI / 2, [0xe2573c, 0x2ec4b6, 0xffd23f][i % 3], KIOSKS[i % KIOSKS.length]);
    else if (i % 3 === 2) balloonCart(kit, st.at.x + ox, st.at.z - 5);
    else flowerBed(kit, st.at.x + ox - sideOf, st.at.z, 3, 6);
  });
  // quảng trường trước cổng: bồn hoa, cột cờ chuỗi
  flowerBed(kit, -9, 40, 6, 3); flowerBed(kit, 9, 40, 6, 3);
  return {
    path, half: HALF, stops, npcs: 16, startYaw: 0,
    sky: env === 'vinh' ? [0x6fa8d8, 0xe6f0f4] : [0x2f94ee, 0xdff3fb], fog: env === 'vinh' ? [0xdfe8ec, 180, 1100] : [0xd6eef8, 220, 1300],
    light: { ambient: 1.6, sun: 1.9, sunColor: 0xfff6dc, sunDir: [0.4, 1, 0.3] },
    shopSpots: stops.slice(1, -1).filter((_, i) => i % 3 === 0).map((s) => V(s.at.x + (s.look && s.look.x > s.at.x ? -1 : 1) * (HALF + 3), 0, s.at.z - 3)),
  };
}
