// Chế độ xây dựng: chọn món trong khay rồi chạm lên sân để đặt liên tục, không phải đóng mở bảng.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { DECOR_ITEMS, DECOR_MAX, validDecor } from '../../shared/custom.ts';
import type { DecorPlacement } from '../../shared/custom.ts';
import { fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { LotView, Me } from './api.ts';
import type { World } from './scene/World.ts';
import './build.css';

type Hook = { pick: (itemId: string | null) => void; placeAt: (x: number, z: number) => boolean; count: () => number; select: (i: number | null) => void; rotate: () => void; remove: () => void; moveTo: (x: number, z: number) => boolean; flush: () => Promise<void> };
type W = Window & { __build?: Hook };

const SNAP = 0.5, GAP = 0.8, TURN = Math.PI / 2;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const key = (d: DecorPlacement) => `${d.item}@${d.x},${d.z},${Math.round(d.rot / TURN)}`;
const count = (list: DecorPlacement[], id: string) => list.reduce((n, d) => n + (d.item === id ? 1 : 0), 0);
/** Tiền phải trả thêm khi lưu `next` so với `saved` (máy chủ chỉ tính phần tăng thêm của từng loại, cất đi không hoàn). */
const costOf = (next: DecorPlacement[], saved: DecorPlacement[]) => DECOR_ITEMS.reduce((c, d) => c + Math.max(0, count(next, d.id) - count(saved, d.id)) * d.price, 0);

/** Vì sao không đặt được ở đây; null nếu đặt được. `skip` là món đang di chuyển (không tự chắn mình). */
function whyNot(list: DecorPlacement[], p: DecorPlacement, skip: number | null): string | null {
  if (validDecor([p]) === null) return 'Chỗ này không đặt được: phải nằm trong sân, ngoài ruộng, ngoài nền nhà và lối cổng.';
  if (list.some((d, i) => i !== skip && Math.hypot(d.x - p.x, d.z - p.z) < GAP)) return 'Chỗ này đã có món khác.';
  return null;
}

export function BuildMode({ me, home, worldRef, onChanged, onClose }: { me: Me; home: LotView; worldRef: MutableRefObject<World | null>; onChanged: () => void; onClose: () => void }) {
  const [items, setItems] = useState<DecorPlacement[]>(() => (home.plot.decor ?? []).map((d) => ({ ...d })));
  const [saved, setSaved] = useState<DecorPlacement[]>(() => (home.plot.decor ?? []).map((d) => ({ ...d })));
  const [pick, setPick] = useState<string | null>(null);
  const [turns, setTurns] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; z: number; ok: boolean } | null>(null);
  const [drag, setDrag] = useState<{ x: number; z: number; ok: boolean } | null>(null);
  const [undo, setUndo] = useState<DecorPlacement[][]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef({ items, saved, pick, turns, sel, cash: me.user.cash });
  live.current = { items, saved, pick, turns, sel, cash: me.user.cash };
  const plotId = home.plot.id;

  const pending = costOf(items, saved), cashLeft = me.user.cash - pending;
  const say = useCallback((t: string) => { setMsg(t); window.clearTimeout((say as unknown as { t?: number }).t); (say as unknown as { t?: number }).t = window.setTimeout(() => setMsg(null), 2600); }, []);

  // ---- lưu: gom thay đổi, gửi sau 600 ms rảnh; lỗi thì quay về bản máy chủ đang giữ
  const saving = useRef(false), timer = useRef(0), closed = useRef(false);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      for (;;) {
        const want = live.current.items, have = live.current.saved;
        if (want.length === have.length && want.every((d, i) => key(d) === key(have[i]))) break;
        try {
          await api('POST', `/api/plots/${plotId}/decor`, { items: want });
          live.current.saved = want; if (!closed.current) setSaved(want);
        } catch (e) {
          if (!closed.current) { setItems(have); setUndo([]); setSel(null); say(e instanceof Error && e.message ? e.message : 'Không lưu được, đã trả sân về như cũ.'); }
          live.current.items = have; break;
        }
      }
      onChanged();
    } finally { saving.current = false; if (!closed.current) setBusy(false); }
  }, [plotId, onChanged, say]);
  const change = useCallback((next: DecorPlacement[]) => {
    setUndo((u) => [...u.slice(-19), live.current.items]); setItems(next); live.current.items = next;
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void flush(); }, 600);
  }, [flush]);

  // ---- thao tác
  const placeAt = useCallback((gx: number, gz: number): boolean => {
    const c = live.current; if (!c.pick) return false;
    const p: DecorPlacement = { item: c.pick, x: snap(gx), z: snap(gz), rot: c.turns * TURN };
    const info = DECOR_ITEMS.find((d) => d.id === c.pick)!;
    const why = c.items.length >= DECOR_MAX ? `Sân đã đủ ${DECOR_MAX} món, cất bớt mới đặt thêm được.`
      : c.cash - costOf([...c.items, p], c.saved) < 0 ? `Không đủ tiền mua thêm ${info.name} (${fmtMoney(info.price)}).` : whyNot(c.items, p, null);
    if (why) { setGhost({ x: p.x, z: p.z, ok: false }); say(why); return false; }
    setGhost(null); change([...c.items, p]); return true;
  }, [change, say]);
  const moveTo = useCallback((gx: number, gz: number): boolean => {
    const c = live.current; if (c.sel === null || !c.items[c.sel]) return false;
    const p = { ...c.items[c.sel], x: snap(gx), z: snap(gz) }, why = whyNot(c.items, p, c.sel);
    if (why) { say(why); return false; }
    if (p.x !== c.items[c.sel].x || p.z !== c.items[c.sel].z) change(c.items.map((d, i) => (i === c.sel ? p : d)));
    return true;
  }, [change, say]);
  const rotate = useCallback(() => {
    const c = live.current;
    if (c.sel !== null && c.items[c.sel]) change(c.items.map((d, i) => (i === c.sel ? { ...d, rot: ((Math.round(d.rot / TURN) + 1) % 4) * TURN } : d)));
    else setTurns((t) => (t + 1) % 4);
  }, [change]);
  const remove = useCallback(() => {
    const c = live.current; if (c.sel === null || !c.items[c.sel]) return;
    const d = c.items[c.sel], wasSaved = c.saved.some((x) => key(x) === key(d));
    change(c.items.filter((_, i) => i !== c.sel)); setSel(null);
    if (wasSaved) say('Đã cất đi. Món đã mua không được hoàn tiền.');
  }, [change, say]);
  const undoOne = () => { if (!undo.length) return; const prev = undo[undo.length - 1]; setUndo(undo.slice(0, -1)); setItems(prev); live.current.items = prev; setSel(null); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void flush(); }, 600); };
  const choose = (id: string | null) => { setPick(id); setSel(null); setGhost(null); setTurns(0); };
  const done = () => { void flush().then(onClose); };

  // ---- chạm trên sân: chạm ngắn = đặt hoặc chọn; kéo trên món đang chọn = di chuyển; kéo nền = đi lại như thường
  useEffect(() => {
    const world = worldRef.current; if (!world) return;
    const canvas = world.buildCanvas(), host = canvas.parentElement ?? canvas;
    let down: { x: number; y: number; t: number; id: number } | null = null, moving: number | null = null;
    const ground = (e: PointerEvent) => world.screenToGround(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => {
      if (e.target !== canvas) return;
      const c = live.current, g = ground(e);
      if (g && c.sel !== null && c.items[c.sel] && Math.hypot(g.x - c.items[c.sel].x, g.z - c.items[c.sel].z) < 1.3) {
        moving = e.pointerId; e.stopPropagation(); e.preventDefault(); setDrag({ x: c.items[c.sel].x, z: c.items[c.sel].z, ok: true }); return;
      }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    };
    const onMove = (e: PointerEvent) => {
      const c = live.current, g = ground(e);
      if (moving === e.pointerId) { if (g && c.sel !== null && c.items[c.sel]) { const p = { ...c.items[c.sel], x: snap(g.x), z: snap(g.z) }; setDrag({ x: p.x, z: p.z, ok: whyNot(c.items, p, c.sel) === null }); } return; }
      if (e.pointerType === 'mouse' && c.pick && g && e.target === canvas && !down) {
        const p = { item: c.pick, x: snap(g.x), z: snap(g.z), rot: c.turns * TURN };
        setGhost({ x: p.x, z: p.z, ok: whyNot(c.items, p, null) === null && c.items.length < DECOR_MAX });
      }
    };
    const onUp = (e: PointerEvent) => {
      const c = live.current, g = ground(e);
      if (moving === e.pointerId) { moving = null; setDrag(null); if (g && e.type === 'pointerup') moveTo(g.x, g.z); return; }
      const d = down; down = null;
      if (!d || d.id !== e.pointerId || e.type !== 'pointerup' || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 500 || !g) return;
      world.cancelWalk(); // cú chạm này để đặt hoặc chọn món, không phải để chạy tới
      if (c.pick) { placeAt(g.x, g.z); return; }
      let best = -1, bd = 1.1; c.items.forEach((it, i) => { const dd = Math.hypot(it.x - g.x, it.z - g.z); if (dd < bd) { bd = dd; best = i; } });
      setSel(best >= 0 ? best : null);
    };
    host.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    return () => { host.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, [worldRef, placeAt, moveTo]);

  // ---- vẽ xem trước trong cảnh
  // món chỉ thôi vẽ dạng "chờ lưu" khi cảnh vườn đã nhận danh sách mới từ máy chủ
  const savedKeys = useMemo(() => new Set((home.plot.decor ?? []).map(key)), [home.plot.decor]);
  useEffect(() => {
    const world = worldRef.current; if (!world) return;
    const list: Parameters<World['buildPreview']>[0] = [];
    items.forEach((d, i) => {
      if (drag && i === sel) return;
      if (!savedKeys.has(key(d))) list!.push({ ...d, tone: 'pending' });
      if (i === sel) list!.push({ ...d, tone: 'select' });
    });
    if (drag && sel !== null && items[sel]) list!.push({ ...items[sel], x: drag.x, z: drag.z, tone: drag.ok ? 'ok' : 'bad' });
    if (ghost && pick) list!.push({ item: pick, x: ghost.x, z: ghost.z, rot: turns * TURN, tone: ghost.ok ? 'ok' : 'bad' });
    world.buildPreview(list, true);
  }, [worldRef, items, savedKeys, sel, drag, ghost, pick, turns]);
  useEffect(() => { closed.current = false; return () => { closed.current = true; worldRef.current?.buildPreview(null); window.clearTimeout(timer.current); void flush(); }; }, [worldRef, flush]);
  useEffect(() => { const w = worldRef.current; w?.buildFocus(true); return () => { w?.buildFocus(false); }; }, [worldRef]);

  // ---- móc cho bộ kiểm tự động
  useEffect(() => {
    const w = window as W;
    w.__build = { pick: (id) => { setPick(id); setSel(null); setGhost(null); live.current.pick = id; live.current.sel = null; }, placeAt: (x, z) => placeAt(x, z), count: () => live.current.items.length,
      select: (i) => { setSel(i); live.current.sel = i; if (i !== null) { setPick(null); live.current.pick = null; } }, rotate, remove, moveTo: (x, z) => moveTo(x, z), flush };
    return () => { delete w.__build; };
  }, [placeAt, moveTo, rotate, remove, flush]);

  const selItem = sel !== null && items[sel] ? DECOR_ITEMS.find((d) => d.id === items[sel].item) : null;
  const pickItem = pick ? DECOR_ITEMS.find((d) => d.id === pick) : null;
  return (
    <div className="build" data-count={items.length} data-pick={pick ?? ''} data-sel={sel ?? ''}>
      <div className="build-top">
        <div className="build-title"><b aria-hidden="true">🔨</b><div><strong>Chế độ xây dựng</strong><small>Đã đặt {items.length}/{DECOR_MAX} · tiền còn {fmtMoney(Math.max(0, cashLeft))}{busy ? ' · đang lưu…' : ''}</small></div></div>
        <button className="build-done" onClick={done}>Xong</button>
      </div>
      <div className="build-mid">
        {msg ? <p className="build-msg" role="status">{msg}</p>
          : <p className="build-hint">{selItem ? `${selItem.emoji} ${selItem.name}: kéo để di chuyển, hoặc bấm Xoay, Cất đi` : pickItem ? `${pickItem.emoji} Chạm lên sân để đặt ${pickItem.name} · chạm tiếp để đặt thêm` : 'Chọn một món ở khay bên dưới, hoặc chạm vào món đã đặt để sửa'}</p>}
        <div className="build-tools">
          {(pick || selItem) && <button onClick={rotate} aria-label="Xoay 90 độ"><b aria-hidden="true">↻</b><small>Xoay</small></button>}
          {selItem && <button className="warn" onClick={remove} aria-label="Cất đi"><b aria-hidden="true">🧺</b><small>Cất đi</small></button>}
          <button onClick={undoOne} disabled={!undo.length} aria-label="Hoàn tác"><b aria-hidden="true">↶</b><small>Hoàn tác</small></button>
          {(pick || selItem) && <button onClick={() => { choose(null); }} aria-label="Bỏ chọn"><b aria-hidden="true">✕</b><small>Bỏ chọn</small></button>}
        </div>
      </div>
      <div className="build-tray" role="listbox" aria-label="Khay đồ trang trí">
        {DECOR_ITEMS.map((d) => {
          const have = count(items, d.id), poor = cashLeft < d.price, full = items.length >= DECOR_MAX;
          return (
            <button key={d.id} type="button" role="option" aria-selected={pick === d.id} className={`build-item${poor || full ? ' off' : ''}`} onClick={() => choose(pick === d.id ? null : d.id)}>
              {have > 0 && <i className="build-have">{have}</i>}
              <span className="emoji" aria-hidden="true">{d.emoji}</span><strong>{d.name}</strong><small>{poor ? 'thiếu tiền' : fmtMoney(d.price)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
