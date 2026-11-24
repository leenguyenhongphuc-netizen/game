// Tràng An, Ninh Bình. Trục x: tây → đông; z: bắc → nam. Thung nước giữa núi đá vôi; lối đi men bờ đá (đò chở khách chạy giữa dòng).
// Bến thuyền phía nam → đường hầm hang Sáng (nhũ đá rủ sát mặt nước) → thung giữa → hang Tối → đảo đền Trình (cầu đá)
// → bãi ven núi có làng thổ dân của phim trường Kong.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, label, person, rock, signPost } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { LIME, archBridge, hall, karst, landWithLakes, sampan, tamQuan, wet } from './db__kit.ts';
import type { Lake } from './db__kit.ts';

const LAKES: Lake[] = [{ x: 0, z: 110, rx: 40, rz: 22 }, { x: -18, z: 60, rx: 12, rz: 34 }, { x: 0, z: 0, rx: 46, rz: 30 }, { x: 24, z: -56, rx: 12, rz: 30 }, { x: 10, z: -110, rx: 50, rz: 30 }];
export function trangAn(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  landWithLakes(kit, -200, -200, 200, 200, LAKES, 0x6f9a4f, { water: 0x3f8a6a, floor: 0x2f4a3a });
  // núi đá vôi dày đặc quanh thung, chừa bờ lối đi
  for (let i = 0; i < 90; i++) {
    const x = -190 + r() * 380, z = -190 + r() * 380;
    if (wet(LAKES, x, z, 14) || Math.abs(x - pathX(z)) < 16) continue;
    kit.add(karst(x, z, 10 + r() * 14, 30 + r() * 46, r, -1));
  }
  // hai đường hầm hang (Sáng, Tối): vách đá hai bên lối, trần đá thấp, nhũ đá, đèn
  const tunnel = (z0: number, z1: number, x: number, dark: boolean) => {
    for (let z = z0; z < z1; z += 4) { for (const s of [-1, 1]) kit.add(rock(LIME[(z >> 2) % 4], x + s * 5.6, 4, z + 2, 2.4, 4.6, 2.6, z * 0.3)); if ((z - z0) % 8 === 0) kit.add(rock(LIME[(z >> 3) % 4], x, 10.5, z + 2, 6.8, 1.4, 2.4, z)); } // vòm hang cao, hở từng đoạn
    for (let i = 0; i < 18; i++) kit.add(cone(0xd8c8a8, x + (r() - 0.5) * 7, 9.4, z0 + r() * (z1 - z0), 0.2 + r() * 0.3, 1.4 + r() * 1.6).rotateX(Math.PI));
    for (let z = z0 + 3; z < z1; z += 7) kit.add(bead(glow(dark ? 0xffa64a : 0xfff0b0), x - 3.6, 1.4, z, 0.22));
  };
  tunnel(78, 96, pathX(86), false); tunnel(-36, -18, pathX(-27), true);
  // bến thuyền: tam quan, nhà chờ, hàng đò nan chờ khách
  kit.add(tamQuan(pathX(150), 150, 0, 3.4));
  kit.add(box(0xb8ae98, 0, 0.1, 136, 40, 0.2, 8));
  for (let i = 0; i < 14; i++) { const b = sampan(0x6b4a2a, i % 3 === 0, i); b.position.set(-30 + i * 4.4, -0.45, 126); b.rotation.y = 0.05; kit.add(b); }
  for (let i = 0; i < 6; i++) { const b = sampan(0x6b4a2a, true, i); b.position.set(-14 + r() * 26, -0.45, (i % 3 ? 10 : -100) + r() * 30); b.rotation.y = r() * 6; kit.add(b); for (let k = 0; k < 2; k++) { const p = person(i * 2 + k, 1); p.position.set(b.position.x, -0.1, b.position.z + k * 1.4 - 0.7); kit.add(p); } }
  // đền Trình trên đảo giữa thung, cầu đá vồng
  const DX = 28, DZ = 0;
  kit.add(cyl(0x7a8a5a, DX, -0.5, DZ, 9, 1, 8), hall(DX - 1, DZ, 7, 5, 2.6, -Math.PI / 2, { lit: true }));
  const br = archBridge(kit, V(47.5, 0, DZ), V(DX + 8.5, 0, DZ), 2.4, 1.4, 0x9a958a, 0xb8ae98, 8);
  // làng thổ dân phim trường Kong: chòi tre mái lá trên cọc, cọc gỗ, đống lửa
  for (let i = 0; i < 9; i++) { const x = 38 + (i % 3) * 10 + r() * 2, z = -186 + Math.floor(i / 3) * 10; kit.add(grp(x, 0, z, r() * 6, ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl(0x8a6a42, sx * 2, 1, sz * 2, 0.14, 2))), box(0xa88a5a, 0, 2.1, 0, 5, 0.2, 5), box(0xb8945a, 0, 3.2, 0, 4.2, 2, 4.2), cone(0xc8a868, 0, 5, 0, 3.8, 2.6))); }
  for (let i = 0; i < 10; i++) kit.add(cyl(0x6a5038, 30 + i * 4, 1.6, -150, 0.24, 3.2), cone(0x6a5038, 30 + i * 4, 3.4, -150, 0.24, 0.5));
  kit.add(cyl(0x5a5a54, 46, 0.2, -164, 1.2, 0.4)); kit.motes(20, 0xffa040, 0.6, () => V(46 + (r() - 0.5), 0.6, -164 + (r() - 0.5)), (p, i, t) => { p.y = 0.6 + ((t * 0.8 + i * 0.13) % 2); });
  // khách du lịch trên bờ
  for (let i = 0; i < 10; i++) { const z = 150 - r() * 300, p = person(i + 3, i % 2 ? 1 : 2); p.position.set(pathX(z) + (r() < 0.5 ? -2.4 : 2.4), 0, z); if (wet(LAKES, p.position.x, z, 1)) continue; p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Bến thuyền Tràng An', 0, 6, 140, '#2a6f5a', 1.0), label('Hang Sáng', pathX(86), 9, 86, '#5a5a54', 0.9), label('Hang Tối', pathX(-27), 9, -27, '#3a3a36', 0.9), label('Đền Trình', DX - 2, 8, DZ, '#9a3f2a', 0.9), label('Phim trường Kong', 48, 8, -176, '#6a4a2a', 1.0));
  kit.add(signPost('Đường men núi →', pathX(140) + 3, 0, 140, '#3a5a3a', 0.8));
  void ball;

  const zs = [160, 140, 120, 100, 86, 70, 50, 30, 10, 0, -10, -27, -45, -70, -95, -118, -140, -158];
  const path: THREE.Vector3[] = [];
  for (const z of zs) { path.push(V(pathX(z), 0, z)); if (z === 0) { path.push(...br, V(DX + 5, 0, DZ), ...br.slice().reverse(), V(pathX(0), 0, 0)); } }
  path.push(V(48, 0, -164));
  return {
    path, half: 1.6, npcs: 6, startYaw: 0,
    extras: [
      { frac: 0.35, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Tràng An được UNESCO ghi danh năm 2014, là di sản hỗn hợp văn hoá và thiên nhiên đầu tiên của Việt Nam.', q: 'Tràng An là loại di sản thế giới nào?', options: ['Di sản thiên nhiên', 'Di sản văn hoá', 'Di sản hỗn hợp văn hoá và thiên nhiên'], answer: 2 },
      { frac: 0.6, kind: 'ngam_canh', name: 'Ngắm thung nước', fact: 'Giữa các dãy núi đá vôi là những thung nước nối nhau bằng hang xuyên thuỷ. Người chèo đò thường chèo bằng chân để hai tay rảnh.' },
    ],
    stops: [
      { id: 'ben_do', at: V(pathX(140), 0, 140), look: V(0, 1, 126) },
      { id: 'hang_sang', at: V(pathX(86), 0, 86), look: V(pathX(86) - 3, 3, 78) },
      { id: 'hang_toi', at: V(pathX(-27), 0, -27), look: V(pathX(-27) - 3, 3, -36) },
      { id: 'den_trinh', at: V(DX + 5, 0, DZ), look: V(DX - 1, 2.6, DZ) },
      { id: 'phim_truong', at: V(48, 0, -164), look: V(48, 3, -176) },
    ],
    sky: [0x7fb0d0, 0xe8eee0], fog: [0xd8e2d4, 120, 520],
    light: { ambient: 1.5, sun: 1.6, sunColor: 0xfff0d0, sunDir: [-0.4, 0.6, 0.5], ambientColor: 0xf2f6ea },
    shopSpots: [V(10, 0, 146), V(pathX(40) + 3, 0, 40), V(58, 0, -150)],
  };
}
/** Lối đi men bờ phía đông các thung: x theo z, nội suy giữa các mốc (tránh mặt nước). */
const PX: [number, number][] = [[170, 46], [100, 46], [86, 46], [70, 10], [50, 10], [10, 52], [-27, 52], [-45, 44], [-70, 44], [-95, 68], [-118, 66], [-140, 64], [-160, 52]];
function pathX(z: number): number { for (let i = 0; i < PX.length - 1; i++) { const [z0, x0] = PX[i], [z1, x1] = PX[i + 1]; if (z <= z0 && z >= z1) return x0 + (x1 - x0) * (z0 - z) / (z0 - z1); } return z > 0 ? 46 : 52; }
