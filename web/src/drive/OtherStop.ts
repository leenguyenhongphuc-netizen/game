// Người chơi khác và cư dân ảo ở trạm dừng nghỉ / cây xăng (cảnh StopArea): xe đỗ trong bãi, người đi bộ vào cửa hàng, WC rồi về xe.
// StopArea chỉ gọi attachStopOthers() một lần (xem móc trong StopArea.ts); vòng vẽ riêng chỉ cập nhật vị trí, StopArea vẫn tự vẽ cảnh.
import * as THREE from 'three';
import type { PresenceIn, PresenceOther } from '../../../shared/social.ts';
import { rand01 } from '../../../shared/social.ts';
import { PresenceLink, disposeTag, hexOf, nameTag, turnTo } from '../presence.ts';
import { playerVehicle } from './DriveExtras.ts';
import type { VehGroup } from './DriveExtras.ts';
import { bakeColored } from '../scene/batch.ts';
import { makeFarmer } from '../scene/World.ts';

// Toạ độ khớp với StopArea.ts: ô đỗ trong bãi (z = 8,4, hướng nam), cửa nhà (z = 13,4). Cư dân ảo dùng các ô phía đông để ít chạm xe mình.
const LOT_X = (i: number) => -24 + i * 4.2, LOT_Z = 8.4, DOOR_Z = 13.4, DOORS = [-14, -1, 13];
const BOT_BAYS = [9, 8, 7, 6];
const GROUPS: VehGroup[] = ['ba_gac', 'ban_tai', 'tai_nhe', 'tai_trung', 'tai_nang', 'dau_keo'];

/** Kịch bản cư dân ở trạm: đỗ ở một ô, xuống xe đi vào một cửa, ở trong một lúc, đi ra về xe, ngồi xe nghỉ, lặp lại. */
export function restAt(seed: number, t0: number, nowMs: number, bay: number): { x: number; z: number; yaw: number; walk: boolean; visible: boolean } {
  const cx = LOT_X(bay) + 1.5, cz = LOT_Z, period = 70 + rand01(seed, 1) * 40;
  let t = (((nowMs - t0) / 1000) + rand01(seed, 2) * period) % period;
  const door = DOORS[Math.floor(rand01(seed, Math.floor(((nowMs - t0) / 1000) / period)) * 3)], walkS = Math.hypot(door - cx, DOOR_Z - cz) / 1.4;
  const seg = (a: [number, number], b: [number, number], f: number) => ({ x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
  if (t < 6) return { x: cx, z: cz, yaw: 0, walk: false, visible: true }; t -= 6; // vừa xuống xe
  if (t < walkS) return { ...seg([cx, cz], [door, DOOR_Z], t / walkS), walk: true, visible: true }; t -= walkS;
  const inside = 18 + rand01(seed, 3) * 14;
  if (t < inside) return { x: door, z: DOOR_Z + 0.5, yaw: 0, walk: false, visible: false }; t -= inside; // trong cửa hàng/WC
  if (t < walkS) return { ...seg([door, DOOR_Z], [cx, cz], t / walkS), walk: true, visible: true };
  return { x: cx, z: cz, yaw: Math.PI, walk: false, visible: false }; // ngồi trong xe
}

interface Item { o: PresenceOther; look: string; car: THREE.Group; person: ReturnType<typeof makeFarmer>; tag: THREE.Sprite; bay: number; px: number; pz: number; pyaw: number; cx: number; cz: number; cyaw: number; walkK: number }

export interface StopMe { x: number; z: number; walk: boolean; car: { x: number; z: number; yaw: number } }

export function attachStopOthers(scene: THREE.Scene, stopName: string, getMe: () => StopMe | null): { dispose(): void; count(): number } {
  const items = new Map<number, Item>(), group = new THREE.Group(); scene.add(group);
  let skew = 0, raf = 0, last = performance.now(), dead = false, botN = 0;
  const state = (): PresenceIn | null => { const me = getMe(); if (!me) return null; return { scene: 'rest_stop', key: stopName.slice(0, 80), x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, walk: me.walk, car: me.car }; };
  const drop = (it: Item) => { group.remove(it.car, it.person.root); disposeTag(it.tag); };
  const link = new PresenceLink(state, (list, at) => {
    skew = at.server - Date.now(); const keep = new Set<number>(); botN = 0;
    for (const o of list) {
      keep.add(o.id);
      const g = (GROUPS.includes(o.vehicle?.group as VehGroup) ? o.vehicle!.group : 'tai_nhe') as VehGroup, color = hexOf(o.vehicle?.color, 0x5aa9e6);
      const look = `${g}|${color}|${o.avatar?.shirt}|${o.name}`;
      let it = items.get(o.id);
      if (it && it.look !== look) { drop(it); items.delete(o.id); it = undefined; }
      const bay = o.bot ? BOT_BAYS[botN++ % BOT_BAYS.length] : 0;
      if (!it) {
        const car = bakeColored(playerVehicle(g, color, {}).root, false);
        const person = makeFarmer(hexOf(o.avatar?.shirt, 0x7cc48a), o.avatar?.hat ?? 'non_la', o.outfit); person.root.scale.setScalar(1.35);
        const tag = nameTag(o, 0.7); tag.position.y = 2.9 / 1.35; person.root.add(tag);
        const c = o.car ?? { x: LOT_X(bay), z: LOT_Z, yaw: Math.PI };
        it = { o, look, car, person, tag, bay, px: o.x ?? c.x, pz: o.z ?? c.z, pyaw: 0, cx: c.x, cz: c.z, cyaw: c.yaw, walkK: 0 };
        group.add(car, person.root); items.set(o.id, it);
      }
      it.o = o; it.bay = bay;
    }
    for (const [id, it] of items) if (!keep.has(id)) { drop(it); items.delete(id); }
  });
  const frame = () => {
    if (dead) return; raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000), t = now / 1000; last = now;
    const k = 1 - Math.exp(-dt * 6);
    for (const it of items.values()) {
      let px: number, pz: number, walk: boolean, vis: boolean, yaw: number | null = null, car = it.o.car;
      if (it.o.script) {
        const p = restAt(it.o.script.seed, it.o.script.t0, Date.now() + skew, it.bay);
        px = p.x; pz = p.z; walk = p.walk; vis = p.visible; yaw = p.yaw; car = { x: LOT_X(it.bay), z: LOT_Z, yaw: Math.PI };
      } else { px = it.o.x ?? 0; pz = it.o.z ?? 0; walk = !!it.o.walk; vis = walk; }
      // hai người chọn cùng một ô trên máy của mỗi người: vẽ xe người kia sang ô bên cạnh cho khỏi chồng lên xe mình
      const mine = getMe()?.car;
      if (car && !it.o.script && mine && Math.hypot(car.x - mine.x, car.z - mine.z) < 3) car = { ...car, x: car.x + (car.x > 20 ? -4.2 : 4.2) };
      if (car) { it.cx += (car.x - it.cx) * k; it.cz += (car.z - it.cz) * k; it.cyaw = turnTo(it.cyaw, car.yaw, k); }
      it.car.position.set(it.cx, 0, it.cz); it.car.rotation.y = it.cyaw;
      const dx = px - it.px, dz = pz - it.pz; if (Math.hypot(dx, dz) > 15) { it.px = px; it.pz = pz; } else { it.px += dx * k; it.pz += dz * k; }
      if (Math.hypot(dx, dz) > 0.04) yaw = Math.atan2(dx, dz);
      if (yaw !== null) it.pyaw = turnTo(it.pyaw, yaw, Math.min(1, dt * 10));
      it.walkK += ((walk ? 1 : 0) - it.walkK) * Math.min(1, dt * 8);
      const b = it.person, sw = Math.sin(t * 12 + it.o.id) * 0.8 * it.walkK;
      b.root.visible = vis; b.root.position.set(it.px, 0, it.pz); b.root.rotation.y = it.pyaw;
      b.legL.rotation.x = sw; b.legR.rotation.x = -sw; b.armL.rotation.x = -sw; b.armR.rotation.x = sw;
    }
  };
  raf = requestAnimationFrame(frame);
  (window as unknown as { __stopOthers?: () => { name: string; bot: boolean }[] }).__stopOthers = () => [...items.values()].map((it) => ({ name: it.o.name, bot: it.o.bot }));
  return {
    dispose() { dead = true; cancelAnimationFrame(raf); link.stop(); for (const it of items.values()) drop(it); items.clear(); group.removeFromParent(); },
    count: () => items.size,
  };
}
