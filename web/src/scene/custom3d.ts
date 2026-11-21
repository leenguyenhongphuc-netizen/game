// Mô hình cho phần cá nhân hoá: kiểu nhà, hàng rào, đồ trang trí sân, nón, xe tải, công trình theo vai trò.
import * as THREE from 'three';
import { GEO, mat, mesh } from './plants.ts';

export function hex(s: string | undefined | null, fallback: number): number {
  return s && /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : fallback;
}

export interface FenceBox { x: number; back: number; front: number; gate: number }

/** Hàng rào bốn mặt, chừa cổng ở mặt trước. */
export function buildFence(st: THREE.Group, style: string, F: FenceBox, gateColor: number) {
  const depth = F.front - F.back, midZ = (F.front + F.back) / 2, seg = F.x - F.gate;
  const sides: [number, number, number, number][] = [
    [0, F.back, F.x * 2, 0], [-F.x, midZ, 0, depth], [F.x, midZ, 0, depth],
    [-(F.x + F.gate) / 2, F.front, seg, 0], [(F.x + F.gate) / 2, F.front, seg, 0],
  ];
  if (style === 'gach') {
    const brick = mat(0xd98b6a), cap = mat(0xf7efe2);
    for (const [x, z, sx, sz] of sides) st.add(mesh(GEO.box, brick, x, 0.45, z, sx || 0.34, 0.9, sz || 0.34), mesh(GEO.box, cap, x, 0.95, z, (sx || 0.34) + 0.14, 0.12, (sz || 0.34) + 0.14));
  } else {
    const c = style === 'go' ? [0xb9855a, 0x8a5f3c] : style === 'tre' ? [0xc9d77a, 0x8fae4a] : [0xfdf6e6, 0xb9855a];
    const body = mat(c[0]), tip = mat(c[1]), thin = style === 'tre';
    const post = (x: number, z: number) => st.add(mesh(thin ? GEO.cyl : GEO.box, body, x, 0.5, z, thin ? 0.08 : 0.18, 1, thin ? 0.08 : 0.18), mesh(GEO.ball, tip, x, 1.05, z, thin ? 0.09 : 0.14));
    const n = thin ? 16 : 8, m = thin ? 18 : 9;
    for (let i = 0; i <= n; i++) { const x = -F.x + (i * F.x * 2) / n; post(x, F.back); if (Math.abs(x) > F.gate + 0.3) post(x, F.front); }
    for (let i = 1; i < m; i++) { const z = F.back + (i * depth) / m; post(-F.x, z); post(F.x, z); }
    for (const [x, z, sx, sz] of sides) st.add(mesh(GEO.box, body, x, 0.72, z, sx || 0.08, 0.1, sz || 0.08), mesh(GEO.box, body, x, 0.38, z, sx || 0.08, 0.1, sz || 0.08));
  }
  const dark = mat(0xb9855a);
  for (const x of [-F.gate, F.gate]) st.add(mesh(GEO.box, dark, x, 1.5, F.front, 0.28, 3, 0.28));
  st.add(mesh(GEO.box, dark, 0, 3.05, F.front, F.gate * 2 + 0.9, 0.26, 0.4), mesh(GEO.box, mat(gateColor), 0, 3.3, F.front, F.gate * 2 + 1.3, 0.14, 0.7));
}

/** Nhà đặt tâm tại gốc toạ độ, mặt tiền quay về +z. Cả ba kiểu nằm gọn trong khối va chạm 6 × 4. */
export function buildHouse(type: string, wall: number, roof: number, night: boolean): THREE.Group {
  const h = new THREE.Group();
  const dark = mat(0x9a7150), white = mat(0xffffff), w = mat(wall), r = mat(roof);
  const glow = night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0x8fd3f2, { rough: 0.3 });
  const win = (x: number, y: number, z: number) => h.add(mesh(GEO.box, glow, x, y, z, 0.9, 0.8, 0.08), mesh(GEO.box, white, x, y, z + 0.04, 1.05, 0.1, 0.05), mesh(GEO.box, white, x, y, z + 0.04, 0.1, 0.95, 0.05));
  if (type === 'nha_san') { // nhà sàn gỗ mái lá
    const wood = mat(0xc99a68), thatch = mat(0xe6c66a);
    for (const x of [-2.4, 0, 2.4]) for (const z of [-1.4, 1.4]) h.add(mesh(GEO.cyl, dark, x, 0.75, z, 0.14, 1.5, 0.14));
    h.add(mesh(GEO.box, wood, 0, 1.6, 0, 5.8, 0.2, 3.8), mesh(GEO.box, w, 0, 2.7, 0, 5.2, 2, 3.2));
    const roofM = mesh(new THREE.CylinderGeometry(0.01, 3.1, 2.1, 4, 1), thatch, 0, 4.7, 0, 1.4, 1, 0.95); roofM.rotation.y = Math.PI / 4; h.add(roofM);
    h.add(mesh(GEO.box, r, 0, 3.72, 0, 6.2, 0.12, 4.2), mesh(GEO.box, dark, 0, 2.5, 1.62, 0.9, 1.5, 0.1));
    win(-1.7, 2.8, 1.62); win(1.7, 2.8, 1.62);
    for (let i = 0; i < 5; i++) h.add(mesh(GEO.box, wood, 0, 0.25 + i * 0.3, 2.9 - i * 0.26, 1.2, 0.1, 0.3)); // cầu thang
  } else if (type === 'nha_ba_gian') { // nhà ba gian mái dài
    h.add(mesh(GEO.box, mat(0xcdbb99), 0, 0.2, 0.1, 6.8, 0.4, 4.4), mesh(GEO.box, w, 0, 1.5, -0.3, 6.2, 2.2, 3));
    const roofM = mesh(new THREE.CylinderGeometry(0.01, 2.6, 1.4, 4, 1), r, 0, 3.3, -0.3, 1.9, 1, 0.9); roofM.rotation.y = Math.PI / 4; h.add(roofM);
    h.add(mesh(GEO.box, r, 0, 2.55, 1.6, 6.9, 0.14, 1.6));
    for (const x of [-3, -1, 1, 3]) h.add(mesh(GEO.cyl, mat(0xb5523b), x, 1.4, 2.2, 0.11, 2.2, 0.11));
    for (const x of [-2, 0, 2]) h.add(mesh(GEO.box, dark, x, 1.2, 1.22, 1.3, 1.7, 0.1));
    h.add(mesh(GEO.box, mat(0xf6d77a), 0, 2.45, 1.26, 1.6, 0.36, 0.06));
  } else { // nhà mái ngói có hiên
    h.add(mesh(GEO.box, mat(0xcdbb99), 0, 0.15, 0, 6.6, 0.3, 4.6), mesh(GEO.box, w, 0, 1.5, 0, 5.6, 2.4, 3.6));
    const roofM = mesh(new THREE.CylinderGeometry(0.01, 3.1, 1.8, 4, 1), r, 0, 3.6, 0, 1.38, 1, 0.98); roofM.rotation.y = Math.PI / 4; h.add(roofM);
    h.add(mesh(GEO.box, dark, 0, 1.1, 1.82, 1.0, 1.6, 0.1), mesh(GEO.box, r, 0, 2.6, 2.5, 6.3, 0.14, 1.5));
    win(-1.8, 1.7, 1.82); win(1.8, 1.7, 1.82);
    for (const x of [-2.9, 2.9]) h.add(mesh(GEO.cyl, dark, x, 1.4, 3.1, 0.09, 2.4, 0.09));
    h.add(mesh(GEO.box, mat(0xb0a08a), 1.9, 4.2, -0.3, 0.5, 0.9, 0.5));
  }
  return h;
}

/** Một món trang trí sân, gốc đặt tại chân món đồ. */
export function buildDecor(item: string): THREE.Group {
  const g = new THREE.Group();
  const green = mat(0x5cb85f), wood = mat(0xb9855a), stone = mat(0xd9d2c4);
  switch (item) {
    case 'chau_hoa': g.add(mesh(GEO.cyl, mat(0xe0a070), 0, 0.3, 0, 0.36, 0.5, 0.36), mesh(GEO.ball, green, 0, 0.85, 0, 0.5)); for (const [x, z, c] of [[0.25, 0.2, 0xf7a8c4], [-0.25, 0.1, 0xffe27a], [0, -0.3, 0xffffff]] as const) g.add(mesh(GEO.ball, mat(c), x, 1.15, z, 0.14)); break;
    case 'den_long': g.add(mesh(GEO.cyl, wood, 0, 1.3, 0, 0.07, 2.6, 0.07), mesh(GEO.box, wood, 0.35, 2.55, 0, 0.8, 0.07, 0.07), mesh(GEO.ball, mat(0xe8412f, { emissive: 0xff5a3a }), 0.7, 2.1, 0, 0.3, 0.38, 0.3), mesh(GEO.cyl, mat(0xffd23f), 0.7, 1.68, 0, 0.1, 0.12, 0.1)); break;
    case 'ban_ghe': g.add(mesh(GEO.cyl, wood, 0, 0.72, 0, 0.75, 0.1, 0.75), mesh(GEO.cyl, wood, 0, 0.36, 0, 0.12, 0.7, 0.12)); for (const a of [0, 2.1, 4.2]) g.add(mesh(GEO.cyl, mat(0xd9a877), Math.cos(a) * 1.1, 0.24, Math.sin(a) * 1.1, 0.26, 0.48, 0.26)); g.add(mesh(GEO.cyl, mat(0xffffff), 0.1, 0.84, 0, 0.14, 0.14, 0.14)); break;
    case 'ao_ca': g.add(mesh(GEO.cyl, stone, 0, 0.12, 0, 1.5, 0.24, 1.2), mesh(GEO.cyl, mat(0x7fd3e8, { rough: 0.2 }), 0, 0.26, 0, 1.3, 0.04, 1.0)); for (const [x, z] of [[0.4, 0.2], [-0.5, -0.1], [0.1, -0.5]]) g.add(mesh(GEO.ball, mat(0xf2893a), x, 0.3, z, 0.16, 0.05, 0.08)); g.add(mesh(GEO.cyl, mat(0x79c96d), -0.6, 0.3, 0.5, 0.3, 0.03, 0.3)); break;
    case 'xich_du': for (const x of [-0.9, 0.9]) g.add(mesh(GEO.cyl, wood, x, 1.1, 0, 0.08, 2.2, 0.08)); g.add(mesh(GEO.box, wood, 0, 2.2, 0, 2, 0.1, 0.1), mesh(GEO.box, mat(0xf08a6c), 0, 0.6, 0, 1.1, 0.08, 0.4)); for (const x of [-0.5, 0.5]) g.add(mesh(GEO.box, mat(0x8f97a3), x, 1.4, 0, 0.03, 1.6, 0.03)); break;
    case 'cay_mai': case 'cay_dao': { const c = item === 'cay_mai' ? 0xffd23f : 0xf7a8c4; g.add(mesh(GEO.cyl, mat(0xe0a070), 0, 0.3, 0, 0.5, 0.6, 0.5), mesh(GEO.cyl, mat(0x7a5233), 0, 1.2, 0, 0.09, 1.4, 0.09)); for (const [x, y, z, s] of [[0, 2.1, 0, 0.6], [-0.5, 1.7, 0.2, 0.42], [0.5, 1.75, -0.1, 0.45], [0.1, 1.6, 0.5, 0.36]]) g.add(mesh(GEO.ball, mat(c), x, y, z, s)); break; }
    case 'bu_nhin': g.add(mesh(GEO.cyl, wood, 0, 1, 0, 0.06, 2, 0.06), mesh(GEO.box, wood, 0, 1.45, 0, 1.6, 0.07, 0.07), mesh(GEO.box, mat(0x6fb7d9), 0, 1.25, 0, 0.7, 0.7, 0.25), mesh(GEO.ball, mat(0xf6e3b0), 0, 1.95, 0, 0.3), mesh(new THREE.ConeGeometry(0.5, 0.3, 10), mat(0xf2dc9a), 0, 2.28, 0)); break;
    case 'cot_co': g.add(mesh(GEO.cyl, stone, 0, 0.15, 0, 0.4, 0.3, 0.4), mesh(GEO.cyl, mat(0xdfe6ee), 0, 2.2, 0, 0.05, 4.2, 0.05), mesh(GEO.box, mat(0xda251d), 0.62, 3.75, 0, 1.2, 0.8, 0.04), mesh(GEO.ball, mat(0xffdd00), 0.62, 3.75, 0.03, 0.2, 0.2, 0.02)); break;
    case 'chum_nuoc': g.add(mesh(GEO.ball, mat(0xb5613c), 0, 0.6, 0, 0.6, 0.65, 0.6), mesh(GEO.cyl, mat(0x7fd3e8, { rough: 0.2 }), 0, 1.16, 0, 0.36, 0.03, 0.36), mesh(GEO.cyl, mat(0x9a7150), 0.3, 1.25, 0, 0.12, 0.1, 0.12)); break;
    default: g.add(mesh(GEO.ball, green, 0, 0.4, 0, 0.4));
  }
  return g;
}

/** Nón, mũ đặt lên đầu nhân vật (đầu ở y ≈ 1.52, bán kính 0.42). */
export function addHat(root: THREE.Group, hat: string) {
  if (hat === 'mu_tai_beo') root.add(mesh(GEO.cyl, mat(0x7f9a5a), 0, 1.86, 0, 0.6, 0.06, 0.6), mesh(GEO.cyl, mat(0x7f9a5a), 0, 2.0, 0, 0.36, 0.26, 0.36));
  else if (hat === 'mu_luoi_trai') root.add(mesh(GEO.ball, mat(0x3f6fd9), 0, 1.84, 0, 0.44, 0.26, 0.44), mesh(GEO.box, mat(0x3f6fd9), 0, 1.84, 0.5, 0.5, 0.05, 0.4));
  else if (hat === 'khan_ran') root.add(mesh(GEO.ball, mat(0x3a3a3a), 0, 1.74, -0.02, 0.45, 0.3, 0.45), mesh(GEO.box, mat(0xf2f2f2), 0, 1.72, 0.3, 0.6, 0.12, 0.08), mesh(GEO.box, mat(0x3a3a3a), 0.3, 1.3, -0.3, 0.14, 0.5, 0.1));
  else root.add(mesh(new THREE.ConeGeometry(0.62, 0.36, 12), mat(0xf2dc9a), 0, 1.98, 0), mesh(GEO.cyl, mat(0xf08a6c), 0, 1.86, 0, 0.44, 0.07, 0.44));
}

/** Xe tải nhỏ, đầu xe hướng +z. */
export function makeTruck(color: number): { root: THREE.Group; wheels: THREE.Mesh[] } {
  const root = new THREE.Group(), body = mat(color), dark = mat(0x3a3f4a), wheels: THREE.Mesh[] = [];
  root.add(mesh(GEO.box, dark, 0, 0.55, 0, 1.7, 0.2, 4.2), mesh(GEO.box, body, 0, 1.25, 1.35, 1.8, 1.3, 1.4), mesh(GEO.box, mat(0xa9dcf2, { rough: 0.25 }), 0, 1.5, 2.06, 1.5, 0.6, 0.06));
  root.add(mesh(GEO.box, mat(0xd9a877), 0, 0.95, -0.75, 1.8, 0.7, 2.6), mesh(GEO.box, mat(0xb9855a), 0, 1.33, -0.75, 1.9, 0.08, 2.7));
  for (const [x, z, c] of [[-0.45, -0.2, 0xf4c430], [0.45, -0.3, 0xe8457f], [-0.4, -1.3, 0x9bd64a], [0.4, -1.4, 0xf08a24]] as const) root.add(mesh(GEO.box, mat(0xc9975a), x, 1.6, z, 0.7, 0.45, 0.7), mesh(GEO.ball, mat(c), x, 1.9, z, 0.2));
  root.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), -0.6, 0.95, 2.07, 0.13), mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0.6, 0.95, 2.07, 0.13));
  for (const x of [-0.9, 0.9]) for (const z of [1.3, -1.3]) { const w = mesh(GEO.cyl, mat(0x2b2f38), x, 0.42, z, 0.42, 0.3, 0.42); w.rotation.z = Math.PI / 2; wheels.push(w); root.add(w); }
  return { root, wheels };
}

/** Công trình trong sân cho vai không phải nhà vườn: xưởng chế biến hoặc bãi cân hàng của thương lái. */
export function buildRoleProp(role: string | null | undefined): THREE.Group | null {
  const g = new THREE.Group();
  if (role === 'xuong') {
    g.add(mesh(GEO.box, mat(0xf3ead6), 0, 1.1, 0, 4.4, 2.2, 2.4), mesh(GEO.box, mat(0x6fb7d9), 0, 2.35, 0, 4.8, 0.2, 2.8), mesh(GEO.box, mat(0x9a7150), -1.1, 0.8, 1.22, 1, 1.5, 0.08));
    g.add(mesh(GEO.cyl, mat(0x8f97a3), 1.5, 3.1, -0.4, 0.22, 1.4, 0.22), mesh(GEO.box, mat(0xa9dcf2, { rough: 0.3 }), 1.1, 1.3, 1.22, 1.2, 0.7, 0.06));
    for (const [x, z] of [[2.9, 0.6], [3.3, -0.4], [2.9, -0.5]]) g.add(mesh(GEO.box, mat(0xc9975a), x, 0.3, z, 0.7, 0.6, 0.7));
    g.add(mesh(GEO.cyl, mat(0xdfe6ee, { rough: 0.3 }), -2.9, 0.6, 0.2, 0.5, 1.2, 0.5));
  } else if (role === 'thuong_lai') {
    g.add(mesh(GEO.box, mat(0x8f97a3), 0, 0.1, 0, 2.2, 0.2, 1.6), mesh(GEO.box, mat(0xf08a6c), -1.25, 0.9, 0, 0.14, 1.6, 0.14), mesh(GEO.cyl, mat(0xfdf6e6), -1.25, 1.75, 0, 0.36, 0.1, 0.36)); // cân bàn
    for (const [x, y, z] of [[2.1, 0.3, 0.3], [2.9, 0.3, 0.2], [2.5, 0.9, 0.25], [2.2, 0.3, -0.7], [-2.9, 0.3, 0]]) g.add(mesh(GEO.box, mat(0xc9975a), x, y, z, 0.75, 0.6, 0.75));
    g.add(mesh(GEO.ball, mat(0xf4c430), 2.5, 1.3, 0.25, 0.2), mesh(GEO.ball, mat(0xe8457f), -2.9, 0.7, 0, 0.2));
  } else return null;
  return g;
}
