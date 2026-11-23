// Màn đi bộ tham quan một địa danh thật: đi vào, xem từng điểm dừng theo đúng thứ tự ngoài đời, chụp ảnh lưu niệm rồi ra cổng sang siêu thị đặc sản.
import { useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent as RPointerEvent } from 'react';
import { sight as findSight } from '../../../shared/sights.ts';
import { SightScene } from './SightScene.ts';
import type { SightHud, SightShop } from './SightScene.ts';
import { guide } from './guide.ts';
import type { SightExtra } from './SightKit.ts';
import { attachSightOthers } from './SightOthers.ts';
import type { SightOthers } from './SightOthers.ts';
import { EMOTES } from '../../../shared/social.ts';
import { park as findPark } from '../../../shared/parks.ts';
import type { ParkTicket } from '../../../shared/parks.ts';
import { api } from '../api.ts';
import { ParkStopBody } from '../park/ParkStop.tsx';
import type { ParkView } from '../park/ParkStop.tsx';
import { RideCut } from '../park/RideCut.tsx';
import { Arcade } from '../park/Arcade.tsx';
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
const ART = `${import.meta.env.BASE_URL}art/sights/`;
/** Ảnh có thể thiếu: lỗi tải thì ẩn cả khung chứa. */
const hideOnError = (e: { currentTarget: HTMLImageElement }) => { (e.currentTarget.closest('[data-art]') as HTMLElement | null ?? e.currentTarget).style.display = 'none'; };
const today = () => { const d = new Date(), z = (n: number) => String(n).padStart(2, '0'); return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}`; };

export function SightWalk(props: SightWalkProps): JSX.Element {
  const s = findSight(props.sightId);
  const host = useRef<HTMLDivElement>(null), scene = useRef<SightScene | null>(null);
  const [seen, setSeen] = useState<string[]>(() => (props.seen ?? []).filter((id) => s?.stops.some((x) => x.id === id)));
  const seenRef = useRef(seen); seenRef.current = seen;
  const [near, setNear] = useState<number | null>(null);
  const [hud, setHud] = useState<SightHud | null>(null);
  const [flash, setFlash] = useState(0);
  const [shop, setShop] = useState<number | null>(null);
  const [splash, setSplash] = useState<'on' | 'fade' | 'off'>('on');
  const [stamp, setStamp] = useState<{ k: number; name: string } | null>(null);
  const [hint, setHint] = useState(true);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const knob = useRef<HTMLElement>(null);
  const ptr = useRef<{ move: number | null; look: number | null; lx: number; ly: number; ox: number; oy: number }>({ move: null, look: null, lx: 0, ly: 0, ox: 0, oy: 0 });
  const nearRef = useRef<number | null>(null); nearRef.current = near;
  const [album, setAlbum] = useState(false);
  const [exNear, setExNear] = useState<number | null>(null);
  const [ex, setEx] = useState<{ i: number; x: SightExtra; pick: number | null; pan: boolean } | null>(null);
  const [exDone, setExDone] = useState<number[]>([]);
  const [bonus, setBonus] = useState<{ k: number; xp: number } | null>(null);
  // ---- người chơi khác cùng tham quan, biểu cảm, ảnh chung
  const others = useRef<SightOthers | null>(null);
  const [crowd, setCrowd] = useState<{ n: number; near: string[] }>({ n: 0, near: [] });
  const [myEmote, setMyEmote] = useState<{ k: number; e: string } | null>(null);
  const [photo, setPhoto] = useState<{ src: string; names: string[] } | null>(null);
  // ---- khu vui chơi: vé, lượt chơi, khu trò chơi
  const pk = s?.park ? findPark(s.park) ?? null : null;
  const [pv, setPv] = useState<ParkView | null>(null);
  const [pkBusy, setPkBusy] = useState(false); const [pkErr, setPkErr] = useState('');
  const [riding, setRiding] = useState<string | null>(null); const [arcade, setArcade] = useState(false); const arcadePlayed = useRef(false);
  const [energyNow, setEnergyNow] = useState<number | null>(null);

  const snap = () => {
    const i = nearRef.current; if (i === null || !s) return; const id = s.stops[i].id;
    if (!seenRef.current.includes(id)) { const next = [...seenRef.current, id]; seenRef.current = next; setSeen(next); scene.current?.markSeen(i); setFlash((f) => f + 1); setStamp({ k: Date.now(), name: s.stops[i].name }); }
  };
  const close = () => { scene.current?.dismiss(); };

  useEffect(() => {
    if (!s || !host.current) return;
    const w = window as W;
    const sc = new SightScene(host.current, s, seenRef.current, { onNear: (i) => { setNear(i); setAlbum(false); if (i !== null) setEx(null); }, onHud: setHud, onShop: setShop }, props.shops);
    sc.auto = !!w.__sightAuto; sc.speedMul = w.__sightAuto && w.__rideStep ? 6 : 1; scene.current = sc;
    w.__sight = { goto: (i) => sc.goto(i), snap, pos: () => sc.pos(), info: () => sc.info(), close };
    others.current = attachSightOthers(sc, s.id);
    const t = window.setTimeout(() => setHint(false), 9000);
    // màn chào: giữ ảnh tới khi cảnh dựng xong rồi mới mờ dần vào cảnh 3D
    const hold = w.__sightAuto ? 250 : 1500, t2 = window.setTimeout(() => setSplash('fade'), hold), t3 = window.setTimeout(() => setSplash('off'), hold + 800);
    return () => { window.clearTimeout(t); window.clearTimeout(t2); window.clearTimeout(t3); others.current?.dispose(); others.current = null; sc.dispose(); scene.current = null; delete w.__sight; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sightId]);

  // đếm người cùng cảnh và ai đang đứng gần (để hiện nút chụp ảnh chung)
  useEffect(() => {
    const t = window.setInterval(() => {
      const o = others.current; if (!o) return; const list = o.names(), near = list.filter((x) => x.d < 9).map((x) => x.name).slice(0, 6);
      setCrowd((c) => (c.n === list.length && c.near.join('|') === near.join('|') ? c : { n: list.length, near }));
    }, 1000);
    return () => window.clearInterval(t);
  }, [props.sightId]);
  useEffect(() => {
    if (!pk) return; let live = true;
    api<ParkView>('GET', `/api/parks/${pk.id}`).then((v) => { if (live) setPv(v); }).catch(() => undefined);
    return () => { live = false; };
  }, [pk?.id]);
  useEffect(() => { if (scene.current) scene.current.paused = !!riding; }, [riding]);
  // cảnh đọc trạng thái này để tô trụ mốc và vẽ dải mũi tên trên nền
  useEffect(() => { guide.next = hud?.next ?? 0; guide.seen = new Set(seen); }, [hud?.next, seen]);
  useEffect(() => { guide.quiet = !!ex?.pan; }, [ex?.pan]);
  // điểm tương tác phụ: dò vị trí người chơi vài lần mỗi giây
  useEffect(() => {
    const t = window.setInterval(() => {
      const sc = scene.current; if (!sc) return; const p = sc.pos(); let best: number | null = null, bd = 4.4 * 4.4;
      guide.extras.forEach((x, i) => { const d = (x.at.x - p.x) ** 2 + (x.at.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } });
      setExNear((v) => (v === best ? v : best));
    }, 300);
    return () => window.clearInterval(t);
  }, [props.sightId]);
  // ngắm toàn cảnh: máy quay tự lia trọn một vòng trong 4 giây
  useEffect(() => {
    if (!ex?.pan) return; let n = 0; const steps = 100;
    const t = window.setInterval(() => { scene.current?.look(Math.PI * 2 / steps, 0); if (++n >= steps) { window.clearInterval(t); setEx((e) => (e ? { ...e, pan: false } : e)); } }, 40);
    return () => window.clearInterval(t);
  }, [ex?.pan]);
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
      scene.current?.setMove(dx / R, -dy / R); if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`; // ghi thẳng DOM: không vẽ lại React theo từng sự kiện chạm
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
  const walker = scene.current as unknown as { walkToStop?: (i: number) => void } | null, canWalk = typeof walker?.walkToStop === 'function';
  const exHere = exNear !== null && !stop && !ex ? guide.extras[exNear] : null;
  const EX_LABEL = { ngam_canh: ['🔭', 'Ngắm toàn cảnh'], hoi_dap: ['❓', 'Hỏi nhanh có thưởng'], thu_vat: ['✨', 'Lại gần xem'] } as const;
  const finishEx = (i: number, gain: number) => { if (!exDone.includes(i)) { setExDone((d) => [...d, i]); guide.done.add(i); if (gain > 0) setBonus({ k: Date.now(), xp: gain }); } };
  const openEx = () => { if (exNear === null) return; const x = guide.extras[exNear]; setEx({ i: exNear, x, pick: null, pan: x.kind === 'ngam_canh' }); if (x.kind !== 'hoi_dap') finishEx(exNear, x.kind === 'ngam_canh' ? 5 : 3); };
  const emote = (e: string) => { others.current?.emote(e); setMyEmote({ k: Date.now(), e }); };
  const groupPhoto = () => {
    const sc = scene.current; if (!sc) return; emote('📸');
    window.setTimeout(() => { const src = sc.capture(); setFlash((f) => f + 1); setPhoto({ src, names: crowd.near }); }, 700);
  };
  const pkRun = async (f: () => Promise<void>) => { setPkErr(''); setPkBusy(true); try { await f(); } catch (e) { setPkErr((e as Error).message || 'Có lỗi, thử lại sau.'); } finally { setPkBusy(false); } };
  const buyTicket = (t: ParkTicket) => pkRun(async () => { const r = await api('POST', `/api/parks/${pk!.id}/ticket`, { ticket: t.id }); setPv((v) => ({ ...(v ?? { tokens: 0, tickets: 0, prizes: [], rides: {} }), passes: r.passes })); });
  const startRide = (id: string) => pkRun(async () => {
    const r = await api('POST', `/api/parks/${pk!.id}/ride`, { ride: id });
    if (typeof r.energy === 'number') setEnergyNow(r.energy);
    setPv((v) => (v ? { ...v, rides: { ...v.rides, [id]: r.times } } : v)); setRiding(id);
  });
  const enShown = en ? { value: energyNow ?? en.value, max: en.max } : undefined;
  const pct = enShown ? Math.max(0, Math.min(100, enShown.value / Math.max(1, enShown.max) * 100)) : 0;
  return (
    <div className="sw" data-stop={stop?.id ?? ''} data-seen={seen.length}>
      <div className="sw-scene" ref={host} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
      <div className="sw-top">
        <div className="sw-bar">
          <div className="sw-title"><b aria-hidden="true">{s.emoji}</b><span>{s.name}</span></div>
          <ol className="sw-dots" aria-label={`Đã đóng ${seen.length} trên ${s.stops.length} dấu`}>
            {s.stops.map((x, i) => <li key={x.id} className={(seen.includes(x.id) ? 'done ' : '') + (hud?.next === i && !allSeen ? 'next' : '')} title={x.name}>{seen.includes(x.id) ? '✓' : i + 1}</li>)}
          </ol>
          {enShown && <div className={`sw-energy${pct < 25 ? ' low' : ''}`} role="img" aria-label={`Thể lực ${Math.round(enShown.value)} trên ${enShown.max}`}><span aria-hidden="true">⚡</span><div><i style={{ width: `${pct}%` }} /></div></div>}
        </div>
        <button className="sw-leave" onClick={() => leave(false)}>Rời đi</button>
      </div>
      {crowd.n > 0 && !stop && !photo && <div className="sw-crowd" role="status" aria-label={`${crowd.n} người đang tham quan cùng bạn`}>👥 {crowd.n}</div>}
      {!stop && !ex && !riding && !arcade && (
        <div className="sw-emotes" role="toolbar" aria-label="Biểu cảm">
          {EMOTES.filter((e) => e !== '📸').map((e) => <button key={e} aria-label={`Biểu cảm ${e}`} onClick={() => emote(e)}>{e}</button>)}
          {crowd.near.length > 0 && <button className="sw-group" onClick={groupPhoto} aria-label="Chụp ảnh chung với người đứng gần">📸<span>Ảnh chung</span></button>}
        </div>
      )}
      {myEmote && <div className="sw-my-emote" key={myEmote.k} aria-hidden="true">{myEmote.e}</div>}
      {photo && (
        <div className="sw-photo" role="dialog" aria-label="Ảnh chung">
          <img src={photo.src} alt="Ảnh chụp chung" />
          <p>{photo.names.length ? `Cùng ${photo.names.join(', ')}` : 'Ảnh lưu niệm'} · {s.name} · {today()}</p>
          <div className="sw-actions"><a className="sw-next" href={photo.src} download={`vuon-viet-${s.id}.jpg`}>Lưu ảnh</a><button className="sw-later" onClick={() => setPhoto(null)}>Đóng</button></div>
        </div>
      )}
      {!stop && !ex && hud && (
        <div className="sw-guide">
          <i style={{ transform: `rotate(${hud.bearing}rad)` }} aria-hidden="true">➤</i>
          <span>{allSeen ? 'Ra cổng:' : 'Tới:'} <b>{hud.next + 1}. {next.name}</b></span>
          <small>{Math.round(hud.dist)} m</small>
          {canWalk && hud.dist > 3 && <button className="sw-walk" onClick={() => walker!.walkToStop!(hud.next)}>▶ Đi tới</button>}
        </div>
      )}
      {seen.length > 0 && !stop && !ex && (
        <div className={`sw-album${album ? ' open' : ''}`}>
          <button className="sw-album-btn" aria-expanded={album} aria-label={`Ảnh đã chụp: ${seen.length}`} onClick={() => setAlbum((a) => !a)}><span aria-hidden="true">📷</span>{seen.length}</button>
          {album && <ul>{s.stops.filter((x) => seen.includes(x.id)).map((x) => <li key={x.id} data-art><img src={`${ART}${s.id}-s.jpg`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /><span>{x.name}</span></li>)}</ul>}
        </div>
      )}
      {hint && !stop && <div className="sw-hint">Kéo nửa dưới màn hình để đi · kéo nửa trên để nhìn quanh</div>}
      {stick && <div className="sw-stick" style={{ left: stick.x, top: stick.y }}><i ref={knob} /></div>}
      {splash !== 'off' && <div className={`sw-splash${splash === 'fade' ? ' fade' : ''}`} aria-hidden="true"><img src={`${ART}${s.id}.jpg`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /><div><b>{s.emoji}</b><h1>{s.name}</h1><p>{s.blurb}</p></div></div>}
      {flash > 0 && <div className="sw-flash" key={flash} />}
      {stamp && (
        <div className="sw-seal" key={stamp.k} aria-hidden="true">
          <div className="sw-polaroid" data-art><img src={`${ART}${s.id}-s.jpg`} alt="" onError={hideOnError} /><span>{stamp.name}</span></div>
          <div className="sw-seal-ink"><small>VƯỜN VIỆT · HỘ CHIẾU</small><b>{stamp.name}</b><span>{s.name}</span><em>{today()}</em></div>
          <strong className="sw-xp">+{xp} XP</strong>
        </div>
      )}
      {bonus && <strong className="sw-bonus" key={bonus.k} aria-hidden="true">+{bonus.xp} XP</strong>}
      {exHere && <button className={`sw-extra${exDone.includes(exNear!) ? ' done' : ''}`} onClick={openEx}><span aria-hidden="true">{exHere.emoji ?? EX_LABEL[exHere.kind][0]}</span> {exHere.kind === 'thu_vat' ? exHere.name : EX_LABEL[exHere.kind][1]}</button>}
      {shopNear && !stop && !exHere && !ex && <button className="sw-shop" onClick={() => props.onShop?.(shopNear.id)}><span aria-hidden="true">🛒</span> {shopNear.emoji} {shopNear.name}</button>}
      {ex && ex.x.kind === 'ngam_canh' && (
        <div className="sw-pan" role="dialog" aria-label={ex.x.name}>
          <b>🔭 {ex.x.name}</b><p>{ex.x.fact}</p>
          {!ex.pan && <button onClick={() => setEx(null)}>Xong</button>}
        </div>
      )}
      {ex && ex.x.kind !== 'ngam_canh' && (
        <div className="sw-ex" role="dialog" aria-label={ex.x.name}>
          <div className="sw-ex-head"><span aria-hidden="true">{ex.x.emoji ?? EX_LABEL[ex.x.kind][0]}</span><b>{ex.x.name}</b><button className="sw-x" aria-label="Đóng" onClick={() => setEx(null)}>✕</button></div>
          {ex.x.kind === 'hoi_dap' && <>
            <p className="sw-q">{ex.x.q}</p>
            <div className="sw-opts">{(ex.x.options ?? []).map((o, k) => (
              <button key={o} disabled={ex.pick !== null} className={ex.pick === null ? '' : k === ex.x.answer ? 'right' : k === ex.pick ? 'wrong' : ''}
                onClick={() => { setEx({ ...ex, pick: k }); finishEx(ex.i, k === ex.x.answer ? 15 : 0); }}>{o}</button>
            ))}</div>
            {ex.pick !== null && <p className="sw-fact"><b>{ex.pick === ex.x.answer ? 'Chính xác! ' : 'Chưa đúng. '}</b>{ex.x.fact}</p>}
          </>}
          {ex.x.kind === 'thu_vat' && <p className="sw-fact">{ex.x.fact}</p>}
          {(ex.x.kind === 'thu_vat' || ex.pick !== null) && <div className="sw-actions"><button className="sw-next" onClick={() => setEx(null)}>Đi tiếp ›</button></div>}
        </div>
      )}
      {stop && (
        <div className={`sw-card${got ? ' got' : ''}`} role="dialog" aria-label={stop.name}>
          <div className="sw-card-body">
            <div className="sw-thumb" data-art><img src={`${ART}${s.id}-s.jpg`} alt="" onError={hideOnError} />{got && <em>Đã đóng dấu</em>}</div>
            <div className="sw-card-text">
              <small>Điểm dừng {near! + 1}/{s.stops.length}</small>
              <b>{stop.name}</b>
            </div>
          </div>
          <p className="sw-fact">{stop.fact}</p>
          {pk && !last && <ParkStopBody park={pk} stopId={stop.id} view={pv} busy={pkBusy} got={got} energy={enShown?.value} onBuy={(t) => void buyTicket(t)} onRide={(id) => void startRide(id)} onArcade={() => setArcade(true)} onStamp={snap} />}
          {pk && pkErr && <p className="pk-err" role="alert">{pkErr}</p>}
          <div className="sw-actions">
            {!got && !(pk && !last) && <button className="sw-snap" onClick={snap}><span aria-hidden="true">📸</span> Chụp ảnh, đóng dấu</button>}
            {got && !last && <button className="sw-next" onClick={close}>Đi tiếp ›</button>}
            {got && last && <button className="sw-go" onClick={() => leave(true)}>Ra cổng → Siêu thị đặc sản</button>}
            {(!got || last) && <button className="sw-later" onClick={close}>{last ? 'Ở lại ngắm thêm' : 'Để sau'}</button>}
          </div>
        </div>
      )}
      {pk && riding && (() => { const r = pk.rides.find((x) => x.id === riding)!; return <RideCut park={pk} ride={r} onDone={() => { setRiding(null); snap(); }} />; })()}
      {pk && arcade && pv && <Arcade park={pk} wallet={{ tokens: pv.tokens, tickets: pv.tickets, prizes: pv.prizes }} onWallet={(w) => setPv((v) => (v ? { ...v, ...w } : v))} onPlayed={() => { arcadePlayed.current = true; }} onClose={() => { setArcade(false); if (arcadePlayed.current) snap(); }} />}
    </div>
  );
}
