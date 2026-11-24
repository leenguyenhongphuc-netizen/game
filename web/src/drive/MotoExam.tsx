// Thi sa hình xe máy hạng A1/A: giới thiệu 4 bài → tập (có vệt dẫn) hoặc thi thật (thu lệ phí) → kết quả, nộp điểm lên máy chủ.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { fmtMoney } from '../../../shared/rules.ts';
import { EXAM } from '../../../shared/vehicles.ts';
import { MOTO_TESTS, MOTO_YARD } from '../../../shared/moto.ts';
import type { MotoTest } from '../../../shared/moto.ts';
import { api } from '../api.ts';
import { MotoYard } from './MotoYard.ts';
import type { YardHud, YardPenalty } from './MotoYard.ts';

export interface MotoExamResult { passed: boolean; score: number; seconds: number; out: string | null; recorded: boolean }
export interface MotoExamProps { cls: 'A1' | 'A'; title: string; fee?: number; practiceOnly?: boolean; /** Số bùa may mắn đang có (vật phẩm vui). */ charms?: number; color?: number; shirt?: number; onClose: (r: MotoExamResult | null) => void }

const CSS = `
.mx { position: fixed; inset: 0; z-index: 1200; background: #dff0f7; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #3b2a17; touch-action: none; user-select: none; -webkit-user-select: none; font-size: 14px; }
.mx *, .mx *::before, .mx *::after { box-sizing: border-box; }
.mx-scene { position: absolute; inset: 0; }
.mx-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(94vw, 460px); max-height: min(92svh, 92vh); overflow-y: auto; overflow-x: hidden; background: #fff6dc; border: 3px solid #7a4a22; border-radius: 18px; box-shadow: 0 5px 0 #56310f; padding: 14px; display: grid; gap: 10px; }
.mx-card h2 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 1.25rem; overflow-wrap: anywhere; }
.mx-card p { margin: 0; color: #5a4630; overflow-wrap: anywhere; }
.mx-card ol { margin: 0; padding-left: 1.3em; display: grid; gap: 4px; }
.mx-card li b { font-family: 'Baloo 2', sans-serif; }
.mx-row { display: flex; gap: 8px; flex-wrap: wrap; }
.mx-row button { flex: 1 1 150px; min-height: 48px; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; border: 3px solid #56310f; border-radius: 14px; background: #f6e7bd; color: #3b2a17; box-shadow: 0 3px 0 #56310f; cursor: pointer; padding: 6px 10px; }
.mx-row button.go { background: #4caf3f; color: #fff; }
.mx-row button small { display: block; font-size: 0.75rem; font-weight: 600; }
.mx-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); display: grid; gap: 6px; pointer-events: none; }
.mx-bar { background: #fff6dc; border: 3px solid #7a4a22; border-radius: 14px; box-shadow: 0 3px 0 #56310f; padding: 6px 10px; display: flex; justify-content: space-between; gap: 8px; font-weight: 700; flex-wrap: wrap; }
.mx-bar b { font-family: 'Baloo 2', sans-serif; font-size: 1.05rem; }
.mx-hint { background: #1f6fb8; color: #fff; border: 3px solid #fff; border-radius: 12px; padding: 4px 10px; font-weight: 700; font-size: 0.85rem; }
.mx-speed { justify-self: start; border-radius: 12px; padding: 4px 10px; font-weight: 800; color: #fff; border: 3px solid #fff; }
.mx-speed.vua { background: #2f8f4c; } .mx-speed.cham { background: #f08a24; } .mx-speed.nhanh { background: #c0281e; }
.mx-feed { position: absolute; left: 50%; top: 42%; transform: translateX(-50%); background: #ffe1dc; border: 3px solid #c0281e; border-radius: 14px; padding: 6px 12px; font-weight: 800; pointer-events: none; max-width: 90vw; text-align: center; }
.mx-bottom { position: absolute; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; pointer-events: none; }
.mx-g { display: flex; gap: 8px; }
.mx-btn { pointer-events: auto; touch-action: none; cursor: pointer; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; color: #3b2a17; background: #fff6dce6; border: 3px solid #7a4a22; box-shadow: 0 5px 0 #56310f; border-radius: 16px; min-width: 62px; min-height: 62px; display: grid; place-items: center; line-height: 1.05; font-size: 0.8rem; padding: 4px; }
.mx-btn i { font-style: normal; font-size: 1.4rem; display: block; }
.mx-btn.on { transform: translateY(4px); box-shadow: 0 1px 0 #56310f; }
.mx-btn.gas { background: #4caf3f; color: #fff; height: 82px; width: 74px; }
.mx-btn.brake { background: #c0392b; color: #fff; }
.mx-quit { pointer-events: auto; justify-self: end; font: inherit; font-weight: 700; min-height: 44px; min-width: 44px; border: 2px solid #7a4a22; border-radius: 12px; background: #f6e7bd; padding: 4px 10px; cursor: pointer; }
.mx-err { color: #c0281e; font-weight: 700; }
.mx-charm { display: flex; gap: 8px; align-items: center; font-weight: 700; font-size: 0.86rem; background: #eaf7e2; border: 2px solid #7cc36b; border-radius: 12px; padding: 6px 10px; }
.mx-charm input { width: 22px; height: 22px; flex: none; }
.mx-luck { justify-self: start; background: #2f8f4c; color: #fff; border: 3px solid #fff; border-radius: 12px; padding: 2px 10px; font-weight: 800; font-size: 0.8rem; }
`;

export function MotoExam(p: MotoExamProps): JSX.Element {
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [practice, setPractice] = useState(!!p.practiceOnly);
  const [hud, setHud] = useState<YardHud | null>(null);
  const [feed, setFeed] = useState<{ id: number; text: string } | null>(null);
  const [result, setResult] = useState<MotoExamResult & { log: YardPenalty[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [useCharm, setUseCharm] = useState(false), [charmed, setCharmed] = useState(false);
  const host = useRef<HTMLDivElement>(null), yard = useRef<MotoYard | null>(null), examId = useRef<number | string | null>(null), minUntil = useRef(0);

  useEffect(() => () => { yard.current?.dispose(); yard.current = null; }, []);
  const begin = async (asPractice: boolean) => {
    setError(null); setBusy(true); let luck = false;
    if (!asPractice) {
      try { const r = await api<{ examId?: number | string; minSeconds?: number; charm?: boolean }>('POST', '/api/licenses/exam/start', { cls: p.cls, part: 'sa_hinh', charm: useCharm }); examId.current = r?.examId ?? null; minUntil.current = Date.now() + (r?.minSeconds ?? 0) * 1000; luck = !!r?.charm; }
      catch (e) { setError(e instanceof Error ? e.message : 'Chưa vào thi được.'); setBusy(false); return; }
    }
    setCharmed(luck);
    setBusy(false); setPractice(asPractice); setResult(null); setHud(null); setPhase('run');
    window.setTimeout(() => {
      yard.current?.dispose();
      try {
        yard.current = new MotoYard(host.current!, {
          cls: p.cls, style: p.cls === 'A' ? 'con_tay' : 'so', color: p.color ?? 0xc0392b, shirt: p.shirt ?? 0x2f7fd8, guide: asPractice || luck,
          onTick: setHud,
          onPenalty: (x) => { const id = Date.now(); setFeed({ id, text: x.points ? `−${x.points} điểm: ${x.text}` : `Truất quyền: ${x.text}` }); window.setTimeout(() => setFeed((f) => (f?.id === id ? null : f)), 2200); },
          onDone: (r) => void end(r, asPractice),
        });
        if ((window as unknown as { __motoAuto?: boolean }).__motoAuto) yard.current.auto = true;
      } catch (e) { setError(e instanceof Error ? e.message : 'Máy không dựng được cảnh 3D.'); setPhase('intro'); }
    }, 30);
  };
  const end = async (r: { score: number; out: string | null; seconds: number; log: YardPenalty[] }, asPractice: boolean) => {
    const passed = !r.out && r.score >= EXAM.sa_hinh.pass;
    const base = { passed, score: r.score, seconds: r.seconds, out: r.out, recorded: false, log: r.log };
    if (!asPractice) {
      const wait = minUntil.current - Date.now(); if (wait > 0) await new Promise((res) => window.setTimeout(res, wait + 200));
      try { await api('POST', '/api/licenses/exam', { examId: examId.current, cls: p.cls, part: 'sa_hinh', score: r.score }); base.recorded = true; } catch (e) { setError(e instanceof Error ? e.message : null); }
    }
    setResult(base); setPhase('result');
    window.setTimeout(() => { yard.current?.dispose(); yard.current = null; }, 50);
  };
  const hold = (which: 'gas' | 'brake' | 'l' | 'r') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } const y = yard.current; if (!y) return; if (which === 'gas') y.setGas(1); else if (which === 'brake') y.setBrake(1); else y.setSteer(which === 'l' ? -1 : 1); setHeld(which); },
    onPointerUp: () => { const y = yard.current; y?.setGas(0); y?.setBrake(0); y?.setSteer(0); setHeld(null); },
    onPointerCancel: () => { const y = yard.current; y?.setGas(0); y?.setBrake(0); y?.setSteer(0); setHeld(null); },
  });
  const close = () => p.onClose(result && !practice ? { passed: result.passed, score: result.score, seconds: result.seconds, out: result.out, recorded: result.recorded } : null);

  const ui = (
    <div className="mx" role="application" aria-label={`Sân sát hạch xe máy ${p.title}`}>
      <style>{CSS}</style>
      <div className="mx-scene" ref={host} />
      {phase === 'intro' && (
        <div className="mx-card" role="dialog" aria-label="Giới thiệu bài thi">
          <h2>🏍️ Sân sát hạch xe máy · {p.title}</h2>
          <p>Đi liên hoàn 4 bài, thang 100 điểm, đạt từ {EXAM.sa_hinh.pass}. Chạm vạch, chống chân mỗi lần trừ {MOTO_YARD.touchLine} điểm; đi ra ngoài hình là truất quyền. Xe tự bám đường mẫu: bạn giữ ga, phanh cho đúng tốc độ từng bài, ◀ ▶ chỉnh nhẹ khi xe lệch.</p>
          <ol>{(Object.keys(MOTO_TESTS) as MotoTest[]).map((k) => <li key={k}><b>{MOTO_TESTS[k].name}</b>: {MOTO_TESTS[k].how}</li>)}</ol>
          {error && <p className="mx-err" role="alert">{error}</p>}
          <div className="mx-row">
            <button onClick={() => void begin(true)} disabled={busy}>🎓 Tập thử<small>miễn phí, có vệt dẫn</small></button>
            {!p.practiceOnly && <button className="go" onClick={() => void begin(false)} disabled={busy}>🏁 Thi sát hạch thật{p.fee ? <small>lệ phí {fmtMoney(p.fee)}</small> : null}</button>}
          </div>
          {!p.practiceOnly && (p.charms ?? 0) > 0 && <label className="mx-charm"><input type="checkbox" checked={useCharm} onChange={(e) => setUseCharm(e.target.checked)} /> 🍀 Dùng bùa may mắn (còn {p.charms}) — vệt dẫn mờ và lời nhắc ở chỗ khó, không đổi cách chấm</label>}
          <div className="mx-row"><button onClick={() => p.onClose(null)}>Đóng</button></div>
        </div>
      )}
      {phase === 'run' && (
        <>
          <div className="mx-top">
            <div className="mx-bar"><span>{practice ? 'Tập' : 'Thi'} · <b>{hud?.testName ?? 'Xuất phát'}</b></span><span>Điểm <b>{hud?.score ?? 100}</b> · {hud?.seconds ?? 0}s</span></div>
            {hud && <div className="mx-hint">{hud.hint}</div>}
            {charmed && !practice && <div className="mx-luck">🍀 Bùa may mắn: có vệt dẫn đường</div>}
            {hud && <div className={`mx-speed ${hud.speedOk}`}>{hud.kmh} km/h · {hud.speedOk === 'cham' ? 'quá chậm' : hud.speedOk === 'nhanh' ? 'quá nhanh' : 'vừa'}</div>}
            <button className="mx-quit" onClick={() => { if (practice || confirm('Bỏ bài thi? Lệ phí không được hoàn lại.')) { yard.current?.dispose(); yard.current = null; setPhase('intro'); } }}>Thoát</button>
          </div>
          {feed && <div className="mx-feed" role="status" key={feed.id}>{feed.text}</div>}
          <div className="mx-bottom">
            <div className="mx-g"><button className={`mx-btn${held === 'l' ? ' on' : ''}`} aria-label="Chỉnh sang trái" {...hold('l')}><i>◀</i>Trái</button><button className={`mx-btn${held === 'r' ? ' on' : ''}`} aria-label="Chỉnh sang phải" {...hold('r')}><i>▶</i>Phải</button></div>
            <div className="mx-g"><button className={`mx-btn brake${held === 'brake' ? ' on' : ''}`} aria-label="Phanh (giữ)" {...hold('brake')}><i>■</i>Phanh</button><button className={`mx-btn gas${held === 'gas' ? ' on' : ''}`} aria-label="Ga (giữ)" {...hold('gas')}><i>▲</i>Ga</button></div>
          </div>
        </>
      )}
      {phase === 'result' && result && (
        <div className="mx-card" role="dialog" aria-label="Kết quả">
          <h2>{result.passed ? '🎉 Đạt' : '😓 Chưa đạt'} · {result.score}/100</h2>
          <p>{practice ? 'Buổi tập không tính điểm.' : result.passed ? `Đã đạt sa hình ${p.title}.` : result.out ? `Truất quyền: ${result.out}.` : `Cần từ ${EXAM.sa_hinh.pass} điểm.`} Thời gian {result.seconds} giây.</p>
          {result.log.length > 0 && <ol>{result.log.map((l, i) => <li key={i}>{l.points ? `−${l.points}: ` : ''}{l.text}</li>)}</ol>}
          {error && <p className="mx-err" role="alert">{error}</p>}
          <div className="mx-row">
            <button onClick={() => void begin(true)}>🎓 Tập lại</button>
            {!p.practiceOnly && !(result.passed && !practice) && <button className="go" onClick={() => void begin(false)}>{practice ? '🏁 Vào thi' : '🔁 Thi lại'}{p.fee ? <small>lệ phí {fmtMoney(p.fee)}</small> : null}</button>}
            <button onClick={close}>Xong</button>
          </div>
        </div>
      )}
    </div>
  );
  return createPortal(ui, document.body);
}
