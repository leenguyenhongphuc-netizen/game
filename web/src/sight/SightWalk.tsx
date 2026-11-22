// Màn đi bộ tham quan một địa danh thật: đi vào, xem từng điểm dừng theo đúng thứ tự ngoài đời, chụp ảnh lưu niệm rồi ra cổng sang siêu thị đặc sản.
import { useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent as RPointerEvent } from 'react';
import { sight as findSight } from '../../../shared/sights.ts';
import { SightScene } from './SightScene.ts';
import type { SightHud, SightShop } from './SightScene.ts';
import './sight.css';

interface TestHook { goto: (i: number) => void; snap: () => void; pos: () => unknown; info: () => unknown; close: () => void }
type W = Window & { __sight?: TestHook; __sightAuto?: boolean; __rideStep?: number };

export interface SightWalkProps {
  sightId: string; seen?: string[];
  onExit: (r: { stops: string[]; toMarket: boolean }) => void;
  /** Quầy hàng đặt dọc tuyến; tới gần hiện nút mở quầy. Bỏ trống thì cảnh vẫn có hai quầy trang trí. */
  shops?: SightShop[]; onShop?: (shopId: string) => void;
  /** Thể lực hiện trên thanh trên cùng. */
  energy?: { value: number; max: number };
  /** Điểm kinh nghiệm nhận cho mỗi con dấu (mặc định 10). */
  xpPerStop?: number;
}
const today = () => { const d = new Date(), z = (n: number) => String(n).padStart(2, '0'); return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}`; };
/** Câu đầu của lời thuyết minh, dùng làm dòng tóm tắt. */
const firstLine = (t: string) => { const m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim(); };

export function SightWalk(props: SightWalkProps): JSX.Element {
  const s = findSight(props.sightId);
  const host = useRef<HTMLDivElement>(null), scene = useRef<SightScene | null>(null);
  const [seen, setSeen] = useState<string[]>(() => (props.seen ?? []).filter((id) => s?.stops.some((x) => x.id === id)));
  const seenRef = useRef(seen); seenRef.current = seen;
  const [near, setNear] = useState<number | null>(null);
  const [hud, setHud] = useState<SightHud | null>(null);
  const [flash, setFlash] = useState(0);
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState<number | null>(null);
  const [stamp, setStamp] = useState<{ k: number; name: string } | null>(null);
  const [hint, setHint] = useState(true);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const ptr = useRef<{ move: number | null; look: number | null; lx: number; ly: number; ox: number; oy: number }>({ move: null, look: null, lx: 0, ly: 0, ox: 0, oy: 0 });
  const nearRef = useRef<number | null>(null); nearRef.current = near;

  const snap = () => {
    const i = nearRef.current; if (i === null || !s) return; const id = s.stops[i].id;
    if (!seenRef.current.includes(id)) { const next = [...seenRef.current, id]; seenRef.current = next; setSeen(next); scene.current?.markSeen(i); setFlash((f) => f + 1); setStamp({ k: Date.now(), name: s.stops[i].name }); }
  };
  const close = () => { scene.current?.dismiss(); };

  useEffect(() => {
    if (!s || !host.current) return;
    const w = window as W;
    const sc = new SightScene(host.current, s, seenRef.current, { onNear: (i) => { setNear(i); setOpen(false); }, onHud: setHud, onShop: setShop }, props.shops);
    sc.auto = !!w.__sightAuto; sc.speedMul = w.__sightAuto && w.__rideStep ? 6 : 1; scene.current = sc;
    w.__sight = { goto: (i) => sc.goto(i), snap, pos: () => sc.pos(), info: () => sc.info(), close };
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => { window.clearTimeout(t); sc.dispose(); scene.current = null; delete w.__sight; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sightId]);

  // chế độ tự đi: tới điểm nào tự chụp rồi đi tiếp
  useEffect(() => {
    const w = window as W; if (!w.__sightAuto || near === null || !s) return;
    const fast = w.__rideStep ? 0.25 : 1;
    const a = window.setTimeout(snap, 900 * fast), b = window.setTimeout(() => { if (near < s.stops.length - 1) close(); }, 2200 * fast);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  if (!s) return <div className="sw"><div className="sw-card"><p>Chưa có điểm tham quan này.</p><button onClick={() => props.onExit({ stops: [], toMarket: false })}>Quay lại</button></div></div>;

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), p = ptr.current; setHint(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.clientY - r.top > r.height * 0.5 && p.move === null) { p.move = e.pointerId; p.ox = e.clientX; p.oy = e.clientY; setStick({ x: e.clientX - r.left, y: e.clientY - r.top, dx: 0, dy: 0 }); }
    else if (p.look === null) { p.look = e.pointerId; p.lx = e.clientX; p.ly = e.clientY; }
  };
  const moveP = (e: RPointerEvent<HTMLDivElement>) => {
    const p = ptr.current;
    if (e.pointerId === p.move) {
      let dx = e.clientX - p.ox, dy = e.clientY - p.oy; const l = Math.hypot(dx, dy), R = 46; if (l > R) { dx *= R / l; dy *= R / l; }
      scene.current?.setMove(dx / R, -dy / R); setStick((st) => st && { ...st, dx, dy });
    } else if (e.pointerId === p.look) { scene.current?.look((e.clientX - p.lx) * 0.006, (e.clientY - p.ly) * 0.003); p.lx = e.clientX; p.ly = e.clientY; }
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const p = ptr.current;
    if (e.pointerId === p.move) { p.move = null; scene.current?.setMove(0, 0); setStick(null); }
    if (e.pointerId === p.look) p.look = null;
  };

  const stop = near !== null ? s.stops[near] : null, last = near === s.stops.length - 1, got = stop ? seen.includes(stop.id) : false;
  const next = hud ? s.stops[hud.next] : s.stops[0], allSeen = seen.length >= s.stops.length;
  const leave = (toMarket: boolean) => props.onExit({ stops: seenRef.current, toMarket });
  const xp = props.xpPerStop ?? 10, en = props.energy, shopNear = shop !== null && props.shops ? props.shops[shop] : null;
  return (
    <div className="sw" data-stop={stop?.id ?? ''} data-seen={seen.length}>
      <div className="sw-scene" ref={host} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
      <div className="sw-top">
        <div className="sw-bar">
          <div className="sw-title"><b aria-hidden="true">{s.emoji}</b><span>{s.name}</span><small>{seen.length}/{s.stops.length} dấu</small></div>
          <ol className="sw-dots" aria-label="Các điểm dừng">
            {s.stops.map((x, i) => <li key={x.id} className={(seen.includes(x.id) ? 'done ' : '') + (hud?.next === i && !allSeen ? 'next' : '')} title={x.name}>{seen.includes(x.id) ? '✓' : i + 1}</li>)}
          </ol>
          {en && <div className="sw-energy" role="img" aria-label={`Thể lực ${Math.round(en.value)} trên ${en.max}`}><span aria-hidden="true">⚡</span><div><i style={{ width: `${Math.max(0, Math.min(100, en.value / Math.max(1, en.max) * 100))}%` }} /></div><small>{Math.round(en.value)}/{en.max}</small></div>}
        </div>
        <button className="sw-leave" onClick={() => leave(false)}>Rời đi</button>
      </div>
      {!stop && hud && (
        <div className="sw-guide">
          <i style={{ transform: `rotate(${hud.bearing}rad)` }} aria-hidden="true">➤</i>
          <span>{allSeen ? 'Đã xem hết · ra cổng ở' : 'Tiếp theo:'} <b>{hud.next + 1}. {next.name}</b></span>
          <small>{Math.round(hud.dist)} m</small>
        </div>
      )}
      {hint && !stop && <div className="sw-hint">Kéo nửa dưới màn hình để đi · kéo nửa trên để nhìn quanh</div>}
      {stick && <div className="sw-stick" style={{ left: stick.x, top: stick.y }}><i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} /></div>}
      {flash > 0 && <div className="sw-flash" key={flash} />}
      {stamp && (
        <div className="sw-seal" key={stamp.k} aria-hidden="true">
          <div className="sw-seal-ink"><small>VƯỜN VIỆT · HỘ CHIẾU</small><b>{stamp.name}</b><span>{s.name}</span><em>{today()}</em></div>
          <strong className="sw-xp">+{xp} XP</strong>
        </div>
      )}
      {shopNear && !stop && <button className="sw-shop" onClick={() => props.onShop?.(shopNear.id)}><span aria-hidden="true">🛒</span> {shopNear.emoji} {shopNear.name}</button>}
      {stop && (
        <div className={`sw-card${open ? ' open' : ''}${got ? ' got' : ''}`} role="dialog" aria-label={stop.name}>
          <div className="sw-card-row">
            <button className="sw-card-main" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <span className="sw-num">{got ? '✓' : near! + 1}</span>
              <span className="sw-card-text"><b>{stop.name}</b><small>{open ? 'Chạm để thu gọn' : firstLine(stop.fact)}</small></span>
              <i aria-hidden="true">{open ? '▾' : '▴'}</i>
            </button>
            {!got && <button className="sw-snap" aria-label="Chụp ảnh lưu niệm, đóng dấu hộ chiếu" onClick={snap}><span aria-hidden="true">📸</span></button>}
            {got && !last && <button className="sw-next" onClick={close}>Đi tiếp ›</button>}
          </div>
          {open && <p className="sw-fact">{stop.fact}</p>}
          {(open || (got && last)) && (
            <div className="sw-actions">
              {got && last && <button className="sw-go" onClick={() => leave(true)}>Ra cổng → Siêu thị đặc sản</button>}
              {(last || !got) && <button onClick={close}>{last ? 'Ở lại ngắm thêm' : 'Để sau'}</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
