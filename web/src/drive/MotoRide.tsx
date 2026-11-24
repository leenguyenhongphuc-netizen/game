// Màn lái xe máy (đi phượt hoặc chở hàng nhỏ đi buôn trên quốc lộ). Tự chứa CSS, phủ kín màn hình qua portal.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { MotoScene } from './MotoScene.ts';
import type { MotoHud, MotoStop, MotoTheme } from './MotoScene.ts';
import type { MotoStyle } from './MotoParts.ts';
import { WEATHER_ICON, WEATHER_NAME } from '../../../shared/moto.ts';
import type { WeatherSpan } from '../../../shared/moto.ts';
import { rallyCount } from '../../../shared/convoy.ts';
import type { ConvoyView } from '../../../shared/convoy.ts';
import { api } from '../api.ts';

export interface MotoRideRoute { title: string; startName: string; endName: string; km: number; theme: MotoTheme; twisty: number; seconds: number; stops: MotoStop[] }
export interface MotoRideBike { name: string; style: MotoStyle; tank: number; per100: number; unit: string; maxKmh: number; fuel: number; price: number; color: number }
export interface MotoRideResult { kmDone: number; aborted: boolean; photos: string[]; cafes: string[]; refuels: { at: string; amount: number }[]; falls: number; seconds: number; raincoat: string | null }
export interface MotoRideProps {
  mode: 'phuot' | 'buon'; route: MotoRideRoute; bike: MotoRideBike;
  shirt?: number; helmet?: number; cargo?: boolean; presenceKey?: string;
  /** Giá một lần ngồi quán (đi phượt) và thể lực hồi lại, để hiện trên nút. */
  cafe?: { cost: number; energy: number };
  /** Thời tiết từng đoạn (đi phượt) và giá áo mưa bán ở quán. */
  weather?: WeatherSpan[]; raincoatCost?: number;
  /** Đang đi cùng đoàn: mã đoàn (báo vị trí, tập trung ở điểm dừng). */
  convoyId?: number;
  onDone: (r: MotoRideResult) => void;
}

const CSS = `
.mr { position: fixed; inset: 0; z-index: 1200; background: #cfe6ee; overflow: hidden; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #3b2a17; touch-action: none; user-select: none; -webkit-user-select: none; font-size: 14px; line-height: 1.25; }
.mr *, .mr *::before, .mr *::after { box-sizing: border-box; }
.mr-scene { position: absolute; inset: 0; }
.mr-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; pointer-events: none; }
.mr-bar { background: #fff6dc; border: 3px solid #7a4a22; border-radius: 16px; box-shadow: 0 3px 0 #56310f; padding: 4px 10px 8px; min-width: 0; }
.mr-names { display: flex; justify-content: space-between; gap: 8px; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 0.9rem; }
.mr-names span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.mr-track { position: relative; height: 10px; border-radius: 8px; background: #e8d6a6; border: 2px solid #cdb67c; margin: 14px 10px 0; }
.mr-fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: linear-gradient(#6fd45c, #4caf3f); }
.mr-pin { position: absolute; top: -17px; font-size: 0.85rem; transform: translateX(-50%); opacity: 0.9; }
.mr-pin.done { opacity: 0.35; }
.mr-x { pointer-events: auto; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; background: #f6e7bd; border: 2px solid #7a4a22; border-radius: 12px; box-shadow: 0 3px 0 #7a4a22; padding: 4px 10px; min-height: 44px; min-width: 44px; cursor: pointer; color: inherit; }
.mr-stats { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; }
.mr-stat { background: #fff6dcf2; border: 2px solid #7a4a22; border-radius: 12px; box-shadow: 0 2px 0 #56310f; padding: 4px 9px; font-weight: 700; font-size: 0.82rem; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.mr-stat b { font-size: 1.15rem; font-family: 'Baloo 2', sans-serif; }
.mr-gauge { width: 58px; height: 9px; border-radius: 6px; background: #e8d6a6; border: 1.5px solid #cdb67c; overflow: hidden; }
.mr-gauge u { display: block; height: 100%; background: linear-gradient(#ffd23f, #f0a51e); text-decoration: none; }
.mr-gauge.low u { background: #e0342b; }
.mr-warn { grid-column: 1 / -1; justify-self: center; max-width: 100%; background: #1f8a4c; color: #fff; border: 3px solid #fff; border-radius: 14px; padding: 5px 12px; font-weight: 800; font-size: 0.86rem; text-align: center; box-shadow: 0 3px 0 #0f5a30; }
.mr-warn.urgent { background: #c0281e; box-shadow: 0 3px 0 #7d150e; animation: mr-pulse 0.6s ease-in-out infinite alternate; }
@keyframes mr-pulse { from { transform: scale(1); } to { transform: scale(1.04); } }
.mr-toast { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); max-width: min(92%, 420px); background: #fff6dc; border: 3px solid #7a4a22; border-radius: 16px; padding: 8px 14px; font-weight: 700; text-align: center; box-shadow: 0 4px 0 #56310f; pointer-events: none; }
.mr-toast.bad { background: #ffe1dc; border-color: #c0281e; }
.mr-bottom { position: absolute; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); display: flex; justify-content: space-between; align-items: flex-end; gap: 6px; pointer-events: none; }
.mr-group { min-width: 0; }
.mr-group { display: flex; gap: 8px; align-items: flex-end; }
.mr-btn { pointer-events: auto; touch-action: none; cursor: pointer; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; color: #3b2a17; background: #fff6dce6; border: 3px solid #7a4a22; box-shadow: 0 5px 0 #56310f; border-radius: 16px; min-width: 56px; min-height: 58px; padding: 4px 8px; display: grid; place-items: center; line-height: 1.05; font-size: 0.8rem; }
.mr-btn i { font-style: normal; font-size: 1.45rem; display: block; }
.mr-btn.on { transform: translateY(4px); box-shadow: 0 1px 0 #56310f; filter: brightness(1.1); }
.mr-btn.gas { background: #4caf3f; color: #fff; width: 70px; height: 82px; }
.mr-btn.brake { background: #c0392b; color: #fff; }
.mr-btn.stop { background: #1f6fb8; color: #fff; min-width: 88px; }
.mr-bottom .mr-group:last-child { flex-wrap: wrap-reverse; justify-content: flex-end; }
.mr-btn:disabled { opacity: 0.45; }
.mr-panel { position: absolute; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(94%, 440px); background: #fff6dc; border: 3px solid #7a4a22; border-radius: 18px; box-shadow: 0 5px 0 #56310f; padding: 12px 14px; display: grid; gap: 8px; max-height: 70%; overflow: auto; }
.mr-panel h3 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 1.15rem; }
.mr-panel p { margin: 0; color: #5a4630; }
.mr-row { display: flex; gap: 8px; flex-wrap: wrap; }
.mr-row button { flex: 1 1 140px; min-height: 48px; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; border: 3px solid #56310f; border-radius: 14px; background: #f6e7bd; color: #3b2a17; box-shadow: 0 3px 0 #56310f; cursor: pointer; padding: 6px 10px; }
.mr-row button.go { background: #4caf3f; color: #fff; }
.mr-row button.blue { background: #1f6fb8; color: #fff; }
.mr-flash { position: absolute; inset: 0; background: #fff; pointer-events: none; animation: mr-flash 0.5s ease-out forwards; }
@keyframes mr-flash { from { opacity: 0.95; } to { opacity: 0; } }
.mr-visor { position: absolute; inset: 0; pointer-events: none; background:
  radial-gradient(circle at 6% 30%, #ffffff55 0 5px, transparent 7px), radial-gradient(circle at 11% 62%, #ffffff44 0 7px, transparent 9px), radial-gradient(circle at 4% 82%, #ffffff50 0 4px, transparent 6px),
  radial-gradient(circle at 94% 26%, #ffffff4d 0 6px, transparent 8px), radial-gradient(circle at 90% 55%, #ffffff40 0 4px, transparent 6px), radial-gradient(circle at 96% 78%, #ffffff55 0 8px, transparent 10px),
  radial-gradient(circle at 30% 96%, #ffffff3d 0 5px, transparent 7px), radial-gradient(circle at 72% 95%, #ffffff44 0 6px, transparent 8px), radial-gradient(circle at 50% 4%, #ffffff33 0 5px, transparent 7px),
  radial-gradient(ellipse at center, transparent 62%, #b8c6ce55 100%); animation: mr-drip 2.4s linear infinite; }
@keyframes mr-drip { 0% { background-position: 0 0; } 100% { background-position: 0 14px; } }
.mr-team { display: flex; gap: 3px; align-items: center; }
.mr-team i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; display: inline-block; box-shadow: 0 0 0 1px #7a4a22; }
.mr-rally { background: #eef6ff; border: 2px dashed #1f6fb8; border-radius: 12px; padding: 6px 8px; font-weight: 700; color: #1f4f8a; }
.mr-err { position: absolute; inset: 0; display: grid; place-items: center; padding: 20px; text-align: center; }
@media (orientation: landscape) and (max-height: 500px) { .mr-btn { min-width: 54px; min-height: 54px; } .mr-btn.gas { height: 70px; } .mr-panel { max-height: 80%; } }
`;

const ICON: Record<MotoStop['kind'], string> = { photo: '📸', fuel: '⛽', cafe: '☕' };
/** Chính mình đang đứng ở điểm dừng thì tính là đã tới, không đợi nhịp báo vị trí kế tiếp. */
const withMe = (ms: ConvoyView['members'], at: MotoStop) => ms.map((m) => (m.me ? { ...m, atStop: at.id, km: Math.max(m.km, at.atKm) } : m));
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

export function MotoRide(p: MotoRideProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null), scene = useRef<MotoScene | null>(null);
  const [hud, setHud] = useState<MotoHud | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; bad: boolean } | null>(null);
  const [flash, setFlash] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const [held, setHeld] = useState<'gas' | 'brake' | null>(null);
  const log = useRef<{ photos: Set<string>; cafes: Set<string>; refuels: { at: string; amount: number }[]; t0: number; raincoat: string | null }>({ photos: new Set(), cafes: new Set(), refuels: [], t0: Date.now(), raincoat: null });
  const [team, setTeam] = useState<ConvoyView | null>(null);
  const teamRef = useRef<ConvoyView | null>(null); teamRef.current = team;
  const atRef = useRef<string | null>(null);
  const [, force] = useState(0);
  const sent = useRef(false);
  const auto = (window as unknown as { __motoAuto?: boolean }).__motoAuto === true;

  const say = (text: string, bad = false) => { const id = Date.now(); setToast({ id, text, bad }); window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200); };
  const finish = (aborted: boolean) => {
    if (sent.current) return; sent.current = true;
    const s = scene.current, L = log.current;
    p.onDone({ kmDone: aborted ? s?.kmNow ?? 0 : p.route.km, aborted, photos: [...L.photos], cafes: [...L.cafes], refuels: L.refuels, falls: s?.hud().falls ?? 0, seconds: Math.round((Date.now() - L.t0) / 1000), raincoat: L.raincoat });
  };

  useEffect(() => {
    try {
      scene.current = new MotoScene(host.current!, {
        theme: p.route.theme, km: p.route.km, seconds: p.route.seconds, twisty: p.route.twisty, stops: p.route.stops,
        look: { style: p.bike.style, color: p.bike.color, shirt: p.shirt, helmet: p.helmet, cargo: p.cargo },
        bike: { tank: p.bike.tank, per100: p.bike.per100, fuel: p.bike.fuel, unit: p.bike.unit, maxKmh: p.bike.maxKmh },
        title: p.route.title, startName: p.route.startName, endName: p.route.endName, presenceKey: p.presenceKey, weather: p.weather,
        onTick: setHud,
        onStop: () => force((x) => x + 1),
        onEvent: (text, kind) => say(text, kind === 'bad'),
        onArrive: () => setArrived(true),
      });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Máy không dựng được cảnh 3D.'); }
    return () => { scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đi đoàn: báo km và điểm đang đứng mỗi 3 giây (nhanh hơn khi đang chờ ở điểm tập trung), nhận vị trí cả đoàn
  useEffect(() => {
    if (!p.convoyId) return;
    let stop = false, timer = 0;
    const beat = async () => {
      if (stop) return;
      if (!document.hidden) {
        const s = scene.current;
        try {
          const r = await api<{ convoy: ConvoyView }>('POST', `/api/convoys/${p.convoyId}/pos`, { km: Math.round((s?.kmNow ?? 0) * 100) / 100, atStop: atRef.current });
          if (stop) return;
          setTeam(r.convoy);
          s?.setConvoy(new Map(r.convoy.members.filter((m) => !m.me).map((m) => [m.userId, m.color])));
        } catch { /* mạng chập chờn: thử lại nhịp sau */ }
      }
      timer = window.setTimeout(beat, atRef.current ? 2000 : 3000);
    };
    void beat();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [p.convoyId]);

  // bàn phím (máy tính): ↑ ga, ↓ phanh, ← → đổi làn, Space dừng ở điểm sắp tới
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = scene.current; if (!s) return;
      if (e.key === 'ArrowUp' || e.key === 'w') s.setThrottle(1);
      else if (e.key === 'ArrowDown' || e.key === 's') s.setBrake(1);
      else if (e.key === 'ArrowLeft' || e.key === 'a') s.setLane(-1);
      else if (e.key === 'ArrowRight' || e.key === 'd') s.setLane(1);
      else if (e.key === ' ') s.stopAhead();
    };
    const up = (e: KeyboardEvent) => { const s = scene.current; if (!s) return; if (e.key === 'ArrowUp' || e.key === 'w') s.setThrottle(0); if (e.key === 'ArrowDown' || e.key === 's') s.setBrake(0); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const at = hud?.at ?? null;
  atRef.current = at?.id ?? null;
  const rally = at && team && (at.kind === 'photo' || at.kind === 'cafe') ? rallyCount(withMe(team.members, at), at.id, at.atKm) : null;
  const meKm = hud?.kmDone ?? 0, mates = team?.members.filter((m) => !m.me && !m.aborted) ?? [];
  const lead = team?.members.find((m) => m.leader && !m.me), last = mates.length ? mates.reduce((a, b) => (b.km < a.km ? b : a)) : null;
  const raining = hud?.weather === 'mua';
  const buyCoat = (st: MotoStop) => { log.current.raincoat = st.id; if (!log.current.cafes.has(st.id)) log.current.cafes.add(st.id); say(`🧥 Đã mặc áo mưa${p.raincoatCost ? ` (${vnd(p.raincoatCost)})` : ''}: đi mưa không mất thêm sức.`); force((x) => x + 1); };
  // hành động ở điểm dừng
  const photo = (st: MotoStop) => { setFlash((f) => f + 1); log.current.photos.add(st.id); say(`📸 Đã chụp ở ${st.name}: được đóng dấu sổ phượt!`); force((x) => x + 1); };
  const fill = (st: MotoStop) => {
    const s = scene.current; if (!s) return;
    const add = Math.round((p.bike.tank - s.fuelNow) * 10) / 10;
    if (add <= 0.05) { say('Bình còn đầy.'); return; }
    s.addFuel(add); log.current.refuels.push({ at: st.id, amount: add });
    say(`${p.bike.unit === 'kWh' ? '⚡ Đã sạc' : '⛽ Đã đổ'} ${add.toLocaleString('vi-VN')} ${p.bike.unit} · ${vnd(add * p.bike.price)}`); force((x) => x + 1);
  };
  const rest = (st: MotoStop) => { log.current.cafes.add(st.id); say(`☕ Nghỉ chân ở ${st.name}${p.cafe ? `: +${p.cafe.energy} thể lực` : ''}`); force((x) => x + 1); };
  const go = () => { scene.current?.resume(); force((x) => x + 1); };

  // tự lái thử: tự làm việc ở điểm dừng rồi đi tiếp
  useEffect(() => {
    if (!auto || !at) return;
    const id = window.setTimeout(() => {
      if (at.kind === 'photo') photo(at);
      else if (at.kind === 'fuel') { if ((scene.current?.fuelNow ?? 0) < p.bike.tank * 0.8) fill(at); }
      else { rest(at); if (p.bike.unit === 'kWh') fill(at); if (scene.current?.weather === 'mua' && !log.current.raincoat) buyCoat(at); }
      // đi đoàn: chờ cả đoàn tới điểm tập trung (tối đa ~20 giây khi kiểm thử) rồi mới đi tiếp
      if (p.convoyId && (at.kind === 'photo' || at.kind === 'cafe')) {
        const t0 = Date.now();
        const wait = () => { const t = teamRef.current, r = t ? rallyCount(withMe(t.members, at), at.id, at.atKm) : null; if ((r && r.here >= r.total) || Date.now() - t0 > 20_000) go(); else window.setTimeout(wait, 500); };
        window.setTimeout(wait, 250);
      } else window.setTimeout(go, 250);
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at?.id, auto]);
  useEffect(() => { if (auto && arrived) { const id = window.setTimeout(() => finish(false), 400); return () => window.clearTimeout(id); } }, [auto, arrived]); // eslint-disable-line react-hooks/exhaustive-deps

  const hold = (which: 'gas' | 'brake') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } if (which === 'gas') scene.current?.setThrottle(1); else scene.current?.setBrake(1); setHeld(which); },
    onPointerUp: () => { scene.current?.setThrottle(0); scene.current?.setBrake(0); setHeld(null); },
    onPointerCancel: () => { scene.current?.setThrottle(0); scene.current?.setBrake(0); setHeld(null); },
    onLostPointerCapture: () => { scene.current?.setThrottle(0); scene.current?.setBrake(0); setHeld(null); },
  });
  const fuelPct = hud ? hud.fuel / Math.max(0.01, hud.tank) : 1;
  const L = log.current;

  const ui = (
    <div className="mr" role="application" aria-label={`Lái xe máy: ${p.route.title}`}>
      <style>{CSS}</style>
      <div className="mr-scene" ref={host} />
      {err ? (
        <div className="mr-err"><div className="mr-panel" style={{ position: 'static', transform: 'none' }}>
          <h3>Máy không dựng được cảnh 3D</h3><p>{err} Bạn vẫn có thể đi hết chặng ở chế độ rút gọn (không có tem chụp ảnh).</p>
          <div className="mr-row"><button className="go" onClick={() => finish(false)}>Đi hết chặng</button><button onClick={() => finish(true)}>Thôi, không đi</button></div>
        </div></div>
      ) : (
        <>
          <div className="mr-top">
            <div className="mr-bar">
              <div className="mr-names"><span>{p.route.startName} → {p.route.endName}</span><span>{hud ? `${Math.max(0, Math.round((p.route.km - hud.kmDone) * 10) / 10)} km nữa` : ''}</span></div>
              <div className="mr-track">
                <div className="mr-fill" style={{ width: `${(hud?.progress ?? 0) * 100}%` }} />
                {p.route.stops.map((st) => <span key={st.id} className={`mr-pin${(hud?.kmDone ?? 0) > st.atKm ? ' done' : ''}`} style={{ left: `${(st.atKm / p.route.km) * 100}%` }} aria-hidden="true">{ICON[st.kind]}</span>)}
              </div>
            </div>
            <button className="mr-x" onClick={() => { if (confirm(p.mode === 'phuot' ? 'Bỏ dở chuyến phượt? Chỉ tính quãng đã đi, không có thưởng đi trọn tuyến.' : 'Dừng chuyến? Xe sẽ quay về chỗ cũ.')) finish(true); }} aria-label="Bỏ dở chuyến">✕</button>
            <div className="mr-stats">
              <div className="mr-stat"><b>{hud?.kmh ?? 0}</b> km/h <small>· tối đa {p.bike.maxKmh}</small></div>
              <div className="mr-stat">{p.bike.unit === 'kWh' ? '🔋' : '⛽'}<span className={`mr-gauge${fuelPct < 0.2 ? ' low' : ''}`}><u style={{ width: `${Math.max(0, Math.min(1, fuelPct)) * 100}%` }} /></span>{hud ? `${hud.fuel.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${p.bike.unit}` : ''}</div>
              {hud?.next && <div className="mr-stat">{ICON[hud.next.kind]} {hud.next.name} · {hud.next.inKm} km</div>}
              {hud && <div className="mr-stat" title={WEATHER_NAME[hud.weather]}>{WEATHER_ICON[hud.weather]} {hud.weather === 'nang' ? 'Nắng ráo' : hud.weather === 'mua' ? `Mưa · đường trơn${log.current.raincoat ? ' · 🧥' : ''}` : 'Sương mù'}</div>}
              {team && mates.length > 0 && <div className="mr-stat"><span className="mr-team">{team.members.map((m) => <i key={m.userId} style={{ background: m.color, opacity: m.aborted ? 0.3 : 1 }} title={m.name} />)}</span>
                {lead ? `Trưởng đoàn ${lead.km >= meKm ? 'trước' : 'sau'} ${Math.abs(Math.round((lead.km - meKm) * 10) / 10)} km` : 'Bạn dẫn đoàn'}{last && last.km < meKm - 0.05 ? ` · cuối đoàn sau ${Math.round((meKm - last.km) * 10) / 10} km` : ''}</div>}
              {(hud?.others ?? 0) > 0 && <div className="mr-stat">🏍️ {hud!.others} người cùng đường</div>}
            </div>
            {hud?.warn ? <div className={`mr-warn${hud.warn.urgent ? ' urgent' : ''}`} role="status">{hud.warn.text}</div>
              : hud?.stopping ? <div className="mr-warn" role="status">Đang giảm tốc, tấp vào lề…</div> : null}
          </div>
          {raining && <div className="mr-visor" aria-hidden="true" />}
          {toast && <div className={`mr-toast${toast.bad ? ' bad' : ''}`} role="status" key={toast.id}>{toast.text}</div>}
          {flash > 0 && <div className="mr-flash" key={flash} />}
          {!at && !arrived && (
            <div className="mr-bottom">
              <div className="mr-group">
                <button className={`mr-btn${hud?.lane === -1 ? ' on' : ''}`} aria-label="Sang làn trái để vượt" onClick={() => scene.current?.setLane(-1)}><i>◀</i>Vượt</button>
                <button className={`mr-btn${hud?.lane === 1 ? ' on' : ''}`} aria-label="Về làn phải" onClick={() => scene.current?.setLane(1)}><i>▶</i>Về làn</button>
              </div>
              <div className="mr-group">
                {hud?.dry && <button className="mr-btn stop" onClick={() => { scene.current?.addFuel(Math.min(1, p.bike.tank)); say('Người dân chở can xăng lên: tính tiền khi tới nơi.'); }}><i>📞</i>Gọi chở xăng</button>}
                {hud?.canStop && !hud.dry && <button className="mr-btn stop" onClick={() => scene.current?.stopAhead()}><i>{hud.next ? ICON[hud.next.kind] : '🅿️'}</i>Dừng ở đây</button>}
                <button className={`mr-btn brake${held === 'brake' ? ' on' : ''}`} aria-label="Phanh (giữ)" {...hold('brake')}><i>■</i>Phanh</button>
                <button className={`mr-btn gas${held === 'gas' ? ' on' : ''}`} aria-label="Ga (giữ)" {...hold('gas')}><i>▲</i>Ga</button>
              </div>
            </div>
          )}
          {at && !arrived && (
            <div className="mr-panel" role="dialog" aria-label={at.name}>
              <h3>{ICON[at.kind]} {at.name}</h3>
              {at.note && <p>{at.note}</p>}
              {rally && <div className="mr-rally" role="status">🏁 Điểm tập trung: {rally.here}/{rally.total} xe đã tới{rally.waiting.length ? ` · đang chờ ${rally.waiting.join(', ')}` : ' · đủ đoàn rồi!'}</div>}
              <div className="mr-row">
                {at.kind === 'photo' && <button className="blue" disabled={L.photos.has(at.id)} onClick={() => photo(at)}>{L.photos.has(at.id) ? '✓ Đã chụp, đóng dấu' : '📸 Chụp ảnh, đóng dấu'}</button>}
                {(at.kind === 'fuel' || (at.kind === 'cafe' && p.bike.unit === 'kWh')) && <button className="blue" onClick={() => fill(at)}>{p.bike.unit === 'kWh' ? '⚡ Sạc đầy' : '⛽ Đổ đầy bình'} · ~{vnd(Math.max(0, p.bike.tank - (scene.current?.fuelNow ?? 0)) * p.bike.price)}</button>}
                {at.kind === 'cafe' && <button className="blue" disabled={L.cafes.has(at.id)} onClick={() => rest(at)}>{L.cafes.has(at.id) ? '✓ Đã nghỉ' : `☕ Ngồi nghỉ${p.cafe ? ` · ${vnd(p.cafe.cost)} · +${p.cafe.energy} thể lực` : ', đi vệ sinh'}`}</button>}
                {at.kind === 'cafe' && p.raincoatCost !== undefined && <button className="blue" disabled={!!L.raincoat} onClick={() => buyCoat(at)}>{L.raincoat ? '✓ Đã mặc áo mưa' : `🧥 Mua áo mưa · ${vnd(p.raincoatCost)}`}</button>}
                <button className="go" onClick={go}>{rally && rally.here < rally.total ? 'Đi tiếp, không chờ ▶' : 'Đi tiếp ▶'}</button>
              </div>
            </div>
          )}
          {arrived && (
            <div className="mr-panel" role="dialog" aria-label="Tới nơi">
              <h3>🏁 Tới {p.route.endName}!</h3>
              <p>{p.route.km} km{L.photos.size ? ` · ${L.photos.size} tem chụp ảnh` : ''}{L.refuels.length ? ` · đổ ${L.refuels.reduce((a, b) => a + b.amount, 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${p.bike.unit}` : ''}{hud?.falls ? ` · ngã ${hud.falls} lần` : ''}.</p>
              <div className="mr-row"><button className="go" onClick={() => finish(false)}>Xong</button></div>
            </div>
          )}
        </>
      )}
    </div>
  );
  return createPortal(ui, document.body);
}
