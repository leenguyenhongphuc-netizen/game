// Khu nhà xưởng chế biến của chủ xưởng: thay cho lưới ô đất trồng. Mỗi máy là một trạm riêng trên nền bê tông.
import * as THREE from 'three';
import { GEO, mat, mesh } from './plants.ts';

export interface FactoryJob { recipeId?: string; doneAt?: number; done?: boolean }
export interface FactoryMachine { id: number | string; kind: string; name: string; level?: number; slots?: number; jobs?: FactoryJob[] }
export interface FactoryData { machines: FactoryMachine[] }
export type MachineState = 'idle' | 'run' | 'done';

/** Sáu chỗ đặt máy (toạ độ trong lô): hàng sau bốn máy, hàng trước hai máy, chừa lối giữa từ cổng vào. */
export const MACHINE_SPOTS: { x: number; z: number }[] = [
  { x: -5.5, z: 0.7 }, { x: -2.1, z: 0.7 }, { x: 2.1, z: 0.7 }, { x: 5.5, z: 0.7 }, { x: -5.5, z: 4.6 }, { x: 5.5, z: 4.6 },
];
/** Máy cấp sẵn khi máy chủ chưa gửi danh sách máy. */
export const BASIC_FACTORY: FactoryData = { machines: [{ id: 'co_ban', kind: 'may_say', name: 'Máy sấy' }] };
/** Ba máy mẫu cho tham số thử ?xuong=1 (một máy đang chạy, một máy đã xong mẻ). */
export function sampleFactory(now: number): FactoryData {
  return { machines: [
    { id: 'm1', kind: 'may_say', name: 'Máy sấy', jobs: [{ recipeId: 'xoai_say', doneAt: now + 3_600_000 }] },
    { id: 'm2', kind: 'may_ep', name: 'Máy ép nước', jobs: [{ recipeId: 'nuoc_ep', doneAt: now - 1000 }] },
    { id: 'm3', kind: 'rang_xay', name: 'Máy rang xay' },
    { id: 'm4', kind: 'dong_hop', name: 'Dây chuyền đóng hộp', jobs: [{ recipeId: 'mut', doneAt: now + 1_800_000 }] },
    { id: 'm5', kind: 'kho_lanh', name: 'Kho lạnh' },
  ] };
}

export function machineState(m: FactoryMachine, now: number): MachineState {
  const jobs = m.jobs ?? [];
  if (jobs.some((j) => j.done || (j.doneAt !== undefined && j.doneAt <= now))) return 'done';
  return jobs.length ? 'run' : 'idle';
}

type Model = 'say' | 'ep' | 'rang' | 'hop' | 'lanh' | 'goi' | 'rua' | 'chung';
function modelOf(m: { kind: string; name: string }): Model {
  const s = `${m.kind} ${m.name}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if (/lanh|cold|dong lanh|cap dong/.test(s)) return 'lanh';
  if (/say|dry|phoi/.test(s)) return 'say';
  if (/rang|xay|roast|grind|nghien/.test(s)) return 'rang';
  if (/hop|mut|lon\b|can\b|chai|tiet trung/.test(s)) return 'hop';
  if (/ep|nuoc|juice|co dac|co_dac|chung cat/.test(s)) return 'ep';
  if (/goi|pack|chan khong|chan_khong|bao bi/.test(s)) return 'goi';
  if (/rua|phan loai|phan_loai|wash|sort/.test(s)) return 'rua';
  return 'chung';
}

const C = {
  concrete: 0xcfd2d4, concrete2: 0xbfc3c6, line: 0xf5c518, steel: 0x8f97a3, dark: 0x4a5059, inox: 0xdfe6ee, white: 0xf5f3ee, cream: 0xf3ead6,
  roof: 0x5f8fb5, roof2: 0x4f7ea3, wood: 0xc9975a, carton: 0xd2a56c, red: 0xe2573c, green: 0x4caf3f, blue: 0x4aa3d8,
};
const inox = () => mat(C.inox); // nhám như mọi khối khác để gộp chung một lần vẽ

/** Phần tĩnh của khu xưởng (chưa gộp lưới): nền, nhà xưởng mái tôn, bồn, ống khói, khu nguyên liệu, khu thành phẩm, xe nâng, đèn. */
export function buildFactoryYard(night: boolean, roofColor: number, used: number): THREE.Group {
  const g = new THREE.Group();
  // nền bê tông và vạch kẻ vàng
  g.add(mesh(GEO.box, mat(C.concrete2), 0, 0.02, 0.4, 17.6, 0.05, 15.4), mesh(GEO.box, mat(C.concrete), 0, 0.04, 0.4, 17.0, 0.06, 14.8));
  for (let i = -3; i <= 3; i++) g.add(mesh(GEO.box, mat(C.concrete2), i * 2.4, 0.075, 0.4, 0.04, 0.01, 14.8)); // khe co giãn
  const line = mat(C.line);
  for (const x of [-1.15, 1.15]) g.add(mesh(GEO.box, line, x, 0.08, 4.4, 0.12, 0.012, 8.0)); // lối đi giữa
  for (let i = 0; i < 6; i++) g.add(mesh(GEO.box, line, 0, 0.08, 7.6 - i * 1.4, 0.5, 0.012, 0.16)); // mũi vạch dẫn vào
  MACHINE_SPOTS.forEach((p, i) => { // khung vị trí máy: đã có máy thì viền liền, còn trống thì nét đứt và dấu cộng
    const w = 2.5, d = 1.9;
    if (i < used) {
      g.add(mesh(GEO.box, line, p.x, 0.08, p.z - d / 2, w, 0.012, 0.09), mesh(GEO.box, line, p.x, 0.08, p.z + d / 2, w, 0.012, 0.09), mesh(GEO.box, line, p.x - w / 2, 0.08, p.z, 0.09, 0.012, d), mesh(GEO.box, line, p.x + w / 2, 0.08, p.z, 0.09, 0.012, d));
    } else {
      for (let k = 0; k < 5; k++) for (const s of [-1, 1]) g.add(mesh(GEO.box, line, p.x - w / 2 + 0.25 + k * 0.5, 0.08, p.z + s * d / 2, 0.28, 0.012, 0.09));
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) g.add(mesh(GEO.box, line, p.x + s * w / 2, 0.08, p.z - d / 2 + 0.24 + k * 0.48, 0.09, 0.012, 0.28));
      g.add(mesh(GEO.box, mat(0xffffff), p.x, 0.08, p.z, 0.7, 0.012, 0.14), mesh(GEO.box, mat(0xffffff), p.x, 0.08, p.z, 0.14, 0.012, 0.7));
    }
  });

  // nhà xưởng: khung thép, tường tôn, mái dốc một chiều, cửa cuốn mở nhìn thấy bên trong
  const sx = -2.4, sz = -4.6, sw = 9.0, sd = 3.6, wall = mat(C.cream), tole = mat(roofColor), tole2 = mat(new THREE.Color(roofColor).multiplyScalar(0.82).getHex());
  g.add(mesh(GEO.box, mat(C.concrete2), sx, 0.1, sz, sw + 0.3, 0.14, sd + 0.3));
  g.add(mesh(GEO.box, wall, sx, 1.7, sz - sd / 2, sw, 3.2, 0.14)); // tường sau
  for (const s of [-1, 1]) g.add(mesh(GEO.box, wall, sx + s * sw / 2, 1.7, sz, 0.14, 3.2, sd));
  g.add(mesh(GEO.box, mat(0x5b8a4a), sx, 0.5, sz - sd / 2 + 0.08, sw - 0.1, 0.8, 0.04)); // chân tường sơn xanh bên trong
  for (const x of [-sw / 2, -sw / 6, sw / 6, sw / 2]) g.add(mesh(GEO.box, mat(C.dark), sx + x, 1.75, sz + sd / 2, 0.2, 3.5, 0.2)); // cột thép mặt trước
  g.add(mesh(GEO.box, mat(C.dark), sx, 3.3, sz + sd / 2, sw + 0.2, 0.5, 0.26)); // hộp cửa cuốn
  for (let i = 0; i < 3; i++) g.add(mesh(GEO.box, mat(0xb9bec4), sx - sw / 3 + i * sw / 3, 3.0 - (i === 1 ? 0 : 0.18), sz + sd / 2 - 0.02, sw / 3 - 0.3, i === 1 ? 0.14 : 0.5, 0.06)); // cửa cuốn kéo lên
  const roof = mesh(GEO.box, tole, sx, 3.85, sz - 0.1, sw + 0.9, 0.16, sd + 1.3); roof.rotation.x = 0.16; g.add(roof);
  for (let i = 0; i < 12; i++) { const rib = mesh(GEO.box, tole2, sx - (sw + 0.7) / 2 + 0.4 + i * 0.8, 3.95, sz - 0.1, 0.12, 0.08, sd + 1.3); rib.rotation.x = 0.16; g.add(rib); } // sóng tôn
  for (const x of [-2.6, 0, 2.6]) g.add(mesh(GEO.box, mat(0xbfe9ff), sx + x, 2.6, sz - sd / 2 + 0.09, 1.5, 0.6, 0.03)); // ô lấy sáng
  // bên trong: băng chuyền, phễu nạp, công nhân (dáng đơn giản), đèn treo
  g.add(mesh(GEO.box, mat(C.dark), sx, 0.75, sz - 0.3, 6.6, 0.12, 0.8), mesh(GEO.box, mat(0x2f3338), sx, 0.83, sz - 0.3, 6.5, 0.05, 0.62));
  for (let i = 0; i < 6; i++) g.add(mesh(GEO.box, mat(C.steel), sx - 3 + i * 1.2, 0.4, sz - 0.3, 0.1, 0.7, 0.7));
  g.add(mesh(GEO.cyl, inox(), sx - 3.5, 1.5, sz - 0.3, 0.7, 0.9, 0.7), mesh(GEO.cone, inox(), sx - 3.5, 0.95, sz - 0.3, 0.7, -0.5, 0.7), mesh(GEO.box, mat(C.steel), sx - 3.5, 0.4, sz - 0.3, 1.0, 0.8, 0.9));
  for (const [x, c] of [[-1.2, 0x6fb7d9], [1.6, 0xf2b25c]] as const) g.add(mesh(GEO.cyl, mat(c), sx + x, 0.75, sz - 1.1, 0.24, 0.9, 0.2), mesh(GEO.ball, mat(0xf8d3ae), sx + x, 1.42, sz - 1.1, 0.24), mesh(GEO.cyl, mat(0xffffff), sx + x, 1.62, sz - 1.1, 0.25, 0.12, 0.25));
  for (const x of [-2.8, 0, 2.8]) g.add(mesh(GEO.cyl, mat(C.dark), sx + x, 3.3, sz, 0.02, 0.6, 0.02), mesh(GEO.cone, mat(C.dark), sx + x, 2.95, sz, 0.32, 0.22, 0.32), mesh(GEO.ball, mat(0xfff3c4, { emissive: night ? 0xffd66b : 0xfff0b0 }), sx + x, 2.84, sz, 0.14));
  // ống khói và ống thông gió
  g.add(mesh(GEO.cyl, mat(C.steel), sx + 3.6, 3.6, sz - 1.2, 0.3, 3.2, 0.3), mesh(GEO.cyl, mat(C.red), sx + 3.6, 4.9, sz - 1.2, 0.33, 0.3, 0.33), mesh(GEO.cyl, mat(C.dark), sx + 3.6, 5.24, sz - 1.2, 0.34, 0.08, 0.34));
  for (const x of [-3, -0.6]) g.add(mesh(GEO.cyl, inox(), sx + x, 4.25, sz - 0.6, 0.26, 0.3, 0.26), mesh(GEO.ball, inox(), sx + x, 4.5, sz - 0.6, 0.34, 0.2, 0.34));
  // bồn inox có chân, thang và đường ống về xưởng
  for (const [x, z, h] of [[4.5, -5.0, 3.4], [6.7, -4.2, 2.6]] as const) {
    g.add(mesh(GEO.cyl, inox(), x, h / 2 + 0.5, z, 0.9, h, 0.9), mesh(GEO.ball, inox(), x, h + 0.5, z, 0.9, 0.34, 0.9), mesh(GEO.cone, inox(), x, 0.36, z, 0.9, -0.4, 0.9));
    for (const [dx, dz] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) g.add(mesh(GEO.cyl, mat(C.steel), x + dx, 0.3, z + dz, 0.06, 0.6, 0.06));
    g.add(mesh(GEO.box, mat(C.blue), x, h * 0.55 + 0.5, z + 0.9, 0.9, 0.34, 0.03), mesh(GEO.box, mat(C.steel), x + 0.96, h / 2 + 0.4, z, 0.05, h, 0.3));
  }
  g.add(mesh(GEO.box, mat(C.steel), 3.2, 2.2, -5.0, 2.0, 0.12, 0.12), mesh(GEO.box, mat(C.steel), 5.6, 1.4, -4.6, 0.12, 0.12, 1.2));
  // khu nhập nguyên liệu (trái) : sọt nhựa đầy trái cây, cân bàn
  const fruit = [0xff8a3d, 0xffd23f, 0x7ccf4f, 0xe8457f, 0x9b5de5];
  [[-8.0, 2.4, 0], [-8.0, 3.4, 1], [-8.0, 4.4, 2], [-7.9, 2.9, 3], [-8.1, 5.6, 4]].forEach(([x, z, k], i) => {
    const y = i === 3 ? 0.78 : 0.26;
    g.add(mesh(GEO.box, mat(i % 2 ? 0x3f8fd0 : 0xd9534f), x, y, z, 0.85, 0.5, 0.85));
    for (let n = 0; n < 5; n++) g.add(mesh(GEO.ball, mat(fruit[k], {}), x + ((n % 3) - 1) * 0.24, y + 0.32, z + (n > 2 ? 0.18 : -0.18), 0.17));
  });
  g.add(mesh(GEO.box, mat(C.steel), -8.0, 0.12, 6.9, 1.2, 0.14, 1.0), mesh(GEO.box, mat(C.dark), -8.5, 0.7, 6.9, 0.1, 1.2, 0.1), mesh(GEO.box, mat(C.white), -8.5, 1.35, 6.9, 0.4, 0.3, 0.12));
  g.add(mesh(GEO.box, mat(0x2f7d26), -8.0, 1.9, 1.2, 0.08, 0.6, 1.6)); // biển "Nhập nguyên liệu" (màu, chữ nằm ở nhãn nổi)
  // khu thành phẩm (phải): thùng carton trên pallet, màng bọc, xe nâng
  for (const [x, z, n] of [[8.0, 2.3, 3], [8.0, 4.0, 2]] as const) {
    g.add(mesh(GEO.box, mat(C.wood), x, 0.1, z, 1.3, 0.14, 1.3));
    for (let l = 0; l < n; l++) for (const [dx, dz] of [[-0.31, -0.31], [0.31, -0.31], [-0.31, 0.31], [0.31, 0.31]]) g.add(mesh(GEO.box, mat(C.carton), x + dx, 0.42 + l * 0.52, z + dz, 0.58, 0.5, 0.58), mesh(GEO.box, mat(C.red), x + dx, 0.5 + l * 0.52, z + dz + 0.295, 0.3, 0.14, 0.01));
  }
  const fk = new THREE.Group(); fk.position.set(7.7, 0, 6.6); fk.rotation.y = -0.5;
  fk.add(mesh(GEO.box, mat(0xf2a72e), 0, 0.55, 0, 1.0, 0.6, 1.5), mesh(GEO.box, mat(C.dark), 0, 0.95, 0.45, 0.9, 0.3, 0.5), mesh(GEO.box, mat(C.dark), 0, 1.6, -0.2, 0.95, 0.06, 1.0));
  for (const [x, z] of [[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.2], [0.45, 0.2]]) fk.add(mesh(GEO.box, mat(C.dark), x, 1.25, z, 0.05, 0.7, 0.05));
  for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.5], [0.5, 0.5]]) { const w = mesh(GEO.cyl, mat(0x2b2118), x, 0.26, z, 0.26, 0.2, 0.26); w.rotation.z = Math.PI / 2; fk.add(w); }
  for (const x of [-0.3, 0.3]) fk.add(mesh(GEO.box, mat(C.steel), x, 1.1, -0.82, 0.08, 2.0, 0.08), mesh(GEO.box, mat(C.steel), x, 0.16, -1.4, 0.1, 0.05, 1.1));
  fk.add(mesh(GEO.box, mat(C.wood), 0, 0.26, -1.45, 0.9, 0.12, 0.9), mesh(GEO.box, mat(C.carton), 0, 0.6, -1.45, 0.7, 0.56, 0.7));
  g.add(fk);
  // cột đèn pha hai góc trước, bình chữa cháy, thùng rác phân loại
  for (const x of [-8.6, 8.6]) g.add(mesh(GEO.cyl, mat(C.dark), x, 2.3, 7.8, 0.07, 4.6, 0.07), mesh(GEO.box, mat(C.dark), x * 0.975, 4.55, 7.6, 0.5, 0.2, 0.34), mesh(GEO.box, mat(0xfff3c4, { emissive: night ? 0xffd66b : 0xcfc7a0 }), x * 0.975, 4.44, 7.6, 0.42, 0.04, 0.28));
  g.add(mesh(GEO.cyl, mat(C.red), 2.6, 0.45, -2.5, 0.13, 0.6, 0.13), mesh(GEO.cyl, mat(C.dark), 2.6, 0.82, -2.5, 0.05, 0.14, 0.05));
  for (const [i, c] of [0x4caf3f, 0xf5c518, 0x4aa3d8].entries()) g.add(mesh(GEO.cyl, mat(c), -8.4 + i * 0.6, 0.4, -2.4, 0.24, 0.7, 0.24));
  return g;
}

export interface MachineModel { root: THREE.Group; lamp: THREE.Vector3; steam: THREE.Vector3 | null; h: number }
/** Mô hình một trạm máy, mặt quay ra +z. Trả về phần tĩnh (chưa gộp) và vị trí đèn báo, chỗ thoát hơi. */
export function buildMachine(m: { kind: string; name: string }): MachineModel {
  const g = new THREE.Group(), model = modelOf(m);
  const steel = mat(C.steel), dark = mat(C.dark), white = mat(C.white);
  g.add(mesh(GEO.box, mat(0x5d646e), 0, 0.12, 0, 2.2, 0.12, 1.6)); // bệ máy
  let steam: THREE.Vector3 | null = null, h = 2.0;
  const panel = (x: number, y: number, z: number) => { g.add(mesh(GEO.box, dark, x, y, z, 0.42, 0.5, 0.06), mesh(GEO.box, mat(0x9be7ff), x, y + 0.1, z + 0.035, 0.3, 0.18, 0.01), mesh(GEO.ball, mat(C.red), x - 0.09, y - 0.13, z + 0.04, 0.045), mesh(GEO.ball, mat(C.green), x + 0.09, y - 0.13, z + 0.04, 0.045)); };
  if (model === 'say') { // tủ sấy nhiều khay, cửa kính thấy lát trái cây
    g.add(mesh(GEO.box, white, 0, 1.2, -0.1, 1.7, 2.0, 1.1), mesh(GEO.box, mat(0xe2573c), 0, 2.24, -0.1, 1.8, 0.12, 1.2));
    g.add(mesh(GEO.box, mat(0x3b3f45), -0.25, 1.2, 0.46, 1.05, 1.7, 0.03));
    for (let i = 0; i < 5; i++) { g.add(mesh(GEO.box, steel, -0.25, 0.52 + i * 0.34, 0.48, 1.0, 0.04, 0.03)); for (let k = 0; k < 4; k++) g.add(mesh(GEO.cyl, mat(i % 2 ? 0xffb347 : 0xffd23f, {}), -0.6 + k * 0.24, 0.58 + i * 0.34, 0.49, 0.09, 0.03, 0.03)); }
    panel(0.6, 1.5, 0.46); g.add(mesh(GEO.box, steel, -0.82, 1.2, 0.5, 0.05, 0.5, 0.05));
    g.add(mesh(GEO.cyl, steel, 0.45, 2.55, -0.3, 0.2, 0.5, 0.2), mesh(GEO.cyl, dark, 0.45, 2.82, -0.3, 0.26, 0.06, 0.26));
    steam = new THREE.Vector3(0.45, 2.95, -0.3); h = 2.9;
  } else if (model === 'ep') { // bồn ép có phễu, vòi rót, can và chai nước
    g.add(mesh(GEO.cyl, inox(), -0.35, 1.25, -0.1, 0.62, 1.3, 0.62), mesh(GEO.cone, inox(), -0.35, 0.48, -0.1, 0.62, -0.3, 0.62), mesh(GEO.cone, inox(), -0.35, 2.15, -0.1, 0.7, -0.5, 0.7));
    for (const [dx, dz] of [[0.42, 0.42], [-0.42, 0.42], [0.42, -0.42], [-0.42, -0.42]]) g.add(mesh(GEO.cyl, steel, -0.35 + dx, 0.36, -0.1 + dz, 0.05, 0.5, 0.05));
    for (const [x, z, c] of [[-0.5, -0.2, 0xff8a3d], [-0.2, 0, 0xffa94d], [-0.4, 0.1, 0xff8a3d]] as const) g.add(mesh(GEO.ball, mat(c, {}), x, 2.36, z, 0.17));
    g.add(mesh(GEO.box, steel, 0.25, 0.9, 0.1, 0.5, 0.08, 0.08), mesh(GEO.box, steel, 0.5, 0.78, 0.1, 0.08, 0.3, 0.08));
    g.add(mesh(GEO.cyl, mat(0xffb347, {}), 0.5, 0.42, 0.1, 0.2, 0.42, 0.2), mesh(GEO.cyl, white, 0.5, 0.66, 0.1, 0.08, 0.08, 0.08));
    for (let i = 0; i < 4; i++) g.add(mesh(GEO.cyl, mat(i % 2 ? 0xffa94d : 0xffd23f, {}), 0.55 + (i % 2) * 0.22, 0.36, 0.5 + (i > 1 ? 0.2 : 0), 0.075, 0.34, 0.075), mesh(GEO.cyl, mat(C.green), 0.55 + (i % 2) * 0.22, 0.56, 0.5 + (i > 1 ? 0.2 : 0), 0.04, 0.06, 0.04));
    panel(0.75, 1.5, -0.3); g.add(mesh(GEO.box, steel, 0.75, 0.7, -0.33, 0.08, 1.1, 0.06));
    h = 2.5;
  } else if (model === 'rang') { // trống rang nằm ngang, ống khói, mâm làm nguội
    const drum = mesh(GEO.cyl, mat(0x7a4a2c), -0.3, 1.25, -0.15, 0.6, 1.2, 0.6); drum.rotation.z = Math.PI / 2; g.add(drum);
    for (const x of [-0.92, 0.32]) { const r = mesh(GEO.cyl, mat(0xd9a441), x, 1.25, -0.15, 0.63, 0.08, 0.63); r.rotation.z = Math.PI / 2; g.add(r); }
    g.add(mesh(GEO.box, dark, -0.3, 0.45, -0.15, 1.3, 0.6, 0.9), mesh(GEO.box, mat(0xff7b3a), -0.3, 0.4, 0.31, 0.6, 0.22, 0.02));
    g.add(mesh(GEO.cone, steel, -0.3, 2.1, -0.15, 0.3, -0.4, 0.3), mesh(GEO.cyl, steel, 0.25, 2.5, -0.45, 0.13, 1.5, 0.13));
    g.add(mesh(GEO.cyl, steel, 0.65, 0.62, 0.35, 0.5, 0.14, 0.5), mesh(GEO.cyl, mat(0x4a2c17), 0.65, 0.7, 0.35, 0.44, 0.04, 0.44), mesh(GEO.cyl, steel, 0.65, 0.35, 0.35, 0.07, 0.5, 0.07));
    g.add(mesh(GEO.box, mat(0xc9975a), -0.85, 0.42, 0.5, 0.5, 0.5, 0.36), mesh(GEO.box, mat(0x4a2c17), -0.85, 0.68, 0.5, 0.4, 0.04, 0.28)); // bao hạt
    steam = new THREE.Vector3(0.25, 3.3, -0.45); h = 3.2;
  } else if (model === 'hop') { // băng chuyền đóng hộp: máy dập, hàng lon chạy
    g.add(mesh(GEO.box, dark, 0, 0.72, 0.1, 2.0, 0.1, 0.5), mesh(GEO.box, mat(0x2f3338), 0, 0.79, 0.1, 1.96, 0.04, 0.4));
    for (const x of [-0.9, 0, 0.9]) g.add(mesh(GEO.box, steel, x, 0.42, 0.1, 0.08, 0.6, 0.44));
    g.add(mesh(GEO.box, mat(0x3f8fd0), -0.2, 1.5, -0.25, 0.9, 1.0, 0.5), mesh(GEO.box, steel, -0.2, 1.75, 0.1, 0.6, 0.16, 0.5), mesh(GEO.cyl, inox(), -0.2, 1.3, 0.1, 0.1, 0.7, 0.1), mesh(GEO.cyl, steel, -0.2, 0.98, 0.1, 0.17, 0.06, 0.17));
    g.add(mesh(GEO.box, mat(0x3f8fd0), -0.2, 0.7, -0.4, 0.3, 1.2, 0.2));
    for (let i = 0; i < 6; i++) g.add(mesh(GEO.cyl, i < 2 ? inox() : mat(i % 2 ? C.red : 0xf2a72e), -0.85 + i * 0.32, 0.92, 0.1, 0.1, 0.22, 0.1), mesh(GEO.cyl, inox(), -0.85 + i * 0.32, 1.04, 0.1, 0.1, 0.02, 0.1));
    panel(0.75, 1.45, -0.3); g.add(mesh(GEO.box, steel, 0.75, 0.7, -0.33, 0.08, 1.1, 0.06));
    h = 2.3;
  } else if (model === 'lanh') { // kho lạnh: container trắng, cửa bản lề, dàn lạnh có quạt
    g.add(mesh(GEO.box, white, 0, 1.15, -0.05, 2.1, 1.9, 1.4), mesh(GEO.box, mat(C.blue), 0, 1.95, 0.66, 2.1, 0.22, 0.02), mesh(GEO.box, mat(C.blue), 0, 0.3, 0.66, 2.1, 0.12, 0.02));
    g.add(mesh(GEO.box, mat(0xe6e9ec), -0.3, 1.05, 0.67, 1.0, 1.5, 0.04), mesh(GEO.box, steel, 0.12, 1.05, 0.71, 0.06, 0.5, 0.05));
    for (const y of [0.55, 1.55]) g.add(mesh(GEO.box, steel, -0.78, y, 0.7, 0.1, 0.16, 0.05));
    g.add(mesh(GEO.box, mat(0xd9dde2), 0.45, 2.38, -0.1, 1.0, 0.5, 0.9), mesh(GEO.cyl, dark, 0.45, 2.64, -0.1, 0.32, 0.03, 0.32), mesh(GEO.box, steel, 0.45, 2.66, -0.1, 0.56, 0.02, 0.07), mesh(GEO.box, steel, 0.45, 2.66, -0.1, 0.07, 0.02, 0.56));
    for (let i = 0; i < 3; i++) g.add(mesh(GEO.box, mat(0xffffff), 0.6, 1.05 + (i - 1) * 0.16, 0.67, 0.34, 0.035, 0.02)); // bông tuyết cách điệu
    g.add(mesh(GEO.box, mat(0xffffff), 0.6, 1.05, 0.67, 0.035, 0.46, 0.02)); panel(0.62, 1.62, 0.66);
    h = 2.8;
  } else if (model === 'goi') { // bàn đóng gói: máy hút chân không nắp trong, cuộn màng, túi thành phẩm
    g.add(mesh(GEO.box, inox(), 0, 0.85, 0, 2.0, 0.08, 1.1)); for (const [x, z] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]]) g.add(mesh(GEO.box, steel, x, 0.5, z, 0.08, 0.7, 0.08));
    g.add(mesh(GEO.box, mat(0x3f8fd0), -0.35, 1.08, -0.05, 1.0, 0.36, 0.8), mesh(GEO.box, mat(0xcfefff), -0.35, 1.34, -0.05, 0.9, 0.16, 0.7), mesh(GEO.box, dark, -0.35, 1.02, 0.36, 0.5, 0.14, 0.03));
    const roll = mesh(GEO.cyl, mat(0xe9f6ff), 0.6, 1.3, -0.3, 0.2, 0.6, 0.2); roll.rotation.z = Math.PI / 2; g.add(roll, mesh(GEO.box, steel, 0.6, 1.1, -0.3, 0.74, 0.4, 0.06));
    for (let i = 0; i < 5; i++) g.add(mesh(GEO.box, mat([0xffb347, 0xe8457f, 0x7ccf4f][i % 3], {}), 0.45 + (i % 2) * 0.3, 0.93 + Math.floor(i / 2) * 0.07, 0.25, 0.26, 0.06, 0.34));
    g.add(mesh(GEO.box, mat(C.carton), 0.2, 0.36, 0.1, 0.6, 0.5, 0.5));
    h = 1.9;
  } else if (model === 'rua') { // máng rửa và bàn phân loại
    g.add(mesh(GEO.box, inox(), -0.3, 0.8, 0, 1.4, 0.5, 0.9), mesh(GEO.box, mat(0x7fd3e8), -0.3, 1.04, 0, 1.3, 0.03, 0.8));
    for (const [x, z] of [[-0.9, -0.38], [0.3, -0.38], [-0.9, 0.38], [0.3, 0.38]]) g.add(mesh(GEO.box, steel, x, 0.35, z, 0.08, 0.5, 0.08));
    for (let i = 0; i < 5; i++) g.add(mesh(GEO.ball, mat([0xff8a3d, 0x7ccf4f, 0xffd23f][i % 3], {}), -0.75 + i * 0.22, 1.08, (i % 2 ? 0.15 : -0.15), 0.13));
    const ramp = mesh(GEO.box, mat(0x2f3338), 0.72, 0.95, 0, 0.9, 0.06, 0.7); ramp.rotation.z = -0.35; g.add(ramp, mesh(GEO.box, steel, 0.95, 0.42, 0, 0.08, 0.7, 0.6));
    g.add(mesh(GEO.cyl, steel, -0.3, 1.6, -0.4, 0.04, 1.2, 0.04), mesh(GEO.box, steel, -0.3, 2.18, -0.15, 0.06, 0.06, 0.5), mesh(GEO.cone, steel, -0.3, 2.06, 0.08, 0.12, 0.16, 0.12));
    h = 2.3;
  } else { // máy chung: thân hộp, phễu nạp, bảng điều khiển, bánh răng
    g.add(mesh(GEO.box, mat(0x4f9a6a), -0.1, 1.0, -0.1, 1.6, 1.6, 1.0), mesh(GEO.cone, steel, -0.4, 2.15, -0.1, 0.5, -0.6, 0.5), mesh(GEO.box, steel, 0.75, 0.6, 0.1, 0.5, 0.2, 0.5));
    const gear = mesh(GEO.cyl, mat(0xf2a72e), 0.35, 1.2, 0.42, 0.3, 0.06, 0.3); gear.rotation.x = Math.PI / 2; g.add(gear); panel(-0.5, 1.3, 0.41);
    h = 2.4;
  }
  // cột đèn báo trạng thái
  g.add(mesh(GEO.cyl, dark, 0.98, h * 0.5 + 0.1, 0.66, 0.035, h, 0.035));
  return { root: g, lamp: new THREE.Vector3(0.98, h + 0.2, 0.66), steam, h };
}

/** Thùng thành phẩm đặt trước máy khi mẻ đã xong. */
export function buildDoneCrate(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(GEO.box, mat(C.carton), 0, 0.3, 0, 0.62, 0.5, 0.5), mesh(GEO.box, mat(C.red), 0, 0.36, 0.255, 0.34, 0.16, 0.01), mesh(GEO.box, mat(0xf3e2b8), 0, 0.555, 0, 0.64, 0.02, 0.1));
  g.add(mesh(GEO.box, mat(C.carton), 0.1, 0.78, 0.02, 0.5, 0.42, 0.42));
  return g;
}
/** Ba thùng hàng trượt trên băng chuyền trong xưởng (di chuyển cả cụm). */
export function buildBeltCrates(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(mesh(GEO.box, mat(i % 2 ? C.carton : 0xe8c48a), i * 1.65, 0, 0, 0.5, 0.36, 0.44));
  return g;
}
export const LAMP_MATS = {
  idle: mat(0x9aa1ab),
  run: mat(0x54e36b, { emissive: 0x20c040, rough: 0.4 }),
  done: mat(0xffd23f, { emissive: 0xffa800, rough: 0.4 }),
};
export const STEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
/** Vật cản trong khu xưởng (x0, x1, z0, z1 theo toạ độ lô). */
export function factoryColliders(used: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [[-7.0, 2.2, -6.5, -2.75], [3.5, 7.7, -6.0, -3.2], [-8.6, -7.4, 1.9, 6.1], [7.3, 8.7, 1.6, 4.7], [6.9, 8.6, 5.4, 7.6]];
  MACHINE_SPOTS.slice(0, used).forEach((p) => out.push([p.x - 1.12, p.x + 1.12, p.z - 0.82, p.z + 0.82]));
  return out;
}
