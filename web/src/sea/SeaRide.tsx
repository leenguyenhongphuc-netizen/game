// Màn lái tàu ra đảo trên biển mở và lái mô tô nước ở bãi biển: HUD, bản đồ nhỏ/lớn, nút lái, cần ga, còi, tự lái.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, PointerEvent as RPointerEvent } from 'react';
import './sea.css';
import { SeaScene } from './SeaScene.ts';
import type { SeaHud, SeaSummary } from './SeaScene.ts';
import { buildFerryWorld, buildJetSkiWorld } from './seaWorld.ts';
import type { Pt } from './seaWorld.ts';
import { SeaBigMap, SeaMiniMap } from './SeaMap.tsx';
import type { SeaMapData } from './SeaMap.tsx';
import { jetSkiBeach, seaRoute } from '../../../shared/sea.ts';
import type { VehGroup } from '../drive/DriveExtras.ts';

export type SeaRideProps =
  | { mode: 'ferry'; routeId: string; toIsland: boolean; cargo?: { group: VehGroup; color: number; electric?: boolean } | null; onDone: (s: SeaSummary) => void; onFail?: () => void; onCancel?: () => void }
  | { mode: 'jetski'; beachId: string; endsAt: number; jetColor?: number; onDone: (s: SeaSummary) => void; onFail?: () => void };

const LEVER = ['Lùi', 'Dừng máy', '¼ máy', '½ máy', '¾ máy', 'Hết máy'];
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function SeaRide(props: SeaRideProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null), sc = useRef<SeaScene | null>(null), cb = useRef(props); cb.current = props;
  const world = useMemo(() => {
    if (props.mode === 'ferry') { const r = seaRoute(props.routeId); return r ? buildFerryWorld(r, props.toIsland) : null; }
    const b = jetSkiBeach(props.beachId); return b ? buildJetSkiWorld(b) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [hud, setHud] = useState<SeaHud | null>(null);
  const [map, setMap] = useState<SeaMapData | null>(null);
  const [big, setBig] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; kind: string } | null>(null);
  const [hint, setHint] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [ended, setEnded] = useState<SeaSummary | null>(null);
  const [asking, setAsking] = useState(false);
  const jet = props.mode === 'jetski';

  useEffect(() => {
    if (!world) { cb.current.onFail?.(); return; }
    let id = 0, n = 0;
    try {
      sc.current = new SeaScene(host.current!, {
        world, mode: props.mode,
        cargo: props.mode === 'ferry' ? props.cargo ?? null : null, jetColor: props.mode === 'jetski' ? props.jetColor : undefined,
        presenceKey: props.mode === 'ferry' ? `tau:${props.routeId}` : `jet:${props.beachId}`,
        onHud: (h) => { setHud(h); if (++n % 3 === 0 && sc.current) setMap({ me: { x: h.x, z: h.z, yaw: h.yaw }, ships: sc.current.ships(), others: sc.current.othersList(), waypoint: sc.current.waypoint }); },
        onBump: (text, kind) => setToast({ id: ++id, text, kind }),
        onArrive: (s) => setEnded(s),
      });
      sc.current.start();
      if (props.mode === 'ferry') sc.current.setLever(2);
    } catch { cb.current.onFail?.(); }
    const t = window.setTimeout(() => setHint(false), 7000);
    return () => { window.clearTimeout(t); sc.current?.dispose(); sc.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(t); }, [toast]);
  // đồng hồ thuê mô tô nước (đếm theo giây là đủ, không động vào cảnh 3D)
  useEffect(() => { if (!jet) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [jet]);
  const left = props.mode === 'jetski' ? Math.max(0, (props.endsAt - now) / 1000) : 0;
  useEffect(() => { if (props.mode === 'jetski' && left <= 0 && hud && !ended) finishJet(); });
  useEffect(() => { if (!ended) return; const t = window.setTimeout(() => cb.current.onDone(ended), jet ? 2200 : 1800); return () => window.clearTimeout(t); }, [ended, jet]);
  const finishJet = () => { if (ended) return; const h = hud; setEnded({ seconds: Math.round(h?.elapsed ?? 0), hits: h?.hits ?? 0, hull: h?.hull ?? 100, km: h?.km ?? 0 }); };

  const hold = (dir: number) => ({
    onPointerDown: (e: RPointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } sc.current?.setRudder(dir); },
    onPointerUp: () => sc.current?.setRudder(0), onPointerCancel: () => sc.current?.setRudder(0), onLostPointerCapture: () => sc.current?.setRudder(0), onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const pedal = (which: 'gas' | 'brake') => ({
    onPointerDown: (e: RPointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } if (which === 'gas') sc.current?.setGas(1); else sc.current?.setBrake(1); },
    onPointerUp: () => { sc.current?.setGas(0); sc.current?.setBrake(0); }, onPointerCancel: () => { sc.current?.setGas(0); sc.current?.setBrake(0); }, onLostPointerCapture: () => { sc.current?.setGas(0); sc.current?.setBrake(0); }, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const pick = (p: Pt | null) => { sc.current?.setWaypoint(p); setBig(false); setMap((m) => (m ? { ...m, waypoint: p } : m)); };
  const views = ['chase', 'bridge', 'far'] as const, viewName = { chase: 'Sau tàu', bridge: jet ? 'Tầm mắt' : 'Buồng lái', far: 'Trên cao' };
  const nextView = () => { const v = views[(views.indexOf(hud?.view ?? 'chase') + 1) % views.length]; sc.current?.setView(v); };
  const title = props.mode === 'ferry' ? `${world?.start.name ?? ''} → ${world?.goal.name ?? ''}` : jetSkiBeach(props.beachId)?.name ?? 'Mô tô nước';
  const bearDeg = hud ? (hud.bearing * 180) / Math.PI : 0;
  const windDeg = hud ? ((hud.wind.dir - hud.yaw) * 180) / Math.PI : 0;

  return (
    <div className="sea" role="application" aria-label={jet ? 'Lái mô tô nước' : `Lái tàu ${title}`}>
      <div className="sea-scene" ref={host} />
      {!world && <p className="sea-fail">Chưa có vùng biển này.</p>}
      <div className="sea-top">
        <div className="sea-card">
          <div className="sea-title">{jet ? '🏄' : '⛴'} {title}</div>
          <div className="sea-row">
            <span className="sea-arrow" style={{ transform: `rotate(${bearDeg}deg)` }} aria-hidden="true">➤</span>
            <span>{hud ? (jet ? `${hud.targetName} · ${hud.dist} m` : `${hud.targetName} · ${(hud.dist / (world?.upk ?? 30)).toFixed(1).replace('.', ',')} km`) : '…'}</span>
          </div>
          <div className="sea-row small">
            <span title="Độ bền vỏ">🛟 Vỏ <b className={hud && hud.hull < 50 ? 'bad' : ''}>{hud?.hull ?? 100}%</b></span>
            <span title="Gió">🌬️ <i className="sea-wind" style={{ transform: `rotate(${windDeg}deg)` }}>↑</i> {hud ? Math.round(hud.wind.spd * 10) : 0} km/h</span>
            {jet ? <span className={left < 60 ? 'bad' : ''}>⏱ {fmtT(left)}</span> : <span>⏱ {fmtT(hud?.elapsed ?? 0)}</span>}
          </div>
        </div>
        {props.mode === 'ferry' && props.onCancel && <button className="sea-btn ghost" onClick={() => setAsking(true)} disabled={!!ended}>Huỷ chuyến</button>}
        {jet && <button className="sea-btn ghost" onClick={finishJet} disabled={!!ended}>Trả xe</button>}
      </div>
      {world && map && <SeaMiniMap w={world} d={map} onOpen={() => setBig(true)} />}
      {hint && !ended && <div className="sea-hint" role="status">{jet ? 'Chạy tự do trong vùng phao vàng. Giữ GA để chạy, ◀ ▶ để ôm cua.' : 'Biển rộng, lái tự do! Phao đỏ – xanh chỉ là luồng gợi ý (phao đỏ bên trái khi đi vào cảng đảo). Tránh bờ, đá và tàu khác.'}</div>}
      {hud?.zoneOut && <div className="sea-warn" role="alert">⚠ Ngoài vùng phao an toàn</div>}
      {toast && <div className={`sea-toast ${toast.kind}`} key={toast.id} role="status">{toast.text}</div>}
      <div className="sea-side">
        <button className="sea-round" onClick={() => setBig(true)} aria-label="Bản đồ">🗺️</button>
        <button className="sea-round" onClick={nextView} aria-label={`Góc nhìn: ${viewName[hud?.view ?? 'chase']}`}>🎥</button>
        <button className="sea-round" onClick={() => sc.current?.horn()} aria-label="Bóp còi">📯</button>
        {!jet && <button className={`sea-round ${hud?.auto ? 'on' : ''}`} onClick={() => sc.current?.setAuto(!hud?.auto)} aria-label="Tự lái theo luồng" aria-pressed={!!hud?.auto}>🧭</button>}
      </div>
      <div className="sea-bottom">
        <div className="sea-steer">
          <button className="sea-pad" {...hold(-1)} aria-label="Bẻ lái trái">◀</button>
          <button className="sea-pad" {...hold(1)} aria-label="Bẻ lái phải">▶</button>
        </div>
        <div className="sea-dial" aria-label="Tốc độ">
          <b>{hud ? (jet ? Math.round(hud.speed) : hud.speed.toFixed(1)) : 0}</b><small>{jet ? 'km/giờ' : 'hải lý/giờ'}</small>
          <i>{hud ? `${Math.round(hud.heading)}°` : ''}</i>
        </div>
        {jet ? (
          <div className="sea-throttle">
            <button className="sea-pad brake" {...pedal('brake')} aria-label="Lùi, phanh">LÙI</button>
            <button className="sea-pad gas" {...pedal('gas')} aria-label="Ga">GA</button>
          </div>
        ) : (
          <div className="sea-throttle lever">
            <button className="sea-pad gas" onClick={() => sc.current?.leverStep(1)} aria-label="Tăng máy">▲ MÁY</button>
            <span className="sea-lever" aria-live="polite">{LEVER[(hud?.throttle ?? 0) + 1]}</span>
            <button className="sea-pad brake" onClick={() => sc.current?.leverStep(-1)} aria-label="Giảm máy">▼ GIẢM</button>
          </div>
        )}
      </div>
      {big && world && map && <SeaBigMap w={world} d={map} onPick={pick} onClose={() => setBig(false)} />}
      {asking && props.mode === 'ferry' && (
        <div className="sea-done" role="alertdialog" aria-label="Huỷ chuyến">
          <b>Huỷ chuyến đi?</b><span>Bạn sẽ quay về nơi xuất phát.</span>
          <div className="sea-ask"><button className="sea-btn" onClick={() => setAsking(false)}>Lái tiếp</button><button className="sea-btn warn" onClick={() => props.onCancel?.()}>Huỷ chuyến</button></div>
        </div>
      )}
      {ended && (
        <div className="sea-done" role="dialog" aria-label="Kết thúc">
          <b>{jet ? '🏄 Trả mô tô nước' : `⚓ Đã cập ${world?.goal.name ?? 'bến'}`}</b>
          <span>{fmtT(ended.seconds)} · va chạm {ended.hits} lần · vỏ {ended.hull}%</span>
        </div>
      )}
    </div>
  );
}
