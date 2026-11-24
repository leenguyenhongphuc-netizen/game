// Nhà rông Kon Klor, Kon Tum (nay thuộc Quảng Ngãi). Trục x: tây → đông; trục z: bắc → nam.
// Sông Đắk Bla chảy tây → đông ở giữa cảnh. Khách từ phía thành phố (bắc) qua cầu treo Kon Klor sang làng Ba Na ở bờ nam:
// bến sông có thuyền độc mộc, sân lễ có cây nêu, nhà rông mái lưỡi rìu và các nhà sàn quanh làng.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, grp, label, person, signPost, strip, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { rongHouse, stiltHouse, suspensionBridge } from './nt_common.ts';
import { baked } from './_extra.ts';

const GRASS = 0x8ab45e, SOIL = 0xb26a42, RIVER = 0x6f8f6a, WATER = 0x6a9a8a;
/** Cây nêu lễ hội: cột cao chạm khắc, tua lá, chim gỗ trên đỉnh, các cành ngang treo vật lễ. */
function neu(): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0x8a6a48, 0, 5, 0, 0.18, 10), cone(0x8a6a48, 0, 10.6, 0, 0.3, 1.2), ball(0x2a1a12, 0, 11.3, 0, 0.35, 0.2, 0.7));
  for (let i = 0; i < 4; i++) { const y = 4 + i * 1.6; g.add(box([0xb8322a, 0xf4ead0, 0x2a1a12, 0xd9a83a][i], 0, y, 0, 0.42, 0.5, 0.42)); const b = box(0x7a5a3c, 0, y + 0.6, 0, 2.6 - i * 0.4, 0.08, 0.08); b.rotation.y = i * 0.8; g.add(b); }
  for (let i = 0; i < 8; i++) { const a = i * 0.785; g.add(box(0xd9c27a, Math.cos(a) * 0.5, 8.4, Math.sin(a) * 0.5, 0.06, 2.4, 0.2).rotateZ(Math.cos(a) * 0.4)); }
  return g;
}
function canoe(): THREE.Group { return grp(0, 0, 0, 0, ball(0x5a3d26, 0, 0, 0, 0.55, 0.3, 3.6), box(0x3a2a1a, 0, 0.2, 0, 0.7, 0.06, 6), person(4, 1, 0x3a5a7a).translateY(0.05).translateZ(-1.6)); }

export function konKlor(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  // nền hai bờ, lòng sông thấp hẳn để không đi xuống nước
  kit.add(box(GRASS, 0, -0.5, -230, 900, 1, 400), box(GRASS, 0, -0.5, 270, 900, 1, 460));
  kit.add(box(RIVER, 0, -3.2, 5, 900, 1, 72)); kit.water(WATER, 0, 5, 900, 72, -0.55, 0.92);
  for (const z of [-27, 37]) kit.add(box(0xa58a5a, 0, -0.7, z, 900, 1.2, 6, 0)); // bờ cát dốc
  for (let i = 0; i < 60; i++) kit.add(ball(0x8c8a80, -200 + r() * 400, -0.6, (r() < 0.5 ? -27 : 37) + (r() - 0.5) * 4, 0.6 + r(), 0.4, 0.6 + r()));
  // cầu treo Kon Klor: dài ~292 m ngoài đời, ở đây thu gọn còn 64 m nhịp chính; trụ trắng, dây văng thép
  kit.add(strip(0xc9c2b4, V(0, 0, -56), V(0, 1.3, -36), 4.5, 0.4), strip(0xc9c2b4, V(0, 1.3, 46), V(0, 0, 64), 4.5, 0.4));
  suspensionBridge(kit, V(0, 1.3, -36), V(0, 1.3, 46), 4.5, 13);
  kit.live(label('Cầu treo Kon Klor', 0, 17, 5, '#2d6f73', 1.0));
  // thuyền độc mộc trôi chậm trên sông
  const boats = [0, 1, 2].map((i) => { const c = canoe(); c.rotation.y = Math.PI / 2; const b = baked(grp(-60 + i * 50, -0.4, -12 + i * 12, 0, c)); kit.live(b); return b; });
  kit.onTick((t) => boats.forEach((b, i) => { b.position.x = -120 + ((t * (2 + i) + i * 70) % 240); b.position.y = -0.42 + Math.sin(t * 1.4 + i) * 0.04; }));
  // ---- bờ bắc: phố Kon Tum, hàng cây, quán nước bên đầu cầu
  for (let i = 0; i < 16; i++) { const x = -150 + i * 20 + r() * 6; if (Math.abs(x) < 14) continue; const c = [0xf1e3b8, 0xd9e6ee, 0xe9d2c0, 0xf4f1ea][i % 4]; kit.add(box(c, x, 3 + (i % 3), -110 - r() * 20, 9, 6 + (i % 3) * 2, 10), box(0xb8452e, x, 6.4 + (i % 3) * 2, -110, 10, 0.4, 11)); }
  for (let x = -120; x <= 120; x += 12) if (Math.abs(x) > 8) { const t = tree(r, 1.3 + r() * 0.6, r() < 0.5); t.position.set(x, 0, -60 - r() * 8); kit.add(t); }
  kit.add(box(0x5a5d62, 0, 0.02, -80, 900, 0.08, 10)); // đường ven sông
  kit.add(signPost('Cầu treo Kon Klor', 5, 0, -62, '#2d6f73', 1));
  // ---- bờ nam: làng Ba Na Kon Klor
  kit.add(box(SOIL, 12, 0.03, 80, 40, 0.06, 26)); kit.add(box(0xa58a5a, -14, 0.03, 46, 10, 0.06, 6)); // sân đất đỏ trước nhà rông
  const rong = rongHouse(17, 6, 18); rong.position.set(12, 0, 100); rong.rotation.y = Math.PI; kit.add(rong);
  kit.live(label('Nhà rông Kon Klor', 12, 25, 100, '#9c4a32', 1.0));
  const n = neu(); n.position.set(12, 0, 78); kit.add(n);
  // chiêng treo, ché rượu cần, người đánh chiêng xếp vòng quanh cây nêu
  for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28, p = person(i, 0, [0x2a1a12, 0xb8322a, 0x1f1f1f][i % 3]); p.position.set(12 + Math.cos(a) * 5, 0, 78 + Math.sin(a) * 5); p.rotation.y = -a + Math.PI / 2; p.add(cyl(0xd9a83a, 0.35, 1.1, 0.25, 0.32, 0.06).rotateX(Math.PI / 2)); kit.add(p); }
  for (let i = 0; i < 5; i++) kit.add(grp(4 + i * 1.2, 0, 86, 0, cyl(0x6a4a32, 0, 0.45, 0, 0.32, 0.9), ball(0x6a4a32, 0, 0.9, 0, 0.3, 0.2, 0.3), cyl(0xd9c27a, 0.15, 1.5, 0, 0.02, 1.2)));
  const houses: [number, number, number][] = [[44, 96, 0.2], [52, 118, -0.3], [-24, 104, 0.4], [-36, 86, 0], [34, 132, 0.1], [-14, 132, -0.2], [62, 90, 0.5]];
  for (const [x, z, ry] of houses) { const h = stiltHouse(10 + r() * 3, 5.5, r() < 0.5 ? 0x8a6a3a : 0x6f5a3a); h.position.set(x, 0, z); h.rotation.y = ry; kit.add(h); }
  // khung dệt thổ cẩm, gùi, đống củi dưới gầm sàn
  kit.add(grp(40, 0, 90, 0, box(0x7a5a3c, 0, 0.5, 0, 1.6, 1, 0.1), box(0xb8322a, 0, 0.6, 0.1, 1.2, 0.5, 0.02), box(0x2a1a12, 0, 0.75, 0.12, 1.2, 0.08, 0.02), person(1, 0, 0x2a1a12).translateZ(0.8).translateY(-0.6)));
  for (let i = 0; i < 6; i++) kit.add(cone(0xc9a36a, 46 + i * 0.9, 0.45, 100, 0.32, 0.9).rotateX(Math.PI));
  for (let i = 0; i < 4; i++) kit.add(cyl(0x7a5a3c, 50, 0.2 + i * 0.25, 116 + i * 0.3, 0.12, 2.2).rotateZ(Math.PI / 2));
  // tre, chuối, cà phê quanh làng; núi xa phía nam
  for (let i = 0; i < 160; i++) {
    const x = -200 + r() * 400, z = 64 + r() * 190; if (Math.abs(x - 8) < 42 && z < 126) continue; if (houses.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 9)) continue; if (Math.abs(x) < 5) continue;
    if (r() < 0.35) { const b = grp(x, 0, z); for (let k = 0; k < 6; k++) { const c = cyl(0x6f9a3a, (r() - 0.5) * 1.2, 4, (r() - 0.5) * 1.2, 0.08, 8); c.rotation.z = (r() - 0.5) * 0.4; b.add(c); } b.add(ball(0x5f8a3a, 0, 8, 0, 2.4, 1.6, 2.4)); kit.add(b); }
    else if (r() < 0.5) kit.add(grp(x, 0, z, r() * 6, ball(0x3f7a3a, 0, 0.9, 0, 1.1, 0.9, 1.1), bead(0xb8322a, 0.5, 1.2, 0.3, 0.08), bead(0xb8322a, -0.4, 1.0, 0.5, 0.08)));
    else { const t = tree(r, 1.2 + r(), r() < 0.6); t.position.set(x, 0, z); kit.add(t); }
  }
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + (i / 8) * 0.7); kit.add(forestMountain(i % 2 ? 0x4f8362 : 0x5d8f6a, Math.cos(a) * 340, 120 + Math.sin(a) * 280, 90 + r() * 40, 60 + r() * 50, r)); }
  for (let i = 0; i < 6; i++) kit.add(forestMountain(0x6a9c70, -300 + i * 120, -360, 90, 40 + r() * 30, r));
  kit.add(signPost('Làng Kon Klor', -6, 0, 70, '#9c4a32', 0.9));
  void bead;

  const path = [V(0, 0, -76), V(0, 0, -58), V(0, 1.3, -36), V(0, 1.3, 5), V(0, 1.3, 46), V(0, 0, 66), V(-12, 0, 62), V(-14, 0, 48), V(-4, 0, 72), V(8, 0, 70), V(24, 0, 84), V(36, 0, 92)];
  return {
    path, half: 2.1, npcs: 10, startYaw: 0,
    stops: [
      { id: 'cau_treo', at: V(0, 1.3, -10), look: V(0, 10, 30) },
      { id: 'song_dak_bla', at: V(-14, 0, 48), look: V(-40, -0.4, 10) },
      { id: 'nha_rong', at: V(24, 0, 86), look: V(12, 11, 100), cam: V(34, 5, 64) },
      { id: 'cot_le', at: V(-2, 0, 72), look: V(12, 5, 78) },
      { id: 'nha_san', at: V(36, 0, 92), look: V(44, 3, 96), cam: V(26, 6, 78) },
    ],
    sky: [0x7fbce8, 0xf4ecd8], fog: [0xe4e8d8, 80, 460],
    light: { ambient: 1.55, sun: 1.6, sunColor: 0xffe6c0, sunDir: [-0.6, 0.7, -0.4] },
    shopSpots: [V(-6, 0, -68), V(-10, 0, 82), V(28, 0, 84)],
  };
}
