// Khu trò chơi kỹ năng trong khu vui chơi: mua xu giá cố định, chơi ném vòng / ném bóng rổ / gắp thú (kết quả chỉ do canh thời điểm chạm,
// không có may rủi), đạt điểm nhận vé thưởng, đổi quà trang trí. Quà không bán, không tặng, không đổi ra tiền.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { api } from '../api.ts';
import { ARCADE_GAMES, PARK_PRIZES, TOKEN_PRICE, arcadeTickets } from '../../../shared/parks.ts';
import type { ArcadeGameId, Park } from '../../../shared/parks.ts';
import './park.css';

export interface ArcadeWallet { tokens: number; tickets: number; prizes: { prizeId: string; qty: number }[] }
const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

/** Một ván: trả điểm 0–100 qua onEnd. */
function Game({ id, onEnd }: { id: ArcadeGameId; onEnd: (score: number) => void }): JSX.Element {
  const g = ARCADE_GAMES[id];
  const [shot, setShot] = useState(0), [score, setScore] = useState(0), [msg, setMsg] = useState(g.how);
  const [pos, setPos] = useState(0), [busy, setBusy] = useState(false), [claw, setClaw] = useState<number | null>(null);
  const t0 = useRef(performance.now()), raf = useRef(0), posRef = useRef(0);
  // mục tiêu gắp thú: nằm yên, nhìn thấy rõ (không ẩn, không ngẫu nhiên lúc chấm)
  const target = useRef(0.25 + ((Date.now() / 997) % 1) * 0.5);
  useEffect(() => {
    const loop = (now: number) => {
      const t = (now - t0.current) / 1000, sp = id === 'bong_ro' ? 1.2 + shot * 0.15 : id === 'nem_vong' ? 0.9 + shot * 0.15 : 0.7;
      const p = id === 'bong_ro' ? (1 - Math.cos(t * sp * Math.PI)) / 2 : (Math.sin(t * sp * Math.PI) + 1) / 2;
      posRef.current = p; setPos(p); raf.current = requestAnimationFrame(loop);
    };
    if (!busy && claw === null) raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [id, shot, busy, claw]);
  const zone = id === 'nem_vong' ? Math.max(0.08, 0.14 - shot * 0.012) : 0.06;
  const tap = () => {
    if (busy) return; const p = posRef.current;
    if (id === 'gap_thu') {
      setClaw(p); setBusy(true);
      const d = Math.abs(p - target.current), pts = d < 0.045 ? 100 : d < 0.1 ? 30 : 0;
      setMsg(pts === 100 ? 'Gắp trúng! 🧸' : pts ? 'Chạm được tai thú nhưng tuột mất…' : 'Trượt rồi.');
      window.setTimeout(() => onEnd(pts), 1600);
      return;
    }
    let pts = 0;
    if (id === 'nem_vong') { const d = Math.abs(p - 0.5); pts = d < zone ? Math.round(20 * (1 - (d / zone) * 0.5)) : 0; setMsg(pts ? `Lọt cổ chai! +${pts}` : 'Vòng văng ra ngoài.'); }
    else { pts = p >= 0.68 && p <= 0.8 ? 20 : (p >= 0.63 && p < 0.68) || (p > 0.8 && p <= 0.85) ? 10 : 0; setMsg(pts === 20 ? 'Vào rổ! +20' : pts ? 'Chạm vành rồi vào! +10' : p < 0.63 ? 'Thiếu lực.' : 'Mạnh quá, bay ra ngoài.'); }
    const ns = score + pts, n = shot + 1; setScore(ns); setBusy(true);
    window.setTimeout(() => { if (n >= g.shots) onEnd(Math.min(100, ns)); else { setShot(n); setBusy(false); t0.current = performance.now(); } }, 700);
  };
  return (
    <div className="pk-game" onPointerDown={tap} role="button" tabIndex={0} aria-label={`${g.name}: chạm để ${id === 'gap_thu' ? 'thả càng' : 'ném'}`}>
      <div className="pk-game-head"><b>{g.emoji} {g.name}</b><span>{id === 'gap_thu' ? '1 lượt' : `Lượt ${Math.min(shot + 1, g.shots)}/${g.shots}`} · {score} điểm</span></div>
      {id === 'nem_vong' && <div className="pk-meter h"><i className="zone" style={{ left: `${(0.5 - zone) * 100}%`, width: `${zone * 200}%` }} /><i className="mark" style={{ left: `${pos * 100}%` }} /><span className="bottle" aria-hidden="true">🍾</span></div>}
      {id === 'bong_ro' && <div className="pk-meter v"><i className="zone" style={{ bottom: '68%', height: '12%' }} /><i className="near" style={{ bottom: '63%', height: '5%' }} /><i className="near" style={{ bottom: '80%', height: '5%' }} /><i className="mark" style={{ bottom: `${pos * 100}%` }} /><span className="hoop" aria-hidden="true">🏀</span></div>}
      {id === 'gap_thu' && <div className="pk-claw"><i className="rail" /><i className="arm" style={{ left: `${(claw ?? pos) * 100}%`, height: claw !== null ? '72%' : '18%' }} /><span className="toy" style={{ left: `${target.current * 100}%` }} aria-hidden="true">🧸</span></div>}
      <p className="pk-game-msg">{msg}</p>
      <small>Chạm bất kỳ đâu trong khung để {id === 'gap_thu' ? 'thả càng' : 'ném'}.</small>
    </div>
  );
}

export function Arcade({ park, wallet, cash, onWallet, onClose, onPlayed }: { park: Park; wallet: ArcadeWallet; cash?: number; onWallet: (w: ArcadeWallet) => void; onClose: () => void; onPlayed: () => void }): JSX.Element {
  const [tab, setTab] = useState<'choi' | 'qua'>('choi');
  const [play, setPlay] = useState<{ id: ArcadeGameId; playId: number; at: number } | null>(null);
  const [result, setResult] = useState<{ score: number; won: number } | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => { setErr(''); setBusy(true); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const buy = (n: number) => run(async () => { const r = await api('POST', `/api/parks/${park.id}/tokens`, { n }); onWallet({ ...wallet, tokens: r.tokens, tickets: r.tickets }); });
  const start = (id: ArcadeGameId) => run(async () => { const r = await api('POST', `/api/parks/${park.id}/arcade/start`, { game: id }); onWallet({ ...wallet, tokens: r.tokens }); setResult(null); setPlay({ id, playId: r.playId, at: performance.now() }); });
  const end = (score: number) => {
    const p = play; if (!p) return;
    // ván thật không thể ngắn hơn thời gian tối thiểu: chờ đủ rồi mới nộp để máy chủ tính điểm
    const wait = Math.max(0, ARCADE_GAMES[p.id].minMs + 300 - (performance.now() - p.at));
    window.setTimeout(() => void run(async () => {
      const r = await api('POST', `/api/parks/arcade/${p.playId}/finish`, { score });
      onWallet({ ...wallet, tokens: wallet.tokens - 0, tickets: r.tickets }); setResult({ score: r.score, won: r.ticketsWon }); setPlay(null); onPlayed();
    }), wait);
  };
  const redeem = (id: string) => run(async () => { const r = await api('POST', `/api/parks/prizes/${id}/redeem`, {}); onWallet({ tokens: r.tokens, tickets: r.tickets, prizes: r.prizes }); });
  const owned = (id: string) => wallet.prizes.find((p) => p.prizeId === id)?.qty ?? 0;
  return (
    <div className="pk-arcade" role="dialog" aria-label="Khu trò chơi kỹ năng">
      <div className="pk-arcade-head">
        <b>🕹️ Khu trò chơi kỹ năng</b>
        <span className="pk-chip">🪙 {wallet.tokens} xu</span><span className="pk-chip">🎟️ {wallet.tickets} vé</span>
        <button className="pk-x" aria-label="Đóng" onClick={onClose}>✕</button>
      </div>
      {play ? <Game key={play.playId} id={play.id} onEnd={end} /> : <>
        <div className="pk-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'choi'} className={tab === 'choi' ? 'on' : ''} onClick={() => setTab('choi')}>Chơi</button>
          <button role="tab" aria-selected={tab === 'qua'} className={tab === 'qua' ? 'on' : ''} onClick={() => setTab('qua')}>Đổi quà</button>
        </div>
        {result && <p className="pk-result">Được {result.score} điểm → <b>+{result.won} vé thưởng</b></p>}
        {tab === 'choi' && <>
          <div className="pk-buy"><span>Mua xu · {money(TOKEN_PRICE)}/xu{cash !== undefined ? ` · bạn có ${money(cash)}` : ''}</span>
            <div>{[1, 5, 10].map((n) => <button key={n} disabled={busy} onClick={() => void buy(n)}>+{n}</button>)}</div></div>
          <ul className="pk-games">{Object.values(ARCADE_GAMES).map((g) => (
            <li key={g.id}><span className="em" aria-hidden="true">{g.emoji}</span><div><b>{g.name}</b><small>{g.how}</small><small>Điểm tối đa {g.maxScore} → {arcadeTickets(g.id, g.maxScore)} vé</small></div>
              <button disabled={busy || wallet.tokens < g.tokens} onClick={() => void start(g.id)}>Chơi · {g.tokens} xu</button></li>
          ))}</ul>
        </>}
        {tab === 'qua' && <ul className="pk-prizes">{PARK_PRIZES.map((p) => (
          <li key={p.id}><span className="em" aria-hidden="true">{p.emoji}</span><div><b>{p.name}</b><small>{p.tickets} vé{owned(p.id) ? ` · đang có ${owned(p.id)}` : ''}</small></div>
            <button disabled={busy || wallet.tickets < p.tickets} onClick={() => void redeem(p.id)}>Đổi</button></li>
        ))}</ul>}
        <p className="pk-legal">Trò chơi kỹ năng, không có may rủi. Xu và vé thưởng chỉ dùng trong khu trò chơi; quà để trưng bày, không bán, không tặng, không đổi ra tiền.</p>
      </>}
      {err && <p className="pk-err" role="alert">{err}</p>}
    </div>
  );
}
