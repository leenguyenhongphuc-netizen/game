// Người chơi khác và cư dân ảo đi lại trong làng (cảnh World). Dữ liệu từ web/src/presence.ts.
import * as THREE from 'three';
import type { PresenceOther } from '../../../shared/social.ts';
import { rand01 } from '../../../shared/social.ts';
import { disposeTag, dropSay, hexOf, nameTag, syncSay, turnTo } from '../presence.ts';

interface Body { root: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Group; armR: THREE.Group }
export type BodyFactory = (shirt: number, hat?: string, outfit?: { ao?: string | null; non?: string | null; phu_kien?: string | null } | null) => Body;

interface Item {
  o: PresenceOther; look: string; body: Body; tag: THREE.Sprite; seen: number;
  /** vị trí đang vẽ và đích (đã ngoại suy theo vận tốc) */
  x: number; z: number; yaw: number; tx: number; tz: number; vx: number; vz: number; at: number; moving: number; fresh: boolean;
}

/** Kịch bản dạo đường làng của cư dân ảo: đi từ điểm này sang điểm khác dọc đường, dừng ngắm một lúc rồi đi tiếp. Cùng hạt giống → mọi máy thấy giống nhau. */
export function strollAt(seed: number, t0: number, nowMs: number, road: { z: number; halfX: number }): { x: number; z: number; yaw: number; moving: boolean } {
  const span = Math.min(road.halfX - 6, 46), speed = 1.5;
  let t = Math.max(0, (nowMs - t0) / 1000), k = 0, x = -span + rand01(seed, 0) * span * 2;
  const lane = (n: number) => road.z + (rand01(seed, 500 + n) < 0.5 ? -1.6 : 1.6) + (rand01(seed, 600 + n) - 0.5) * 0.8;
  for (; k < 400; k++) {
    const nx = -span + rand01(seed, k + 1) * span * 2, dur = Math.abs(nx - x) / speed, pause = 3 + rand01(seed, 1000 + k) * 6, z0 = lane(k), z1 = lane(k + 1);
    if (t < dur) { const f = t / dur; return { x: x + (nx - x) * f, z: z0 + (z1 - z0) * f, yaw: Math.atan2(nx - x, z1 - z0), moving: true }; }
    t -= dur;
    if (t < pause) return { x: nx, z: z1, yaw: rand01(seed, 2000 + k) < 0.5 ? Math.PI : 0, moving: false };
    t -= pause; x = nx;
  }
  return { x, z: road.z, yaw: 0, moving: false };
}

export class OthersLayer {
  group = new THREE.Group();
  private items = new Map<number, Item>();
  private serverSkew = 0;
  constructor(private makeBody: BodyFactory, private road: { z: number; halfX: number }) {}

  set(list: PresenceOther[], at: { server: number; local: number }) {
    this.serverSkew = at.server - Date.now();
    const now = performance.now(), keep = new Set<number>();
    for (const o of list) {
      if (o.x === undefined && !o.script) continue;
      keep.add(o.id);
      const look = `${o.avatar?.shirt}|${o.avatar?.hat}|${o.outfit?.ao}|${o.outfit?.non}|${o.outfit?.phu_kien}|${o.name}`;
      let it = this.items.get(o.id);
      if (it && it.look !== look) { this.drop(it); it = undefined; }
      if (!it) {
        const body = this.makeBody(hexOf(o.avatar?.shirt, 0x7cc48a), o.avatar?.hat ?? 'non_la', o.outfit);
        const tag = nameTag(o); tag.position.y = 2.75 / 1.18; body.root.add(tag);
        it = { o, look, body, tag, seen: now, x: o.x ?? 0, z: o.z ?? 0, yaw: o.yaw ?? 0, tx: o.x ?? 0, tz: o.z ?? 0, vx: 0, vz: 0, at: now, moving: 0, fresh: true };
        this.group.add(body.root); this.items.set(o.id, it);
      }
      it.o = o; it.seen = now;
      syncSay(it.body.root, o, 3.15, 1.18); // bong bóng chat (web/src/chat)
      if (!o.script) {
        // vận tốc ước theo hai lần nhận liên tiếp, để vẽ mượt giữa các nhịp
        const nx = o.x ?? 0, nz = o.z ?? 0, dtS = Math.max(0.5, (now - it.at) / 1000);
        if (!it.fresh) { it.vx = Math.max(-8, Math.min(8, (nx - it.tx) / dtS)); it.vz = Math.max(-8, Math.min(8, (nz - it.tz) / dtS)); }
        if (Math.hypot(nx - it.x, nz - it.z) > 12) { it.x = nx; it.z = nz; } // dịch chuyển xa (vào xe, đổi làng): nhảy luôn
        it.tx = nx; it.tz = nz; it.at = now - (o.ageMs ?? 0); it.fresh = false;
        if ((o.speed ?? 0) < 0.3) { it.vx = 0; it.vz = 0; }
      }
    }
    for (const [id, it] of this.items) if (!keep.has(id)) { this.drop(it); this.items.delete(id); }
  }
  private drop(it: Item) { this.group.remove(it.body.root); disposeTag(it.tag); dropSay(it.body.root); }

  update(dt: number, t: number) {
    const now = performance.now(), serverNow = Date.now() + this.serverSkew;
    for (const it of this.items.values()) {
      let wantX: number, wantZ: number, moving: boolean, wantYaw: number | null = null;
      if (it.o.script) {
        const p = strollAt(it.o.script.seed, it.o.script.t0, serverNow, this.road);
        wantX = p.x; wantZ = p.z; moving = p.moving; wantYaw = p.yaw;
      } else {
        const ahead = Math.min(1.2, (now - it.at) / 1000); // ngoại suy tối đa 1,2 s rồi đứng chờ nhịp sau
        wantX = it.tx + it.vx * ahead; wantZ = it.tz + it.vz * ahead;
        moving = Math.hypot(wantX - it.x, wantZ - it.z) > 0.08 || Math.hypot(it.vx, it.vz) > 0.3;
      }
      const k = 1 - Math.exp(-dt * 7), dx = wantX - it.x, dz = wantZ - it.z;
      it.x += dx * k; it.z += dz * k;
      if (Math.hypot(dx, dz) > 0.05) wantYaw = Math.atan2(dx, dz);
      if (wantYaw !== null) it.yaw = turnTo(it.yaw, wantYaw, Math.min(1, dt * 10));
      it.moving += ((moving ? 1 : 0) - it.moving) * Math.min(1, dt * 8);
      const b = it.body, sw = Math.sin(t * 14 + it.o.id) * 0.8 * it.moving;
      b.root.position.set(it.x, Math.abs(Math.sin(t * 14 + it.o.id)) * 0.08 * it.moving, it.z); b.root.rotation.y = it.yaw;
      b.legL.rotation.x = sw; b.legR.rotation.x = -sw; b.armL.rotation.x = -sw; b.armR.rotation.x = sw;
    }
  }
  count() { return this.items.size; }
  /** Người chơi thật đang hiện (không tính cư dân ảo): điểm thân và điểm bảng tên để chạm mở thẻ (chat/tapPick.ts). */
  pickables(): { id: number; pts: THREE.Vector3[] }[] {
    const out: { id: number; pts: THREE.Vector3[] }[] = [];
    for (const it of this.items.values()) { if (it.o.bot || !it.body.root.visible) continue; const p = it.body.root.getWorldPosition(new THREE.Vector3()); out.push({ id: it.o.id, pts: [p.clone().setY(p.y + 1.0), p.clone().setY(p.y + 2.75)] }); }
    return out;
  }
  list() { return [...this.items.values()].map((it) => ({ name: it.o.name, bot: it.o.bot, x: Math.round(it.x * 10) / 10, z: Math.round(it.z * 10) / 10, say: !!it.body.root.userData.saySp })); }
  dispose() { for (const it of this.items.values()) this.drop(it); this.items.clear(); this.group.removeFromParent(); }
}
