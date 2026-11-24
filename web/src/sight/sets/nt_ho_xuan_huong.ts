// Hồ Xuân Hương, trung tâm Đà Lạt, Lâm Đồng. Trục x: tây → đông; z: bắc → nam.
// Hồ hình trăng lưỡi liềm chạy tây bắc – đông nam. Khách bắt đầu ở quảng trường Lâm Viên (bờ nam) với nụ hoa dã quỳ và bông
// atiso kính màu, đi lối dạo bờ hồ hàng thông, qua bến thuyền thiên nga, nhà hàng Thủy Tạ trên cột giữa nước, tới chợ Đà Lạt ở đầu tây.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cone, cyl, gable, glow, grp, label, lampPost, person, strip } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { baked } from './_extra.ts';
import { pine } from './nt_common.ts';

const GRASS = 0x7fae5a, WALK = 0xd9c8b0, ROOF = [0xb8452e, 0x8a3a2a, 0x3f5f7a, 0xd2702e];
function swanBoat(c: number) { return grp(0, 0, 0, 0, ball(0xf4f1ea, 0, 0.5, 0, 1.2, 0.6, 1.8), cyl(0xf4f1ea, 0, 1.4, -1.3, 0.18, 1.6), ball(0xf4f1ea, 0, 2.2, -1.1, 0.3), cone(0xf2a020, 0, 2.2, -0.7, 0.1, 0.4).rotateX(Math.PI / 2), box(c, 0, 1.2, 0.4, 1.6, 0.1, 1.6)); }
export function hoXuanHuong(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  // nền: lòng hồ trăng lưỡi liềm (các đoạn elip nối nhau), bờ cỏ cao hơn mặt nước 0,8 m
  const lake = [[-60, -40, 34, 22], [-20, -14, 40, 24], [24, 6, 38, 22], [64, 30, 30, 18]] as const;
  kit.add(box(GRASS, 0, -0.5, -170, 600, 1, 200), box(GRASS, 0, -0.5, 180, 600, 1, 200), box(GRASS, -230, -0.5, 0, 140, 1, 160), box(GRASS, 230, -0.5, 0, 140, 1, 160));
  // vùng giữa có hồ: ô cỏ 4 m rải theo lưới, bỏ những ô nằm trong lòng hồ
  for (let x = -158; x < 160; x += 4) for (let z = -78; z < 80; z += 4) { if (lake.some(([cx, cz, rx, rz]) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1)) continue; kit.add(box(GRASS, x, -0.5, z, 4.02, 1, 4.02)); }
  kit.add(box(0x4a5a4a, 0, -3, 0, 320, 1, 160)); kit.water(0x5a8fa0, 0, 0, 320, 160, -0.8, 0.9);
  // lối dạo quanh bờ nam và tây, đèn đường, ghế đá; hàng thông và liễu ven hồ
  const walk = [V(70, 0, 66), V(40, 0, 42), V(6, 0, 34), V(-26, 0, 16), V(-56, 0, -2), V(-86, 0, -18), V(-100, 0, -40), V(-96, 0, -66)];
  for (let i = 0; i < walk.length - 1; i++) kit.add(strip(WALK, walk[i], walk[i + 1], 3.4, 0.08, 0.02));
  for (let i = 0; i < walk.length - 1; i++) { const m = walk[i].clone().lerp(walk[i + 1], 0.5); kit.add(lampPost(m.x + 2.4, 0, m.z + 2.4, 4, 0xfff0c4)); }
  for (let i = 0; i < 90; i++) { const x = -150 + r() * 300, z = -90 + r() * 190; if (lake.some(([cx, cz, rx, rz]) => ((x - cx) / (rx + 6)) ** 2 + ((z - cz) / (rz + 6)) ** 2 < 1)) continue; if (walk.some((w) => Math.hypot(w.x - x, w.z - z) < 6)) continue; if (Math.hypot(x - 60, z - 80) < 30) continue; const p = pine(r, 12 + r() * 8); p.position.set(x, 0, z); kit.add(p); }
  // quảng trường Lâm Viên bờ nam: sân lát đá, nụ hoa dã quỳ vàng, bông atiso kính xanh
  kit.add(cyl(0xcfc8b8, 60, 0.15, 84, 26, 0.3, 18));
  kit.add(grp(50, 0.3, 84, 0, cone(0xf2c14e, 0, 5, 0, 3.4, 10), cone(0xe8a83a, 0, 3, 0, 4.6, 6), ...[0, 1, 2, 3, 4, 5].map((i) => box(0x5f8a3a, Math.cos(i) * 3.6, 1.6, Math.sin(i) * 3.6, 0.6, 3.2, 1.4, i))));
  const ati = grp(72, 0.3, 84);
  for (let k = 0; k < 5; k++) for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28 + k * 0.3, rr = 7 - k * 1.2; const pt = box(k % 2 ? 0x4fa36a : 0x2f7d5a, Math.cos(a) * rr, 1 + k * 1.6, Math.sin(a) * rr, 2.4, 0.3, 3.2, -a); pt.rotation.x = 0.6; ati.add(pt); }
  ati.add(ball(0x2f7d5a, 0, 8.6, 0, 2.4, 2, 2.4)); kit.add(ati);
  kit.live(label('Quảng trường Lâm Viên', 60, 14, 84, '#2f5d3a', 1.0));
  // bến thuyền thiên nga
  kit.add(box(0x8a6a48, 4, 0.1, 30, 14, 0.3, 4));
  const swans = [0, 1, 2, 3, 4].map((i) => { const b = baked(swanBoat([0xe2573c, 0x2a6fbf, 0xffd23f, 0x18a558, 0xff8fc8][i])); kit.live(b); return b; });
  kit.onTick((t) => swans.forEach((b, i) => { const a = t * 0.05 + i * 1.2; b.position.set(-20 + Math.cos(a) * 30, -0.8 + Math.sin(t * 1.5 + i) * 0.05, -10 + Math.sin(a) * 14); b.rotation.y = -a; }));
  // nhà hàng Thủy Tạ: nhà mái ngói trên hàng cột giữa nước, cầu gỗ nối bờ
  const TX = -40, TZ = 6;
  for (let i = 0; i < 12; i++) kit.add(cyl(0xf4f1ea, TX - 6 + (i % 4) * 4, -0.3, TZ - 4 + Math.floor(i / 4) * 4, 0.3, 2));
  kit.add(box(0xf4f1ea, TX, 0.9, TZ, 16, 0.4, 12), box(0xf1e3b8, TX, 2.6, TZ, 14, 3, 10), gable(ROOF[0], TX, 4.1, TZ, 11, 2.4, 15.4, Math.PI / 2), strip(0x8a6a48, V(TX, 0.9, TZ + 6), V(-34, 0, 24), 2.4, 0.2));
  for (let i = 0; i < 6; i++) kit.add(box(glow(0xfff0c4), TX - 5 + i * 2, 2.8, TZ + 5.02, 1, 1.2, 0.05));
  kit.live(label('Nhà hàng Thủy Tạ', TX, 9, TZ, '#7a4a22', 0.9));
  // chợ Đà Lạt ở đầu tây: khối nhà chợ lớn, bậc thang, quầy dâu tây và atiso
  kit.add(box(0xe9e2d0, -120, 5, -60, 40, 10, 20), box(0x9fb4c0, -120, 10.4, -60, 41, 0.8, 21), box(0x3f5f7a, -120, 6, -49.9, 30, 3, 0.2));
  kit.live(label('Chợ Đà Lạt', -120, 15, -60, '#d2301e', 1.0));
  for (let i = 0; i < 6; i++) kit.add(grp(-106 + i * 4, 0, -44, 0, box(0x8a6a48, 0, 0.6, 0, 3, 1.2, 1.6), ...[0, 1, 2, 3].map((k) => ball(i % 2 ? 0xd2301e : 0x5f8a3a, -1 + k * 0.66, 1.3, 0, 0.3, 0.2, 0.5)), box(0xe2573c, 0, 2.6, 0, 3.4, 0.1, 2.2), cyl(0x8a8a8a, 0, 1.9, 0, 0.04, 1.4)));
  for (let i = 0; i < 8; i++) { const p = person(i, i % 4 === 0 ? 1 : 2, [0x9b7fd6, 0x4aa3d8, 0xe2573c, 0xffd23f][i % 4]); p.position.set(-110 + i * 3, 0, -38 + (i % 2) * 2); kit.add(p); }
  // nhà biệt thự, khách sạn mái dốc trên đồi xung quanh
  for (let i = 0; i < 26; i++) { const a = (i / 26) * 6.28, x = Math.cos(a) * 190, z = Math.sin(a) * 120, h = 6 + r() * 8; kit.add(box([0xf4f1ea, 0xf1e3b8, 0xd9e6ee, 0xe9d2c0][i % 4], x, h / 2 + 4, z, 12, h, 10), gable(ROOF[i % 4], x, h + 4, z, 13, 4, 11, Math.PI / 2), box(GRASS, x, 1.5, z, 16, 5, 14)); }
  for (let i = 0; i < 10; i++) { const p = person(i + 3, i % 3 === 0 ? 2 : 0, [0x7ccf4f, 0xf29bc0, 0x4aa3d8][i % 3]); p.position.set(walk[i % 7].x + 1.2, 0, walk[i % 7].z - 1); kit.add(p); }

  const path = [V(62, 0.3, 70), V(70, 0, 66), V(40, 0, 42), V(6, 0, 34), V(-26, 0, 16), V(-34, 0, 24), V(-26, 0, 16), V(-56, 0, -2), V(-86, 0, -18), V(-100, 0, -40), V(-108, 0, -44)];
  return {
    path, half: 1.7, npcs: 12, startYaw: -0.6,
    stops: [
      { id: 'quang_truong', at: V(62, 0.3, 72), look: V(62, 5, 84), cam: V(64, 8, 52) },
      { id: 'bo_ho', at: V(40, 0, 42), look: V(0, 0, 0) },
      { id: 'thien_nga', at: V(6, 0, 33), look: V(-20, -0.5, -10) },
      { id: 'thuy_ta', at: V(-32, 0, 22), look: V(TX, 3, TZ) },
      { id: 'cho_da_lat', at: V(-106, 0, -42), look: V(-120, 6, -60), cam: V(-92, 8, -24) },
    ],
    sky: [0x8fc4ea, 0xf2f0e6], fog: [0xe4ece6, 90, 520],
    light: { ambient: 1.6, sun: 1.5, sunColor: 0xfff2dc, sunDir: [0.5, 0.8, 0.4] },
    shopSpots: [V(52, 0.3, 70), V(-14, 0, 30), V(-96, 0, -30)],
  };
}
