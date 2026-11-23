// Thế giới xóm vườn 3D: đường làng, các lô vườn (nhà mình và hàng xóm), nhân vật chạy bằng cần điều khiển.
import * as THREE from 'three';
import { HIT_AT, makeTool, poseWork, toolHand } from './actions.ts';
import type { WorkKind } from './actions.ts';
import { IS_MOBILE, Quality, debugScene, SHADOW_MAP, rendererParams , stepDt, trace } from '../perf.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CROPS, REGIONS, SPECIALTIES, processOf } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { PLOT_COLS, PLOT_ROWS, allowedTiles } from '../../../shared/rules.ts';
import type { Role } from '../../../shared/rules.ts';
import type { Avatar, DecorPlacement, PlotStyle } from '../../../shared/custom.ts';
import { buildDecor, buildFence, buildRoleProp, hex } from './custom3d.ts';
import { addAccessory, addHeadwear, addOutfitBody, outfitLook } from './wardrobe.ts';
import type { Outfit } from './wardrobe.ts';
import { GOODS_SPOTS, buildGoodProp, buildHomeHouse } from './houses.ts';
import { buildPersonalRide, makeTruckKind, packRide } from './rides.ts';
import type { Listing, Planting } from '../api.ts';
import { GEO, buildPlant, fruitColor, mat, mesh, rng } from './plants.ts';
import type { Stage } from './plants.ts';
import { roadsideProp, zoneHouse, zoneScene } from './zones.ts';
import { BASIC_FACTORY, LAMP_MATS, MACHINE_SPOTS, STEAM_MAT, buildBeltCrates, buildDoneCrate, buildFactoryYard, buildMachine, factoryColliders, machineState } from './factory.ts';
import type { FactoryData, FactoryMachine, MachineState } from './factory.ts';
import { blobTex, boardCanvas, edgeFade, grassTex, roadTex, softDot } from './tex.ts';

// ---------------------------------------------------------------- bố cục xóm
const TILE = 2;
const PITCH = 24;          // khoảng cách giữa hai lô liền kề dọc đường
const ROAD_Z = 15.5;       // tim đường làng
const ROAD_HALF = 3;
const FENCE = { x: 9.6, back: -13.5, front: 8.5, gate: 1.8 };
const STALL = { x: 6.2, z: 10.6 };
/** Vị trí 10 lô: lô 0 là vườn đang xem, còn lại là hàng xóm; s = 1 phía bắc đường, -1 phía nam. */
const SLOTS: { k: number; s: 1 | -1 }[] = [
  { k: 0, s: 1 }, { k: -1, s: 1 }, { k: 1, s: 1 }, { k: 0, s: -1 }, { k: -1, s: -1 },
  { k: 1, s: -1 }, { k: -2, s: 1 }, { k: 2, s: 1 }, { k: -2, s: -1 }, { k: 2, s: -1 },
];
export const SLOT_COUNT = SLOTS.length;
const WORLD = { x: 62, zMin: -22, zMax: 53 };
/** Màu mái, mái che sạp và áo hàng xóm: năm tông phấn dịu. */
const ROOFS = [0xf08a6c, 0x6fb7d9, 0xf2b25c, 0xa98bd6, 0xe7799a];

function tileLocal(tile: number): { x: number; z: number } {
  const c = tile % PLOT_COLS, r = Math.floor(tile / PLOT_COLS);
  return { x: (c - (PLOT_COLS - 1) / 2) * TILE, z: (r - (PLOT_ROWS - 1) / 2) * TILE };
}
/** Đổi toạ độ trong lô ↔ toạ độ thế giới (phép đối xứng nên dùng được cả hai chiều). */
function flip(slot: number, x: number, z: number): { x: number; z: number } {
  const { k, s } = SLOTS[slot];
  return s === 1 ? { x: x + k * PITCH, z } : { x: k * PITCH - x, z: 2 * ROAD_Z - z };
}
function toLocal(slot: number, X: number, Z: number): { x: number; z: number } {
  const { k, s } = SLOTS[slot];
  return s === 1 ? { x: X - k * PITCH, z: Z } : { x: k * PITCH - X, z: 2 * ROAD_Z - Z };
}

const SHARED_GEO = new Set<THREE.BufferGeometry>(Object.values(GEO));
const WHITE = new THREE.Color(1, 1, 1), VC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
/** Nhả bộ nhớ đồ hoạ của một cụm đã gộp bằng bake() khi bỏ nó khỏi cảnh (lưới gộp là hình riêng, không dùng chung). */
function freeBaked(root: THREE.Object3D) { root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !SHARED_GEO.has(m.geometry)) m.geometry.dispose(); }); }
/** Gộp các khối tĩnh cùng chất liệu thành một lưới để giảm số lần vẽ. */
export function bake(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((o as THREE.InstancedMesh).isInstancedMesh || (o as THREE.Sprite).isSprite) { keep.push(o); return; }
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    let material = m.material as THREE.Material;
    const sm = material as THREE.MeshStandardMaterial;
    // Lưới đã gộp từ trước (đang dùng màu đỉnh) phải GIỮ thuộc tính color khi gộp lần nữa, nếu không sẽ đen sì.
    const keepColor = !!sm.vertexColors && !!g.attributes.color;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && !(keepColor && name === 'color')) g.deleteAttribute(name);
    // Khối màu trơn, nhám (phần lớn mô hình): ghi màu vào đỉnh rồi dùng chung MỘT chất liệu — mỗi cụm chỉ còn một lần vẽ.
    const plain = sm.isMeshStandardMaterial && !sm.map && !sm.transparent && sm.roughness >= 0.7 && sm.emissive.getHex() === 0 && !sm.vertexColors;
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = plain ? sm.color : WHITE;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    if (plain) { g.setAttribute('color', new THREE.BufferAttribute(col, 3)); material = VC_MAT; }
    else if (sm.vertexColors && !g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); // chất liệu đọc màu đỉnh mà lưới không có: tô trắng thay vì để đen
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material)!.push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), material);
    merged.castShadow = !material.transparent; merged.receiveShadow = true; out.add(merged);
  }
  for (const o of keep) {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    o.removeFromParent(); rel.decompose(o.position, o.quaternion, o.scale); out.add(o);
  }
  out.position.copy(root.position); out.quaternion.copy(root.quaternion); out.scale.copy(root.scale);
  return out;
}

const TUFT_GEO = new THREE.ConeGeometry(1, 1, 5), FLOWER_GEO = new THREE.OctahedronGeometry(1, 0);
type LabelTone = 'gold' | 'paper' | 'region' | 'float';
/** Biển chữ trong thế giới: tấm ván gỗ (hoặc viên chữ nổi), cao `h` đơn vị, rộng theo chữ. */
function makeLabel(text: string, tone: LabelTone = 'paper', h = 0.92, floatBg?: string): THREE.Sprite {
  const { canvas, aspect } = boardCanvas(text, tone, floatBg);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(h * aspect, h, 1); sp.renderOrder = 6;
  return sp;
}

interface Body { root: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Group; armR: THREE.Group }
export function makeFarmer(shirt: number, hat = 'non_la', outfit: Outfit | null = null): Body {
  const root = new THREE.Group(), core = new THREE.Group();
  const wear = outfitLook(outfit?.ao, shirt); // bộ đồ mua ở cửa hàng đổi màu áo, quần, giày và thân áo
  const skin = mat(0xf8d3ae), cloth = mat(wear.cloth), pants = mat(wear.pants), shoe = mat(wear.shoe), hair = mat(0x3a2a1c), dark = mat(0x2b2118);
  const trim = mat(new THREE.Color(wear.cloth).multiplyScalar(0.78).getHex());
  // chân ngắn tròn, có giày — dáng "chibi": đầu to, thân bầu
  const leg = (x: number) => { const m = mesh(GEO.cyl, pants, x, 0.26, 0, 0.13, 0.5, 0.14); m.add(mesh(GEO.ball, shoe, 0, -0.46, 0.35, 1.25, 0.22, 1.9)); return m; };
  const legL = leg(-0.16), legR = leg(0.16);
  if (!addOutfitBody(core, outfit?.ao, wear)) {
    core.add(mesh(GEO.ball, cloth, 0, 0.84, 0, 0.4, 0.44, 0.34), mesh(GEO.cyl, trim, 0, 0.5, 0, 0.36, 0.1, 0.31)); // thân áo + gấu áo
    core.add(mesh(GEO.ball, mat(0xfdf6e6), 0, 1.15, 0.05, 0.22, 0.1, 0.2)); // cổ áo
    for (const y of [0.98, 0.8]) core.add(mesh(GEO.ball, mat(0xfdf6e6), 0, y, 0.33, 0.035)); // khuy
  }
  core.add(mesh(GEO.ball, skin, 0, 1.52, 0, 0.42));
  core.add(mesh(GEO.ball, hair, 0, 1.6, -0.1, 0.43, 0.38, 0.4)); // tóc sau gáy
  for (const x of [-0.15, 0.15]) core.add(mesh(GEO.ball, dark, x, 1.54, 0.37, 0.058, 0.075, 0.04), mesh(GEO.ball, mat(0xffffff), x + 0.02, 1.565, 0.4, 0.02));
  for (const x of [-0.25, 0.25]) core.add(mesh(GEO.ball, mat(0xf4a48c), x, 1.42, 0.31, 0.075, 0.05, 0.03)); // má hồng
  core.add(mesh(GEO.ball, mat(0xc9644a), 0, 1.4, 0.4, 0.06, 0.025, 0.02)); // miệng cười
  if (outfit?.ao !== 'ao_mua' || outfit?.non) addHeadwear(core, outfit?.non, hat);
  addAccessory(core, outfit?.phu_kien);
  root.add(bake(core), legL, legR); // phần thân, đầu, nón gộp lại theo chất liệu để ít lần vẽ
  const arm = (x: number) => { const g = new THREE.Group(); g.position.set(x, 1.06, 0); g.add(mesh(GEO.cyl, cloth, 0, -0.2, 0, 0.1, 0.42, 0.1), mesh(GEO.ball, skin, 0, -0.46, 0, 0.115)); g.rotation.z = x < 0 ? -0.12 : 0.12; root.add(g); return g; };
  const armL = arm(-0.44), armR = arm(0.44);
  root.traverse((o) => { o.receiveShadow = false; });
  root.scale.setScalar(1.18);
  return { root, legL, legR, armL, armR };
}

// ---------------------------------------------------------------- dữ liệu vào
export interface LotData {
  plotId: number; ownerName: string; mine: boolean; friend: boolean; kind?: 'ground' | 'rooftop'; plantings: Planting[]; stall: Listing[];
  /** undefined = chưa rõ (vườn mẫu) thì coi như nhà vườn; null = chủ vườn chưa quay vai. */
  ownerRole?: Role | null; style?: PlotStyle | null; decor?: DecorPlacement[] | null; avatar?: Avatar | null;
  /** Đồ mua ở trung tâm mua sắm đang dùng (áo, nón, phụ kiện, kiểu nhà, xe riêng) và các món nội thất, sân vườn đã có. Hiện mới có cho thửa của chính mình. */
  equipped?: Equipped | null; goods?: string[] | null;
  /** Máy của chủ xưởng (lấy từ `factory` của GET /api/plots/:id). Thiếu thì thửa của chủ xưởng vẫn hiện một máy cơ bản. */
  factory?: FactoryData | null;
}
/** Thửa mặt đất của chủ xưởng là nhà xưởng, không có ô đất trồng. */
function isFactory(d: LotData | null): boolean { return !!d && d.ownerRole === 'xuong' && d.kind !== 'rooftop'; }
function machinesOf(d: LotData): FactoryMachine[] { return (d.factory?.machines?.length ? d.factory.machines : BASIC_FACTORY.machines).slice(0, MACHINE_SPOTS.length); }
function lotTiles(d: LotData): number[] { return isFactory(d) ? [] : allowedTiles(d.kind ?? 'ground', d.ownerRole === undefined ? 'nong_dan' : d.ownerRole); }
export type WeatherKind = 'nang' | 'may' | 'mua' | 'nang_gat' | 'bao';
export interface Equipped extends Outfit { nha?: string | null; xe?: string | null }
export interface WorldState { regionId: string; lots: (LotData | null)[]; clockOffset: number; weather?: WeatherKind }
export type Context =
  | { kind: 'none' }
  | { kind: 'tile'; lot: number; tile: number }
  | { kind: 'stall'; lot: number }
  | { kind: 'truck' }
  /** Đứng cạnh một trạm máy trong xưởng; machineId = null là chỗ còn trống để đặt máy mới. */
  | { kind: 'machine'; lot: number; index: number; machineId: number | string | null }
  | { kind: 'empty-lot'; lot: number };
export interface WorldOptions {
  hour?: number; demo?: boolean;
  onContext?: (ctx: Context) => void;
  /** Nhân vật đang đứng trên một ô có cây đã đến giờ chăm. */
  onReady?: (lot: number, planting: Planting) => void;
}

interface Theme { grass: number; grass2: number; sea: boolean; mountains: number; hill: number; trees: 'palm' | 'pine' | 'leaf'; road: number; /** màu mảng đất đặc trưng loang trên cỏ */ patch?: number; patchK?: number }
const THEMES: Record<Zone, Theme> = {
  bac: { grass: 0x9fcf68, grass2: 0x86bd5c, sea: false, mountains: 9, hill: 5, trees: 'leaf', road: 0xe9d3a2, patch: 0x74ad56, patchK: 0.55 },
  trung: { grass: 0xbcd67c, grass2: 0xa9c86c, sea: false, mountains: 5, hill: 3, trees: 'leaf', road: 0xf6e8c0, patch: 0xf0e2b0, patchK: 0.9 },
  taynguyen: { grass: 0x9bc968, grass2: 0x86b85a, sea: false, mountains: 7, hill: 6, trees: 'pine', road: 0xd08a62, patch: 0xc98058, patchK: 0.8 },
  nam: { grass: 0xa2da74, grass2: 0x8ccb62, sea: false, mountains: 0, hill: 1, trees: 'palm', road: 0xecd6a4 },
  dao: { grass: 0xb4dc7e, grass2: 0x9fce6e, sea: true, mountains: 2, hill: 1.5, trees: 'palm', road: 0xf7ecc8, patch: 0xf3e6b8, patchK: 0.85 },
};
/** Khu phố: dùng khi vườn nhà là sân thượng giữa trung tâm thành phố. */
const CITY: Theme = { grass: 0xdfe3da, grass2: 0xd2d8cc, sea: false, mountains: 0, hill: 0, trees: 'leaf', road: 0xa3aab4 };
type Sky = { top: number; sky: number; sun: number; sunI: number; dir: [number, number, number]; hemiSky: number; hemiGround: number; hemiI: number; night: boolean };
function skyFor(hour: number): Sky {
  if (hour >= 7 && hour < 16.5) return { top: 0x8fd0f5, sky: 0xdff3fb, sun: 0xfff0cf, sunI: 2.55, dir: [13, 22, 9], hemiSky: 0xdfefff, hemiGround: 0xb7cf8a, hemiI: 1.05, night: false };
  if ((hour >= 5.3 && hour < 7) || (hour >= 16.5 && hour < 18.6)) return { top: 0xf7a98a, sky: 0xffe2bd, sun: 0xffa95e, sunI: 2.5, dir: [24, 10, 8], hemiSky: 0xffd9c2, hemiGround: 0xb79f78, hemiI: 0.95, night: false };
  // Đêm trăng: ngả xanh rõ để thấy là đêm, nhưng vẫn đủ sáng để chơi.
  return { top: 0x1f2f66, sky: 0x5a78c4, sun: 0xb9c8ff, sunI: 1.05, dir: [-10, 22, 10], hemiSky: 0xa9b8f0, hemiGround: 0x5c7096, hemiI: 1.2, night: true };
}
function gradient(top: number, bottom: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#' + new THREE.Color(top).getHexString()); grad.addColorStop(0.62, '#' + new THREE.Color(bottom).getHexString());
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- một lô vườn
class Lot {
  group = new THREE.Group();
  data: LotData | null = null;
  private built: 'none' | 'empty' | 'farm' | 'roof' = 'none';
  private plantLayer = new THREE.Group();
  private plants = new Map<number, { key: string; group: THREE.Group; born: number }>();
  private goods = new THREE.Group();
  private label: THREE.Sprite | null = null;
  private labelText = '';
  private look = '';
  private signs: THREE.Sprite[] = [];
  private goodsKey = '';
  markers = new Map<number, THREE.Mesh>();
  /** Trạm máy đang hiện (chỉ khi lô là xưởng). */
  fx: { m: FactoryMachine; group: THREE.Group; lamp: THREE.Mesh; done: THREE.Group; puffs: THREE.Mesh[]; x: number; z: number; state: MachineState | '' }[] = [];
  private belt: THREE.Group | null = null;
  private smoke: THREE.Mesh[] = [];
  npc: Body | null = null;
  private slot: number;
  private night: boolean;
  /** Miền của vùng đang xem: quyết định kiểu nhà mặc định. */
  zone: Zone = 'nam';

  constructor(slot: number, night: boolean) {
    this.slot = slot; this.night = night;
    const { k, s } = SLOTS[slot];
    this.group.position.set(k * PITCH, 0, s === 1 ? 0 : 2 * ROAD_Z);
    this.group.rotation.y = s === 1 ? 0 : Math.PI;
  }

  colliders(): [number, number, number, number][] {
    if (this.built !== 'farm' && this.built !== 'roof') return [];
    const prop: [number, number, number, number][] = isFactory(this.data) ? factoryColliders(this.fx.length) : this.data?.ownerRole === 'xuong' ? [[-2.3, 2.3, 2.4, 5.0]] : [];
    const local: [number, number, number, number][] = [...prop,
      [-FENCE.x, FENCE.x, FENCE.back - 0.15, FENCE.back + 0.15], [-FENCE.x - 0.15, -FENCE.x + 0.15, FENCE.back, FENCE.front],
      [FENCE.x - 0.15, FENCE.x + 0.15, FENCE.back, FENCE.front], [-FENCE.x, -FENCE.gate, FENCE.front - 0.15, FENCE.front + 0.15],
      [FENCE.gate, FENCE.x, FENCE.front - 0.15, FENCE.front + 0.15], [-3.0, 3.0, -12.4, -8.4], [STALL.x - 1.9, STALL.x + 1.9, STALL.z - 0.8, STALL.z + 0.8],
    ];
    return local.map(([x0, x1, z0, z1]) => { const a = flip(this.slot, x0, z0), b = flip(this.slot, x1, z1); return [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z)]; });
  }

  private rebuild(kind: 'empty' | 'farm' | 'roof') {
    this.merged = null; this.mergedKey = '';
    freeBaked(this.group); this.group.clear(); this.plants.clear(); this.markers.clear(); this.fx = []; this.belt = null; this.smoke = []; this.label = null; this.labelText = ''; this.npc = null; this.signs = [];
    const data = this.data, style = data?.style ?? null, tiles = data ? lotTiles(data) : [];
    const roofColor = hex(style?.roof, ROOFS[this.slot % 5]), wallColor = hex(style?.wall, [0xfff6e2, 0xffeceb, 0xeef6ff, 0xf1f9e4, 0xfff8d6][this.slot % 5]), awning = hex(style?.awning, ROOFS[this.slot % 5]);
    this.plantLayer = new THREE.Group(); this.goods = new THREE.Group();
    const st = new THREE.Group();
    const woodDark = mat(0xb9855a);
    if (kind === 'empty') {
      for (const [x, z] of [[-FENCE.x, FENCE.front], [FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back]]) st.add(mesh(GEO.box, woodDark, x, 0.4, z, 0.2, 0.8, 0.2));
      st.add(mesh(GEO.box, woodDark, 0, 0.8, FENCE.front + 1.2, 0.14, 1.6, 0.14), mesh(GEO.box, mat(0xf6e7c1), 0, 1.5, FENCE.front + 1.28, 2.6, 0.9, 0.1));
      this.group.add(bake(st));
      const l = makeLabel('Đất trống · mời bạn', 'paper', 0.72); l.position.set(0, 2.55, FENCE.front + 1.2); this.group.add(l);
      this.built = kind; return;
    }
    if (kind === 'roof') {
    // Sân thượng nhà phố: nền gạch, lan can, bồn nước, pin mặt trời, thùng trồng cây
    const depthR = FENCE.front - FENCE.back, midR = (FENCE.front + FENCE.back) / 2, wall = mat(0xfbf7ee), trim = mat(roofColor);
    st.add(mesh(GEO.box, mat(0xe9e4da), 0, 0.04, midR, FENCE.x * 2, 0.08, depthR));
    for (let i = -4; i <= 4; i++) st.add(mesh(GEO.box, mat(0xdcd6ca), i * 2.1, 0.085, midR, 0.05, 0.01, depthR));
    const parapet = (x: number, z: number, sx: number, sz: number) => st.add(mesh(GEO.box, wall, x, 0.5, z, sx, 1, sz), mesh(GEO.box, trim, x, 1.03, z, sx + 0.12, 0.1, sz + 0.12));
    const segR = FENCE.x - FENCE.gate;
    parapet(0, FENCE.back, FENCE.x * 2, 0.3); parapet(-FENCE.x, midR, 0.3, depthR); parapet(FENCE.x, midR, 0.3, depthR);
    parapet(-(FENCE.x + FENCE.gate) / 2, FENCE.front, segR, 0.3); parapet((FENCE.x + FENCE.gate) / 2, FENCE.front, segR, 0.3);
    for (const t of tiles) { const p = tileLocal(t); st.add(mesh(GEO.box, mat(0xc99a68), p.x, 0.2, p.z, TILE - 0.12, 0.3, TILE - 0.12), mesh(GEO.box, mat(0x8a6044), p.x, 0.33, p.z, TILE - 0.36, 0.08, TILE - 0.36)); }
    // Tum cầu thang
    st.add(mesh(GEO.box, mat(wallColor), 0, 1.4, -10.6, 5, 2.8, 3.6), mesh(GEO.box, trim, 0, 2.9, -10.6, 5.5, 0.22, 4.1), mesh(GEO.box, mat(0x9a7150), 0, 1.1, -8.76, 1.0, 1.7, 0.1));
    st.add(mesh(GEO.box, this.night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0xa9dcf2, { rough: 0.3 }), 1.6, 1.7, -8.76, 0.9, 0.8, 0.08));
    // Bồn nước inox, pin mặt trời, dây phơi, cục nóng máy lạnh
    st.add(mesh(GEO.box, mat(0x8f97a3), 6.6, 0.7, -10.6, 1.5, 1.4, 1.5), mesh(GEO.cyl, mat(0xdfe6ee, { rough: 0.25 }), 6.6, 2.2, -10.6, 0.85, 1.7, 0.85), mesh(GEO.ball, mat(0xdfe6ee, { rough: 0.25 }), 6.6, 3.05, -10.6, 0.85, 0.3, 0.85));
    for (const x of [-7.4, -5.2]) { const pv = mesh(GEO.box, mat(0x355c9a, { rough: 0.3 }), x, 0.75, -10.8, 1.9, 0.08, 2.6); pv.rotation.x = -0.45; st.add(pv, mesh(GEO.box, mat(0x8f97a3), x, 0.35, -10.2, 0.1, 0.7, 0.1)); }
    for (const z of [-5.5, 6.2]) st.add(mesh(GEO.cyl, mat(0x8f97a3), -8.2, 1.1, z, 0.06, 2.2, 0.06));
    st.add(mesh(GEO.box, mat(0x6b7280), -8.2, 2.1, 0.35, 0.03, 0.03, 11.7));
    [0xf08a6c, 0x6fb7d9, 0xfdf6e6, 0xf2c65c, 0xa98bd6].forEach((c, i) => st.add(mesh(GEO.box, mat(c), -8.2, 1.6, -4 + i * 2, 0.06, 0.9, 1.1)));
    st.add(mesh(GEO.box, mat(0xf3f4f6), 8.4, 0.5, 6.4, 1.0, 0.9, 1.4));
    for (const [x, z] of [[8.5, -2], [8.5, 1.5], [-3.2, 7.6], [3.2, 7.6]]) st.add(mesh(GEO.cyl, mat(0xe0a070), x, 0.3, z, 0.36, 0.5, 0.36), mesh(GEO.ball, mat(0x5cb85f), x, 0.9, z, 0.5), mesh(GEO.ball, mat(0xf7a8c4), x + 0.2, 1.25, z + 0.1, 0.14));
    } else if (isFactory(data)) {
    // Nhà xưởng chế biến: nền bê tông, nhà xưởng mái tôn, bồn, khu nguyên liệu và thành phẩm; mỗi máy là một trạm riêng
    const ms = machinesOf(data!);
    st.add(buildFactoryYard(this.night, roofColor, ms.length));
    buildFence(st, style?.fence ?? 'trang', FENCE, roofColor);
    const h = buildHomeHouse(data?.equipped?.nha ?? style?.house ?? zoneHouse(this.zone), wallColor, roofColor, this.night); h.position.set(0, 0, -10.4); st.add(h);
    ms.forEach((m, i) => {
      const spot = MACHINE_SPOTS[i], model = buildMachine(m), group = bake(model.root);
      group.position.set(spot.x, 0, spot.z);
      const lamp = new THREE.Mesh(GEO.ball, LAMP_MATS.idle); lamp.scale.setScalar(0.13); lamp.position.copy(model.lamp).add(group.position);
      const done = bake(buildDoneCrate()); done.position.set(spot.x - 0.2, 0.06, spot.z + 1.25); done.visible = false; done.traverse((o) => { o.castShadow = false; });
      const puffs: THREE.Mesh[] = [];
      if (model.steam) for (let k = 0; k < 2; k++) { const pf = new THREE.Mesh(GEO.sphere, STEAM_MAT); pf.userData.base = model.steam.clone().add(group.position); pf.userData.k = k / 2; pf.visible = false; puffs.push(pf); this.group.add(pf); }
      this.group.add(group, lamp, done);
      if (this.slot === 0) { const tag = makeLabel(m.name, 'paper', 0.6); tag.position.set(spot.x, model.h + 1.0, spot.z); this.group.add(tag); this.signs.push(tag); }
      this.fx.push({ m, group, lamp, done, puffs, x: spot.x, z: spot.z, state: '' });
    });
    if (this.slot === 0 && ms.length < MACHINE_SPOTS.length) { const sp = MACHINE_SPOTS[ms.length], tag = makeLabel('Chỗ đặt máy', 'paper', 0.56); tag.position.set(sp.x, 1.3, sp.z); this.group.add(tag); this.signs.push(tag); }
    this.belt = bake(buildBeltCrates()); this.belt.position.set(-5.4, 1.04, -4.9); this.belt.traverse((o) => { o.castShadow = false; }); this.group.add(this.belt);
    for (let k = 0; k < 3; k++) { const pf = new THREE.Mesh(GEO.sphere, STEAM_MAT); pf.userData.k = k / 3; this.smoke.push(pf); this.group.add(pf); }
    } else {
    // Sân đất và các ô được trồng theo vai trò
    st.add(mesh(GEO.box, mat(0xefdcb4), 0, 0.03, 0.2, PLOT_COLS * TILE + 1.6, 0.06, PLOT_ROWS * TILE + 1.6));
    st.add(mesh(GEO.box, mat(0xdcc394), 0, 0.02, 0.2, PLOT_COLS * TILE + 2.0, 0.05, PLOT_ROWS * TILE + 2.0));
    for (const t of tiles) {
      const p = tileLocal(t), alt = (t + Math.floor(t / PLOT_COLS)) % 2;
      st.add(mesh(GEO.box, mat(0x8a5f3f), p.x, 0.06, p.z, TILE - 0.1, 0.1, TILE - 0.1), mesh(GEO.box, mat(alt ? 0xa57650 : 0xb08259), p.x, 0.1, p.z, TILE - 0.26, 0.08, TILE - 0.26));
      for (let i = 0; i < 4; i++) st.add(mesh(GEO.box, mat(alt ? 0xb58560 : 0xbf8f67), p.x - 0.63 + i * 0.42, 0.15, p.z, 0.2, 0.05, TILE - 0.42)); // rãnh luống
    }
    buildFence(st, style?.fence ?? 'trang', FENCE, roofColor);
    // Lối đá từ cổng vào ruộng, vòng ra nhà
    const stone = mat(0xfaf3e3);
    for (let i = 0; i < 4; i++) st.add(mesh(GEO.cyl, stone, i % 2 ? 0.2 : -0.2, 0.05, FENCE.front - 0.6 - i * 0.75, 0.42, 0.06, 0.36));
    for (let i = 0; i < 9; i++) st.add(mesh(GEO.cyl, stone, -7.6 + (i % 2 ? 0.15 : -0.1), 0.05, 5.2 - i * 1.5, 0.4, 0.06, 0.34));
    const h = buildHomeHouse(data?.equipped?.nha ?? style?.house ?? zoneHouse(this.zone), wallColor, roofColor, this.night); h.position.set(0, 0, -10.4);
    h.add(mesh(GEO.cyl, mat(0xb5613c), -3.6, 0.55, 3.1, 0.45, 0.8, 0.45), mesh(GEO.cyl, mat(0x7fd3e8, { rough: 0.2 }), -3.6, 0.96, 3.1, 0.38, 0.03, 0.38));
    st.add(h);
    // Cây bóng mát, đống rơm, giếng trong sân
    st.add(mesh(GEO.cyl, mat(0x7a5233), 7.3, 1.0, -9.5, 0.2, 2, 0.2), mesh(GEO.ball, mat(0x5cb85f), 6.7, 2.6, -9.3, 1.2), mesh(GEO.ball, mat(0x79c96d), 7.9, 2.8, -9.7, 1.25), mesh(GEO.ball, mat(0x9bdc84), 7.3, 3.6, -9.4, 1.2));
    st.add(mesh(GEO.cone, mat(0xf6d77a), -7.4, 0.8, -10.6, 1.1, 1.6, 1.1), mesh(GEO.cyl, mat(0xbdb5a6), -7.3, 0.4, 6.9, 0.7, 0.8, 0.7), mesh(GEO.cyl, mat(0x4fb3e0, { rough: 0.2 }), -7.3, 0.81, 6.9, 0.56, 0.03, 0.56));
    }
    // Công trình theo vai trò (xưởng, bãi cân hàng) và đồ trang trí do chủ vườn đặt
    const prop = isFactory(data) ? null : buildRoleProp(data?.ownerRole); if (prop) { prop.position.set(0, 0, 3.7); st.add(prop); }
    for (const d of data?.decor ?? []) { const o = buildDecor(d.item); o.position.set(d.x, 0, d.z); o.rotation.y = d.rot; st.add(o); }
    // Nội thất, đồ sân vườn đã mua bày ở chỗ cố định quanh nhà; xe riêng đang dùng đỗ trong sân cạnh cổng
    if (!isFactory(data)) for (const id of data?.goods ?? []) { const sp = GOODS_SPOTS[id], o = sp && buildGoodProp(id, this.night); if (o) { o.position.set(sp[0], 0, sp[1]); o.rotation.y = sp[2]; st.add(o); } }
    { const ride = data?.equipped?.xe ? buildPersonalRide(data.equipped.xe) : null; if (ride) { ride.root.position.set(4.4, 0.04, 6.6); ride.root.rotation.y = Math.PI / 2 + 0.25; st.add(ride.root); } }
    {
    // Sạp bán hàng sát đường
    const s = new THREE.Group(); s.position.set(STALL.x, 0, STALL.z);
    s.add(mesh(GEO.box, mat(0xd9a877), 0, 0.55, 0, 3.4, 1.1, 1.3), mesh(GEO.box, mat(0xf2d2a2), 0, 1.13, 0.05, 3.6, 0.08, 1.5));
    for (const x of [-1.65, 1.65]) for (const z of [-0.6, 0.6]) s.add(mesh(GEO.cyl, woodDark, x, 1.5, z, 0.07, 3, 0.07));
    for (let i = 0; i < 8; i++) { const strip = mesh(GEO.box, mat(i % 2 ? 0xffffff : awning), -1.58 + i * 0.45, 3.05, 0.1, 0.45, 0.1, 2.1); strip.rotation.x = 0.22; s.add(strip); }
    for (let i = 0; i < 8; i++) s.add(mesh(GEO.ball, mat(i % 2 ? 0xffffff : awning), -1.58 + i * 0.45, 2.74, 1.14, 0.225, 0.2, 0.05)); // diềm bạt lượn sóng
    s.add(mesh(GEO.box, mat(0x8a5f3c), 0, 0.5, 0.68, 3.0, 0.7, 0.05), mesh(GEO.box, mat(0xf6e3ba), 0, 0.52, 0.71, 2.2, 0.42, 0.03)); // bảng giá trước quầy
    for (const [x, z, c] of [[-2.2, 0.5, 0xf08a24], [2.25, 0.4, 0x9bd64a], [2.3, -0.5, 0xe8457f]] as const) { s.add(mesh(GEO.box, mat(0xc9975a), x, 0.25, z, 0.7, 0.5, 0.7)); for (let k = 0; k < 4; k++) s.add(mesh(GEO.ball, mat(c, { rough: 0.5 }), x + (k % 2 ? 0.16 : -0.16), 0.56, z + (k > 1 ? 0.16 : -0.16), 0.15)); }
    s.add(mesh(GEO.cyl, woodDark, -1.2, 2.5, 0.62, 0.02, 0.5, 0.02), mesh(GEO.ball, this.night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0xe8412f), -1.2, 2.16, 0.62, 0.16, 0.2, 0.16)); // đèn lồng
    st.add(s);
    }
    if (style?.stallName) { const sign = makeLabel(style.stallName, 'paper', 0.66); sign.position.set(STALL.x, 3.9, STALL.z); this.group.add(sign); this.signs.push(sign); }
    this.group.add(bake(st), this.plantLayer);
    this.goods.position.set(STALL.x, 0, STALL.z); this.group.add(this.goods);
    if (this.slot !== 0) { // chủ nhà hàng xóm đứng trước hiên
      this.npc = makeFarmer(hex(data?.avatar?.shirt, ROOFS[(this.slot + 2) % 5]), data?.avatar?.hat ?? 'non_la', data?.equipped ?? null);
      this.npc.root.position.set(-1.6, 0, -6.4); this.group.add(this.npc.root);
    }
    this.built = kind;
  }

  private merged: THREE.Group | null = null; private mergedKey = '';
  setData(data: LotData | null, time: number) {
    this.data = data;
    const want = data ? (data.kind === 'rooftop' ? 'roof' : 'farm') : this.slot === 0 ? 'none' : 'empty';
    if (want === 'none') { this.group.clear(); this.built = 'none'; return; }
    const look = !data ? want : [want, this.zone, data.ownerRole, JSON.stringify(data.style ?? null), JSON.stringify(data.decor ?? null), JSON.stringify(data.avatar ?? null), JSON.stringify(data.equipped ?? null), (data.goods ?? []).join(','), isFactory(data) ? machinesOf(data).map((m) => `${m.id}:${m.kind}:${m.name}`).join(',') : ''].join('|');
    if (this.built !== want || this.look !== look) { this.rebuild(want); this.look = look; }
    if (!data) return;
    for (const f of this.fx) { const cur = machinesOf(data).find((m) => m.id === f.m.id); if (cur) f.m = cur; } // cập nhật mẻ đang chạy mà không dựng lại cảnh
    const text = data.style?.gateName || (isFactory(data) ? (data.mine ? 'Xưởng nhà' : `Xưởng ${data.ownerName}`) : data.mine ? (data.kind === 'rooftop' ? 'Sân thượng nhà' : 'Vườn nhà') : `Vườn ${data.ownerName}`);
    if (text !== this.labelText) {
      if (this.label) this.group.remove(this.label);
      this.label = makeLabel(text, data.mine ? 'gold' : 'paper', data.mine ? 0.92 : 0.8); this.label.position.set(0, 4.25, FENCE.front); this.group.add(this.label); this.labelText = text;
    }
    const seen = new Set<number>();
    for (const p of data.plantings) {
      seen.add(p.tile);
      const crop = CROPS[SPECIALTIES[p.specialtyId].crop];
      const last = processOf(crop).length - 1, prog = p.stepIndex / last;
      const stage: Stage = p.stepIndex >= last ? 3 : prog < 0.3 ? 0 : prog < 0.65 ? 1 : 2;
      const key = `${p.id}:${stage}`, cur = this.plants.get(p.tile);
      if (cur?.key === key) continue;
      if (cur) { this.plantLayer.remove(cur.group); freeBaked(cur.group); }
      const group = bake(buildPlant(crop, stage, p.id * 7 + p.tile));
      if (IS_MOBILE) group.traverse((o) => { o.castShadow = false; }); // trên di động cây trồng không đổ bóng thật: bớt một lượt vẽ cho mỗi ô
      const l = tileLocal(p.tile); group.position.set(l.x, 0, l.z); group.userData.sway = p.tile * 0.7;
      this.plantLayer.add(group); this.plants.set(p.tile, { key, group, born: time });
    }
    for (const [tile, cur] of this.plants) if (!seen.has(tile)) { this.plantLayer.remove(cur.group); freeBaked(cur.group); this.plants.delete(tile); }
    if (this.slot !== 0) { // vườn hàng xóm: gộp mọi cây thành một lưới (một lần vẽ thay vì mỗi ô một lần), không đổ bóng
      const sig = [...this.plants].map(([t, c]) => `${t}:${c.key}`).join(',');
      if (sig !== this.mergedKey) {
        if (this.merged) { this.group.remove(this.merged); freeBaked(this.merged); this.merged = null; }
        this.mergedKey = sig;
        if (this.plants.size) {
          const tmp = new THREE.Group();
          for (const c of this.plants.values()) { const k = c.group.clone(); k.scale.setScalar(1); k.rotation.set(0, 0, 0); tmp.add(k); }
          this.merged = bake(tmp); this.merged.position.copy(this.plantLayer.position); this.group.add(this.merged);
        }
      }
      this.plantLayer.visible = false;
    }
    const kinds = [...new Set(data.stall.map((l) => SPECIALTIES[l.specialtyId].crop))].slice(0, 4);
    // hàng trên sạp chỉ dựng lại khi món bày đổi (trước đây dựng lại mỗi lần tải dữ liệu, 15 giây một lần, và không nhả lưới cũ)
    if (kinds.join(',') === this.goodsKey && this.goods.children.length === (kinds.length ? 1 : 0)) return;
    this.goodsKey = kinds.join(','); freeBaked(this.goods); this.goods.clear();
    const g = new THREE.Group();
    kinds.forEach((cropId, i) => {
      const x = -1.2 + i * 0.8, r = rng(i + 3), color = fruitColor(cropId);
      g.add(mesh(GEO.box, mat(0xc9975a), x, 1.3, 0.1, 0.62, 0.26, 0.62));
      for (let k = 0; k < 6; k++) g.add(mesh(GEO.ball, mat(color, { rough: 0.5 }), x + (r() - 0.5) * 0.4, 1.5 + (k > 3 ? 0.14 : 0), 0.1 + (r() - 0.5) * 0.4, 0.14));
    });
    if (kinds.length) this.goods.add(bake(g));
  }

  animate(t: number, now: number, scene: World) {
    if ((this.built !== 'farm' && this.built !== 'roof') || !this.data) return;
    for (const [, p] of this.plants) {
      const k = Math.min(1, (t - p.born) / 0.5), ease = 1 - Math.pow(1 - k, 3);
      p.group.scale.setScalar((0.6 + 0.4 * ease + (k < 1 ? Math.sin(k * Math.PI) * 0.14 : 0)) * 1.14);
      p.group.rotation.z = Math.sin(t * 1.4 + p.group.userData.sway) * 0.03;
    }
    const ready = new Set<number>();
    for (const p of this.data.plantings) if (now >= p.stepReadyAt) ready.add(p.tile);
    for (const tile of ready) {
      let m = this.markers.get(tile);
      if (!m) { m = scene.makeMarker(); const l = tileLocal(tile); m.position.set(l.x, 2.6, l.z); this.group.add(m); this.markers.set(tile, m); }
      m.position.y = 2.7 + Math.sin(t * 3 + tile) * 0.2; m.rotation.y = t * 2.2;
    }
    for (const [tile, m] of this.markers) if (!ready.has(tile)) { this.group.remove(m); this.markers.delete(tile); }
    for (const [i, f] of this.fx.entries()) { // máy đang chạy rung nhẹ, đèn xanh nhấp nháy, có hơi; mẻ xong đèn vàng và có thùng thành phẩm
      const state = machineState(f.m, now);
      if (state !== f.state) { f.state = state; f.lamp.material = LAMP_MATS[state]; f.done.visible = state === 'done'; for (const pf of f.puffs) pf.visible = state === 'run'; if (state !== 'run') f.group.position.set(f.x, 0, f.z); }
      if (state === 'run') {
        f.group.position.set(f.x + Math.sin(t * 31 + i) * 0.012, Math.abs(Math.sin(t * 23 + i)) * 0.014, f.z);
        f.lamp.scale.setScalar(0.13 * (Math.sin(t * 7 + i) > 0 ? 1.25 : 0.8));
        for (const pf of f.puffs) { const k = (t * 0.45 + pf.userData.k + i * 0.3) % 1, b = pf.userData.base as THREE.Vector3; pf.position.set(b.x + Math.sin(k * 5 + i) * 0.12, b.y + k * 1.5, b.z); pf.scale.setScalar(0.14 + k * 0.3); }
      } else f.lamp.scale.setScalar(state === 'done' ? 0.15 + Math.sin(t * 4) * 0.02 : 0.13);
    }
    if (this.belt) this.belt.position.x = -5.4 + ((t * 0.5) % 1.65);
    for (const pf of this.smoke) { const k = (t * 0.22 + pf.userData.k) % 1; pf.position.set(1.2 + k * 0.9, 5.4 + k * 2.4, -5.8 - k * 0.3); pf.scale.setScalar(0.22 + k * 0.55); }
    if (this.npc) { this.npc.armR.rotation.z = -2.4 + Math.sin(t * 5) * 0.35; this.npc.root.position.y = Math.abs(Math.sin(t * 2)) * 0.04; }
  }
}

// ---------------------------------------------------------------- thế giới
export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
  private clock = new THREE.Clock();
  private sun: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private rain!: THREE.InstancedMesh;
  private rainDrops: { x: number; y: number; z: number; v: number }[] = [];
  private weather: WeatherKind = 'nang';
  private urban = false;
  private sky: Sky;
  private env = new THREE.Group();
  private lots: Lot[] = [];
  private colliders: [number, number, number, number][] = [];
  private envColliders: [number, number, number, number][] = [];
  private state: WorldState | null = null;
  private regionId = '';
  private player: Body;
  private avatarKey = '';
  private truck: { root: THREE.Group; wheels: THREE.Object3D[] } | null = null;
  private truckPos = new THREE.Vector3(-5.5, 0, ROAD_Z - 1.7);
  private truckYaw = Math.PI / 2;
  driving = false;
  private pos = new THREE.Vector3(-7, 0, ROAD_Z + 0.5);
  private vel = new THREE.Vector3();
  private camPos = new THREE.Vector3(); private camLag = new THREE.Vector3(); private camTmp = new THREE.Vector3();
  private input = new THREE.Vector2();
  private keys = new Set<string>();
  private walkTo: THREE.Vector3 | null = null;
  private stick: { id: number; x: number; y: number; moved: boolean; t: number } | null = null;
  private stickEl: HTMLDivElement; private knobEl: HTMLDivElement;
  private zoom = 1;
  private ctxKey = '';
  private readyAt = new Map<number, number>();
  private workUntil = 0;
  private walkJob: { to: THREE.Vector3; mul: number; res: (ok: boolean) => void; cancel: boolean } | null = null;
  private work: { kind: WorkKind; t0: number; dur: number; pro: boolean; tool: THREE.Group; hit: boolean; onHit: (ok: boolean) => void; onDone: () => void } | null = null;
  private ring: THREE.Mesh;
  private arrow = new THREE.Group();
  private markerGeo = new THREE.OctahedronGeometry(0.36, 0);
  private sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private floats: { s: THREE.Sprite; life: number }[] = [];
  private chickens: { obj: THREE.Group; target: THREE.Vector3; wait: number; speed: number }[] = [];
  private clouds: THREE.Group[] = [];
  private flutter: { m: THREE.Mesh; c: THREE.Vector3; ph: number }[] = [];
  private shades: THREE.Mesh[] = [];
  private puffs: { s: THREE.Sprite; lot: number; ph: number }[] = [];
  private flies: { s: THREE.Sprite; ph: number }[] = [];
  private water: THREE.Mesh | null = null;
  private ro: ResizeObserver;
  private disposed = false;
  private enteredYard = false;
  private demoT = 0;
  private cleanup: (() => void)[] = [];
  paused = false;
  private container: HTMLElement;
  private opts: WorldOptions;

  constructor(container: HTMLElement, opts: WorldOptions) {
    this.container = container; this.opts = opts;
    const d = new Date();
    this.sky = skyFor(opts.hour ?? d.getHours() + d.getMinutes() / 60);
    this.renderer = new THREE.WebGLRenderer(rendererParams(container));
    // điện thoại: bóng đổ lọc đơn (PCF) và chỉ dựng lại bản đồ bóng cách khung, thay vì bóng mềm đắt gấp mấy lần
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = this.sky.night ? 1.3 : 1.0;
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none';
    container.appendChild(el);
    this.scene.background = gradient(this.sky.top, this.sky.sky);
    this.scene.fog = new THREE.Fog(this.sky.sky, 90, 260);
    this.sun = new THREE.DirectionalLight(this.sky.sun, this.sky.sunI);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    Object.assign(this.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 5;
    this.hemi = new THREE.HemisphereLight(this.sky.hemiSky, this.sky.hemiGround, this.sky.hemiI);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.env);
    this.buildRain();
    for (let i = 0; i < SLOT_COUNT; i++) { const lot = new Lot(i, this.sky.night); this.lots.push(lot); this.scene.add(lot.group); }

    this.player = makeFarmer(0x5aa9e6); this.scene.add(this.player.root);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.rotation.z = Math.PI / 4; this.ring.visible = false; this.scene.add(this.ring);
    const gold = mat(0xffd23f, { emissive: 0xffa800, rough: 0.4 });
    const head = mesh(GEO.cone, gold, 0, 0, 0, 0.75, 1.1, 0.75); head.rotation.x = Math.PI; head.castShadow = false;
    const shaft = mesh(GEO.box, gold, 0, 1.2, 0, 0.5, 1.4, 0.5); shaft.castShadow = false;
    this.arrow.add(head, shaft); this.arrow.visible = false; this.scene.add(this.arrow);
    for (let i = 0; i < 30; i++) { const m = mesh(GEO.ball, mat(0xffffff), 0, -10, 0, 0.1); m.castShadow = false; m.visible = false; this.scene.add(m); this.sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }
    this.buildLife();

    // Cần điều khiển ảo
    this.stickEl = document.createElement('div'); this.knobEl = document.createElement('div');
    this.stickEl.className = 'stick'; this.knobEl.className = 'stick-knob'; this.stickEl.appendChild(this.knobEl); container.appendChild(this.stickEl);
    if (!opts.demo) this.bindInput(el);
    this.camPos.copy(this.pos);
    this.quality = new Quality(this.renderer, { name: opts.demo ? 'vườn mẫu' : 'vườn', onLevel: (l) => this.applyQuality(l) }); debugScene(this.scene);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  private quality!: Quality; private qLevel = 0; private frameNo = 0; private shadowKey = '';
  /** Bậc chất lượng đổi: tắt bóng đổ, bớt mưa, kéo sương và tầm nhìn gần lại. */
  private applyQuality(l: number) {
    this.qLevel = l;
    if (this.sun) this.sun.castShadow = IS_MOBILE ? l < 1 : l < 2;
    if (this.rain) this.rain.count = [900, 600, 380, 240][l];
    this.applyFog();
  }
  private applyFog() {
    const fog = this.scene.fog as THREE.Fog | null; if (!fog) return;
    const wet = this.weather === 'mua' || this.weather === 'bao', k = [1, 1, 0.8, 0.65][this.qLevel];
    fog.near = (wet ? 45 : 90) * k; fog.far = (wet ? 150 : 260) * k;
    this.camera.far = this.qLevel >= 2 ? fog.far + 40 : 600; this.camera.updateProjectionMatrix();
  }

  /** Đổi áo, nón của nhân vật mình điều khiển. */
  setAvatar(avatar: Avatar | null | undefined, outfit: Outfit | null = null) {
    const key = JSON.stringify([avatar ?? null, outfit ?? null]); if (key === this.avatarKey) return; this.avatarKey = key;
    this.scene.remove(this.player.root);
    this.player = makeFarmer(hex(avatar?.shirt, 0x5aa9e6), avatar?.hat ?? 'non_la', outfit); this.player.root.visible = !this.driving; this.scene.add(this.player.root);
  }
  /** Thương lái có xe tải đỗ trước cổng; truyền null để cất xe. */
  setTruck(color: string | null, kind: string | null = null) {
    if (this.truck) { this.scene.remove(this.truck.root); freeBaked(this.truck.root); this.truck = null; }
    if (color === null) { if (this.driving) this.exitTruck(); return; }
    this.truck = packRide(makeTruckKind(kind, hex(color, 0xf08a6c))); this.scene.add(this.truck.root); // đúng loại xe đang dùng, gộp lưới để ít lần vẽ
    this.truck.root.position.copy(this.driving ? this.pos : this.truckPos); this.truck.root.rotation.y = this.truckYaw;
  }
  enterTruck() { if (!this.truck || this.driving) return; this.driving = true; this.pos.copy(this.truckPos); this.walkTo = null; this.vel.set(0, 0, 0); this.player.root.visible = false; }
  exitTruck() {
    if (!this.driving) return; this.driving = false; this.truckPos.copy(this.pos); this.truckYaw = this.truck?.root.rotation.y ?? this.truckYaw;
    this.pos.set(this.pos.x, 0, ROAD_Z - ROAD_HALF - 0.6); this.walkTo = null; this.vel.set(0, 0, 0); this.player.root.visible = true;
  }

  makeMarker(): THREE.Mesh { const m = new THREE.Mesh(this.markerGeo, mat(0xffd23f, { emissive: 0xffa800, rough: 0.4 })); return m; }

  private bindInput(el: HTMLCanvasElement) {
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: any) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); this.cleanup.push(() => t.removeEventListener(type, fn, o)); };
    on(el, 'pointerdown', (e: PointerEvent) => {
      if (this.paused || this.stick) return;
      el.setPointerCapture(e.pointerId);
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: performance.now() };
    });
    on(el, 'pointermove', (e: PointerEvent) => {
      const s = this.stick; if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y, len = Math.hypot(dx, dy);
      if (!s.moved && len > 10) { s.moved = true; this.walkTo = null; const r = this.container.getBoundingClientRect(); this.stickEl.style.left = `${s.x - r.left}px`; this.stickEl.style.top = `${s.y - r.top}px`; this.stickEl.classList.add('on'); }
      if (!s.moved) return;
      const k = Math.min(1, len / 56); this.input.set((dx / (len || 1)) * k, (dy / (len || 1)) * k);
      this.knobEl.style.transform = `translate(${this.input.x * 44}px, ${this.input.y * 44}px)`;
    });
    const end = (e: PointerEvent) => {
      const s = this.stick; if (!s || s.id !== e.pointerId) return;
      this.stick = null; this.input.set(0, 0); this.stickEl.classList.remove('on'); this.knobEl.style.transform = '';
      if (!s.moved && performance.now() - s.t < 500 && e.type === 'pointerup') { // chạm nhanh: chạy tới điểm đó
        const r = el.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
        const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) { this.walkTo = this.snapTap(hit); this.detour = null; }
      }
    };
    on(el, 'pointerup', end); on(el, 'pointercancel', end);
    on(el, 'wheel', (e: WheelEvent) => { e.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.92), 0.6, 1.6); }, { passive: false });
    const typing = () => /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    on(window, 'keydown', (e: KeyboardEvent) => { if (!typing() && /^(Arrow|Key[WASD])/.test(e.code)) { this.keys.add(e.code); this.walkTo = null; e.preventDefault(); } });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
  }

  // ------------------------------------------------------------ cảnh nền theo vùng
  private buildLife() {
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Group(), r = rng(100 + i);
      for (let k = 0; k < 4; k++) { const b = mesh(GEO.ball, mat(this.sky.night ? 0x5a6a99 : 0xffffff, { rough: 1 }), k * 2.2 - 3 + r(), r() * 0.8, r() * 1.5, 2 + r() * 1.3, 1.1 + r() * 0.5, 1.8); b.castShadow = false; b.receiveShadow = false; c.add(b); }
      const cb = bake(c); cb.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
      cb.position.set(-90 + i * 26, 30 + r() * 8, -60 + r() * 60); cb.userData.speed = 0.6 + r() * 0.6; this.clouds.push(cb); this.scene.add(cb);
    }
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(), col = mat(i % 2 ? 0xffffff : 0xd98a4a);
      const cbody = new THREE.Group(), chead = new THREE.Group(), beak = mesh(GEO.cone, mat(0xffa51e), 0, -0.02, 0.17, 0.05, 0.12, 0.05); beak.rotation.x = Math.PI / 2;
      cbody.add(mesh(GEO.ball, col, 0, 0.32, 0, 0.27, 0.25, 0.33), mesh(GEO.cone, col, 0, 0.46, -0.33, 0.11, 0.27, 0.11));
      chead.add(mesh(GEO.ball, col, 0, 0, 0, 0.15), beak, mesh(GEO.box, mat(0xe0342b), 0, 0.17, 0, 0.05, 0.11, 0.14));
      const chb = bake(chead); chb.position.set(0, 0.6, 0.22); g.add(bake(cbody), chb); // thân và đầu gộp lại: 2 lần vẽ thay vì 5
      g.position.set(-8 + i * 0.7, 0, 7 - i * 0.3);
      this.chickens.push({ obj: g, target: g.position.clone(), wait: i * 0.7, speed: 1.2 + i * 0.15 }); this.scene.add(g);
    }
    { // chó vàng quanh quẩn trong sân (đầu là phần tử thứ hai để gật gù như gà)
      const g = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(), fur = mat(0xd9a05a), dk = mat(0x8a5a2a);
      body.add(mesh(GEO.sphere, fur, 0, 0.42, 0, 0.24, 0.24, 0.42));
      const tail = mesh(GEO.cone, fur, 0, 0.62, -0.42, 0.06, 0.34, 0.06); tail.rotation.x = -0.7; body.add(tail);
      for (const x of [-0.14, 0.14]) for (const z of [-0.24, 0.24]) body.add(mesh(GEO.box, fur, x, 0.14, z, 0.1, 0.28, 0.1));
      head.add(mesh(GEO.sphere, fur, 0, 0, 0.42, 0.22), mesh(GEO.sphere, dk, 0, -0.04, 0.62, 0.09, 0.08, 0.1), mesh(GEO.cone, dk, -0.13, 0.22, 0.38, 0.07, 0.18, 0.07), mesh(GEO.cone, dk, 0.13, 0.22, 0.38, 0.07, 0.18, 0.07));
      const hb = bake(head); hb.position.y = 0.6; g.add(bake(body), hb);
      g.position.set(3.5, 0, 9.5); this.chickens.push({ obj: g, target: g.position.clone(), wait: 2, speed: 2.4 }); this.scene.add(g);
    }
    for (let i = 0; i < 4; i++) { // bóng mây trôi trên mặt đất
      const m = new THREE.Mesh(new THREE.PlaneGeometry(38, 26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x15301a, transparent: true, opacity: 0.2, depthWrite: false }));
      m.position.set(-60 + i * 42, 0.14, -8 + (i % 2) * 34); m.renderOrder = -1; m.visible = !this.sky.night; this.shades.push(m); this.scene.add(m);
    }
    for (let i = 0; i < 9; i++) { // khói bếp
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: this.sky.night ? 0x9aa6c8 : 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      this.puffs.push({ s, lot: i % 3, ph: i / 9 }); this.scene.add(s);
    }
    if (this.sky.night) for (let i = 0; i < 26; i++) { // đom đóm
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xf6ff8a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(0.34); this.flies.push({ s, ph: i * 2.39 }); this.scene.add(s);
    }
    if (!this.sky.night) for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({ color: [0xff7fb0, 0xffd23f, 0x7fd0ff, 0xffffff][i % 4], side: THREE.DoubleSide }));
      this.flutter.push({ m, c: new THREE.Vector3(-14 + i * 4, 1.2, 9 + (i % 3) * 2), ph: i * 1.7 }); this.scene.add(m);
    }
  }

  private buildEnvironment(regionId: string) {
    this.env.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !SHARED_GEO.has(m.geometry) && m.geometry !== TUFT_GEO && m.geometry !== FLOWER_GEO) m.geometry.dispose(); if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); }); // đổi vùng: nhả lưới cảnh nền cũ
    this.env.clear(); this.water = null;
    const zone = REGIONS[regionId]?.zone ?? 'nam', th = this.urban ? CITY : THEMES[zone];
    const r = rng([...regionId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const out = (x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x) - (WORLD.x + 6)), Math.max(0, WORLD.zMin - 6 - z, z - WORLD.zMax - 6));
    const g = new THREE.PlaneGeometry(520, 520, 80, 80); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute, colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), cg = new THREE.Color(th.grass), cg2 = new THREE.Color(th.grass2), sand = new THREE.Color(0xf6ecc6), rock = new THREE.Color(0xa9b8a2);
    const lush = cg2.clone().multiplyScalar(0.86), dry = cg.clone().lerp(new THREE.Color(0xe6dc8a), 0.45), patch = new THREE.Color(th.patch ?? th.grass2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i) + 15, d = out(x, z);
      const n = Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.16) + Math.sin(x * 0.07 + z * 0.1) * 1.4;
      let y = 0;
      if (th.sea) { y = -Math.min(3.5, Math.max(0, d - 4) * 0.3); c.copy(d < 2 ? (n > 0.9 ? cg2 : cg) : sand); }
      else { const k = d / 34; y = k * k * th.hill * (2.4 + n); c.copy(y > 9 ? rock : n > 0.9 ? cg2 : cg); }
      if (!this.urban && y < 9 && !(th.sea && d >= 2)) { // loang màu: mảng cỏ non, cỏ rậm, cỏ khô và mảng đất đặc trưng của vùng
        const n1 = Math.sin(x * 0.11 + 2.1) * Math.cos(z * 0.13 - 0.7), n2 = Math.sin(x * 0.045 - z * 0.06 + 4) + Math.cos(x * 0.31 + z * 0.27) * 0.35, n3 = Math.sin(x * 0.083 + z * 0.021 + 1.7) * Math.sin(z * 0.097 - x * 0.03);
        c.lerp(lush, THREE.MathUtils.clamp(n1 * 0.9, 0, 0.7)); c.lerp(dry, THREE.MathUtils.clamp(-n2 * 0.5 - 0.1, 0, 0.5));
        if (th.patch !== undefined) c.lerp(patch, THREE.MathUtils.smoothstep(n3, 0.25, 0.6) * (th.patchK ?? 0.8));
      }
      pos.setZ(i, z); pos.setY(i, y); colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
    const gt = grassTex(this.urban); gt.repeat.set(86, 86);
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: gt }));
    ground.receiveShadow = true; ground.position.y = -0.03; this.env.add(ground);
    if (th.sea) {
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: this.sky.night ? 0x2f6a96 : 0x7fd3e8, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
      this.water.position.set(0, -0.6, 15); this.water.receiveShadow = true; this.env.add(this.water);
      for (const [bx, bz, col] of [[-48, 66, 0x6fb7d9], [30, 70, 0xf08a6c], [78, 20, 0x8fd67c]] as const) {
        const boat = bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(col), 0, 0, 0, 3, 0.6, 1.1), mesh(GEO.box, mat(0xffffff), 0, 0.36, 0, 3.1, 0.12, 1.2), mesh(GEO.cyl, mat(0x6e4424), 0.2, 1.2, 0, 0.05, 1.9, 0.05), mesh(GEO.box, mat(0xfff6dc), 0.75, 1.3, 0, 1.0, 1.2, 0.04)); return b; })());
        boat.position.set(bx, -0.4, bz); boat.rotation.y = r() * 3; boat.userData.boat = r() * 6; this.env.add(boat);
      }
    }
    // Đường làng và lối vào từng cổng
    const st = new THREE.Group(), road = mat(th.road), edge = mat(this.urban ? 0xf3f4f6 : 0xfbf3df);
    const strip = (x: number, z: number, len: number, wid: number, alongZ = false) => { // dải đường có vân, mép mờ vào cỏ
      const tex = roadTex(th.road, this.urban).clone(); tex.needsUpdate = true; tex.repeat.set(len / 9, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, wid).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, alphaMap: this.urban ? null : edgeFade(), transparent: !this.urban, roughness: 1, depthWrite: this.urban, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.position.set(x, 0.035, z); if (alongZ) m.rotation.y = Math.PI / 2; m.receiveShadow = true; m.renderOrder = this.urban ? 0 : alongZ ? -3 : -2; this.env.add(m);
    };
    strip(0, ROAD_Z, (WORLD.x + 60) * 2, ROAD_HALF * 2 + 1.3);
    for (let x = -WORLD.x - 4; x <= WORLD.x + 4; x += 2.4) for (const s of [-1, 1]) { const k = 0.7 + ((Math.abs(x * 7.3) % 1) * 0.6); if ((Math.round(x / 2.4) + (s > 0 ? 1 : 0)) % 3 !== 0) st.add(mesh(GEO.ball, edge, x + (s > 0 ? 1.1 : 0), 0.04, ROAD_Z + s * (ROAD_HALF + 0.35), 0.3 * k, 0.11, 0.24 * k)); }
    for (let i = 0; i < SLOT_COUNT; i++) { const a = flip(i, 0, (FENCE.front + ROAD_Z - ROAD_HALF) / 2); strip(a.x, a.z, ROAD_Z - ROAD_HALF - FENCE.front + 1.6, 3.9, true); }
    for (let k = -2; k <= 3; k++) { // cột đèn: đứng ở khe giữa hai lô để không chắn sạp, cổng hay xe tải
      const x = k * PITCH - 24;
      st.add(mesh(GEO.cyl, mat(0x5a5f6b), x + 12, 1.7, ROAD_Z - ROAD_HALF - 0.6, 0.08, 3.4, 0.08), mesh(GEO.ball, this.sky.night ? mat(0xffe9a8, { emissive: 0xffd05a }) : mat(0xfff6dc), x + 12, 3.5, ROAD_Z - ROAD_HALF - 0.6, 0.28));
      if (this.sky.night) { const lamp = new THREE.PointLight(0xffd58a, 22, 14, 1.7); lamp.position.set(x + 12, 3.4, ROAD_Z - ROAD_HALF - 0.4); this.env.add(lamp); }
    }
    if (this.urban) this.buildSkyline(st, r);
    if (zone === 'nam' && !this.urban) st.add(mesh(GEO.box, new THREE.MeshStandardMaterial({ color: 0x8fd8ea, roughness: 0.25, transparent: true, opacity: 0.92 }), 0, 0.03, WORLD.zMin - 3, 300, 0.06, 6));
    // Cây, bụi quanh xóm
    const gapX = (x: number) => Math.abs(((x - 12) % PITCH + PITCH * 1.5) % PITCH - PITCH / 2); // khoảng cách tới tim khe giữa hai lô
    const free = (x: number, z: number) => {
      if (Math.abs(z - ROAD_Z) < ROAD_HALF + 1.5) return false;
      if (!this.urban && Math.abs(x) < 3 * PITCH && gapX(x) < 2.6 && z > -12 && z < 2 * ROAD_Z + 12) return false;
      for (let i = 0; i < SLOT_COUNT; i++) { const l = toLocal(i, x, z); if (Math.abs(l.x) < FENCE.x + 1.2 && l.z > FENCE.back - 1.2 && l.z < FENCE.front + 4) return false; }
      return true;
    };
    const blobs: number[][] = [];
    let placed = 0, guard = 0; const groves = new Map<string, THREE.Group>(); // gộp cây theo cụm ~30 m: ít lần vẽ mà vẫn bỏ được cụm ngoài khung hình
    while (placed < (this.urban ? 22 : 70) && guard++ < 900) {
      const x = (r() * 2 - 1) * (WORLD.x + 40), z = WORLD.zMin - 34 + r() * (WORLD.zMax - WORLD.zMin + 70);
      const d = out(x, z); if (!free(x, z) || (th.sea && d > 3)) continue;
      if (z > ROAD_Z + ROAD_HALF && z < 2 * ROAD_Z + 6 && Math.abs(x) < 8 && r() < 0.7) continue;
      const k = d / 34, t = this.makeTree(th.trees, r); t.position.set(x, th.sea ? 0 : k * k * th.hill * 2.4, z); t.rotation.y = r() * 6; t.scale.setScalar(0.9 + r() * 0.7); blobs.push([x, t.position.y, z, t.scale.x]);
      { const key = `${Math.round(x / 30)}|${z < ROAD_Z ? 0 : 1}`; if (!groves.has(key)) groves.set(key, new THREE.Group()); groves.get(key)!.add(t); } placed++;
    }
    for (const gv of groves.values()) { const b = bake(gv); if (IS_MOBILE) b.traverse((o) => { o.castShadow = false; }); this.env.add(b); } // di động: cây quanh xóm không vào lượt bóng đổ, thay bằng bóng tròn mềm dưới gốc
    if (blobs.length) { // bóng tiếp đất mềm dưới mọi gốc cây quanh xóm: một lưới, một lần vẽ
      const parts = blobs.map(([x, y, z, k]) => { const c = new THREE.CircleGeometry(1.9 * k, 12).rotateX(-Math.PI / 2); c.scale(1, 1, 0.8); c.translate(x + 0.5, y + 0.07, z + 0.4); return c; });
      const m = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshBasicMaterial({ color: 0x0c2410, transparent: true, opacity: this.sky.night ? 0.24 : IS_MOBILE ? 0.32 : 0.12, depthWrite: false }));
      for (const c of parts) c.dispose(); m.renderOrder = -1; this.env.add(m);
    }
    for (let i = 0; i < 60; i++) { const x = (r() * 2 - 1) * WORLD.x, z = WORLD.zMin + r() * (WORLD.zMax - WORLD.zMin); if (free(x, z)) st.add(mesh(GEO.ball, mat(i % 3 ? 0x79c96d : 0x5cb85f), x, 0.2, z, 0.4 + r() * 0.3, 0.3, 0.4)); }
    for (let i = 0; i < th.mountains; i++) {
      const a = Math.PI * (1.05 + (i / Math.max(1, th.mountains - 1)) * 0.9) + r() * 0.15, dist = 150 + r() * 50, hh = 34 + r() * 36;
      const m = mesh(new THREE.ConeGeometry(26 + r() * 20, hh, 6), mat(zone === 'taynguyen' ? 0x9cc79a : 0xa9cbbd, { rough: 1 }), Math.cos(a) * dist, hh / 2 - 3, 15 + Math.sin(a) * dist); m.castShadow = false; m.rotation.y = r() * 3; this.env.add(m);
    }
    this.envColliders = [];
    if (!this.urban) {
      let idx = Math.floor(r() * 4);
      const all = new THREE.Group(); // gộp mọi tiểu cảnh thành một lưới theo chất liệu để ít lần vẽ
      for (let k = -3; k <= 2; k++) for (const side of [1, -1]) { // tiểu cảnh đặc trưng của miền ở khe giữa các lô
        const gx = k * PITCH + 12, sc = zoneScene(zone, idx++, r);
        sc.position.set(gx, 0, side === 1 ? 0 : 2 * ROAD_Z); sc.rotation.y = side === 1 ? 0 : Math.PI; all.add(sc);
        this.envColliders.push(side === 1 ? [gx - 2.0, gx + 2.0, -10.4, 8.4] : [gx - 2.0, gx + 2.0, 2 * ROAD_Z - 8.4, 2 * ROAD_Z + 10.4]);
      }
      this.env.add(bake(all));
      for (let i = 0; i < SLOT_COUNT; i++) { const a = flip(i, -5.6, 10.4), pr = roadsideProp(zone, i + idx, r); pr.position.set(a.x, 0, a.z); pr.rotation.y = r() * 6; st.add(pr); }
      // cổng chào tên vùng bắc ngang đường làng
      const ax = 15.6, post = mat(0x8a5f3c), reg = REGIONS[regionId];
      for (const s of [-1, 1]) st.add(mesh(GEO.cyl, post, ax, 2.2, ROAD_Z + s * (ROAD_HALF + 1.1), 0.12, 4.4, 0.12), mesh(GEO.ball, mat(0xf2b25c), ax, 4.5, ROAD_Z + s * (ROAD_HALF + 1.1), 0.24));
      st.add(mesh(GEO.box, post, ax, 4.15, ROAD_Z, 0.16, 0.16, ROAD_HALF * 2 + 2.6));
      for (let i = 0; i < 7; i++) st.add(mesh(GEO.cone, mat([0xe8412f, 0xffd23f, 0x6fb7d9, 0xfdf6e6][i % 4]), ax, 3.86, ROAD_Z - 2.7 + i * 0.9, 0.05, 0.34, 0.16).rotateX(Math.PI));
      if (reg) { const lb = makeLabel(`Chào mừng tới ${reg.name}`, 'region', 0.78); lb.position.set(ax, 5.0, ROAD_Z); this.env.add(lb); }
    }
    this.env.add(bake(st));
    // Cỏ và hoa dại
    const tuft = new THREE.InstancedMesh(TUFT_GEO, mat(this.urban ? 0x8fd67c : new THREE.Color(th.grass2).multiplyScalar(0.88).getHex()), 700), flower = new THREE.InstancedMesh(FLOWER_GEO, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 260);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), palette = [0xffffff, 0xffe27a, 0xf7a8c4, 0xf6b384, 0xcdb4f2];
    let ti = 0, fi = 0, tries = 0;
    while ((ti < 700 || fi < 260) && tries++ < 6000) {
      const x = (r() * 2 - 1) * (WORLD.x + 4), z = WORLD.zMin - 4 + r() * (WORLD.zMax - WORLD.zMin + 8);
      if (!free(x, z)) continue;
      if (ti < 700 && r() < 0.75) { m4.compose(new THREE.Vector3(x, 0.16, z), q.setFromEuler(new THREE.Euler(0, r() * 6, (r() - 0.5) * 0.5)), new THREE.Vector3(0.09, 0.3 + r() * 0.2, 0.09)); tuft.setMatrixAt(ti++, m4); }
      else if (fi < 260) { m4.compose(new THREE.Vector3(x, 0.2, z), q.identity(), new THREE.Vector3(0.11, 0.11, 0.11)); flower.setMatrixAt(fi, m4); flower.setColorAt(fi++, col.setHex(palette[Math.floor(r() * palette.length)])); }
    }
    tuft.count = this.urban ? Math.min(ti, 120) : ti; flower.count = this.urban ? Math.min(fi, 60) : fi; tuft.receiveShadow = true; this.env.add(tuft, flower);
  }

  private makeTree(kind: Theme['trees'], r: () => number): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'pine') {
      g.add(mesh(GEO.cyl, mat(0x7a5233), 0, 0.6, 0, 0.16, 1.2, 0.16));
      for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(i % 2 ? 0x4f9f6a : 0x66b47c), 0, 1.5 + i * 0.9, 0, 1.25 - i * 0.3, 1.5, 1.25 - i * 0.3));
    } else if (kind === 'palm') {
      const h = 3.2 + r() * 1.6; const trunk = mesh(GEO.cyl, mat(0x9a7a50), 0.15, h / 2, 0, 0.15, h, 0.15); trunk.rotation.z = -0.08; g.add(trunk);
      for (let i = 0; i < 7; i++) { const p = new THREE.Group(); p.position.set(0.3, h, 0); p.rotation.y = (i / 7) * 6.28; p.rotation.z = -0.5; p.add(mesh(GEO.sphere, mat(i % 2 ? 0x5cb85f : 0x8fd67c), 1.0, 0, 0, 1.15, 0.07, 0.3)); g.add(p); }
      g.add(mesh(GEO.ball, mat(0x8aa83a), 0.3, h - 0.2, 0.17, 0.19), mesh(GEO.ball, mat(0x8aa83a), 0.13, h - 0.22, -0.1, 0.19));
    } else {
      g.add(mesh(GEO.cyl, mat(0x7a5233), 0, 0.8, 0, 0.18, 1.6, 0.18));
      g.add(mesh(GEO.ball, mat(0x5cb85f), -0.5, 2.0, 0.1, 1.0), mesh(GEO.ball, mat(0x79c96d), 0.55, 2.1, -0.1, 1.05), mesh(GEO.ball, mat(0x9bdc84), 0, 2.8, 0.1, 1.1));
    }
    return bake(g);
  }

  // ------------------------------------------------------------ trạng thái
  setState(state: WorldState) {
    const urban = state.lots[0]?.kind === 'rooftop';
    if (state.regionId !== this.regionId || urban !== this.urban) { this.regionId = state.regionId; this.urban = urban; this.buildEnvironment(state.regionId); }
    this.setWeather(state.weather ?? 'nang');
    this.state = state;
    for (const c of this.chickens) c.obj.visible = !urban; // sân thượng thành phố không nuôi gà thả
    const t = this.clock.elapsedTime;
    const zone = REGIONS[state.regionId]?.zone ?? 'nam';
    for (let i = 0; i < SLOT_COUNT; i++) { this.lots[i].zone = zone; this.lots[i].setData(state.lots[i] ?? null, t); }
    for (let i = 1; i < SLOT_COUNT; i++) this.lots[i].group.traverse((o) => { if (o.castShadow) o.castShadow = false; }); // chỉ thửa đang xem đổ bóng thật
    this.colliders = [...this.lots.flatMap((l) => l.colliders()), ...this.envColliders];
  }

  private buildRain() {
    const N = 900; this.rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.3, depthWrite: false }), N);
    for (let i = 0; i < N; i++) this.rainDrops.push({ x: (Math.random() - 0.5) * 70, y: Math.random() * 30, z: (Math.random() - 0.5) * 70, v: 26 + Math.random() * 12 });
    this.rain.frustumCulled = false; this.rain.visible = false; this.scene.add(this.rain);
  }
  private buildSkyline(st: THREE.Group, r: () => number) {
    const cols = [0xf6e3d0, 0xdfe9f5, 0xf5dfe4, 0xe6f0dd, 0xf7efc9, 0xe3ddf3];
    for (let i = 0; i < 46; i++) {
      const side = i % 4, w = 7 + r() * 8, d = 7 + r() * 8, h = 9 + r() * 30;
      const x = side < 2 ? (r() * 2 - 1) * (WORLD.x + 30) : (side === 2 ? -1 : 1) * (WORLD.x + 14 + r() * 26);
      const z = side === 0 ? WORLD.zMin - 14 - r() * 34 : side === 1 ? WORLD.zMax + 14 + r() * 30 : WORLD.zMin + r() * (WORLD.zMax - WORLD.zMin);
      st.add(mesh(GEO.box, mat(cols[i % cols.length]), x, h / 2, z, w, h, d), mesh(GEO.box, mat(0xfbf7ee), x, h + 0.25, z, w + 0.5, 0.5, d + 0.5));
      const glass = this.sky.night ? mat(0xffe9a8, { emissive: 0xffd05a }) : mat(0xa9dcf2, { rough: 0.3 });
      for (let y = 3; y < h - 2; y += 3.4) st.add(mesh(GEO.box, glass, x, y, z + (side === 1 ? -1 : 1) * (d / 2 + 0.03), w * 0.78, 1.3, 0.06));
    }
    for (let x = -WORLD.x; x <= WORLD.x; x += 5) st.add(mesh(GEO.box, mat(0xffffff), x, 0.06, ROAD_Z, 2.2, 0.02, 0.22));
  }
  /** Mưa, bão: hạt mưa rơi và trời xám lại; nắng gắt: sáng và ấm hơn. */
  private setWeather(kind: WeatherKind) {
    if (kind === this.weather && this.rain.visible === (kind === 'mua' || kind === 'bao')) return;
    this.weather = kind;
    const wet = kind === 'mua' || kind === 'bao', dim = kind === 'bao' ? 0.55 : wet ? 0.7 : kind === 'may' ? 0.88 : 1;
    this.rain.visible = wet;
    this.sun.intensity = this.sky.sunI * (wet ? dim * 0.7 : dim) * (kind === 'nang_gat' ? 1.18 : 1);
    this.hemi.intensity = this.sky.hemiI * (wet ? 1.05 : 1);
    const grey = new THREE.Color(this.sky.night ? 0x2a3350 : 0xb9c6d2), top = new THREE.Color(this.sky.top), low = new THREE.Color(this.sky.sky), k = wet ? (kind === 'bao' ? 0.85 : 0.65) : kind === 'may' ? 0.3 : 0;
    top.lerp(grey, k); low.lerp(grey, k * 0.8);
    (this.scene.background as THREE.Texture).dispose?.(); this.scene.background = gradient(top.getHex(), low.getHex());
    (this.scene.fog as THREE.Fog).color.copy(low); this.applyFog();
    for (const c of this.clouds) c.visible = kind !== 'nang_gat';
  }

  private worldOfTile(lot: number, tile: number): THREE.Vector3 { const l = tileLocal(tile), w = flip(lot, l.x, l.z); return new THREE.Vector3(w.x, 0, w.z); }

  burst(lot: number, tile: number, kind: 'water' | 'soil' | 'leaf' | 'harvest') {
    const color = { water: 0x6ecbff, soil: 0xb5773f, leaf: 0x7fe06a, harvest: 0xffd84a }[kind], p = this.worldOfTile(lot, tile);
    for (const s of this.sparks) {
      s.m.material = mat(color, kind === 'harvest' ? { emissive: 0xffb300, rough: 0.4 } : { rough: 0.5 });
      s.m.position.set(p.x + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.8, p.z + (Math.random() - 0.5) * 1.2);
      s.v.set((Math.random() - 0.5) * 3, 3 + Math.random() * 3.5, (Math.random() - 0.5) * 3); s.life = 0.9 + Math.random() * 0.5; s.m.visible = true;
    }
    this.workUntil = this.clock.elapsedTime + 0.9;
  }
  /** Chữ nổi bay lên tại một ô (ví dụ "+25 kg"). */
  floatText(lot: number, tile: number, text: string, bg = '#ffcf3a') {
    const s = makeLabel(text, 'float', 0.8, bg), p = this.worldOfTile(lot, tile);
    s.position.set(p.x, 3.0, p.z); s.renderOrder = 10; (s.material as THREE.SpriteMaterial).depthTest = false;
    this.scene.add(s); this.floats.push({ s, life: 1.6 });
  }
  /** Cho nhân vật tự chạy tới một ô (dùng cho nút dẫn đường và kiểm thử). */
  /** Chạm vào một ô đất thì đi tới đúng tâm ô đó; chạm chỗ khác thì đi tới chỗ chạm. */
  private snapTap(hit: THREE.Vector3): THREE.Vector3 {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const lot = this.lots[i]; if (!lot?.data) continue; const l = toLocal(i, hit.x, hit.z);
      if (Math.abs(l.x) < PLOT_COLS && Math.abs(l.z) < PLOT_ROWS) { const tile = Math.floor((l.z + PLOT_ROWS) / TILE) * PLOT_COLS + Math.floor((l.x + PLOT_COLS) / TILE); if (lotTiles(lot.data).includes(tile) || lot.data.plantings.some((q) => q.tile === tile)) return this.worldOfTile(i, tile); }
    }
    return hit;
  }
  goToTile(lot: number, tile: number) { this.walkTo = this.worldOfTile(lot, tile); }
  teleportToTile(lot: number, tile: number) { this.pos.copy(this.worldOfTile(lot, tile)); this.walkTo = null; this.vel.set(0, 0, 0); }
  /** Đưa nhân vật tới trước trạm máy thứ `index` của xưởng (dùng cho nút dẫn đường và kiểm thử). */
  teleportToMachine(lot: number, index: number) { const sp = MACHINE_SPOTS[Math.max(0, Math.min(MACHINE_SPOTS.length - 1, index))], w = flip(lot, sp.x, sp.z + 1.5); this.pos.set(w.x, 0, w.z); this.walkTo = null; this.vel.set(0, 0, 0); }
  goHome() { if (this.driving) this.exitTruck(); this.pos.set(0, 0, FENCE.front + 2.5); this.walkTo = null; this.camPos.copy(this.pos); }
  position() { return { x: this.pos.x, z: this.pos.z }; }

  private resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ vòng lặp
  private frame() {
    if (this.disposed) return;
    // bị hoạt cảnh khác che kín hoặc tab ẩn: nghỉ hẳn; đang mở bảng (paused): chỉ vẽ ~8 khung/giây cho phần nền lộ ra
    if (!this.quality.tick()) { if (!this.quality.throttled) this.clock.getDelta(); return; }
    this.frameNo++;
    if (this.paused && !this.opts.demo && this.frameNo % 8 !== 0) return;
    const dt = stepDt(this.clock.getDelta()), t = this.clock.elapsedTime, now = Date.now() + (this.state?.clockOffset ?? 0);
    this.movePlayer(dt, t); this.quality.busy = this.vel.lengthSq() > 0.05;
    this.updateContext(now, t);
    for (const lot of this.lots) lot.animate(t, now, this);
    // Máy quay bám theo nhân vật
    // Máy quay gắn cứng theo nhân vật, chỉ trễ một khoảng tỉ lệ với vận tốc (đã làm mượt). Trước đây máy quay 'đuổi theo' vị trí bằng lerp:
    // khi thời gian mỗi khung không đều, khoảng trễ đổi theo từng khung nên cả cảnh giật theo nhịp dù nhân vật đi đều.
    this.camLag.lerp(this.camTmp.copy(this.vel).multiplyScalar(-0.16), 1 - Math.exp(-dt * 6)); this.camPos.copy(this.pos).add(this.camLag);
    const portrait = this.camera.aspect < 0.9, k = (portrait ? 1.12 : 1) * this.zoom * (this.driving ? 1.15 : 1);
    if (this.opts.demo) { const a = 0.55 + Math.sin(t * 0.08) * 0.22; this.camera.position.set(Math.sin(a) * 30, 26, 4 + Math.cos(a) * 30); }
    // Màn dọc: đẩy nhân vật lên nửa trên màn hình để thanh thao tác bên dưới không che.
    // Có khai báo vùng bị che (thanh trên, bảng dưới): dồn nhân vật vào giữa phần còn nhìn thấy; chưa khai báo thì giữ cách cũ.
    let wantLift = portrait ? 3.4 * k : 0;
    if (this.insets) { const H = this.container.clientHeight || 1, off = (this.insets.bottom - this.insets.top) / 2 / H, D = Math.hypot(24 * k, 23 * k), viewH = 2 * D * Math.tan((this.camera.fov * Math.PI) / 360); wantLift = THREE.MathUtils.clamp(off * viewH / 0.72, -2 * k, 5 * k); }
    this.liftNow += (wantLift - this.liftNow) * (this.liftNow < -900 ? 1 : 1 - Math.exp(-dt * 5)); if (this.liftNow < -900) this.liftNow = wantLift;
    const lift = this.liftNow;
    if (!this.opts.demo) this.camera.position.set(this.camPos.x, 24 * k, this.camPos.z + 23 * k + lift);
    if (this.opts.demo) this.camera.lookAt(0, 0.8, 2);
    else this.camera.lookAt(this.camPos.x, 0.8, this.camPos.z - 1.2 + lift);
    // Mặt trời bám theo máy quay theo từng nấc 2 m để bóng không rung; bản đồ bóng dựng lại cách khung (điện thoại) hoặc mỗi khung (máy tính)
    const sx = Math.round(this.camPos.x / 2) * 2, sz = Math.round(this.camPos.z / 2) * 2;
    this.sun.target.position.set(sx, 0, sz); this.sun.position.set(sx + this.sky.dir[0], this.sky.dir[1], sz + this.sky.dir[2]);
    if (this.sun.castShadow) { const every = 1, key = `${sx},${sz}`; if (this.frameNo % every === 0 || key !== this.shadowKey) { this.renderer.shadowMap.needsUpdate = true; this.shadowKey = key; } }
    this.updateGuide(now, t);
    this.animateLife(dt, t);
    this.renderer.render(this.scene, this.camera);
    trace({ t: performance.now(), dt, x: this.pos.x, z: this.pos.z, cx: this.camera.position.x, cy: this.camera.position.y, cz: this.camera.position.z, yaw: 0, level: this.quality.level, ratio: this.quality.pixelRatio });
  }
  private insets: { top: number; bottom: number } | null = null; private liftNow = -999;
  /** Khai báo phần màn hình bị giao diện che (px): máy quay dồn nhân vật vào giữa vùng còn nhìn thấy. Gọi với null để trả về mặc định. */
  setViewInsets(i: { top?: number; bottom?: number } | null) { this.insets = i ? { top: Math.max(0, i.top ?? 0), bottom: Math.max(0, i.bottom ?? 0) } : null; }
  private detour: { until: number; x: number; z: number; n: number } | null = null; private stuckT = 0;

  private movePlayer(dt: number, t: number) {
    const dir = new THREE.Vector3();
    if (this.opts.demo) { // nhân vật mẫu tự đi vòng quanh ruộng
      const pts = [[-7.4, 6.4], [-7.4, -6.6], [7.4, -6.6], [7.4, 6.4]]; const target = pts[Math.floor(this.demoT) % 4];
      dir.set(target[0] - this.pos.x, 0, target[1] - this.pos.z); if (dir.length() < 0.4) this.demoT++; dir.normalize().multiplyScalar(0.55);
    } else if (!this.paused) {
      dir.set(this.input.x, 0, this.input.y);
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir.x -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir.x += 1;
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) dir.z -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) dir.z += 1;
      if (dir.lengthSq() > 1) dir.normalize();
      if (dir.lengthSq() < 0.01 && this.walkTo) {
        dir.subVectors(this.walkTo, this.pos).setY(0); const d = dir.length();
        if (d < 0.25) { this.walkTo = null; this.detour = null; dir.set(0, 0, 0); } else { dir.normalize(); if (this.detour && t < this.detour.until) dir.set(dir.x * 0.35 + this.detour.x, 0, dir.z * 0.35 + this.detour.z).normalize(); dir.multiplyScalar(Math.min(1, d / 1.2 + 0.35)); }
      }
    }
    this.vel.lerp(dir.multiplyScalar(this.driving ? 13 : 7.5 * (this.walkJob && this.walkTo === this.walkJob.to ? this.walkJob.mul : 1)), 1 - Math.pow(this.driving ? 0.02 : 0.0005, dt));
    const before = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);
    if (this.driving && this.truck) { // xe chỉ chạy trên đường làng
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, ROAD_Z - 1.9, ROAD_Z + 1.9); this.pos.x = THREE.MathUtils.clamp(this.pos.x, -WORLD.x, WORLD.x);
      const sp = this.vel.length(), tr = this.truck.root;
      if (sp > 0.5) { const want = Math.atan2(this.vel.x, this.vel.z); let diff = want - tr.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); tr.rotation.y += diff * Math.min(1, dt * 6); }
      tr.position.set(this.pos.x, Math.abs(Math.sin(t * 20)) * 0.03 * Math.min(1, sp / 6), this.pos.z);
      for (const w of this.truck.wheels) w.rotation.x += sp * dt * 2.2;
      this.player.root.position.copy(this.pos);
      return;
    }
    const R = 0.42;
    for (const [x0, x1, z0, z1] of this.colliders) {
      const cx = THREE.MathUtils.clamp(this.pos.x, x0, x1), cz = THREE.MathUtils.clamp(this.pos.z, z0, z1), dx = this.pos.x - cx, dz = this.pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); this.pos.x = cx + (dx / d) * R; this.pos.z = cz + (dz / d) * R; }
      else { this.pos.copy(before); }
    }
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -WORLD.x, WORLD.x); this.pos.z = THREE.MathUtils.clamp(this.pos.z, WORLD.zMin, WORLD.zMax);
    // Vướng vật cản khi tự đi: lách sang bên (đổi bên mỗi lần), thử vài lần không qua mới dừng
    if (this.walkTo) {
      if (before.distanceTo(this.pos) < 7.5 * dt * 0.3 && this.vel.length() > 2) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.stuckT > 0.18) { this.stuckT = 0; const n = (this.detour?.n ?? 0) + 1, to = new THREE.Vector3().subVectors(this.walkTo, this.pos).setY(0).normalize(), side = n % 2 ? 1 : -1; if (n > 6) { this.walkTo = null; this.detour = null; } else this.detour = { until: t + 0.35 + n * 0.12, x: -to.z * side, z: to.x * side, n }; }
    } else { this.detour = null; this.stuckT = 0; }
    if (this.walkJob && this.walkTo !== this.walkJob.to) { // chuyến tự đi theo hàng đợi: tới nơi, bị người chơi giành lái, hoặc vướng quá lâu
      const j = this.walkJob, cancelled = j.cancel || this.walkTo !== null || this.input.lengthSq() > 0.01 || this.keys.size > 0 || !!this.stick?.moved; this.walkJob = null;
      if (!cancelled && Math.hypot(this.pos.x - j.to.x, this.pos.z - j.to.z) > 0.6) { this.pos.copy(j.to); this.vel.set(0, 0, 0); }
      j.res(!cancelled);
    }
    const p = this.player, speed = this.vel.length();
    p.root.position.copy(this.pos);
    if (this.work && this.tickWork(t)) return;
    if (speed > 0.4) {
      const want = Math.atan2(this.vel.x, this.vel.z); let diff = want - p.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.root.rotation.y += diff * Math.min(1, dt * 14);
      const sw = Math.sin(t * 16) * 0.9 * Math.min(1, speed / 5); p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw; p.armR.rotation.x = sw;
      p.root.position.y = Math.abs(Math.sin(t * 16)) * 0.1; p.root.rotation.x = 0.12;
    } else {
      p.legL.rotation.x = p.legR.rotation.x = 0; p.root.rotation.x = 0;
      if (t < this.workUntil) { const sw = Math.sin(t * 18); p.armL.rotation.x = -1.4 + sw * 0.6; p.armR.rotation.x = -1.4 - sw * 0.6; p.root.position.y = Math.abs(sw) * 0.06; }
      else { p.armL.rotation.x = Math.sin(t * 1.5) * 0.06; p.armR.rotation.x = -Math.sin(t * 1.5) * 0.06; p.root.position.y = Math.sin(t * 2.2) * 0.02; }
    }
  }

  private updateContext(now: number, t: number) {
    let ctx: Context = { kind: 'none' };
    for (let i = 0; i < SLOT_COUNT; i++) {
      const lot = this.lots[i], l = toLocal(i, this.pos.x, this.pos.z);
      const inside = Math.abs(l.x) < FENCE.x && l.z > FENCE.back && l.z < FENCE.front;
      if (!lot.data) { if (i !== 0 && Math.abs(l.x) < FENCE.x && l.z > FENCE.back && l.z < FENCE.front + 3) ctx = { kind: 'empty-lot', lot: i }; continue; }
      if (i === 0 && inside) this.enteredYard = true;
      if (isFactory(lot.data) && inside) { // đứng cạnh trạm máy gần nhất (hoặc chỗ trống kế tiếp)
        let best = -1, bd = 2.3;
        for (let k = 0; k <= lot.fx.length && k < MACHINE_SPOTS.length; k++) { const d = Math.hypot(l.x - MACHINE_SPOTS[k].x, l.z - MACHINE_SPOTS[k].z); if (d < bd) { bd = d; best = k; } }
        if (best >= 0) { ctx = { kind: 'machine', lot: i, index: best, machineId: lot.fx[best]?.m.id ?? null }; continue; }
      }
      if (Math.abs(l.x) < PLOT_COLS && Math.abs(l.z) < PLOT_ROWS) {
        const tile = Math.floor((l.z + PLOT_ROWS) / TILE) * PLOT_COLS + Math.floor((l.x + PLOT_COLS) / TILE);
        if (!lotTiles(lot.data).includes(tile) && !lot.data.plantings.some((p) => p.tile === tile)) continue;
        ctx = { kind: 'tile', lot: i, tile };
        const planting = lot.data.plantings.find((p) => p.tile === tile);
        if (planting && now >= planting.stepReadyAt && !this.opts.demo && (this.readyAt.get(planting.id) ?? 0) < t) { this.readyAt.set(planting.id, t + 1.5); this.opts.onReady?.(i, planting); }
      } else if (Math.hypot(l.x - STALL.x, l.z - (STALL.z + 1.6)) < 2.4) ctx = { kind: 'stall', lot: i };
    }
    if (ctx.kind === 'none' && this.truck && !this.driving && this.pos.distanceTo(this.truckPos) < 3) ctx = { kind: 'truck' };
    if (ctx.kind === 'tile') { const p = this.worldOfTile(ctx.lot, ctx.tile); this.ring.visible = true; this.ring.position.set(p.x, 0.17, p.z); this.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.04); } else this.ring.visible = false;
    const key = JSON.stringify(ctx);
    if (key !== this.ctxKey) { this.ctxKey = key; this.opts.onContext?.(ctx); }
  }

  /** Mũi tên dẫn đường: cổng vườn khi mới tới, sau đó là ô gần nhất đang chờ chăm. */
  private updateGuide(now: number, t: number) {
    const home = this.lots[0]; let target: THREE.Vector3 | null = null;
    if (!this.opts.demo && home.data?.mine) {
      if (!this.enteredYard) target = new THREE.Vector3(0, 0, FENCE.front);
      else { let best = Infinity; for (const p of home.data.plantings) if (now >= p.stepReadyAt) { const w = this.worldOfTile(0, p.tile), d = w.distanceTo(this.pos); if (d < best) { best = d; target = w; } } if (best < 1.6) target = null; }
    }
    this.arrow.visible = !!target;
    if (target) { this.arrow.position.set(target.x, 4.2 + Math.abs(Math.sin(t * 4)) * 0.8, target.z); this.arrow.rotation.y = t * 1.5; }
  }

  private animateLife(dt: number, t: number) {
    for (const o of this.env.children) {
      if (o.userData.sway !== undefined) o.rotation.z = Math.sin(t * 0.9 + o.userData.sway) * 0.03;
      if (o.userData.boat !== undefined) { o.position.y = -0.4 + Math.sin(t * 1.2 + o.userData.boat) * 0.1; o.rotation.z = Math.sin(t * 0.9 + o.userData.boat) * 0.05; }
    }
    if (this.water) this.water.position.y = -0.6 + Math.sin(t * 0.8) * 0.06;
    for (const c of this.chickens) {
      const d = new THREE.Vector3().subVectors(c.target, c.obj.position), dist = d.length();
      if (dist < 0.1) {
        c.wait -= dt; c.obj.children[1].position.y = 0.6 - Math.max(0, Math.sin(t * 6 + c.speed * 9)) * 0.25;
        if (c.wait <= 0) { c.wait = 1.5 + Math.random() * 3; const side = Math.random() < 0.5 ? -1 : 1; c.target.set(side * (7 + Math.random() * 2), 0, -6 + Math.random() * 13); }
      } else { d.normalize(); c.obj.position.addScaledVector(d, Math.min(dist, c.speed * dt)); c.obj.rotation.y = Math.atan2(d.x, d.z); c.obj.position.y = Math.abs(Math.sin(t * 14)) * 0.05; c.obj.children[1].position.y = 0.6; }
    }
    for (const c of this.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 110) c.position.x = -110; }
    const wet = this.weather === 'mua' || this.weather === 'bao';
    for (const m of this.shades) { m.position.x += dt * 1.6; if (m.position.x > 96) m.position.x = -96; m.visible = !this.sky.night && !wet && this.weather !== 'nang_gat'; }
    for (const p of this.puffs) { // khói bay lên từ mái nhà các lô gần
      const lot = this.lots[p.lot], on = !!lot.data && lot.data.kind !== 'rooftop' && !this.urban && !wet;
      const k = (t * 0.22 + p.ph) % 1, base = flip(p.lot, 1.9, -10.7);
      p.s.visible = on; if (!on) continue;
      p.s.position.set(base.x + Math.sin(k * 5 + p.ph * 9) * 0.35 + k * 0.9, 4.8 + k * 3.4, base.z); p.s.scale.setScalar(0.5 + k * 1.3); (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.5;
    }
    for (const f of this.flies) { f.s.position.set(this.camPos.x + Math.sin(t * 0.31 + f.ph) * 13 + Math.sin(f.ph * 7) * 6, 0.8 + Math.abs(Math.sin(t * 0.7 + f.ph)) * 1.6, this.camPos.z - 2 + Math.cos(t * 0.23 + f.ph * 1.7) * 11); (f.s.material as THREE.SpriteMaterial).opacity = 0.35 + Math.abs(Math.sin(t * 2.1 + f.ph)) * 0.6; }
    if (this.rain.visible) {
      const m = new THREE.Matrix4(), slant = this.weather === 'bao' ? 0.45 : 0.12;
      for (let i = 0, n = Math.min(this.rain.count, this.rainDrops.length); i < n; i++) {
        const d = this.rainDrops[i]; d.y -= d.v * dt * (this.weather === 'bao' ? 1.4 : 1); d.x += d.v * dt * slant;
        if (d.y < 0) { d.y = 26 + Math.random() * 6; d.x = (Math.random() - 0.5) * 70; d.z = (Math.random() - 0.5) * 70; }
        m.makeRotationZ(slant).setPosition(this.camPos.x + d.x, d.y, this.camPos.z + d.z - 4); this.rain.setMatrixAt(i, m);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
    for (const f of this.flutter) { f.m.position.set(f.c.x + Math.sin(t * 0.7 + f.ph) * 3, f.c.y + Math.sin(t * 2.3 + f.ph) * 0.5, f.c.z + Math.cos(t * 0.5 + f.ph) * 3); f.m.rotation.set(Math.sin(t * 18 + f.ph) * 1.1, t + f.ph, 0); }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 10 * dt; s.m.position.addScaledVector(s.v, dt); s.m.scale.setScalar(Math.max(0.01, 0.13 * s.life));
      if (s.life <= 0 || s.m.position.y < 0) { s.life = 0; s.m.visible = false; }
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.life -= dt; f.s.position.y += dt * 1.8; (f.s.material as THREE.SpriteMaterial).opacity = Math.min(1, f.life * 2);
      if (f.life <= 0) { this.scene.remove(f.s); (f.s.material as THREE.SpriteMaterial).map?.dispose(); f.s.material.dispose(); this.floats.splice(i, 1); }
    }
  }

  // ---- chế độ xây dựng (đồ trang trí sân): chỉ thêm, không đụng phần khác
  private buildGroup: THREE.Group | null = null;
  /** Vải vẽ của vườn, để chế độ xây dựng nghe thao tác chạm. */
  buildCanvas(): HTMLCanvasElement { return this.renderer.domElement; }
  /** Điểm trên mặt sân (toạ độ của vườn đang xem) ứng với một điểm chạm trên màn. */
  screenToGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? { x: hit.x, z: hit.z } : null;
  }
  /** Vào/ra chế độ xây dựng: đưa nhân vật vào sân trước nhà và lùi máy ảnh để thấy trọn sân; ra thì trả mức phóng cũ. */
  buildFocus(on: boolean) {
    if (on) { this.buildZoom = this.zoom; this.zoom = this.camera.aspect < 0.9 ? 1.6 : 1.15; if (this.driving) this.exitTruck(); this.pos.set(0, 0, 6.9); this.walkTo = null; this.vel.set(0, 0, 0); this.camPos.copy(this.pos); }
    else if (this.buildZoom !== null) { this.zoom = this.buildZoom; this.buildZoom = null; }
  }
  private buildZoom: number | null = null;
  /** Bỏ lệnh "chạy tới điểm vừa chạm" (khi cú chạm đó dùng để đặt đồ). */
  cancelWalk() { this.walkTo = null; }
  // ---- Làm việc hàng loạt: tự chạy tới từng ô rồi làm đúng động tác của bước đó
  /** Chạy tới một ô (mul: hệ số tốc độ theo cấp). Trả false nếu người chơi giành lại điều khiển hoặc gọi cancelQueue(). */
  walkToTile(lot: number, tile: number, mul = 1): Promise<boolean> {
    if (this.walkJob) { const j = this.walkJob; this.walkJob = null; j.res(false); }
    const to = this.worldOfTile(lot, tile);
    if (mul > 3) { this.pos.copy(to); this.vel.set(0, 0, 0); this.walkTo = null; return Promise.resolve(true); } // chạy kiểm thử: nhảy thẳng tới ô
    return new Promise((res) => { this.walkTo = to; this.detour = null; this.walkJob = { to, mul, res, cancel: false }; });
  }
  /** Phát động tác làm việc tại chỗ trong `dur` giây. `hit` xong khi động tác chạm đất (false nếu bị ngắt), `done` xong khi hết động tác. */
  playAction(kind: WorkKind, dur = 0.9, pro = false): { hit: Promise<boolean>; done: Promise<void> } {
    this.endWork(false);
    let onHit: (ok: boolean) => void = () => {}, onDone: () => void = () => {};
    const hit = new Promise<boolean>((r) => { onHit = r; }), done = new Promise<void>((r) => { onDone = r; });
    const tool = makeTool(kind, pro); (toolHand(kind) === 'L' ? this.player.armL : this.player.armR).add(tool);
    this.walkTo = null; this.vel.set(0, 0, 0);
    this.work = { kind, t0: this.clock.elapsedTime, dur: Math.max(0.05, dur), pro, tool, hit: false, onHit, onDone };
    return { hit, done };
  }
  /** Dừng hàng đợi: bỏ chuyến tự đi và động tác đang làm. */
  cancelQueue() { if (this.walkJob) this.walkJob.cancel = true; this.walkTo = null; this.endWork(false); }
  /** Xếp các ô theo đường rắn bò: hàng gần nhân vật trước, mỗi hàng đổi chiều. */
  tileOrder(lot: number, tiles: number[]): number[] {
    const rows = new Map<number, { tile: number; x: number }[]>();
    for (const tile of tiles) { const w = this.worldOfTile(lot, tile), k = Math.round(w.z * 2); (rows.get(k) ?? rows.set(k, []).get(k)!).push({ tile, x: w.x }); }
    const keys = [...rows.keys()].sort((a, b) => a - b); if (keys.length && Math.abs(this.pos.z * 2 - keys[keys.length - 1]) < Math.abs(this.pos.z * 2 - keys[0])) keys.reverse();
    const out: number[] = []; let x = this.pos.x;
    for (const k of keys) { const r = rows.get(k)!.sort((a, b) => a.x - b.x); if (Math.abs(x - r[r.length - 1].x) < Math.abs(x - r[0].x)) r.reverse(); for (const c of r) out.push(c.tile); x = r[r.length - 1].x; }
    return out;
  }
  private endWork(ok: boolean) {
    const w = this.work; if (!w) return; this.work = null; w.tool.removeFromParent();
    w.tool.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    const p = this.player; p.armL.rotation.x = p.armR.rotation.x = 0; p.root.rotation.x = 0;
    if (!w.hit) w.onHit(ok); w.onDone();
  }
  private tickWork(t: number): boolean {
    const w = this.work!; if (this.input.lengthSq() > 0.01 || this.keys.size > 0 || this.stick?.moved || this.driving) { this.endWork(false); return false; }
    const k = (t - w.t0) / w.dur, p = this.player;
    if (k >= HIT_AT && !w.hit) { w.hit = true; w.onHit(true); }
    if (k >= 1) { this.endWork(true); return false; }
    p.legL.rotation.x = p.legR.rotation.x = 0; this.vel.set(0, 0, 0); poseWork(p, w.kind, k, t, w.pro);
    return true;
  }
  /** Vẽ các món xem trước: ok = bóng xanh, bad = bóng đỏ, pending = món vừa đặt chờ lưu, select = vòng sáng quanh món đã có. Gọi với [] hoặc null để xoá. */
  buildPreview(items: { item: string; x: number; z: number; rot: number; tone: 'ok' | 'bad' | 'pending' | 'select' }[] | null, grid = false) {
    if (this.buildGroup) {
      this.scene.remove(this.buildGroup);
      this.buildGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.userData.own) { (m.material as THREE.Material).dispose(); if (m.userData.ownGeo) m.geometry.dispose(); } });
      this.buildGroup = null;
    }
    if (!items) return;
    const g = new THREE.Group();
    if (grid) { const gh = new THREE.GridHelper(28, 56, 0xffffff, 0xffffff); gh.position.set(0, 0.09, -2.5); const gm = gh.material as THREE.Material; gm.transparent = true; gm.opacity = 0.16; gm.depthWrite = false; gh.userData.own = true; gh.userData.ownGeo = true; g.add(gh); }
    for (const it of items) {
      const color = it.tone === 'bad' ? 0xff5a4a : it.tone === 'ok' ? 0x6fe07a : 0xffd23f;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(it.x, 0.12, it.z); ring.userData.own = true; ring.userData.ownGeo = true; g.add(ring);
      if (it.tone === 'select') continue;
      const o = buildDecor(it.item); o.position.set(it.x, it.tone === 'pending' ? 0 : 0.05, it.z); o.rotation.y = it.rot;
      if (it.tone !== 'pending') o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }); m.userData.own = true; m.castShadow = false; } });
      g.add(o);
    }
    this.buildGroup = g; this.scene.add(g);
  }

  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null); this.quality.dispose();
    for (const fn of this.cleanup) fn();
    this.ro.disconnect(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.stickEl.remove();
  }
}
