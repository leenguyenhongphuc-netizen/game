// Người chơi khác và cư dân ảo cùng đi tham quan một địa danh hoặc một khu vui chơi (cảnh SightScene).
// Hiện diện qua web/src/presence.ts: scene 'sight', khoá = mã địa danh. Cư dân ảo đi theo kịch bản tính từ đồng hồ
// (mọi máy thấy giống nhau, không tốn truy vấn): men lối đi từ điểm dừng này sang điểm dừng khác, đứng xem một lúc rồi đi tiếp.
import * as THREE from 'three';
import type { PresenceIn, PresenceOther } from '../../../shared/social.ts';
import { rand01 } from '../../../shared/social.ts';
import { PresenceLink, disposeTag, dropSay, hexOf, nameTag, syncSay, turnTo } from '../presence.ts';
import { makeFarmer } from '../scene/World.ts';
import type { SightScene } from './SightScene.ts';
import { openPlayerCard } from '../chat/events.ts';

const BODY_H = 1.95;
type Body = ReturnType<typeof makeFarmer>;
interface Item { o: PresenceOther; look: string; body: Body; tag: THREE.Sprite; emo: THREE.Sprite | null; emoKey: string; x: number; z: number; yaw: number; walkK: number; fresh: boolean }

/** Vị trí cư dân ảo trên lối đi tại thời điểm nowMs: đi giữa các điểm dừng (theo thứ tự ngẫu nhiên cố định), dừng xem 8–20 giây. */
export function sightStroll(seed: number, t0: number, nowMs: number, stopS: number[], total: number): { s: number; off: number; moving: boolean; dir: number } {
  const speed = 1.05 + rand01(seed, 7) * 0.4, n = Math.max(1, stopS.length), off = (rand01(seed, 8) - 0.5) * 1.6;
  let t = Math.max(0, (nowMs - t0) / 1000), s = Math.min(total, stopS[Math.floor(rand01(seed, 0) * n)] ?? 0), last = 1;
  for (let k = 0; k < 300; k++) {
    const target = Math.min(total, Math.max(0, (stopS[Math.floor(rand01(seed, k + 1) * n)] ?? 0) + (rand01(seed, 300 + k) - 0.5) * 3));
    const dur = Math.abs(target - s) / speed, dir = target >= s ? 1 : -1;
    if (t < dur) return { s: s + (target - s) * (t / dur), off, moving: true, dir };
    t -= dur; s = target; last = dir;
    const pause = 8 + rand01(seed, 600 + k) * 12;
    if (t < pause) return { s, off: off + Math.sin(k) * 0.4, moving: false, dir: last };
    t -= pause;
  }
  return { s, off, moving: false, dir: last };
}

function emojiSprite(e: string): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(48, 44, 40, 0, 7); g.fill(); g.beginPath(); g.moveTo(38, 78); g.lineTo(48, 94); g.lineTo(58, 78); g.fill();
  g.font = '52px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); sp.renderOrder = 8; sp.scale.setScalar(0.9); return sp;
}

export interface SightOthers { dispose(): void; count(): number; names(): { name: string; bot: boolean; d: number }[]; emote(e: string | null): void; /** Vị trí người khác (cho bản đồ). */ positions(): { x: number; z: number; name: string; bot: boolean }[] }

export function attachSightOthers(sc: SightScene, key: string): SightOthers {
  const items = new Map<number, Item>(), group = new THREE.Group(); sc.world.add(group);
  let skew = 0, dead = false, myEmote: { e: string; until: number } | null = null;
  const stopS = sc.stopS(), total = sc.pathLength;
  const state = (): PresenceIn | null => {
    if (dead) return null; const p = sc.pose();
    const emote = myEmote && Date.now() < myEmote.until ? myEmote.e : undefined;
    return { scene: 'sight', key: key.slice(0, 80), x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, yaw: Math.round(p.yaw * 100) / 100, walk: p.walk, ...(emote ? { emote } : {}) };
  };
  const drop = (it: Item) => { group.remove(it.body.root); disposeTag(it.tag); if (it.emo) disposeTag(it.emo); dropSay(it.body.root); };
  const link = new PresenceLink(state, (list, at) => {
    skew = at.server - Date.now(); const keep = new Set<number>();
    for (const o of list) {
      keep.add(o.id);
      const look = `${o.avatar?.shirt}|${o.avatar?.hat}|${o.outfit?.ao}|${o.name}`;
      let it = items.get(o.id);
      if (it && it.look !== look) { drop(it); items.delete(o.id); it = undefined; }
      if (!it) {
        const body = makeFarmer(hexOf(o.avatar?.shirt, 0x7cc48a), o.avatar?.hat ?? (o.bot ? 'non_la' : 'mu_luoi_trai'), o.outfit);
        const h = new THREE.Box3().setFromObject(body.root).getSize(new THREE.Vector3()).y || 1.4, k = BODY_H / h;
        body.root.scale.setScalar(k);
        const tag = nameTag(o, 0.55); tag.position.y = (BODY_H + 0.55) / k; tag.scale.multiplyScalar(1 / k); body.root.add(tag);
        it = { o, look, body, tag, emo: null, emoKey: '', x: o.x ?? 0, z: o.z ?? 0, yaw: o.yaw ?? 0, walkK: 0, fresh: true };
        group.add(body.root); items.set(o.id, it);
      }
      it.o = o;
      syncSay(it.body.root, o, BODY_H + 0.95, it.body.root.scale.x); // bong bóng chat (web/src/chat)
      const ek = o.emote ?? '';
      if (ek !== it.emoKey) {
        if (it.emo) { it.body.root.remove(it.emo); disposeTag(it.emo); it.emo = null; }
        if (ek) { const k = it.body.root.scale.x; it.emo = emojiSprite(ek); it.emo.position.y = (BODY_H + 1.35) / k; it.emo.scale.multiplyScalar(1 / k); it.body.root.add(it.emo); }
        it.emoKey = ek;
      }
    }
    for (const [id, it] of items) if (!keep.has(id)) { drop(it); items.delete(id); }
  });
  const tick = (t: number, dt: number) => {
    const k = 1 - Math.exp(-dt * 5);
    for (const it of items.values()) {
      let tx: number, tz: number, walk: boolean, yaw: number | null = null;
      if (it.o.script) {
        const p = sightStroll(it.o.script.seed, it.o.script.t0, Date.now() + skew, stopS, total), a = sc.pathAt(p.s), nx = -a.dz, nz = a.dx;
        tx = a.x + nx * p.off; tz = a.z + nz * p.off; walk = p.moving; if (p.moving) yaw = Math.atan2(a.dx * p.dir, a.dz * p.dir);
      } else { tx = it.o.x ?? 0; tz = it.o.z ?? 0; walk = !!it.o.walk; if (!walk && it.o.yaw !== undefined) yaw = it.o.yaw; }
      const dx = tx - it.x, dz = tz - it.z, d = Math.hypot(dx, dz);
      if (it.fresh || d > 25) { it.x = tx; it.z = tz; it.fresh = false; } else { it.x += dx * k; it.z += dz * k; }
      if (d > 0.05 && walk) yaw = Math.atan2(dx, dz);
      if (yaw !== null) it.yaw = turnTo(it.yaw, yaw, Math.min(1, dt * 8));
      it.walkK += ((walk || d > 0.3 ? 1 : 0) - it.walkK) * Math.min(1, dt * 8);
      const b = it.body, sw = Math.sin(t * 9 + it.o.id) * 0.7 * it.walkK;
      b.root.position.set(it.x, sc.groundY(it.x, it.z), it.z); b.root.rotation.y = it.yaw;
      b.legL.rotation.x = sw; b.legR.rotation.x = -sw; b.armL.rotation.x = -sw; b.armR.rotation.x = sw;
      // vẫy tay khi đang có biểu cảm 👋
      if (it.emoKey === '👋') b.armR.rotation.z = -2.4 + Math.sin(t * 10) * 0.35; else b.armR.rotation.z = 0;
      if (it.emo) it.emo.position.y = (BODY_H + 1.35 + Math.sin(t * 4) * 0.08) / b.root.scale.x;
    }
  };
  sc.extraTicks.push(tick);
  // chạm vào người chơi khác (bảng tên hoặc thân người) → thẻ người chơi để kết bạn, nhắn tin, chặn, báo cáo (web/src/chat)
  const priv = sc as unknown as { camera?: THREE.Camera; host?: HTMLElement };
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    const d0 = down; down = null; const cam = priv.camera, host = priv.host;
    if (!d0 || !cam || !host || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 10 || performance.now() - d0.t > 400) return;
    const r = host.getBoundingClientRect(), v = new THREE.Vector3(); let best: Item | null = null, bd = 40;
    for (const it of items.values()) {
      if (it.o.bot) continue;
      for (const h of [1.0, BODY_H + 0.55]) {
        v.set(it.x, sc.groundY(it.x, it.z) + h, it.z).project(cam); if (v.z > 1) continue;
        const dd = Math.hypot((v.x * 0.5 + 0.5) * r.width + r.left - e.clientX, (-v.y * 0.5 + 0.5) * r.height + r.top - e.clientY);
        if (dd < bd) { bd = dd; best = it; }
      }
    }
    if (best) openPlayerCard(best.o.id);
  };
  priv.host?.addEventListener('pointerdown', onDown, true); priv.host?.addEventListener('pointerup', onUp, true);
  (window as unknown as { __sightOthers?: () => { name: string; bot: boolean }[] }).__sightOthers = () => [...items.values()].map((it) => ({ name: it.o.name, bot: it.o.bot }));
  return {
    dispose() { dead = true; link.stop(); priv.host?.removeEventListener('pointerdown', onDown, true); priv.host?.removeEventListener('pointerup', onUp, true); const i = sc.extraTicks.indexOf(tick); if (i >= 0) sc.extraTicks.splice(i, 1); for (const it of items.values()) drop(it); items.clear(); group.removeFromParent(); },
    count: () => items.size,
    positions: () => [...items.values()].map((it) => ({ x: it.x, z: it.z, name: it.o.name, bot: it.o.bot })),
    names: () => { const p = sc.pose(); return [...items.values()].map((it) => ({ name: it.o.name, bot: it.o.bot, d: Math.hypot(it.x - p.x, it.z - p.z) })).sort((a, b) => a.d - b.d); },
    emote(e) { myEmote = e ? { e, until: Date.now() + 4_500 } : null; },
  };
}
