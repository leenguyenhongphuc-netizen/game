// Kịch bản hoạt cảnh xuất khẩu: mỗi đường (xe tải, container, tàu hoả, hàng không, tàu nhỏ, tàu lớn) có ba cảnh riêng.
// Quy ước như hoạt cảnh du lịch: phương tiện chạy về -z, máy quay đứng bên +x.
import * as THREE from 'three';
import type { ExportMode } from '../../../shared/rules.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { SCENERY, THEMES, bake } from './RideKit.ts';
import {
  Gulls, Smoke, V3, Wake, Walker, buoy, cloud, crateStack, ease, harbourCrane, karst, lampPost, lighthouse, person, seaSurface, seg, sign, terraces, tunnelHill, warehouse,
} from './RideParts.ts';
import type { Sea } from './RideParts.ts';
import { backdrop, bob, box, crowd, post, prop, slab } from './RideSets.ts';
import type { Act, Ctx } from './RideSets.ts';
import {
  BOXCAR_Z, COASTER_DECK, CONTAINER_COLORS, FREIGHTER_DOOR_Z, FREIGHTER_Y, GIANT, Rolling, beltLoader, borderGate, boxTruck, coaster, container, containerShip, containerTruck,
  crate, forklift, freightTrain, freighter, pallet, shipCrane,
} from './ExportParts.ts';
import type { Vehicle } from './ExportParts.ts';

export interface ExportInfo { mode: ExportMode; fromName: string; marketName: string; specialtyName: string; kg: number }
export interface ExportStep { icon: string; label: string }
export const EXPORT_INFO: Record<ExportMode, { icon: string; name: string; by: string; steps: ExportStep[] }> = {
  xe_tai: { icon: '🚚', name: 'Xe tải', by: 'xe tải', steps: [{ icon: '📦', label: 'Bốc hàng' }, { icon: '🚚', label: 'Ra cửa khẩu' }, { icon: '🛃', label: 'Thông quan' }] },
  container: { icon: '🚛', name: 'Xe container', by: 'xe container lạnh', steps: [{ icon: '🧊', label: 'Đóng container' }, { icon: '🚛', label: 'Chạy cao tốc' }, { icon: '🛃', label: 'Thông quan' }] },
  tau_hoa: { icon: '🚂', name: 'Tàu hoả liên vận', by: 'tàu hoả liên vận', steps: [{ icon: '📦', label: 'Xếp lên toa' }, { icon: '🚂', label: 'Trên đường sắt' }, { icon: '🛃', label: 'Ga biên giới' }] },
  hang_khong: { icon: '✈️', name: 'Hàng không', by: 'đường hàng không', steps: [{ icon: '📦', label: 'Chất hàng' }, { icon: '🛫', label: 'Cất cánh' }, { icon: '☁️', label: 'Bay đi' }, { icon: '🛃', label: 'Thông quan' }] },
  tau_nho: { icon: '⛴️', name: 'Tàu hàng nhỏ', by: 'tàu hàng nhỏ', steps: [{ icon: '📦', label: 'Bốc xuống tàu' }, { icon: '⚓', label: 'Rời bến' }, { icon: '🌊', label: 'Ra cửa biển' }, { icon: '🛃', label: 'Thông quan' }] },
  tau_lon: { icon: '🚢', name: 'Tàu container', by: 'tàu container', steps: [{ icon: '🏗️', label: 'Cẩu container' }, { icon: '⚓', label: 'Rời cảng' }, { icon: '🌊', label: 'Ra khơi' }, { icon: '🛃', label: 'Thông quan' }] },
};

const hashOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const WATER_FOG: [number, number] = [170, 520];
/** Bốn góc hộp bao quanh một phương tiện đang ở toạ độ z. */
function around(pts: THREE.Vector3[], x: number, z: number, hw: number, half: number, high: number, extra: THREE.Vector3[] = []): THREE.Vector3[] {
  pts.length = 0; pts.push(V3(x - hw, 0, z - half), V3(x + hw, 0, z + half), V3(x + hw, high, z - half), V3(x - hw, high, z + half), ...extra); return pts;
}
/** Người bốc vác đi vòng: bưng sọt từ a tới b rồi quay về tay không. u là số vòng (phần lẻ = tiến độ trong vòng). */
function haul(w: Walker, a: THREE.Vector3[], u: number, time: number, active: boolean) {
  if (!active) { w.holding(false); w.pose(0, false); return; }
  const k = u % 1, going = k < 0.5, path = going ? a : [...a].reverse();
  w.walk(path, going ? k * 2 : (k - 0.5) * 2, time); w.holding(going);
}
function yard(S: THREE.Group, x: number, z: number, w: number, d: number) { box(S, 0xd3ccbd, x, 0.04, z, w, 0.1, d); for (let k = -w / 2 + 3; k < w / 2; k += 6) box(S, 0xc4bcab, x + k, 0.1, z, 0.12, 0.02, d); }
function road(S: THREE.Group, color: number, width = 8, lanes = 2) {
  box(S, color, 0, 0.02, 0, width, 0.12, 520);
  for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) box(S, 0xfbf3df, x, 0.04, 0, 0.26, 0.12, 520);
  for (let l = 1; l < lanes; l++) for (let z = -200; z <= 200; z += 7) box(S, 0xffffff, -width / 2 + (width / lanes) * l, 0.05, z, 0.24, 0.12, 2.8);
}
function rails(S: THREE.Group) {
  box(S, 0xc9bfae, 0, 0.02, 0, 5.2, 0.3, 520);
  for (const x of [-1.15, 1.15]) box(S, 0x6b7280, x, 0.24, 0, 0.18, 0.22, 520, { rough: 0.4 });
  for (let z = -150; z <= 150; z += 1.7) box(S, 0x8a6a4a, 0, 0.16, z, 3.4, 0.16, 0.5);
}
function trees(S: THREE.Group, zone: 'bac' | 'nam', r: () => number, near: number, z0: number, z1: number) {
  for (let z = z0; z < z1; z += 8 + r() * 6) prop(S, SCENERY[zone === 'nam' ? 'palm' : r() < 0.5 ? 'leaf' : 'pine'](), near + r() * 7, 0, z, 1 + r() * 0.4, r() * 6);
}

// ================================================================ đường bộ: kho → đường → cửa khẩu
function loadTruck(info: ExportInfo): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'kho')), th = THEMES.bac;
  root.add(slab(th.ground)); yard(S, 2, 0, 30, 44);
  prop(S, warehouse(18, 11, 5.4, 0x4fa3a5), -11, 0, 0, 1, Math.PI / 2);
  prop(S, crateStack(6), 6.8, 0, 6.6, 1.25, 0.2); prop(S, crateStack(6), 7.8, 0, 9.4, 1.25, -0.4); prop(S, crateStack(4), 5.6, 0, 10.6, 1.25, 0.6);
  crowd(S, [[6.6, 0, -2.6, -1.9], [-3.6, 0, 6.5, 1.2]], 2);
  trees(S, 'bac', r, 17, -40, 40); backdrop(S, root, 'bac', r, 22);
  root.add(bake(S, true));
  const label = sign(`Kho ${info.fromName}`, '#2a7fd6', 9, -5.4, 7.4, 0); root.add(label);
  const truck = boxTruck(); truck.g.position.set(2, 0, 0); root.add(truck.g);
  const cargo: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) { const c = crate(i); c.position.set(2 - 0.62 + (i % 2) * 1.24, 1.08 + (i >= 8 ? 0.66 : 0), -0.6 + (Math.floor(i / 2) % 4) * 1.15); c.visible = false; cargo.push(c); root.add(c); }
  const ws = [new Walker(1.3, 'sot'), new Walker(1.3, 'sot')]; ws.forEach((w) => root.add(w.g));
  const path = [V3(5.6, 0, 7.4), V3(3.8, 0, 6.6), V3(2.4, 0, 4.9)], pts: THREE.Vector3[] = [], D = 5.6;
  return {
    stage: 1, caption: `Bốc ${info.kg.toLocaleString('vi-VN')} kg ${info.specialtyName} lên xe tải ở kho ${info.fromName}`, duration: D, root, fog: [90, 300],
    update: (t, _dt, c) => {
      const work = t < 3.9;
      ws.forEach((w, i) => { haul(w, path, t / 1.3 + i * 0.5, c.time, work); if (!work) { w.g.position.lerp(V3(4.6 + i * 1.3, 0, 7.6), 0.12); w.face(-1, -0.6); } });
      const n = Math.min(cargo.length, Math.floor(t * 3.3)); cargo.forEach((m, i) => { m.visible = i < n; });
      const go = Math.max(0, t - 4.4), dz = -3.2 * go * go;
      truck.g.position.z = dz; truck.g.position.y = bob(c.time, go > 0 ? 0.6 : 0); truck.roll.turn(-dz); cargo.forEach((m, i) => { m.position.z = dz - 0.6 + (Math.floor(i / 2) % 4) * 1.15; });
      c.shoot(around(pts, 2, 0, 1.4, 4, 3.2, [V3(8.4, 0, 10.6), V3(7, 2.2, 6)]), c.portrait ? 2.0 : 2.05, c.portrait ? 0.46 : 0.24, [label]);
    },
  };
}

/** Cảnh chạy trên đường: phương tiện đi từ z = +from tới -to, máy quay bám theo. */
function runAct(o: {
  stage: number; caption: string; duration: number; root: THREE.Group; v: THREE.Group; roll?: Rolling; hw: number; half: number; high: number;
  from: number; to: number; x?: number; y?: number; fog?: [number, number]; yaw?: [number, number]; pitch?: [number, number]; tick?: (z: number, t: number, c: Ctx, speed: number) => void; signs?: THREE.Sprite[];
}): Act {
  const pts: THREE.Vector3[] = [], x = o.x ?? 0;
  o.v.position.set(x, o.y ?? 0, o.from); o.root.add(o.v);
  return {
    stage: o.stage, caption: o.caption, duration: o.duration, root: o.root, fog: o.fog ?? [100, 320],
    update: (t, _dt, c) => {
      const k = t / o.duration, z = o.from - (o.from + o.to) * k;
      o.v.position.z = z; o.v.position.y = (o.y ?? 0) + (o.roll ? bob(c.time, 0.7) : 0); o.roll?.turn(o.from - z);
      o.tick?.(z, t, c, 1);
      const yaw = o.yaw ?? [2.5, 2.1], pitch = o.pitch ?? [0.4, 0.2];
      c.shoot(around(pts, x, z, o.hw + (c.portrait ? 3.5 : 1), o.half * (c.portrait ? 1.25 : 1.1), o.high * 1.5), (c.portrait ? yaw[0] : yaw[1]) - k * 0.5, c.portrait ? pitch[0] : pitch[1], o.signs);
    },
  };
}

function roadScene(zoneSeed: string, highway: boolean): { root: THREE.Group; S: THREE.Group; r: () => number } {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(zoneSeed)), th = THEMES.bac;
  root.add(slab(th.ground));
  if (highway) {
    road(S, 0x8f97a3, 15, 4); box(S, 0x6fae78, -9.6, 0.1, 0, 2.6, 0.3, 520);
    for (const x of [-8.2, 8.2]) { box(S, 0xb4bac4, x, 0.75, 0, 0.14, 0.3, 520); for (let z = -150; z <= 150; z += 4) box(S, 0x8f97a3, x, 0.4, z, 0.12, 0.8, 0.12); }
    for (const z of [-34, 44]) { for (const x of [-8.8, 8.8]) post(S, 0x8f97a3, x, 0, z, 7.4, 0.18); box(S, 0x8f97a3, 0, 7.2, z, 18, 0.3, 0.3); }
    for (let z = -100; z <= 100; z += 26) prop(S, lampPost(8), 9.2, 0, z, 1, 0);
  } else { road(S, th.road, 8, 2); for (let z = -90; z <= 90; z += 30) prop(S, SCENERY.pole(), -5.6, 0, z); }
  trees(S, 'bac', r, highway ? 26 : 22, -110, 110);
  prop(S, karst(r), 34, 0, -46); prop(S, terraces(), 26, 0, 20, 1, -Math.PI / 2);
  backdrop(S, root, 'bac', r, highway ? 15 : 11);
  return { root, S, r };
}

function driveToBorder(info: ExportInfo, v: Vehicle, highway: boolean): Act {
  const { root, S } = roadScene(info.fromName + info.mode, highway);
  root.add(bake(S, true));
  const signs: THREE.Sprite[] = [];
  if (highway) for (const z of [-34, 44]) { const s = sign(z < 0 ? 'Cửa khẩu · 2 km' : `Cao tốc · ${info.marketName}`, '#1f8a4c', 9, 0, 8.4, z); root.add(s); }
  return runAct({ stage: 2, caption: highway ? `Xe container lạnh chạy cao tốc ra cửa khẩu` : `Xe tải chở ${info.specialtyName} ra cửa khẩu`, duration: 4.6, root, v: v.g, roll: v.roll, hw: 1.4, half: v.half, high: v.high, x: highway ? 3.6 : 1.9, from: 34, to: 38, signs, yaw: [2.55, 2.2], pitch: [0.42, 0.2] });
}

function crossBorder(info: ExportInfo, v: Vehicle, icd: boolean): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.marketName + 'ck')), th = THEMES.bac;
  root.add(slab(th.ground)); road(S, 0x8f97a3, 11, 2); yard(S, 13, 8, 16, 30);
  const gate = borderGate(icd ? 'Cửa khẩu · Cảng cạn' : 'Cửa khẩu quốc tế', 6.6); gate.g.position.z = -6; gate.signs[0].position.z -= 6; root.add(gate.g, gate.signs[0]);
  if (icd) for (let i = 0; i < 9; i++) { const cn = container(CONTAINER_COLORS[i % CONTAINER_COLORS.length], 12, false); prop(S, cn, -24 + (i % 3) * 2.7, Math.floor(i / 6) * 2.75, 4 + (Math.floor(i / 3) % 2) * 13, 1, 0); }
  else { prop(S, crateStack(6), 15, 0, 12, 1.2, 0.3); prop(S, boxTruck(0xf2a53a).g, 15, 0, 22, 1, 0.12); }
  if (!icd) prop(S, warehouse(12, 8, 4.4, 0xf2b25c), -14, 0, 10, 1, Math.PI / 2);
  crowd(S, [[5.6, 0, -0.6, -1.7], [12.4, 0, 0.6, -1.4]], 4); prop(S, lampPost(7), -7, 0, 8, 1, 0);
  // Cột mốc biên giới và dãy núi đá vôi phía bên kia
  box(S, 0xe9edf2, -9.4, 1.0, -8.6, 0.9, 2.0, 0.6); box(S, 0xd9482b, -9.4, 2.2, -8.6, 1.0, 0.4, 0.7);
  for (const [x, z] of [[-40, -70], [30, -84], [-6, -110]]) prop(S, karst(r), x, 0, z, 1.5);
  trees(S, 'bac', r, 22, -60, 50); backdrop(S, root, 'bac', r, 22);
  root.add(bake(S, true));
  const ok = sign('Kiểm dịch đạt ✓', '#1f8a4c', 8, 1.9, 6.6, 6); ok.visible = false; root.add(ok);
  const x = 1.9, stop = 3 + v.half, pts: THREE.Vector3[] = [], D = 5.8;
  v.g.position.set(x, 0, 60); root.add(v.g);
  return {
    stage: 3, caption: `Làm thủ tục hải quan, kiểm dịch rồi qua cửa khẩu sang ${info.marketName}`, duration: D, root, fog: [110, 340],
    update: (t, _dt, c) => {
      const k = seg(t, 0, 2.0), go = Math.max(0, t - 3.9), z = stop + 44 * (1 - k) ** 2 - 4.2 * go * go;
      v.g.position.z = z; v.g.position.y = bob(c.time, k < 1 || go > 0 ? 0.6 : 0); v.roll.turn(60 - z);
      ok.visible = t > 2.3 && t < 4.6; const pop = ease(seg(t, 2.3, 2.7)); ok.scale.set(8 * (0.6 + 0.4 * pop), 2 * (0.6 + 0.4 * pop), 1);
      gate.arm.rotation.z = -1.35 * ease(seg(t, 3.2, 3.9));
      c.shoot(around(pts, x, Math.max(z, -4), 1.4, Math.min(v.half, 6), v.high, [V3(-7.6, 0, -6), V3(7.6, 12.4, -6), V3(9, 0, 6)]), c.portrait ? 0.46 : 0.86, c.portrait ? 0.4 : 0.17, gate.signs);
    },
  };
}

function loadContainer(info: ExportInfo, v: ReturnType<typeof containerTruck>): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'lanh')), th = THEMES.bac;
  root.add(slab(th.ground)); yard(S, 2, 4, 34, 60);
  prop(S, warehouse(22, 12, 6, 0xe9edf2), -13, 0, 4, 1, Math.PI / 2);
  for (const z of [-6, 4, 14]) box(S, 0x6fc8ff, -6.9, 4.9, z, 0.1, 0.6, 2.2, { emissive: 0x6fc8ff });
  for (let i = 0; i < 5; i++) prop(S, pallet(), 8.4 + (i % 2) * 1.7, 0, 18 + Math.floor(i / 2) * 1.8, 1, 0);
  crowd(S, [[7.4, 0, 12.4, 2.6], [-3.4, 0, 16, 1.0]], 5); prop(S, lampPost(7), 12, 0, 2, 1, Math.PI);
  trees(S, 'bac', r, 19, -40, 50); backdrop(S, root, 'bac', r, 24);
  root.add(bake(S, true));
  const label = sign(`Kho lạnh ${info.fromName}`, '#2a7fd6', 12, -6.6, 9.6, 4); root.add(label);
  v.g.position.set(2, 0, 0); root.add(v.g);
  const fl = forklift(), load = pallet(); fl.g.add(fl.fork); fl.fork.add(load); load.position.set(0, 0.08, -1.4); root.add(fl.g);
  const inside: THREE.Group[] = []; for (let i = 0; i < 3; i++) { const p = pallet(); p.position.set(2, 1.3, 5.6 - i * 1.5); p.visible = false; inside.push(p); root.add(p); }
  const pts: THREE.Vector3[] = [], D = 5.8, cyc = 1.25;
  return {
    stage: 1, caption: `Xe nâng xếp ${info.kg.toLocaleString('vi-VN')} kg ${info.specialtyName} vào container lạnh`, duration: D, root, fog: [100, 320],
    update: (t, _dt, c) => {
      const work = t < cyc * 3, k = (t % cyc) / cyc, fwd = k < 0.5, u = fwd ? ease(k * 2) : 1 - ease((k - 0.5) * 2);
      const fz = work ? 17 - u * 8.3 : THREE.MathUtils.lerp(fl.g.position.z, 20, 0.08);
      fl.g.position.set(work ? 2 : THREE.MathUtils.lerp(fl.g.position.x, 6, 0.08), 0, fz); fl.roll.turn(-fz * (fwd ? 1 : 1));
      fl.fork.position.y = work ? 0.2 + 1.2 * seg(u, 0.5, 0.95) : 0.2; load.visible = work && fwd;
      const n = Math.min(3, Math.floor(t / cyc + 0.5)); inside.forEach((p, i) => { p.visible = i < n && t < 4.2; });
      const shut = ease(seg(t, 3.8, 4.4)); v.doors[0].rotation.y = -(1 - shut) * 1.9; v.doors[1].rotation.y = (1 - shut) * 1.9;
      const go = Math.max(0, t - 4.7), dz = -3.0 * go * go; v.g.position.z = dz; v.roll.turn(-dz); v.g.position.y = bob(c.time, go > 0 ? 0.5 : 0);
      c.shoot(around(pts, 2, 3, 1.5, 7.5, 4.1, [V3(4, 0, 19), V3(9.5, 1.4, 20)]), c.portrait ? 0.62 : 1.02, c.portrait ? 0.44 : 0.24, [label]);
    },
  };
}

// ================================================================ đường sắt
function loadTrain(info: ExportInfo, tr: ReturnType<typeof freightTrain>, smoke: Smoke): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'gahang')), th = THEMES.bac;
  root.add(slab(th.ground)); rails(S);
  box(S, 0xd9d2c4, 6.2, 0.45, 0, 9, 0.9, 120); box(S, 0xf2c65c, 2.05, 0.91, 0, 0.26, 0.04, 120);
  prop(S, warehouse(16, 9, 5, 0xd9482b), 14.5, 0.9, 16, 1, -Math.PI / 2);
  box(S, 0xd9482b, 6.4, 5.5, 17, 6, 0.3, 14); for (let z = 11; z <= 23; z += 6) post(S, 0x4fa3a5, 9, 0.9, z, 4.6, 0.14);
  prop(S, crateStack(6), 7.6, 0.9, 3.0, 1.25, 0.2); prop(S, crateStack(6), 8.8, 0.9, 6.2, 1.25, -0.3); prop(S, crateStack(4), 7.2, 0.9, -7.5, 1.25, 0.5);
  crowd(S, [[8.8, 0.9, -3.4, -1.7], [9.4, 0.9, 10.6, -2.0]], 1); prop(S, lampPost(6), 9.6, 0.9, -14, 1, Math.PI);
  box(S, 0xfff0cf, -12, 3.1, 4, 8.4, 6.2, 22); box(S, 0x6fb7d9, -12, 6.5, 4, 10, 0.6, 23.6);
  trees(S, 'bac', r, 22, -60, 60); backdrop(S, root, 'bac', r, 20);
  root.add(bake(S, true));
  const label = sign(`Ga hàng hoá ${info.fromName}`, '#2a7fd6', 13, -7.6, 9.6, 4); root.add(label);
  tr.g.position.set(0, 0.3, 0); root.add(tr.g, smoke.g);
  const ws = [new Walker(1.3, 'sot'), new Walker(1.3, 'sot')]; ws.forEach((w) => root.add(w.g));
  const path = [V3(7.0, 0.9, 3.4), V3(4.4, 0.9, 0.2), V3(2.2, 0.9, BOXCAR_Z)], pts: THREE.Vector3[] = [], D = 5.8;
  return {
    stage: 1, caption: `Xếp ${info.kg.toLocaleString('vi-VN')} kg ${info.specialtyName} lên toa hàng ở ga ${info.fromName}`, duration: D, root, fog: [110, 330],
    update: (t, _dt, c) => {
      const work = t < 3.7;
      ws.forEach((w, i) => { haul(w, path, t / 1.2 + i * 0.5, c.time, work); if (!work) { w.g.position.lerp(V3(6.4 + i * 1.3, 0.9, 1.8), 0.12); w.face(-1, -0.5); } });
      const n = Math.min(6, Math.floor(t * 1.7)); tr.hold.children.forEach((m, i) => { m.visible = i < n; });
      const go = Math.max(0, t - 4.5), dz = -3.0 * go * go; tr.door.position.z = BOXCAR_Z - 2.5 * (1 - ease(seg(t, 3.8, 4.4)));
      tr.g.position.z = dz; tr.roll.turn(-dz); tr.g.position.y = 0.3 + bob(c.time, go > 0 ? 0.5 : 0);
      smoke.update(c.time, 0.5, 4.4, dz - 15.8, 2 + go * 6, 0.45);
      c.shoot(around(pts, 0, -4, 1.4, 9, 4.2, [V3(9.4, 0.9, 7.5)]), c.portrait ? 2.5 : 2.15, c.portrait ? 0.42 : 0.2, [label]);
    },
  };
}
function trainRun(info: ExportInfo, tr: ReturnType<typeof freightTrain>, smoke: Smoke): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'duongsat')), th = THEMES.bac;
  root.add(slab(th.ground)); rails(S);
  // Cầu sắt qua sông ở giữa cảnh, hầm xuyên núi phía trước
  box(S, 0x7fd3e8, 0, 0.0, 0, 900, 0.3, 30, { rough: 0.2 }); box(S, 0x8f97a3, 0, 0.12, 0, 6.4, 0.3, 36);
  const steel = 0xd9482b;
  for (const x of [-3.1, 3.1]) { box(S, steel, x, 6.2, 0, 0.36, 0.36, 34); box(S, steel, x, 0.7, 0, 0.36, 0.5, 34); for (let z = -17, i = 0; z <= 17.1; z += 5.67, i++) { box(S, steel, x, 3.4, z, 0.3, 5.6, 0.3); if (z < 17) { const d = mesh(GEO.box, mat(steel), x, 3.4, z + 2.83, 0.22, 7.9, 0.22); d.rotation.x = (i % 2 ? 1 : -1) * 0.8; S.add(d); } } }
  for (let z = -17; z <= 17.1; z += 5.67) box(S, steel, 0, 6.2, z, 6.4, 0.3, 0.3);
  for (const z of [-12, 0, 12]) box(S, 0xd9d2c4, 0, -1.6, z, 5, 3.2, 2.4);
  for (let i = 0; i < 5; i++) prop(S, SCENERY.ghe(), (i % 2 ? 1 : -1) * (14 + i * 9), 0.12, -9 + r() * 18, 1.3, Math.PI / 2);
  prop(S, tunnelHill(40, th.mountains ?? 0x9cc79a, r), 0, 0, -104);
  for (const [x, z] of [[30, -40], [-36, 40], [38, 50]]) prop(S, karst(r), x, 0, z, 1.2);
  prop(S, terraces(), 24, 0, 34, 1, -Math.PI / 2);
  trees(S, 'bac', r, 24, 20, 110); trees(S, 'bac', r, 24, -62, -20); backdrop(S, root, 'bac', r, 13);
  root.add(bake(S, true)); root.add(smoke.g);
  return runAct({
    stage: 2, caption: `Tàu hàng liên vận chở ${info.specialtyName} qua cầu, xuyên núi lên biên giới`, duration: 4.8, root, v: tr.g, roll: tr.roll, hw: 1.4, half: 16, high: 4.4, y: 0.3, from: 60, to: 12, fog: [120, 360], yaw: [2.6, 2.2], pitch: [0.44, 0.2],
    tick: (z, _t, c) => smoke.update(c.time, 0.5, 4.4, z - 15.8, 14, 0.5),
  });
}
function trainBorder(info: ExportInfo, tr: ReturnType<typeof freightTrain>, smoke: Smoke): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.marketName + 'gabg')), th = THEMES.bac;
  root.add(slab(th.ground)); rails(S);
  box(S, 0xd9d2c4, 6.2, 0.45, 8, 9, 0.9, 90); box(S, 0xf2c65c, 2.05, 0.91, 8, 0.26, 0.04, 90);
  box(S, 0xfff0cf, 14, 3.6, 10, 9, 5.4, 22); box(S, 0x2f6fd0, 14, 6.5, 10, 10.4, 0.5, 23.6); for (const z of [3, 10, 17]) box(S, 0xa9dcf2, 9.46, 3.6, z, 0.08, 2.0, 3.0, { rough: 0.25 });
  crowd(S, [[6.4, 0.9, -4.5, -1.6], [7.6, 0.9, 4.4, -1.8], [8.2, 0.9, 13, -1.5]], 3); prop(S, crateStack(4), 8.6, 0.9, 22, 1.2, 0.3); prop(S, lampPost(6), 9.4, 0.9, -8, 1, Math.PI);
  for (const [x, z] of [[-36, -64], [28, -80]]) prop(S, karst(r), x, 0, z, 1.5);
  trees(S, 'bac', r, 22, -60, 60); backdrop(S, root, 'bac', r, 20);
  root.add(bake(S, true));
  const gate = borderGate('Ga liên vận quốc tế', 4.4, -1); gate.g.position.z = -18; gate.arm.visible = false; gate.signs[0].position.set(8, 7.6, -11); root.add(gate.g, smoke.g, gate.signs[0], mesh(GEO.cyl, mat(0x8f97a3), 8, 3.6, -11, 0.1, 5.4, 0.1));
  const ok = sign('Kiểm dịch đạt ✓', '#1f8a4c', 8, 2, 8, -8); ok.visible = false; root.add(ok);
  const pts: THREE.Vector3[] = [], D = 5.6; tr.g.position.set(0, 0.3, 70); root.add(tr.g); tr.door.position.z = BOXCAR_Z;
  return {
    stage: 3, caption: `Tàu vào ga biên giới, hải quan kiểm hàng rồi sang ${info.marketName}`, duration: D, root, fog: [110, 340],
    update: (t, _dt, c) => {
      const k = seg(t, 0, 2.2), go = Math.max(0, t - 4.0), z = 2 + 62 * (1 - k) ** 2 - 3.6 * go * go;
      tr.g.position.z = z; tr.roll.turn(70 - z); tr.g.position.y = 0.3 + bob(c.time, k < 1 || go > 0 ? 0.5 : 0);
      ok.visible = t > 2.5 && t < 4.6; const pop = ease(seg(t, 2.5, 2.9)); ok.scale.set(8 * (0.6 + 0.4 * pop), 2 * (0.6 + 0.4 * pop), 1);
      smoke.update(c.time, 0.5, 4.4, z - 15.8, k < 1 ? 8 : 2 + go * 6, 0.45);
      c.shoot(around(pts, 0, -10, 1.4, 9, 4.4, [V3(-5.4, 0, -18), V3(5.4, 12.4, -18), V3(9.4, 0.9, 0)]), c.portrait ? 2.05 : 1.95, c.portrait ? 0.42 : 0.18, gate.signs);
    },
  };
}

// ================================================================ hàng không
function loadPlane(info: ExportInfo, pl: ReturnType<typeof freighter>): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'sbhang'));
  root.add(slab(THEMES.nam.ground));
  box(S, 0xb9bfc9, 2, 0.03, 0, 60, 0.12, 260); box(S, 0xf2c65c, 0, 0.1, 0, 0.3, 0.04, 260);
  for (const z of [-14, 14]) box(S, 0xfffaf0, 10, 0.1, z, 16, 0.04, 0.3);
  prop(S, warehouse(26, 14, 7, 0x2f6fd0), -32, 0, 0, 1, Math.PI / 2); box(S, 0xfffaf0, -24.9, 7.8, 0, 0.3, 1.6, 12);
  for (let i = 0; i < 4; i++) { box(S, 0x8f97a3, 12 + i * 2.6, 0.5, 4, 2.2, 0.2, 2.0); box(S, 0xe9edf2, 12 + i * 2.6, 1.5, 4, 2.0, 1.8, 1.8); box(S, CONTAINER_COLORS[i], 12 + i * 2.6, 1.5, 4.92, 1.6, 0.5, 0.04); }
  box(S, 0xf2c65c, 10.2, 0.8, 4, 1.6, 1.0, 2.0); box(S, 0x4a5160, 10.2, 1.5, 4.3, 1.2, 0.5, 1.0);
  crowd(S, [[8.6, 0, -6.4, -1.4], [9.6, 0, -1.2, -2.0]], 6);
  for (const [x, z] of [[11, -12], [11, 10], [-12, -12], [-12, 12]]) S.add(mesh(GEO.cone, mat(0xf08a24), x, 0.4, z, 0.25, 0.7, 0.25));
  for (const z of [-40, 36]) prop(S, lampPost(8), -22, 0, z, 1, Math.PI);
  backdrop(S, root, 'nam', r, 50);
  root.add(bake(S, true));
  const label = sign(`Nhà ga hàng hoá ${info.fromName}`, '#2a7fd6', 15, -24.6, 11, 0); root.add(label);
  pl.g.position.set(0, FREIGHTER_Y, 0); root.add(pl.g);
  const loader = new THREE.Group(); loader.add(bake(beltLoader(), true)); loader.position.set(5.2, 0, FREIGHTER_DOOR_Z); root.add(loader);
  const boxes: THREE.Group[] = []; for (let i = 0; i < 5; i++) { const b = crate(i); boxes.push(b); root.add(b); }
  const pts: THREE.Vector3[] = [], D = 5.8;
  return {
    stage: 1, caption: `Băng chuyền đưa ${info.kg.toLocaleString('vi-VN')} kg ${info.specialtyName} lên máy bay chở hàng`, duration: D, root, fog: [170, 440],
    update: (t, _dt, c) => {
      const work = t < 3.6;
      boxes.forEach((b, i) => { const k = ((t * 0.55 + i / boxes.length) % 1); b.visible = work; b.position.set(loader.position.x + 2.2 - k * 5.6, 1.0 + k * 2.3, FREIGHTER_DOOR_Z); });
      loader.position.x = 5.2 + 10 * ease(seg(t, 3.7, 4.6));
      pl.door.rotation.z = 2.2 * (1 - ease(seg(t, 3.7, 4.4)));
      const go = Math.max(0, t - 4.6); pl.g.position.z = -2.4 * go * go; pl.g.position.y = FREIGHTER_Y + bob(c.time, go > 0 ? 0.5 : 0);
      c.shoot(around(pts, 0, 0, 10.4, 11, 7.6, [V3(11, 0, 5)]), c.portrait ? 2.2 : 2.0, c.portrait ? 0.48 : 0.22, [label]);
    },
  };
}
function takeOff(info: ExportInfo, pl: ReturnType<typeof freighter>): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'catcanh'));
  root.add(slab(THEMES.nam.ground));
  box(S, 0x8f97a3, 0, 0.02, -60, 26, 0.12, 520);
  for (let z = -300; z < 190; z += 16) box(S, 0xffffff, 0, 0.06, z, 0.8, 0.12, 7);
  for (const x of [-12.4, 12.4]) { box(S, 0xfbf3df, x, 0.04, -60, 0.5, 0.14, 520); for (let z = -300; z < 190; z += 12) S.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), x + Math.sign(x) * 1.2, 0.25, z, 0.24)); }
  for (let z = 150; z < 186; z += 3) box(S, 0xffffff, -8 + ((z - 150) % 6) * 2.7, 0.06, 176, 1.6, 0.12, 8);
  prop(S, warehouse(26, 14, 7, 0x2f6fd0), -44, 0, 60, 1, Math.PI / 2);
  S.add(mesh(GEO.cyl, mat(0xfffaf0), -46, 12, 10, 2.2, 24, 2.2), mesh(GEO.cyl, mat(0x7fb9d9, { rough: 0.25 }), -46, 24.8, 10, 3.4, 2.4, 3.4), mesh(GEO.cyl, mat(0x2f6fd0), -46, 26.4, 10, 3.7, 0.6, 3.7));
  for (let i = 0; i < 30; i++) prop(S, SCENERY[['palm', 'leaf', 'house', 'rice'][i % 4]](), (i % 2 ? 1 : -1) * (26 + r() * 60), 0, -240 + r() * 400, 1.2, r() * 6);
  backdrop(S, root, 'nam', r, 60);
  root.add(bake(S, true)); root.add(pl.g);
  const pts: THREE.Vector3[] = [], D = 4.8;
  return {
    stage: 2, caption: `Máy bay chở hàng cất cánh đi ${info.marketName}`, duration: D, root, fog: [200, 560],
    update: (t, _dt, c) => {
      const z = 120 - 7.5 * t * t - 14 * t, up = Math.max(0, t - 2.4), y = FREIGHTER_Y + 2.6 * up * up;
      pl.g.position.set(0, y + bob(c.time, up > 0 ? 0 : 0.5), z); pl.g.rotation.x = Math.min(0.24, up * 0.22);
      c.shoot(around(pts, 0, z, 10.4, 11, 6, [V3(0, y + 3, z)]), (c.portrait ? 2.5 : 2.25) - t * 0.08, c.portrait ? 0.36 : 0.12);
    },
  };
}
function cruiseAir(info: ExportInfo, pl: ReturnType<typeof freighter>): Act {
  const root = new THREE.Group(), r = rng(hashOf(info.marketName + 'may')), C = new THREE.Group(), sea = seaSurface(1700, 60);
  sea.mesh.position.y = -70; root.add(sea.mesh);
  for (let i = 0; i < 60; i++) { const cl = cloud(r); const cx = (r() - 0.5) * 420; cl.position.set(Math.abs(cx) < 34 ? cx + Math.sign(cx || 1) * 40 : cx, -30 - r() * 26, -r() * 620 + 140); cl.scale.setScalar(1.1 + r() * 1.3); C.add(cl); }
  for (let i = 0; i < 9; i++) { const o = SCENERY.islet(); o.position.set((r() - 0.5) * 300, -70, -r() * 500); o.scale.setScalar(5 + r() * 5); C.add(o); }
  const clouds = bake(C); root.add(clouds); pl.g.rotation.x = 0; pl.g.position.set(0, 0, 0); root.add(pl.g);
  const pts: THREE.Vector3[] = [], D = 4.4;
  return {
    stage: 3, caption: `Hàng tươi bay thẳng tới ${info.marketName}, vài giờ là tới`, duration: D, root, fog: [260, 760],
    update: (t, _dt, c) => {
      clouds.position.z = t * 52; sea.tick(c.time, -t * 52); pl.g.rotation.z = Math.sin(c.time * 0.7) * 0.05; pl.g.position.y = Math.sin(c.time * 0.9) * 0.4;
      c.shoot(around(pts, 0, 0, 10.4, 11.5, 5, [V3(0, -2.6, 0)]), (c.portrait ? 2.5 : 2.1) - t * 0.14, c.portrait ? 0.34 : 0.16);
    },
  };
}

// ================================================================ đường thuỷ
interface Water { sea: Sea; wake: Wake; smoke: Smoke; gulls: Gulls }
function water(root: THREE.Group, half: number, len: number): Water {
  const w = { sea: seaSurface(1500, 140), wake: new Wake(half, len, 36), smoke: new Smoke(8), gulls: new Gulls(5) };
  root.add(w.sea.mesh, w.wake.g, w.smoke.g, w.gulls.g); return w;
}
function shoreline(S: THREE.Group, root: THREE.Group, r: () => number, z: number, zone: 'nam' | 'dao' = 'nam') {
  box(S, 0xf6ecc6, 0, 0.5, z + 116, 800, 1.4, 232); box(S, THEMES[zone].ground, 0, 0.56, z + 140, 800, 1.4, 190); box(S, 0xcfc8ba, 0, 0.55, z + 0.6, 800, 1.5, 1.6);
  for (let i = 0; i < 22; i++) prop(S, SCENERY[['palm', 'house', 'palm', 'leaf'][i % 4]](), -90 + r() * 190, 1.2, z + 26 + r() * 60, 1 + r() * 0.4, r() * 6);
  for (let i = 0; i < 6; i++) { const h = 22 + r() * 20, m = mesh(GEO.sphere, mat(i % 2 ? 0x86c08a : 0x9cc79a, { rough: 1 }), -160 + i * 60 + r() * 20, 0, z + 150 + r() * 40, 40 + r() * 20, h, 30); m.castShadow = false; root.add(m); }
}

function loadCoaster(info: ExportInfo, sh: ReturnType<typeof coaster>): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'bensong')), W = water(root, 2.6, 28);
  shoreline(S, root, r, 15);
  box(S, 0xd9d2c4, 8, 0.75, 23, 40, 1.3, 14); prop(S, warehouse(13, 8, 4.4, 0x4fa3a5), -6, 1.4, 25, 1, Math.PI); prop(S, harbourCrane(10), 22, 1.4, 19, 0.8, Math.PI / 2);
  box(S, 0xc99a68, 6.6, 1.2, 0, 4.6, 0.3, 30); box(S, 0xb8875a, 6.6, 1.36, 0, 4.2, 0.04, 30);
  for (let z = -13; z <= 13; z += 6.5) { for (const x of [4.6, 8.6]) post(S, 0x8a6a4a, x, -0.8, z, 2.4, 0.26); post(S, 0x2e3440, 4.7, 1.3, z, 0.5, 0.22); }
  prop(S, crateStack(6), 7.4, 1.36, 8.6, 1.2, 0.2); prop(S, crateStack(6), 7.8, 1.36, 11.6, 1.2, -0.3); crowd(S, [[8.2, 1.36, 4.2, -1.7], [10.6, 1.4, 19.5, 3.0]], 2);
  for (let i = 0; i < 3; i++) prop(S, SCENERY.ghe(), 15 + i * 4.4, 0.05, 11 + (i % 2) * 1.6, 1.3, Math.PI / 2);
  for (let i = 0; i < 6; i++) prop(S, SCENERY[['ghe', 'islet', 'seastone'][i % 3]](), -24 - r() * 70, 0, -r() * 100, 1.2 + r() * 0.6, r() * 6);
  prop(S, lighthouse(), -66, 0, -60, 0.9);
  root.add(bake(S, true));
  const label = sign(`Bến tàu hàng ${info.fromName}`, '#2a7fd6', 13, 10, 9, 17); root.add(label);
  root.add(sh.g);
  const plank = mesh(GEO.box, mat(0xc99a68), 3.6, 1.5, 3.4, 2.6, 0.12, 1.2); plank.rotation.z = -0.1; root.add(plank);
  const ws = [new Walker(1.3, 'sot'), new Walker(1.3, 'sot')]; ws.forEach((w) => root.add(w.g));
  const d = COASTER_DECK + 0.25, path = [V3(7.2, 1.38, 8.4), V3(6.2, 1.38, 3.4), V3(3.2, d, 3.4), V3(1.6, d + 0.4, 1.6)], pts: THREE.Vector3[] = [], D = 5.8;
  return {
    stage: 1, caption: `Bốc ${info.kg.toLocaleString('vi-VN')} kg ${info.specialtyName} xuống tàu hàng nhỏ ở bến ${info.fromName}`, duration: D, root, fog: WATER_FOG,
    update: (t, _dt, c) => {
      const work = t < 3.8;
      ws.forEach((w, i) => { haul(w, path, t / 1.3 + i * 0.5, c.time, work); if (!work) { w.g.position.lerp(V3(6.8, 1.38, 5.4 + i * 1.4), 0.12); w.face(-1, -0.4); } });
      const n = Math.min(12, Math.floor(t * 3.4)); sh.hold.children.forEach((m, i) => { m.visible = i < n; });
      const lift = ease(seg(t, 3.9, 4.4)); plank.visible = lift < 1; plank.position.x = 3.6 + lift * 1.4;
      const go = Math.max(0, t - 4.5), z = -2.0 * go * go;
      sh.g.position.set(0, 0.2 + Math.sin(c.time * 1.6) * 0.06, z); sh.g.rotation.z = Math.sin(c.time * 1.1) * 0.012;
      W.sea.tick(c.time); W.wake.update(c.time, 0, z, 9.8, 8.4, Math.min(1, go * 0.7)); W.smoke.update(c.time, 0, 7.4, z + 6.6, 3 + go * 6, 0.4); W.gulls.update(c.time, 2, 10, z);
      c.shoot(around(pts, 0, 0, 2.8, 9.8, 7.4, [V3(9.2, 1.3, 12.5), V3(9.2, 1.3, -10)]), c.portrait ? 2.75 : 2.0, c.portrait ? 0.46 : 0.24, [label]);
    },
  };
}
function sailOut(info: ExportInfo, ship: THREE.Group, hw: number, bow: number, stern: number, high: number, funnel: [number, number], giant: boolean, last: boolean): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + info.mode + (last ? 'khoi' : 'cua'))), W = water(root, hw, giant ? 110 : 30);
  const L = giant ? 150 : 90;
  if (!last) {
    // Luồng ra cửa biển: hai bờ đất, phao luồng, hải đăng ở mũi đất
    for (const sd of [-1, 1]) { const x = sd * (giant ? 130 : 66); box(S, 0xf6ecc6, x, 0.4, 60, 90, 1.2, 240); box(S, THEMES.nam.ground, x + sd * 10, 0.5, 60, 80, 1.3, 230); for (let i = 0; i < 16; i++) prop(S, SCENERY[i % 3 ? 'palm' : 'house'](), x + sd * (r() * 30 - 20), 1.1, -40 + r() * 190, 1.1 + r() * 0.4, r() * 6); }
    prop(S, lighthouse(), -(giant ? 96 : 40), 0, -60, giant ? 1.5 : 1); if (giant) { prop(S, harbourCrane(26), 110, 1.2, 110, 1.6, Math.PI); for (let i = 0; i < 12; i++) prop(S, container(CONTAINER_COLORS[i % 8], 12, false), 104 + (i % 3) * 3, 1.1 + Math.floor(i / 6) * 2.75, 60 + (Math.floor(i / 3) % 2) * 14, 1.4, 0); }
  } else for (let i = 0; i < 8; i++) prop(S, SCENERY[i % 2 ? 'islet' : 'seastone'](), (i % 2 ? 1 : -1) * (60 + r() * 120), 0, -L + r() * L * 2, 2 + r() * 2, r() * 6);
  for (let z = -L, i = 0; z < L; z += giant ? 44 : 26, i++) { prop(S, buoy(0xe0342b), -(hw + (giant ? 18 : 9)), -0.1, z, giant ? 2 : 1); prop(S, buoy(0x4fa86a), hw + (giant ? 18 : 9), -0.1, z + 13, giant ? 2 : 1); }
  for (let i = 0; i < 5; i++) prop(S, SCENERY.ghe(), (i % 2 ? 1 : -1) * (hw + 14 + r() * 24), 0.05, -L * 0.6 + i * L * 0.3, giant ? 1.8 : 1.3, r() * 6);
  root.add(bake(S, true));
  // Tàu lớn có tàu lai dắt và một tàu hàng nhỏ đi cạnh để thấy rõ kích cỡ
  let mate: THREE.Group | null = null;
  if (giant) { mate = bake(coaster().g, true); root.add(mate); }
  const pts: THREE.Vector3[] = [], D = last ? 4.4 : 4.8, speed = giant ? 9 : 13, from = last ? 20 : 34;
  ship.position.set(0, 0, from); ship.rotation.set(0, 0, 0); root.add(ship);
  return {
    stage: last ? 3 : 2, caption: last ? `${giant ? 'Tàu container' : 'Tàu hàng'} ra khơi, đưa ${info.specialtyName} tới ${info.marketName}` : giant ? `Tàu container khổng lồ rời cảng nước sâu` : `Tàu hàng rời bến, theo luồng ra cửa biển`, duration: D, root, fog: giant ? [260, 760] : WATER_FOG,
    update: (t, _dt, c) => {
      const z = from - speed * t, k = t / D;
      ship.position.set(0, (giant ? 0 : 0.2) + Math.sin(c.time * 1.4) * (giant ? 0.05 : 0.12), z); ship.rotation.z = Math.sin(c.time * 1.1) * (giant ? 0.004 : 0.016); ship.rotation.x = Math.sin(c.time * 1.3) * (giant ? 0.002 : 0.012);
      if (mate) { mate.position.set(hw + 12, 0.2 + Math.sin(c.time * 1.6) * 0.1, z - 20 + t * 2.4); }
      W.sea.tick(c.time); W.wake.update(c.time, 0, z, bow, stern, 1); W.smoke.update(c.time, 0, high + 1, z + funnel[1], giant ? 26 : 12, giant ? 1.6 : 0.45); W.gulls.update(c.time, 0, high + 5, z - bow * 0.3);
      const ex = mate ? [V3(hw + 15, 0, z - 20 + t * 2.4)] : [];
      c.shoot(around(pts, 0, z, hw, giant ? (c.portrait ? 34 : 56) : bow, high, ex), (c.portrait ? (last ? 2.86 : 2.7) : last ? 2.5 : 2.1) - k * 0.3, c.portrait ? (giant ? 0.34 : 0.42) : last ? 0.1 : 0.2);
    },
  };
}

function loadGiant(info: ExportInfo, ship: ReturnType<typeof containerShip>): Act {
  const root = new THREE.Group(), S = new THREE.Group(), r = rng(hashOf(info.fromName + 'nuocsau')), W = water(root, GIANT.half, 60), Q = 2.6, edge = GIANT.half + 1.2;
  // Cầu cảng bê tông cao, bãi container, đèn pha, đường xe đầu kéo
  box(S, 0xcfc8ba, edge + 60, Q / 2, 0, 120, Q, 300); box(S, 0xf2c65c, edge + 0.4, Q + 0.02, 0, 0.5, 0.04, 300);
  for (let z = -100; z <= 100; z += 14) { box(S, 0x2e3440, edge + 0.6, Q + 0.3, z, 0.7, 0.6, 0.7); const f = mesh(new THREE.TorusGeometry(0.9, 0.34, 6, 12), mat(0x2e3440), edge - 0.2, 1.5, z + 7); f.rotation.y = Math.PI / 2; S.add(f); }
  for (let i = 0; i < 48; i++) prop(S, container(CONTAINER_COLORS[(i * 5) % 8], 12, false), edge + 26 + (i % 4) * 2.7, Q + Math.floor(i / 24) * 2.75 + (i % 7 === 0 ? 2.75 : 0), -50 + (Math.floor(i / 4) % 6) * 13.4, 1, 0);
  prop(S, harbourCrane(20), edge + 44, Q, -56, 1.3, Math.PI / 2);
  for (const z of [-30, 30]) prop(S, lampPost(16), edge + 22, Q, z, 1.6, 0);
  prop(S, warehouse(30, 16, 8, 0x2f6fd0), edge + 70, Q, 0, 1, -Math.PI / 2);
  crowd(S, [[edge + 5, Q, 9, -1.6], [edge + 6.4, Q, -8.6, -1.9]], 3);
  for (let i = 0; i < 7; i++) prop(S, SCENERY[['ghe', 'islet', 'seastone'][i % 3]](), -40 - r() * 120, 0, (r() - 0.5) * 240, 1.6 + r(), r() * 6);
  prop(S, lighthouse(), -120, 0, -90, 1.4);
  root.add(bake(S, true));
  const label = sign(`Cảng nước sâu ${info.fromName}`, '#2a7fd6', 22, edge + 24, 46, 0); root.add(label);
  ship.g.position.set(0, 0, 0); root.add(ship.g);
  const crane = shipCrane(); crane.g.position.set(edge + 3, Q, 0); root.add(crane.g);
  const full = ship.stacks.count, hang = bake(container(0xd9482b, 12, true), true); hang.position.y = -2.75; crane.spreader.add(hang);
  const tk = containerTruck(0x2f6fd0); tk.g.position.set(edge + 10, Q, 0); tk.box.visible = false; tk.doors.forEach((d) => { d.visible = false; }); root.add(tk.g);
  const coasterMate = bake(coaster().g, true); coasterMate.position.set(-GIANT.half - 14, 0.2, 26); root.add(coasterMate);
  const pts: THREE.Vector3[] = [], D = 6.2, cyc = 2.3, shipX = -(edge + 3) + 2.7, truckX = 7;
  return {
    stage: 1, caption: `Cẩu giàn xếp container ${info.specialtyName} lên tàu container khổng lồ`, duration: D, root, fog: [260, 760],
    update: (t, _dt, c) => {
      const work = t < cyc * 2, k = (t % cyc) / cyc;
      // Một chu kỳ: hạ xuống xe → nhấc lên → chạy ra tàu → hạ xuống chồng → kéo lên → chạy về
      const drop = work ? (k < 0.14 ? 1 : k < 0.28 ? 1 - ease(seg(k, 0.14, 0.28)) : k < 0.5 ? 0 : k < 0.64 ? ease(seg(k, 0.5, 0.64)) * 0.42 : k < 0.76 ? 0.42 * (1 - ease(seg(k, 0.64, 0.76))) : k < 0.9 ? 0 : ease(seg(k, 0.9, 1))) : 0;
      const tx = work ? (k < 0.28 ? truckX : k < 0.5 ? THREE.MathUtils.lerp(truckX, shipX, ease(seg(k, 0.28, 0.5))) : k < 0.76 ? shipX : THREE.MathUtils.lerp(shipX, truckX, ease(seg(k, 0.76, 0.9)))) : THREE.MathUtils.lerp(crane.trolley.position.x, 10, 0.06);
      const depth = 3 + drop * (crane.top - 8.4);
      crane.trolley.position.x = tx; crane.spreader.position.y = -depth; crane.cable.scale.y = depth; crane.cable.position.y = -depth / 2;
      hang.visible = work && k < 0.64;
      ship.stacks.count = Math.min(full, full - 2 + Math.floor(t / cyc + 0.36));
      tk.g.position.z = work ? 0 : tk.g.position.z + 0.3; tk.roll.turn(-tk.g.position.z);
      ship.g.position.y = Math.sin(c.time * 1.2) * 0.04;
      W.sea.tick(c.time); W.wake.update(c.time, 0, 0, GIANT.bow, GIANT.stern, 0); W.smoke.update(c.time, 0, GIANT.deck + 18, 43, 5, 1.3); W.gulls.update(c.time, 0, 30, -20);
      c.shoot(around(pts, 2, 0, GIANT.half + 4, c.portrait ? 16 : 30, 36, [V3(edge + 16, Q, 6)]), c.portrait ? 2.56 : 2.3, c.portrait ? 0.36 : 0.2, [label]);
    },
  };
}

/** Dựng kịch bản ba cảnh cho một đường xuất khẩu. */
export function exportPlan(info: ExportInfo): (() => Act)[] {
  const m = info.mode;
  if (m === 'xe_tai') { let v: Vehicle; const mk = () => (v ??= loadedTruck()); return [() => loadTruck(info), () => driveToBorder(info, mk(), false), () => crossBorder(info, mk(), false)]; }
  if (m === 'container') { let v: ReturnType<typeof containerTruck>; const mk = () => (v ??= containerTruck()); return [() => loadContainer(info, mk()), () => { mk().doors.forEach((d) => { d.rotation.y = 0; }); return driveToBorder(info, mk(), true); }, () => crossBorder(info, mk(), true)]; }
  if (m === 'tau_hoa') { let v: ReturnType<typeof freightTrain>; const mk = () => (v ??= freightTrain()); return [() => loadTrain(info, mk(), new Smoke(8, 0xe2e2de)), () => trainRun(info, mk(), new Smoke(8, 0xe2e2de)), () => trainBorder(info, mk(), new Smoke(8, 0xe2e2de))]; }
  if (m === 'hang_khong') { let v: ReturnType<typeof freighter>; const mk = () => (v ??= freighter()); return [() => loadPlane(info, mk()), () => { mk().door.rotation.z = 0; return takeOff(info, mk()); }, () => cruiseAir(info, mk())]; }
  if (m === 'tau_nho') {
    let v: ReturnType<typeof coaster>; const mk = () => (v ??= coaster());
    return [() => loadCoaster(info, mk()), () => sailOut(info, mk().g, 2.8, 9.8, 8.4, 7.4, [0, 6.6], false, false), () => sailOut(info, mk().g, 2.8, 9.8, 8.4, 7.4, [0, 6.6], false, true)];
  }
  let v: ReturnType<typeof containerShip>; const mk = () => (v ??= containerShip());
  return [() => loadGiant(info, mk()), () => { mk().stacks.count = mk().stacks.instanceMatrix.count; return sailOut(info, mk().g, GIANT.half, GIANT.bow, GIANT.stern, GIANT.deck + 18, [0, 43], true, false); }, () => sailOut(info, mk().g, GIANT.half, GIANT.bow, GIANT.stern, GIANT.deck + 18, [0, 43], true, true)];
}
/** Xe tải đã chất đầy sọt (dùng cho cảnh chạy đường và qua cửa khẩu). */
function loadedTruck(): Vehicle {
  const v = boxTruck(); for (let i = 0; i < 12; i++) { const c = crate(i); c.position.set(-0.62 + (i % 2) * 1.24, 1.08 + (i >= 8 ? 0.66 : 0), -0.6 + (Math.floor(i / 2) % 4) * 1.15); v.g.add(c); } return v;
}
