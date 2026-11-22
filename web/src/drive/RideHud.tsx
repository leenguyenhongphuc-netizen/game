// Lớp giao diện phủ trên hoạt cảnh (du lịch và xuất khẩu): tuyến đi, dải các bước, "tiếp theo", phụ đề.
// Người xem luôn biết mình đang ở bước nào và bước kế là gì. Tự chứa CSS.
import type { JSX, ReactNode } from 'react';

export interface RideStep { icon: string; label: string }

export const RIDE_CSS = `
.tr { position: fixed; left: var(--vx, 0px); top: var(--vy, 0px); width: var(--vw, 100%); height: var(--vh, 100%); z-index: 1000; background: #dff3fb; overflow: hidden; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #3b2a17; user-select: none; -webkit-user-select: none; touch-action: none; }
.tr-scene { position: absolute; inset: 0; }
.tr-top { position: absolute; top: max(10px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); display: grid; gap: 6px; justify-items: start; pointer-events: none; }
.tr-bar { box-sizing: border-box; width: 100%; max-width: 460px; background: #fff8e4; border: 3px solid #7a4a22; border-radius: 20px; box-shadow: 0 4px 0 #56310f, 0 10px 22px #3b2a1726; padding: 7px 12px 8px; min-width: 0; }
.tr-title { display: flex; align-items: center; gap: 6px; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; font-weight: 800; font-size: clamp(0.9rem, 3.8vw, 1.08rem); line-height: 1.2; min-width: 0; }
.tr-title span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tr-title b { flex-shrink: 0; }
.tr-title small { margin-left: auto; flex-shrink: 0; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 0.74rem; color: #7a5a36; font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 6px; }
.tr-steps { list-style: none; margin: 7px 0 0; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
.tr-step { position: relative; display: grid; justify-items: center; gap: 2px; min-width: 0; }
.tr-step::before { content: ''; position: absolute; top: 14px; right: 50%; width: 100%; height: 5px; background: #e6d3a3; border-radius: 3px; }
.tr-step:first-child::before { display: none; }
.tr-step i { position: absolute; top: 14px; right: 50%; height: 5px; border-radius: 3px; background: linear-gradient(#5fc46f, #2f9a4a); }
.tr-dot { position: relative; z-index: 1; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 1rem; line-height: 1; background: #f3e6c2; border: 2.5px solid #cdb67c; filter: grayscale(0.85); opacity: 0.8; transition: transform 0.25s, background 0.25s; }
.tr-step em { font-style: normal; font-weight: 700; font-size: 0.66rem; line-height: 1.15; color: #8a744f; text-align: center; max-width: 100%; overflow-wrap: anywhere; }
.tr-step.done .tr-dot { background: #dff2c8; border-color: #5fb05f; filter: none; opacity: 1; }
.tr-step.done em { color: #3f7d3f; }
.tr-step.now .tr-dot { background: #ffd95e; border-color: #7a4a22; filter: none; opacity: 1; transform: scale(1.22); box-shadow: 0 3px 0 #b8892a, 0 0 0 4px #ffd95e55; animation: tr-pulse 1.4s ease-in-out infinite; }
.tr-step.now em { color: #3b2a17; font-weight: 800; }
.tr-next { display: flex; flex-wrap: wrap; gap: 6px; max-width: 100%; }
.tr-pill { max-width: 100%; box-sizing: border-box; background: #7a4a22; color: #fff7d6; border: 3px solid #56310f; border-radius: 999px; padding: 2px 12px; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 0.9rem; line-height: 1.35; box-shadow: 0 3px 0 #2e1905; font-variant-numeric: tabular-nums; }
.tr-pill.soft { background: #fff8e4; color: #5a3d1c; border-color: #7a4a22; box-shadow: 0 3px 0 #56310f; }
.tr-pill.soft b { color: #1f7a3a; }
.tr-cap { position: absolute; left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); display: flex; justify-content: center; pointer-events: none; }
.tr-cap p { margin: 0; max-width: min(100%, 640px); box-sizing: border-box; background: rgba(46, 31, 14, 0.86); color: #fff7d6; border-radius: 16px; padding: 8px 16px; font-weight: 700; font-size: clamp(0.92rem, 3.8vw, 1.1rem); line-height: 1.3; text-align: center; text-wrap: balance; animation: tr-cap 0.35s ease-out; }
.tr-arrive { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; pointer-events: none; }
.tr-arrive > div { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: clamp(1.8rem, 8vw, 3.4rem); line-height: 1.1; text-align: center; color: #fff3b0; -webkit-text-stroke: 3px #56310f; paint-order: stroke fill; text-shadow: 0 4px 0 #0003; animation: tr-pop 0.4s cubic-bezier(0.2, 1.6, 0.4, 1); }
.tr-card { max-width: min(92%, 420px); background: #fff8e4; border: 3px solid #7a4a22; border-radius: 22px; box-shadow: 0 5px 0 #56310f, 0 16px 34px #3b2a1740; padding: 14px 18px 16px; text-align: center; animation: tr-pop 0.4s cubic-bezier(0.2, 1.6, 0.4, 1); }
.tr-card .stamp { display: inline-block; border: 3px solid #2f9a4a; color: #1f7a3a; border-radius: 10px; padding: 1px 12px; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.15rem; letter-spacing: 0.04em; text-transform: uppercase; transform: rotate(-4deg); }
.tr-card .big { margin: 8px 0 2px; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: clamp(1.25rem, 5.6vw, 1.7rem); line-height: 1.15; }
.tr-card p { margin: 0; font-weight: 600; font-size: 0.95rem; line-height: 1.35; color: #5a3d1c; }
.tr-fail { position: absolute; inset: 40% 24px auto; text-align: center; background: #fff6dc; border-radius: 14px; padding: 16px; }
@keyframes tr-pop { from { transform: scale(0.5); opacity: 0; } }
@keyframes tr-cap { from { transform: translateY(8px); opacity: 0; } }
@keyframes tr-pulse { 50% { box-shadow: 0 3px 0 #b8892a, 0 0 0 7px #ffd95e33; } }
@media (max-height: 480px) {
  .tr-top { top: max(6px, env(safe-area-inset-top)); grid-template-columns: minmax(0, auto) minmax(0, 1fr); align-items: center; gap: 8px; }
  .tr-bar { display: flex; align-items: center; gap: 10px; width: auto; max-width: 100%; padding: 4px 12px; border-radius: 16px; }
  .tr-title { flex: 0 1 auto; font-size: 0.9rem; } .tr-title small { display: none; }
  .tr-steps { margin: 0; grid-auto-columns: 40px; } .tr-step::before, .tr-step i { top: 11px; } .tr-dot { width: 26px; height: 26px; font-size: 0.85rem; }
  .tr-step em { display: none; }
  .tr-next { flex-wrap: nowrap; min-width: 0; } .tr-pill { font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .tr-cap { bottom: max(8px, env(safe-area-inset-bottom)); } .tr-cap p { padding: 5px 14px; font-size: 0.92rem; }
}
@media (max-width: 380px) { .tr-step em { font-size: 0.6rem; } .tr-dot { width: 30px; height: 30px; } }
@media (prefers-reduced-motion: reduce) { .tr-arrive > div, .tr-card, .tr-cap p, .tr-step.now .tr-dot { animation: none; } }
`;

/** Bảng trên cùng + phụ đề. `current` là thứ tự bước đang diễn (từ 0), `frac` là tiến độ 0..1 của bước đó. */
export function RideHud(p: {
  icon: string; from: string; to: string; note?: string;
  steps: RideStep[]; current: number; frac: number; finished: boolean;
  status: string; caption: string;
  children?: ReactNode;
}): JSX.Element {
  const n = p.steps.length, cur = Math.min(n - 1, Math.max(0, p.current)), next = p.steps[cur + 1];
  return (
    <>
      <div className="tr-top">
        <div className="tr-bar">
          <div className="tr-title"><b aria-hidden="true">{p.icon}</b><span>{p.from}</span><b aria-hidden="true">→</b><span>{p.to}</span>{p.note && <small>{p.note}</small>}</div>
          <ol className="tr-steps" aria-label={`Bước ${cur + 1} trên ${n}: ${p.steps[cur]?.label ?? ''}`}>
            {p.steps.map((s, i) => {
              const state = p.finished || i < cur ? 'done' : i === cur ? 'now' : '';
              // đoạn nối từ bước trước tới bước này: đầy khi đã tới, đang đầy dần khi bước trước đang diễn
              const fill = i === 0 ? 0 : p.finished || i <= cur ? 1 : i === cur + 1 ? p.frac : 0;
              return (
                <li key={i} className={`tr-step ${state}`} aria-current={i === cur && !p.finished ? 'step' : undefined}>
                  {i > 0 && <i style={{ width: `${fill * 100}%`, transform: `translateX(${-(1 - fill) * 100}%)` }} />}
                  <span className="tr-dot" aria-hidden="true">{state === 'done' && i !== n - 1 ? '✓' : s.icon}</span>
                  <em>{s.label}</em>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="tr-next">
          <span className="tr-pill">{p.status}</span>
          {!p.finished && next && <span className="tr-pill soft">Tiếp theo: <b>{next.label}</b></span>}
        </div>
      </div>
      {!p.finished && p.caption && <div className="tr-cap" role="status"><p key={p.current}>{p.caption}</p></div>}
      {p.children}
    </>
  );
}
