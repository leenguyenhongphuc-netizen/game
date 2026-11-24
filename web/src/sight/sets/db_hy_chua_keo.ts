// Chùa Keo (Thần Quang tự), Vũ Thư, Hưng Yên (Thái Bình cũ). Trục x: tây → đông; z: bắc → nam.
// Hồ sen và tam quan (nam) → khu chùa thờ Phật → khu đền thờ Thánh (Thiền sư Không Lộ) → gác chuông ba tầng gỗ ở cuối trục.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, glow, grp, incenseUrn, label, person, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { RED, STONE, TILE, WOOD, banyan, bamboo, hall, landWithLakes, lotus, northRoof, tamQuan } from './db__kit.ts';

export function chuaKeo(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  const HO = { x: 76, z: 112, rx: 30, rz: 16 }; // hồ sen bên phải lối vào
  landWithLakes(kit, -220, -220, 220, 220, [HO], 0x86a85e, { kerb: 0x9a8f7a, water: 0x4f8f7a });
  lotus(kit, HO, 40, r);
  kit.add(box(0xc9b89a, 0, 0.03, 40, 8, 0.06, 220));
  for (const s of [-1, 1]) kit.add(box(0xe8dcc0, s * 34, 1.1, 5.5, 0.8, 2.2, 181), box(TILE, s * 34, 2.3, 5.5, 1.3, 0.3, 181));
  kit.add(tamQuan(0, 96, 0, 6));
  // khu chùa Phật: tiền đường, thiêu hương, thượng điện nối nhau kiểu chữ công
  kit.add(hall(0, 60, 20, 8, 3.6, 0), hall(0, 44, 12, 7, 3.4, 0, { lit: true }), hall(0, 28, 16, 8, 3.8, 0, { twoTier: true, lit: true }));
  // khu đền thờ Thánh
  kit.add(hall(0, -4, 20, 8, 3.6, 0, { lit: true }), hall(0, -22, 14, 8, 3.8, 0, { twoTier: true, lit: true }));
  for (const s of [-1, 1]) kit.add(hall(s * 24, 20, 6, 70, 3, 0)); // hành lang hai bên
  const urn = incenseUrn(); urn.position.set(0, 0, 76); kit.add(urn);
  for (let i = 0; i < 12; i++) kit.add(bead(glow(0xff6a3a), -10 + i * 1.8, 4.2, 23.4, 0.24, 0.3, 0.24));
  // gác chuông ba tầng mười hai mái, khung gỗ lim
  const GZ = -56, gc = grp(0, 0, GZ);
  gc.add(box(STONE, 0, 0.4, 0, 12, 0.8, 12));
  const tier = (y: number, w: number, h: number) => { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) gc.add(cyl(WOOD, x * w * 0.42, y + h / 2, z * w * 0.42, 0.22, h)); gc.add(box(0x7a4a2a, 0, y + h * 0.55, 0, w * 0.7, h * 0.7, w * 0.7)); for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) gc.add(box(0x3a2216, sx * w * 0.351, y + h * 0.55, sz * w * 0.351, sx ? 0.03 : w * 0.5, h * 0.5, sz ? 0.03 : w * 0.5)); gc.add(northRoof(0, y + h, 0, w + 1.4, w + 1.4, 1.1, TILE)); };
  tier(0.8, 8, 3.2); tier(5.2, 6.4, 2.6); tier(9.0, 5, 2.4);
  gc.add(cyl(0x6a5a2a, 0, 7.6, 0, 0.7, 1.2), ball(0x6a5a2a, 0, 8.2, 0, 0.7, 0.4, 0.7));
  // khung gỗ tầng một mở để thấy cột, trừ lối đi phía trước
  kit.add(gc);
  for (const [x, z] of [[-14, 86], [16, 80], [-18, -40], [18, -44]] as const) { const t = banyan(r, 0.6 + r() * 0.2); t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 60 + r() * 60; const t = i % 3 ? bamboo(r, 0.9) : tree(r, 1.2, true); t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d * 0.9 + 10); kit.add(t); }
  for (let i = 0; i < 36; i++) { const x = -200 + (i % 9) * 46, z = -200 + Math.floor(i / 9) * 100; if (Math.abs(x) < 60) continue; kit.add(box(i % 2 ? 0x8fc85a : 0xb8d86a, x, 0.04, z, 42, 0.08, 90)); }
  for (let i = 0; i < 12; i++) { const p = person(i, i % 3 === 0 ? 1 : 0, i % 4 === 0 ? 0x8a5a32 : undefined); p.position.set((i % 2 ? 1 : -1) * (12 + r() * 6), 0, 90 - r() * 140); p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Chùa Keo', 0, 11, 96, '#9a3f2a', 1.0), label('Gác chuông chùa Keo', 0, 17, GZ, '#7a4a2a', 1.0), label('Đền thờ Thánh', 0, 11, -22, '#9a3f2a', 0.9));
  kit.add(signPost('Vũ Thư', 8, 0, 140, '#2a4a6a', 0.8));
  void RED; void THREE;

  const path = [V(0, 0, 150), V(0, 0, 120), V(0, 0, 96), V(0, 0, 70), V(-13.5, 0, 66), V(-13.5, 0, 40), V(-14, 0, 2), V(-14, 0, -30), V(0, 0, -40), V(0, 0, -46)];
  return {
    path, half: 1.6, npcs: 6, startYaw: 0,
    extras: [
      { frac: 0.4, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Chùa Keo thờ Phật và Thiền sư Không Lộ, nhà sư thời Lý gắn với nghề chài lưới và đúc đồng.', q: 'Chùa Keo thờ vị thiền sư nào?', options: ['Vạn Hạnh', 'Không Lộ', 'Từ Đạo Hạnh'], answer: 1 },
      { frac: 0.9, kind: 'ngam_canh', name: 'Ngắm gác chuông', fact: 'Gác chuông chùa Keo có ba tầng, mười hai mái cong, đầu đao vút như cánh chim, toàn bộ khung gỗ ghép mộng.' },
    ],
    stops: [
      { id: 'tam_quan', at: V(0, 0, 104), look: V(0, 4, 96) },
      { id: 'chua_phat', at: V(-14, 0, 40), look: V(0, 3, 44) },
      { id: 'den_thanh', at: V(-14, 0, -6), look: V(0, 3, -4) },
      { id: 'gac_chuong', at: V(0, 0, -44), look: V(0, 8, GZ) },
    ],
    sky: [0x86b6dc, 0xf6e6c4], fog: [0xe8e2cc, 140, 560],
    light: { ambient: 1.5, sun: 1.7, sunColor: 0xffe8c0, sunDir: [-0.3, 0.65, 0.6], ambientColor: 0xfff4e4 },
    shopSpots: [V(10, 0, 142), V(-14, 0, 110), V(10, 0, -38)],
  };
}
