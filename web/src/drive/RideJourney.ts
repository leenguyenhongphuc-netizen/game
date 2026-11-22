// Cảnh 4 "trên đường": phương tiện đứng yên ở gốc toạ độ (đầu hướng -z), cả tuyến đường được dựng sẵn rồi trôi ngược lại.
// Cảnh quan chuyển dần từ miền vùng đi sang miền vùng đến, có điểm nhấn riêng từng miền và từng loại phương tiện.
import * as THREE from 'three';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { SCENERY, THEMES, bake } from './RideKit.ts';
import { buildBus, buildFerry, buildPlane, buildTrain, buoy, cableBridge, chamTower, coffeeHill, fishRaft, karst, lighthouse, nhaRong, terraces, tunnelHill } from './RideParts.ts';
import type { Act, Ctx, RideMode } from './RideSets.ts';

interface Spec { speed: number; half: number; radius: number; height: number; look: number; wide: number }
const SPECS: Record<RideMode, Spec> = {
  xe_khach: { speed: 30, half: 5.2, radius: 18, height: 6, look: 1.6, wide: 1.4 },
  tau_hoa: { speed: 34, half: 19, radius: 31, height: 10, look: 2, wide: 1.4 },
  may_bay: { speed: 95, half: 9, radius: 22, height: 5, look: 1, wide: 8.4 },
  tau_thuy: { speed: 22, half: 8.5, radius: 24, height: 9, look: 2.2, wide: 2.6 },
};
const CRUISE = 62; // độ cao bay bằng, phía trên tầng mây
const WATER = 0x7fd3e8;
const ss = THREE.MathUtils.smoothstep;

export interface JourneyInfo { mode: RideMode; zoneA: Zone; zoneB: Zone; fromIsland: boolean; toIsland: boolean; seconds: number; caption: string; seed: number; onTick?: (p: number) => void }

export class Journey implements Act {
  readonly stage = 4 as const;
  readonly caption: string;
  readonly duration: number;
  readonly root = new THREE.Group();
  readonly fog: [number, number];
  dist = 0;
  alt = 0;
  progress = 0;
  readonly total: number;
  private world = new THREE.Group();
  private vehicle: THREE.Group;
  private spec: Spec;
  private puffs: { m: THREE.Mesh; life: number }[] = [];
  private gulls: THREE.Group[] = [];
  private info: JourneyInfo;

  constructor(info: JourneyInfo) {
    this.info = info; this.caption = info.caption; this.duration = info.seconds;
    this.spec = SPECS[info.mode];
    this.total = this.spec.speed * info.seconds;
    this.fog = info.mode === 'may_bay' ? [240, 680] : [110, 330];
    const raw = info.mode === 'xe_khach' ? buildBus() : info.mode === 'tau_hoa' ? buildTrain() : info.mode === 'may_bay' ? buildPlane() : buildFerry();
    this.vehicle = bake(raw, true);
    this.root.add(this.world, this.vehicle);
    this.build();
    if (info.mode === 'tau_hoa') for (let i = 0; i < 10; i++) { const m = mesh(GEO.ball, mat(0xffffff, { transparent: 0.75 }), 0, -50, 0, 0.5); m.castShadow = false; this.root.add(m); this.puffs.push({ m, life: i * 0.12 }); }
    if (info.mode === 'tau_thuy') for (let i = 0; i < 5; i++) {
      const gull = new THREE.Group();
      for (const s of [-1, 1]) { const w = mesh(GEO.box, mat(0xffffff), s * 0.55, 0, 0, 1.1, 0.05, 0.34); w.castShadow = false; gull.add(w); }
      gull.add(mesh(GEO.ball, mat(0xffffff), 0, 0, 0, 0.2, 0.16, 0.4)); this.gulls.push(gull); this.root.add(gull);
    }
  }

  // ------------------------------------------------------------ dựng tuyến đường
  private build() {
    const { mode, zoneA: zA, zoneB: zB } = this.info, L = this.total;
    const r = rng(this.info.seed), W = this.world, sea = mode === 'tau_thuy', air = mode === 'may_bay';
    const S = new THREE.Group(); // mọi vật tĩnh gộp chung một lưới
    const put = <T extends THREE.Object3D>(o: T, x: number, y: number, s: number): T => { o.position.set(x, y, -s); S.add(o); return o; };
    const flat = (color: number, x: number, y: number, s: number, sx: number, sy: number, sz: number, rough = 1) => { const m = mesh(GEO.box, mat(color, { rough }), x, y, -s, sx, sy, sz); S.add(m); return m; };
    const split = 0.5, zoneAt = (s: number): Zone => (s / L < split - 0.08 + r() * 0.16 ? zA : zB);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();

    // Mặt đất (hoặc mặt biển) chuyển màu dần từ miền đi sang miền đến
    const strip = 24, n = Math.ceil((L + 480) / strip);
    const gm = new THREE.MeshStandardMaterial({ roughness: sea ? 0.25 : 1 });
    const ground = new THREE.InstancedMesh(new THREE.BoxGeometry(900, 0.2, strip + 0.05), gm, n); ground.userData.own = true;
    const cA = new THREE.Color(sea ? WATER : THEMES[zA].ground), cB = new THREE.Color(sea ? 0x6cc6e0 : THEMES[zB].ground);
    for (let i = 0; i < n; i++) { const s = -200 + i * strip; m4.makeTranslation(0, -0.12, -s); ground.setMatrixAt(i, m4); ground.setColorAt(i, c.copy(cA).lerp(cB, ss(s / L, 0.36, 0.64))); }
    ground.receiveShadow = true; W.add(ground);

    // Vùng không rải cây cối (sông, cầu, hầm, biển…)
    const holes: { x0: number; x1: number; s0: number; s1: number }[] = [];
    const blocked = (x: number, s: number) => holes.some((h) => x > h.x0 && x < h.x1 && s > h.s0 && s < h.s1);
    const scatter = (s0: number, s1: number, every: number, near: number, far: number) => {
      for (let s = s0; s < s1; s += every * (0.6 + r() * 0.8)) for (const side of [-1, 1]) {
        if (r() < 0.22) continue;
        const list = THEMES[zoneAt(s)].kinds, kind = list[Math.floor(r() * list.length)];
        const x = side * (near + r() * (far - near)) * (kind === 'rice' || kind === 'dune' ? 1.6 : 1);
        if (blocked(x, s)) continue;
        const o = SCENERY[kind]();
        o.rotation.y = kind === 'house' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : r() * 6.28; o.scale.setScalar(kind === 'pole' ? 1 : 0.9 + r() * 0.5);
        put(o, x, 0, s);
      }
    };
    const mountains = (s0: number, s1: number, zone: Zone) => {
      const col = THEMES[zone].mountains; if (col === null) return;
      for (let s = s0; s < s1; s += 46 + r() * 30) for (const side of [-1, 1]) {
        const x = side * (100 + r() * 60); if (blocked(x, s)) continue;
        const h = 26 + r() * 30, mt = mesh(new THREE.ConeGeometry(22 + r() * 16, h, 7), mat(col, { rough: 1 }), x, h / 2 - 2, -s); mt.castShadow = false; mt.rotation.y = r() * 3; W.add(mt);
      }
    };
    /** Điểm nhấn của một miền trên đoạn [s0, s1] (cho tuyến trên bộ và nhìn từ máy bay). */
    const landmarks = (zone: Zone, s0: number, s1: number, near: number) => {
      const len = s1 - s0, at = (k: number) => s0 + len * k, side = r() < 0.5 ? -1 : 1;
      if (zone === 'bac') {
        for (const k of [0.18, 0.5, 0.82]) put(karst(r), (k === 0.5 ? -side : side) * (near + 34 + r() * 16), 0, at(k));
        const t = put(terraces(), -side * (near + 20), 0, at(0.32)); t.rotation.y = -side * Math.PI / 2;
        const t2 = put(terraces(), side * (near + 22), 0, at(0.68)); t2.rotation.y = side * Math.PI / 2;
      } else if (zone === 'trung' || zone === 'dao') {
        // Đèo ven biển: biển bên +x, bãi cát, đồi cát; tháp Chăm phía núi
        if (!air) {
          holes.push({ x0: near + 16, x1: 999, s0: s0 - 6, s1: s1 + 6 });
          flat(WATER, near + 230, 0.05, (s0 + s1) / 2, 400, 0.12, len, 0.25).castShadow = false; flat(0xf6ecc6, near + 26, 0.06, (s0 + s1) / 2, 12, 0.14, len);
          for (let s = s0 + 6; s < s1; s += 9) flat(s % 2 > 1 ? 0xe0342b : 0xfffaf0, near + 4.5, 0.5, s, 0.3, 1.0, 0.3);
          flat(0xb4bac4, near + 4.5, 0.85, (s0 + s1) / 2, 0.16, 0.16, len - 8);
          for (let i = 0; i < 4; i++) put(SCENERY[i % 2 ? 'ghe' : 'islet'](), near + 50 + r() * 40, 0.05, at(0.15 + i * 0.22)).scale.setScalar(1.3);
          if (zone === 'dao') put(fishRaft(), near + 44, 0, at(0.5));
          for (let i = 0; i < 3; i++) put(SCENERY.dune(), near + 18 + r() * 4, 0, at(0.2 + i * 0.3)).scale.setScalar(1.5);
        }
        if (zone === 'trung') { const t = put(chamTower(), -(near + 18), 0, at(0.5)); t.rotation.y = 0.5; }
      } else if (zone === 'taynguyen') {
        for (const k of [0.2, 0.55, 0.85]) put(coffeeHill(r), (k === 0.55 ? -side : side) * (near + 24 + r() * 6), 0, at(k));
        const h = put(nhaRong(), -side * (near + 12), 0, at(0.38)); h.rotation.y = side > 0 ? 0 : Math.PI;
        for (let i = 0; i < 10; i++) put(SCENERY.pine(), side * (near + 6 + r() * 14), 0, at(0.55 + r() * 0.2)).scale.setScalar(1.1 + r() * 0.7);
      } else if (zone === 'nam') {
        // Kênh chạy dọc tuyến có ghe, rặng dừa hai bờ
        const cx = -side * (near + 14);
        holes.push({ x0: cx - 7, x1: cx + 7, s0: s0 - 4, s1: s1 + 4 });
        flat(WATER, cx, 0.04, (s0 + s1) / 2, 9, 0.12, len, 0.25).castShadow = false;
        for (let i = 0; i < 5; i++) put(SCENERY.ghe(), cx + (r() - 0.5) * 3, 0.06, at(0.1 + i * 0.2)).scale.setScalar(1.3);
        for (let s = s0 + 4; s < s1; s += 7) for (const k of [-1, 1]) put(SCENERY.palm(), cx + k * (6.5 + r()), 0, s + r() * 3).scale.setScalar(1 + r() * 0.4);
      }
    };

    if (mode === 'xe_khach') {
      flat(0x9aa1ab, 0, 0, L / 2, 9, 0.12, L + 440);
      for (const x of [-4.3, 4.3]) flat(0xfbf3df, x, 0.01, L / 2, 0.3, 0.14, L + 440);
      const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.14, 2.6), mat(0xffffff), Math.ceil((L + 440) / 7));
      for (let i = 0; i < dashes.count; i++) { m4.makeTranslation(0, 0.03, -(-200 + i * 7)); dashes.setMatrixAt(i, m4); } W.add(dashes);
      // Cầu dây văng qua sông lớn: ở nửa tuyến thuộc miền Nam, hoặc giữa tuyến nếu không qua miền Nam
      const bm = zA === 'nam' ? L * 0.27 : zB === 'nam' ? L * 0.76 : L * 0.5, bl = 64;
      holes.push({ x0: -999, x1: 999, s0: bm - bl / 2 - 6, s1: bm + bl / 2 + 6 });
      flat(WATER, 0, 0.0, bm, 900, 0.3, bl - 10, 0.2).castShadow = false; put(cableBridge(bl, 9), 0, 0, bm);
      for (let i = 0; i < 6; i++) put(SCENERY.ghe(), (i % 2 ? 1 : -1) * (16 + i * 9), 0.1, bm - 18 + r() * 36).rotation.y = Math.PI / 2;
      landmarks(zA, 20, bm < L * 0.4 ? bm - bl / 2 - 8 : L * 0.46, 12); landmarks(zB, bm > L * 0.6 ? bm + bl / 2 + 8 : L * 0.54, L + 60, 12);
      scatter(-60, L + 200, 9, 9, 40); mountains(-60, L * 0.5, zA); mountains(L * 0.5, L + 200, zB);
    } else if (mode === 'tau_hoa') {
      flat(0xc9bfae, 0, 0.02, L / 2, 5.2, 0.3, L + 440);
      for (const x of [-1.15, 1.15]) flat(0x6b7280, x, 0.24, L / 2, 0.18, 0.22, L + 440, 0.4);
      const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 0.16, 0.5), mat(0x8a6a4a), Math.ceil((L + 440) / 1.7));
      for (let i = 0; i < ties.count; i++) { m4.makeTranslation(0, 0.16, -(-200 + i * 1.7)); ties.setMatrixAt(i, m4); } W.add(ties);
      // Hầm xuyên đồi ở chặng đầu
      const t0 = L * 0.2, tl = Math.min(54, L * 0.16), tm = t0 + tl / 2;
      holes.push({ x0: -30, x1: 30, s0: t0 - 10, s1: t0 + tl + 10 });
      put(tunnelHill(tl, THEMES[zA].mountains ?? 0x9cc79a, r), 0, 0, tm);
      // Cầu sắt qua sông ở giữa hành trình
      const b0 = L * 0.46, b1 = L * 0.6, bm = (b0 + b1) / 2, bl = b1 - b0;
      holes.push({ x0: -999, x1: 999, s0: b0 - 6, s1: b1 + 6 });
      flat(WATER, 0, 0.0, bm, 900, 0.3, bl - 6, 0.2).castShadow = false;
      const steel = mat(0xd9482b), B = new THREE.Group();
      B.add(mesh(GEO.box, mat(0x8f97a3), 0, 0.12, 0, 6.4, 0.3, bl + 4));
      for (const x of [-3.1, 3.1]) {
        B.add(mesh(GEO.box, steel, x, 6.2, 0, 0.36, 0.36, bl), mesh(GEO.box, steel, x, 0.7, 0, 0.36, 0.5, bl));
        for (let z = -bl / 2, i = 0; z <= bl / 2 + 0.1; z += 6, i++) { B.add(mesh(GEO.box, steel, x, 3.4, z, 0.3, 5.6, 0.3)); if (z < bl / 2 - 0.1) { const d = mesh(GEO.box, steel, x, 3.4, z + 3, 0.22, 8.1, 0.22); d.rotation.x = (i % 2 ? 1 : -1) * 0.82; B.add(d); } }
      }
      for (let z = -bl / 2; z <= bl / 2 + 0.1; z += 6) B.add(mesh(GEO.box, steel, 0, 6.2, z, 6.4, 0.3, 0.3));
      for (const z of [-bl / 2 + 2, 0, bl / 2 - 2]) B.add(mesh(GEO.box, mat(0xd9d2c4), 0, -1.6, z, 5, 3.2, 2.4));
      put(B, 0, 0, bm);
      for (let i = 0; i < 5; i++) put(SCENERY.ghe(), (i % 2 ? 1 : -1) * (20 + i * 12), 0.1, b0 + 6 + r() * (bl - 12)).rotation.y = Math.PI / 2;
      landmarks(zA, t0 + tl + 12, b0 - 8, 12); landmarks(zB, b1 + 8, L + 60, 12);
      scatter(-60, L + 200, 9, 8, 42); mountains(-60, L * 0.45, zA); mountains(L * 0.6, L + 200, zB);
    } else if (mode === 'may_bay') {
      // Đường băng cất cánh
      flat(0x8f97a3, 0, 0.02, 30, 22, 0.12, 330);
      for (let s = -120; s < 190; s += 14) flat(0xffffff, 0, 0.06, s, 0.7, 0.12, 6);
      for (const x of [-10.4, 10.4]) flat(0xfbf3df, x, 0.04, 30, 0.5, 0.14, 330);
      const T = new THREE.Group(); T.add(mesh(GEO.box, mat(0xfffaf0), 0, 4, 0, 16, 8, 44), mesh(GEO.box, mat(0x7fb9d9, { rough: 0.25 }), 8.05, 4.4, 0, 0.1, 5, 40), mesh(GEO.box, mat(0x6fb7d9), 0, 8.4, 0, 18, 0.8, 46)); put(T, -40, 0, 10);
      // Bờ biển hình chữ S: biển ở phía +x, mép nước uốn lượn dọc tuyến
      const coastX = (s: number) => 30 + 85 * Math.sin(((s - L * 0.14) / (L * 0.72)) * Math.PI * 2) * ss(s, L * 0.1, L * 0.22) * (1 - ss(s, L * 0.8, L * 0.92)) + 70 * (1 - ss(s, L * 0.06, L * 0.2)) + 60 * ss(s, L * 0.84, L);
      const seg = 40, s0 = -200, ds = (L + 480) / seg, seaPos: number[] = [], sandPos: number[] = [], foamPos: number[] = [];
      for (let i = 0; i < seg; i++) {
        const a = s0 + i * ds, b = a + ds, xa = coastX(a), xb = coastX(b);
        const quad = (arr: number[], x0a: number, x1a: number, x0b: number, x1b: number, y: number) => arr.push(x0a, y, -a, x1a, y, -a, x0b, y, -b, x1a, y, -a, x1b, y, -b, x0b, y, -b);
        quad(seaPos, xa, 700, xb, 700, 1.1); quad(sandPos, xa - 11, xa, xb - 11, xb, 1.12); quad(foamPos, xa, xa + 3, xb, xb + 3, 1.16);
      }
      const ribbon = (pos: number[], color: number, rough: number) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat(color, { rough })); m.receiveShadow = true; W.add(m); };
      ribbon(seaPos, WATER, 0.25); ribbon(sandPos, 0xf6ecc6, 1); ribbon(foamPos, 0xffffff, 0.6);
      const onSea = (x: number, s: number) => x > coastX(s) - 14;
      holes.push({ x0: -14, x1: 14, s0: -200, s1: 200 });
      // Ruộng đồng thành mảng màu, sông, làng xóm nhìn từ trên cao
      const pal = (z: Zone) => z === 'taynguyen' ? [0xdc9a78, 0x79c96d, 0xd98a66, 0x4fa35f, 0xb7e69a] : z === 'trung' || z === 'dao' ? [0xf3e3ae, 0xc9d77a, 0xb7e69a, 0xe6cf6a, 0xead596] : [0xe6cf6a, 0x8fd67c, 0xb7e69a, 0xd9bd4e, 0x79c96d, 0xc9d77a];
      const patches = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), 190); patches.userData.own = true;
      const q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(); let pc = 0;
      for (let i = 0; i < 260 && pc < 190; i++) {
        const s = L * 0.1 + r() * L * 0.95, x = (r() - 0.5) * 520; if (onSea(x + 30, s) || (Math.abs(x) < 30 && s < 200)) continue;
        const p = pal(zoneAt(s)); ps.set(x, 0.05 + pc * 0.004, -s); sc.set(26 + r() * 44, 1, 26 + r() * 44); q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.5, 0)); m4.compose(ps, q, sc);
        patches.setMatrixAt(pc, m4); patches.setColorAt(pc, c.setHex(p[Math.floor(r() * p.length)])); pc++;
      }
      patches.count = pc; W.add(patches);
      for (const k of [0.34, 0.66]) { const riv = flat(WATER, -160, 0.9, L * k, 420, 0.3, 26, 0.2); riv.castShadow = false; riv.rotation.y = k < 0.5 ? 0.3 : -0.25; }
      landmarks(zA, L * 0.12, L * 0.46, 26); landmarks(zB, L * 0.54, L + 80, 26);
      for (let s = -80; s < L + 220; s += 13 + r() * 12) for (const side of [-1, 1]) {
        const x = side * (26 + r() * 150); if (onSea(x, s) || blocked(x, s)) continue;
        const list = THEMES[zoneAt(s)].kinds, kind = list[Math.floor(r() * list.length)], o = SCENERY[kind === 'pole' ? 'house' : kind]();
        o.rotation.y = r() * 6.28; o.scale.setScalar(1.4 + r() * 1.2); put(o, x, 0, s);
      }
      for (let i = 0; i < 9; i++) { const s = L * 0.15 + r() * L * 0.75, x = coastX(s) + 30 + r() * 90; const o = put(SCENERY[i % 3 === 0 ? 'islet' : 'ghe'](), x, 1.1, s); o.scale.setScalar(2.2 + r() * 1.6); o.rotation.y = r() * 6; }
      mountains(-40, L * 0.42, zA); mountains(L * 0.6, L + 200, zB);
      // Tầng mây nằm dưới độ cao bay bằng, thưa ở chỗ nhìn xuống bờ biển
      const clouds = new THREE.Group();
      for (let i = 0; i < 70; i++) {
        const cl = new THREE.Group(), big = 0.8 + r() * 0.9; for (let k = 0; k < 4; k++) cl.add(mesh(GEO.ball, mat(0xffffff, { rough: 1 }), k * 4.4 - 6 + r() * 2, r() * 1.6, r() * 3, 4 + r() * 2.6, 2.2 + r(), 3.6));
        const x = (r() - 0.5) * 300, low = r() < 0.82;
        cl.position.set(Math.abs(x) < 20 ? x + Math.sign(x || 1) * 24 : x, low ? CRUISE - 34 + r() * 18 : CRUISE + 6 + r() * 10, -(L * 0.2 + r() * L * 0.7)); cl.scale.setScalar(big); clouds.add(cl);
      }
      W.add(bake(clouds));
    } else { // tàu thuỷ: hải trình có phao tiêu hai bên luồng, hải đăng, bè cá, đảo nhỏ
      const shore = (s: number, ahead: boolean, zone: Zone, island: boolean) => {
        const k = ahead ? 1 : -1;
        if (island) {
          const I = new THREE.Group(); I.add(mesh(GEO.ball, mat(0xf6ecc6), 0, -1.2, 0, 64, 3.2, 46), mesh(GEO.ball, mat(0xb1dc7c), 2, 0.2, -8 * k, 52, 3.6, 34), mesh(GEO.ball, mat(0x9cc79a, { rough: 1 }), -10, 6, -16 * k, 22, 16, 18), mesh(GEO.ball, mat(0xa9cbbd, { rough: 1 }), 20, 4, -20 * k, 16, 11, 14));
          put(I, 0, 0, s + k * 52);
          for (let i = 0; i < 14; i++) { const a = r() * 6.28; put(SCENERY[i % 4 === 0 ? 'house' : 'palm'](), Math.cos(a) * (10 + r() * 30), 2.6, s + k * 44 + Math.sin(a) * 12); }
        } else {
          flat(THEMES[zone].ground, 0, 0.2, s + k * 96, 900, 1.6, 150); flat(0xf6ecc6, 0, 0.2, s + k * 17, 900, 1.2, 12);
          const kinds = THEMES[zone].kinds.filter((kd) => kd !== 'rice' && kd !== 'pond');
          for (let i = 0; i < 24; i++) put(SCENERY[kinds[Math.floor(r() * kinds.length)]](), (r() - 0.5) * 170, 1.0, s + k * (26 + r() * 50));
        }
      };
      shore(-50, false, zA, this.info.fromIsland); shore(L + 70, true, zB, this.info.toIsland);
      for (let s = 10, i = 0; s < L + 40; s += 34, i++) { put(buoy(0xe0342b), -11, -0.1, s); put(buoy(0x4fa86a), 11, -0.1, s + 17); }
      put(lighthouse(), -42, 0, L * 0.5).rotation.y = 0.6; put(lighthouse(), 46, 0, L * 0.92).scale.setScalar(0.8);
      for (const [k, x] of [[0.22, 30], [0.4, -28], [0.68, 34], [0.82, -32]]) put(fishRaft(), x, 0, L * k).rotation.y = r();
      for (let s = 40; s < L + 20; s += 30 + r() * 26) {
        const kind = ['islet', 'ghe', 'seastone', 'ghe'][Math.floor(r() * 4)], x = (r() < 0.5 ? -1 : 1) * (22 + r() * 60);
        if (Math.abs(s - L * 0.5) < 26 && x < 0) continue;
        const o = put(SCENERY[kind](), x, 0, s); o.rotation.y = r() * 6.28; o.scale.setScalar(1 + r() * 0.8);
      }
      // Dãy núi ven bờ mờ xa nếu đi dọc đất liền
      for (const z of [zA, zB]) if (THEMES[z].mountains !== null && !(z === zA ? this.info.fromIsland : this.info.toIsland)) {
        const base = z === zA ? 0 : L * 0.5;
        for (let i = 0; i < 6; i++) { const h = 24 + r() * 22, mt = mesh(new THREE.ConeGeometry(26 + r() * 14, h, 7), mat(THEMES[z].mountains!, { rough: 1 }), -(150 + r() * 40), h / 2 - 3, -(base + i * L * 0.09)); mt.castShadow = false; W.add(mt); }
      }
      const caps = new THREE.InstancedMesh(GEO.ball, mat(0xffffff, { rough: 0.3 }), 280);
      for (let i = 0; i < 280; i++) { m4.compose(new THREE.Vector3((r() - 0.5) * 260, 0.0, -(r() * (L + 100) - 40)), new THREE.Quaternion(), new THREE.Vector3(1.4 + r() * 1.6, 0.16, 0.45)); caps.setMatrixAt(i, m4); }
      W.add(caps);
    }
    W.add(bake(S, true));
  }

  // ------------------------------------------------------------ mỗi khung hình
  update(t: number, dt: number, cx: Ctx) {
    const { mode } = this.info, p = Math.min(1, t / this.duration), time = cx.time;
    this.progress = p;
    // Rời bến tăng tốc dần, giữa đường đều tốc, gần tới nơi chậm lại
    const speed = 0.5 + 0.5 * ss(p, 0, 0.14) - 0.28 * ss(p, 0.88, 1);
    this.dist = Math.min(this.total, this.dist + this.spec.speed * speed * dt * 1.02);
    this.alt = mode === 'may_bay' ? CRUISE * ss(p, 0.09, 0.3) * (1 - 0.8 * ss(p, 0.72, 1)) : 0;
    this.world.position.set(0, -this.alt, this.dist);

    const v = this.vehicle;
    if (mode === 'may_bay') {
      const climb = ss(p, 0.07, 0.14) * (1 - ss(p, 0.25, 0.33)), descend = ss(p, 0.7, 0.78);
      v.position.y = 2.1; v.rotation.x = climb * 0.22 - descend * 0.08; v.rotation.z = Math.sin(time * 0.7) * 0.04 * (this.alt / CRUISE);
    } else if (mode === 'tau_thuy') { v.position.y = 0.25 + Math.sin(time * 1.6) * 0.16; v.rotation.x = Math.sin(time * 1.3) * 0.02; v.rotation.z = Math.sin(time * 1.1) * 0.025; }
    else v.position.y = (mode === 'tau_hoa' ? 0.3 : 0) + Math.abs(Math.sin(time * 18)) * 0.03 * speed;

    // Máy quay: màn ngang lia từ sau ra ngang rồi lên trước; màn dọc giữ góc chéo từ sau trên cao, đổi bên giữa chừng
    const cam = cx.camera, sp = this.spec, sm = ss(p, 0.05, 0.95);
    let a: number, R = sp.radius, H = sp.height;
    if (cx.portrait) {
      a = p < 0.5 ? THREE.MathUtils.lerp(0.26, 0.42, p * 2) : THREE.MathUtils.lerp(-0.44, -0.26, (p - 0.5) * 2);
      R = Math.max(sp.half * 2.3 + 13, sp.wide / 0.21); H = R * 0.8;
    } else { a = THREE.MathUtils.lerp(0.62, 1.9, sm); R = sp.radius * (cam.aspect < 1.3 ? 1.25 : 1); }
    if (mode === 'may_bay') { H += (cx.portrait ? 4 : 13) * Math.sin(sm * Math.PI); if (!cx.portrait) a = -a; } // máy quay bên -x để nhìn ra bờ biển chữ S ở +x
    const lookZ = cx.portrait ? -sp.half * 0.35 : 0;
    cam.position.set(Math.sin(a) * R, v.position.y + H, Math.cos(a) * R + lookZ);
    cam.lookAt(0, v.position.y + sp.look, lookZ);

    for (const f of this.puffs) {
      f.life += dt * (0.5 + speed * 0.8); const k = f.life % 1.2;
      f.m.position.set(Math.sin(f.life * 3) * 0.3, 4.6 + k * 4.2, -16.8 + k * (6 + speed * 12)); f.m.scale.setScalar(0.35 + k * 0.95);
    }
    this.gulls.forEach((g, i) => {
      const ang = time * 0.5 + i * 1.3; g.position.set(Math.cos(ang) * (7 + i * 1.6), 8.5 + Math.sin(time * 1.4 + i) * 0.8 + i * 0.4, -3 + Math.sin(ang) * (6 + i)); g.rotation.y = -ang;
      const flap = Math.sin(time * 9 + i) * 0.55; g.children[0].rotation.z = flap; g.children[1].rotation.z = -flap;
    });
    this.info.onTick?.(p);
  }
}
