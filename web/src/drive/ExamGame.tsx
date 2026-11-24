// Màn thi sát hạch lái xe trong hình: chọn thi thật hoặc tập, lái bằng vô-lăng và bàn đạp trên màn, xem bảng điểm.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.ts';
import { fmtMoney } from '../../../shared/rules.ts';
import { ExamYard } from './ExamYard.ts';
import type { ExamView, YardHud } from './ExamYard.ts';
import { CAR_SPECS, ITEMS, RULES, summarize } from './ExamCourse.ts';
import type { ExamClass, Gear, Input, ItemId, SimEvent } from './ExamCourse.ts';
import './exam.css';

export interface ExamResult { cls: ExamClass; passed: boolean; score: number; seconds: number; out: string | null; recorded: boolean }
export interface ExamGameProps {
  /** Hạng bằng đang thi. Hạng không có sân riêng (A1, A, B1…) dùng sân hạng B. */
  cls: string; title?: string; fee?: number;
  /** Mở thẳng vào chế độ tập (không tính điểm lên máy chủ). */
  practiceOnly?: boolean;
  /** Số bùa may mắn đang có (vật phẩm vui: lượt thi thật có vệt dẫn đường, không đổi cách chấm). */
  charms?: number;
  onClose: (result: ExamResult | null) => void;
}
type Phase = 'intro' | 'run' | 'result';
const yardClass = (cls: string): ExamClass => (cls === 'C1' || cls === 'C' || cls === 'CE' ? cls : 'B');
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const VIEW_NAMES: Record<ExamView, string> = { tren: 'Trên cao', bac: 'Bản đồ', sau: 'Sau xe' };

export function ExamGame(props: ExamGameProps): JSX.Element {
  const cls = yardClass(props.cls), spec = CAR_SPECS[cls];
  const host = useRef<HTMLDivElement>(null), yard = useRef<ExamYard | null>(null), wheelEl = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [practice, setPractice] = useState(!!props.practiceOnly);
  const [useCharm, setUseCharm] = useState(false), [charmed, setCharmed] = useState(false);
  const [from, setFrom] = useState<ItemId>(1);
  const [hud, setHud] = useState<YardHud | null>(null);
  const [say, setSay] = useState<string>('');
  const [feed, setFeed] = useState<{ id: number; text: string; bad: boolean }[]>([]);
  const [ctl, setCtl] = useState<{ gear: Gear; left: boolean; right: boolean; hazard: boolean; belt: boolean; hand: boolean }>({ gear: 'P', left: false, right: false, hazard: false, belt: false, hand: true });
  const [view, setView] = useState<ExamView>('tren');
  const [auto, setAuto] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [sheet, setSheet] = useState<{ rows: ReturnType<typeof summarize>; general: { points: number; text: string; out?: boolean }[]; firstBad: ItemId } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [nudge, setNudge] = useState(0);
  const minUntil = useRef(0);
  const examId = useRef<number | string | null>(null), feedId = useRef(0), drag = useRef<{ id: number; x: number; s: number } | null>(null), ended = useRef(false);

  const input = (): Input | null => yard.current?.input ?? null;
  const pushFeed = (text: string, bad: boolean) => { const id = ++feedId.current; setFeed((f) => [...f.slice(-2), { id, text, bad }]); window.setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 4200); };

  const finish = useCallback(async () => {
    const y = yard.current; if (!y || ended.current) return; ended.current = true;
    const sim = y.sim, base: ExamResult = { cls, passed: sim.passed, score: sim.outReason ? 0 : sim.score, seconds: Math.round(sim.t), out: sim.outReason, recorded: false };
    setSheet({ rows: summarize(sim), general: sim.log.filter((l) => l.item === 0), firstBad: (sim.log.find((l) => l.item)?.item || 1) as ItemId });
    if (!sim.practice) {
      const waitMs = minUntil.current - Date.now(); if (waitMs > 0) await new Promise((r) => window.setTimeout(r, waitMs + 300)); // máy chủ không nhận bài nộp quá nhanh
      try { await api('POST', '/api/licenses/exam', { examId: examId.current, cls: props.cls, part: 'sa_hinh', score: base.score, detail: { seconds: base.seconds, out: base.out, penalties: sim.log.map((l) => ({ item: l.item, points: l.points, text: l.text })) } }); base.recorded = true; } catch { /* máy chủ chưa có phần thi sa hình: vẫn hiện kết quả */ }
    }
    setResult(base); setPhase('result');
  }, [cls, props.cls]);

  // dựng cảnh khi vào thi, dọn khi rời
  useEffect(() => {
    if (phase !== 'run' || !host.current) return;
    ended.current = false;
    const onEvent = (e: SimEvent) => {
      if (e.type === 'item' && e.item) setSay(e.text ?? '');
      else if (e.type === 'penalty') pushFeed(e.points ? `−${e.points} điểm: ${e.text}` : e.text ?? '', true);
      else if (e.type === 'ok') pushFeed(`✓ ${e.text}`, false);
      else if (e.type === 'say') { setSay(e.text ?? ''); pushFeed(e.text ?? '', /NGUY HIỂM/.test(e.text ?? '')); }
      else if (e.type === 'end') void finish();
    };
    const y = new ExamYard(host.current, cls, { onEvent, onHud: setHud }, { practice, from: practice ? from : 1, assist: 'de', guide: practice || charmed });
    yard.current = y; y.setView(view); setSay(ITEMS[(practice ? from : 1) - 1].say);
    const w = window as unknown as { __exam?: unknown; __examAuto?: boolean };
    w.__exam = {
      state: () => ({ item: y.sim.item, score: y.sim.score, t: y.sim.t, x: y.sim.x, y: y.sim.y, th: y.sim.th, v: y.sim.v, done: y.sim.done, passed: y.sim.passed, out: y.sim.outReason, log: y.sim.log, ...y.info() }),
      setInput: (p: Partial<Input>) => { y.auto = false; setAuto(false); y.input = { ...y.input, ...p }; },
      auto: (item?: ItemId) => { if (item) { y.sim.resetTo(item); } y.auto = true; setAuto(true); },
      view: (v: ExamView) => { y.setView(v); setView(v); },
      /** Người chơi giả: giữ ◀ (1) / ▶ (−1), chạm đích theo toạ độ sân, đổi mức trợ lái. */
      nudge: (n: number) => { y.auto = false; setAuto(false); y.nudge = n; },
      tap: (x: number, yy: number) => y.tapAt(x, yy),
      stops: () => y.sim.c.stops.map((st) => ({ x: st.x, y: st.y, h: st.h, state: st.state })), need: () => y.assist.need, ref: () => y.assist.ref, front: () => y.sim.front, danger: () => !!y.sim.danger,
    };
    if (w.__examAuto) { y.auto = true; setAuto(true); }
    return () => { y.dispose(); yard.current = null; delete w.__exam; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, practice, from, cls, charmed]);

  const begin = async (asPractice: boolean, item: ItemId = 1) => {
    setError(null); setFeed([]); setHud(null); setResult(null); setAuto(false);
    setCtl({ gear: 'P', left: false, right: false, hazard: false, belt: false, hand: true });
    if (!asPractice) {
      setBusy(true);
      try { const r = await api<{ examId?: number | string; minSeconds?: number; charm?: boolean }>('POST', '/api/licenses/exam/start', { cls: props.cls, part: 'sa_hinh', charm: useCharm }); examId.current = r?.examId ?? null; minUntil.current = Date.now() + (r?.minSeconds ?? 0) * 1000; setCharmed(!!r?.charm); }
      catch (e) { const msg = e instanceof Error ? e.message : ''; if (/không đủ tiền|chưa đủ cấp|lý thuyết|không cần thi/i.test(msg)) { setError(msg); setBusy(false); return; } examId.current = null; }
      setBusy(false);
    }
    if (asPractice) setCharmed(false);
    setPractice(asPractice); setFrom(item); setPhase('run');
  };
  const set = (p: Partial<typeof ctl>) => { const i = input(); const base = i ? { gear: i.gear, left: i.left, right: i.right, hazard: i.hazard, belt: i.belt, hand: i.hand } : ctl; const n = { ...base, ...p }; if (i) Object.assign(i, n); setCtl(n); if (yard.current && auto) { yard.current.auto = false; setAuto(false); } };
  const manual = () => { if (yard.current?.auto) { yard.current.auto = false; setAuto(false); const i = input(); if (i) Object.assign(i, ctl, { gas: 0, brake: 1 }); } };
  // vô-lăng: kéo ngang để đánh lái, thả tay thì giữ nguyên góc lái (như xe thật khi đi chậm)
  const turnWheel = (s: number) => { const i = input(); if (i) i.steer = s; if (wheelEl.current) wheelEl.current.style.transform = `rotate(${-s * 400}deg)`; };
  // vô-lăng nhẹ tay, có vùng chết ở giữa; trợ lái giữ xe bám làn, tay người chơi chỉ chỉnh thêm
  const wDown = (e: RPointerEvent) => { manual(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { id: e.pointerId, x: e.clientX, s: input()?.steer ?? 0 }; if (yard.current) yard.current.dragging = true; };
  const wMove = (e: RPointerEvent) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.x, eff = Math.sign(dx) * Math.max(0, Math.abs(dx) - 6) / 230; turnWheel(Math.max(-1, Math.min(1, d.s - eff))); };
  const wUp = (e: RPointerEvent) => { if (drag.current?.id === e.pointerId) { drag.current = null; if (yard.current) yard.current.dragging = false; } };
  const hold = (n: number) => ({
    onPointerDown: (e: RPointerEvent) => { e.preventDefault(); manual(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } if (yard.current) yard.current.nudge = n; setNudge(n); },
    onPointerUp: () => { if (yard.current) yard.current.nudge = 0; setNudge(0); }, onPointerCancel: () => { if (yard.current) yard.current.nudge = 0; setNudge(0); },
    onLostPointerCapture: () => { if (yard.current) yard.current.nudge = 0; setNudge(0); }, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const pedal = (k: 'gas' | 'brake', on: boolean) => (e: RPointerEvent) => { e.preventDefault(); manual(); const i = input(); if (i) i[k] = on ? 1 : 0; (e.currentTarget as HTMLElement).classList.toggle('on', on); };
  useEffect(() => { if (hud && wheelEl.current && !drag.current) wheelEl.current.style.transform = `rotate(${-hud.steer * 400}deg)`; }, [hud]);

  const body = (() => {
    if (phase === 'intro') return (
      <div className="exam-card exam-intro">
        <header><h2>Sân sát hạch · {props.title ?? spec.name}</h2><button className="exam-x" aria-label="Đóng" onClick={() => props.onClose(null)}>✕</button></header>
        <p className="exam-lead">Thi lái xe trong hình gồm <b>11 bài liên hoàn</b>, tổng 100 điểm, <b>đạt từ 80 điểm</b>, tối đa 18 phút. Lên vỉa hè, không qua vệt bánh xe, tụt dốc quá 50 cm hoặc không ghép được xe vào nơi đỗ là bị truất quyền thi.</p>
        {error && <p className="exam-err" role="alert">{error}</p>}
        <p className="exam-assist"><b>Xe có trợ lái</b><span>Xe tự bám làn và tự hãm trước vạch; bạn bấm đúng xi nhan, số, phanh tay, giữ GA/PHANH và chỉnh thêm bằng ◀ ▶. Chạm vào vạch phía trước để xe tự chạy tới và dừng đúng chỗ. Khi tập có vệt dẫn đường, khi thi thì không.</span></p>
        <div className="exam-start">
          {!props.practiceOnly && <button className="exam-go" disabled={busy} onClick={() => void begin(false)}>🏁 Thi sát hạch thật{props.fee ? <small>lệ phí {fmtMoney(props.fee)}</small> : null}</button>}
          <button className="exam-go alt" disabled={busy} onClick={() => void begin(true, 1)}>🎓 Tập cả bài<small>miễn phí, có vệt gợi ý</small></button>
        </div>
        {!props.practiceOnly && (props.charms ?? 0) > 0 && <label className="exam-charm"><input type="checkbox" checked={useCharm} onChange={(e) => setUseCharm(e.target.checked)} /> 🍀 Dùng bùa may mắn (còn {props.charms}) — lượt thi có vệt dẫn mờ, không đổi cách chấm</label>}
        <h3>Tập riêng từng bài</h3>
        <ol className="exam-items">
          {ITEMS.map((it) => (
            <li key={it.id}><button onClick={() => void begin(true, it.id)}><span className="exam-n">{it.id}</span><span className="grow"><b>{it.name}</b><small>{it.tip}</small></span><span aria-hidden="true">▶</span></button></li>
          ))}
        </ol>
        <button className="exam-link" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>{showRules ? 'Ẩn' : 'Xem'} bảng điểm trừ</button>
        {showRules && <ul className="exam-rules">{RULES.map((r, i) => <li key={i}><span>{r.item ? `Bài ${r.item}` : 'Chung'}</span><span className="grow">{r.text}</span><b className={r.points === 'truat' ? 'out' : ''}>{r.points === 'truat' ? 'truất quyền' : `−${r.points}`}</b></li>)}</ul>}
        <p className="exam-note">Điều khiển: giữ ◀ ▶ hoặc kéo vô-lăng để chỉnh lái, giữ GA hoặc PHANH, chọn số P/R/D. Nút nào cần bấm sẽ nhấp nháy. Trên máy tính dùng phím mũi tên hoặc WASD, phím cách để phanh.</p>
      </div>);
    if (phase === 'result' && result) {
      const rows = sheet?.rows ?? [], general = sheet?.general ?? [];
      return (
        <div className="exam-card exam-result" data-passed={result.passed ? '1' : '0'}>
          <header><h2>{practice ? 'Kết quả buổi tập' : 'Kết quả sát hạch'}</h2><button className="exam-x" aria-label="Đóng" onClick={() => props.onClose(practice ? null : result)}>✕</button></header>
          <div className={`exam-verdict ${result.passed ? 'ok' : 'bad'}`}><strong>{result.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</strong><span>{result.out ? `Truất quyền thi: ${result.out}` : `${result.score}/100 điểm`} · {mmss(result.seconds)}</span></div>
          {!practice && !result.recorded && <p className="exam-note">Kết quả chưa ghi được lên máy chủ; bạn có thể thi lại sau.</p>}
          <ol className="exam-rows">
            {rows.map((r) => (<li key={r.item.id} className={r.out ? 'out' : r.lost ? 'lost' : r.reached ? 'ok' : 'skip'}><span className="exam-n">{r.item.id}</span><span className="grow"><b>{r.item.name}</b>{r.notes.map((n, i) => <small key={i}>{n}</small>)}{!r.notes.length && <small>{r.reached ? 'Đạt, không bị trừ điểm' : 'Chưa thi tới'}</small>}</span><span className="exam-pt">{r.out ? '✕' : r.lost ? `−${r.lost}` : r.reached ? '✓' : '·'}</span></li>))}
            {general.length > 0 && <li className="lost"><span className="exam-n">•</span><span className="grow"><b>Lỗi chung</b>{general.map((g, i) => <small key={i}>{g.out ? `Truất quyền: ${g.text}` : `−${g.points}: ${g.text}`}</small>)}</span><span className="exam-pt">−{general.reduce((a, b) => a + b.points, 0)}</span></li>}
          </ol>
          <div className="exam-start">
            {!props.practiceOnly && <button className="exam-go" disabled={busy} onClick={() => void begin(false)}>{practice ? '🏁 Vào thi' : '🔁 Thi lại'}{props.fee ? <small>lệ phí {fmtMoney(props.fee)}</small> : null}</button>}
            <button className="exam-go alt" onClick={() => void begin(true, sheet?.firstBad ?? 1)}>🎓 Tập lại bài bị lỗi</button>
            <button className="exam-go ghost" onClick={() => props.onClose(practice ? null : result)}>Xong</button>
          </div>
        </div>);
    }
    const it = ITEMS[(hud?.item ?? from) - 1];
    const live = auto ? yard.current?.sim.input : yard.current?.input, sig = live ? { gear: live.gear, left: live.left, right: live.right, hazard: live.hazard, belt: live.belt, hand: live.hand } : ctl; // các nút hiện theo thao tác đang áp lên xe
    const need = !auto && hud ? hud.need : null, nd = (on: boolean | undefined) => (on ? ' need' : '');
    return (
      <>
        <div className="exam-scene" ref={host} />
        <div className="exam-top">
          <div className="exam-banner"><span className="exam-n">{it.id}</span><div className="grow"><b>Bài {it.id}/11 · {it.name}</b><small>{say || it.say}</small></div></div>
          <div className="exam-stats">
            <span className="exam-score" title="Điểm">{hud?.score ?? 100}<small>điểm</small></span>
            <span title="Thời gian">⏱ {mmss(hud?.t ?? 0)}</span>
            <span className={hud && hud.item !== 9 && hud.kmh > spec.limitKmh ? 'over' : ''} title="Tốc độ">{Math.round(hud?.kmh ?? 0)} km/h</span>
            {hud?.lightNear && <span className={`exam-light ${hud.light}`} aria-label={`Đèn ${hud.light === 'do' ? 'đỏ' : hud.light === 'vang' ? 'vàng' : 'xanh'}`}><i /><i /><i /></span>}
            <button className="exam-mini" onClick={() => { const v: ExamView = view === 'tren' ? 'sau' : view === 'sau' ? 'bac' : 'tren'; setView(v); yard.current?.setView(v); }}>🎥 {VIEW_NAMES[view]}</button>
            {practice && <button className={`exam-mini${auto ? ' on' : ''}`} onClick={() => { const y = yard.current; if (!y) return; if (auto) manual(); else { y.auto = true; setAuto(true); } }}>{auto ? '✋ Tự lái' : '🤖 Xem lái mẫu'}</button>}
            <button className="exam-mini quit" onClick={() => { if (practice || confirm('Bỏ bài thi? Lệ phí không được hoàn lại.')) { if (practice) setPhase('intro'); else props.onClose(null); } }}>Thoát</button>
          </div>
          {practice && hud?.hint && <div className="exam-hint">💡 {hud.hint}</div>}
          {!auto && hud && !hud.goal && hud.need.stop && <div className="exam-hint">👆 Chạm vào vạch dừng phía trước để xe tự dừng đúng chỗ</div>}
          {!auto && hud?.goal && <div className="exam-hint">🎯 Xe đang tự chạy tới điểm bạn chạm — đạp GA/PHANH để tự lái lại</div>}
          {hud?.danger && <div className="exam-danger" role="alert">⚠ TÌNH HUỐNG NGUY HIỂM: phanh dừng và bật đèn khẩn cấp!</div>}
          <div className="exam-feed" role="status">{feed.map((f) => <p key={f.id} className={f.bad ? 'bad' : 'ok'}>{f.text}</p>)}</div>
        </div>
        <div className="exam-ctl">
          <div className="exam-row">
            <div className="exam-toggles">
              <button className={(sig.left ? 'on amber' : '') + nd(need?.left)} aria-pressed={sig.left} aria-label="Xi nhan trái" onClick={() => set({ left: !sig.left, right: false })}>↰ XN</button>
              <button className={(sig.hazard ? 'on red' : '') + nd(need?.hazard)} aria-pressed={sig.hazard} aria-label="Đèn khẩn cấp" onClick={() => set({ hazard: !sig.hazard })}>⚠</button>
              <button className={(sig.right ? 'on amber' : '') + nd(need?.right)} aria-pressed={sig.right} aria-label="Xi nhan phải" onClick={() => set({ right: !sig.right, left: false })}>XN ↱</button>
              <button className={(sig.belt ? 'on green' : 'warn') + nd(need?.belt)} aria-pressed={sig.belt} onClick={() => set({ belt: !sig.belt })}>{sig.belt ? 'Đã thắt dây' : 'Thắt dây'}</button>
              <button className={(sig.hand ? 'on red' : '') + nd(need?.hand)} aria-pressed={sig.hand} onClick={() => set({ hand: !sig.hand })}>Phanh tay</button>
            </div>
            <div className="exam-gear" role="radiogroup" aria-label="Cần số">{(['P', 'R', 'D'] as Gear[]).map((g) => <button key={g} role="radio" aria-checked={sig.gear === g} className={(sig.gear === g ? 'on' : '') + nd(need?.gear === g)} onClick={() => set({ gear: g })}>{g}</button>)}</div>
          </div>
          <div className="exam-row main">
            <div className="exam-left">
              <div className="exam-steer">
              <button className={`exam-nudge${nudge === 1 ? ' on' : ''}`} aria-label="Đánh lái trái (giữ)" {...hold(1)}>◀</button>
              <div className="exam-wheel-box" onPointerDown={wDown} onPointerMove={wMove} onPointerUp={wUp} onPointerCancel={wUp} aria-label="Vô-lăng: kéo sang trái hoặc phải" role="slider" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round((hud?.steer ?? 0) * 100)}>
                <div className="exam-wheel" ref={wheelEl}><i /><i /><i /><b /></div>
              </div>
              <button className={`exam-nudge${nudge === -1 ? ' on' : ''}`} aria-label="Đánh lái phải (giữ)" {...hold(-1)}>▶</button>
              </div>
            </div>
            <div className="exam-right">
              <button className="exam-pedal brake" onPointerDown={pedal('brake', true)} onPointerUp={pedal('brake', false)} onPointerCancel={pedal('brake', false)} onPointerLeave={pedal('brake', false)} onContextMenu={(e) => e.preventDefault()}>PHANH</button>
              <button className="exam-pedal gas" onPointerDown={pedal('gas', true)} onPointerUp={pedal('gas', false)} onPointerCancel={pedal('gas', false)} onPointerLeave={pedal('gas', false)} onContextMenu={(e) => e.preventDefault()}>GA</button>
            </div>
          </div>
        </div>
      </>);
  })();
  return createPortal(<div className="exam" data-phase={phase} data-item={hud?.item ?? from} data-score={hud?.score ?? 100} data-practice={practice ? '1' : '0'}>{body}</div>, document.body);
}
