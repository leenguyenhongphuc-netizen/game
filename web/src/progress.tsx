// Con đường thăng hạng: cấp, danh hiệu, 30 mốc mở khoá, việc hôm nay, thành tựu, EXP đến từ đâu.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';
import './progress.css';

interface LevelRow { level: number; title: string; xp: number; reward: number; unlocks: string[] }
interface Quest { id: string; text: string; progress: number; goal: number; reward: { xp: number; cash: number }; done: boolean; claimed: boolean }
interface XpRule { source: string; label: string; xp: number; dailyCap?: number; perValue?: number; maxBonus?: number; todayXp: number }
export interface ProgressData {
  xp: number; level: number; title: string; nextXp: number | null; prevXp: number; maxLevel: number;
  unlocks?: LevelRow[]; nextUnlocks: LevelRow[]; levels: LevelRow[]; levelRewards: { level: number; reward: number; claimed: boolean }[];
  daily: Quest[]; dailyResetsAt: number; achievements: Quest[]; xpLog: { at: number; source: string; label: string; xp: number }[]; xpRules: XpRule[];
}

const num = (n: number) => n.toLocaleString('vi-VN');
const Shield = () => (
  <svg viewBox="0 0 64 72" aria-hidden="true">
    <path d="M32 3 59 12v24c0 16-11 26-27 33C16 62 5 52 5 36V12z" fill="#ffcf3a" stroke="#56310f" strokeWidth="3" strokeLinejoin="round" />
    <path d="M32 9 53 16v20c0 12-8 20-21 26C19 56 11 48 11 36V16z" fill="#ffe27a" stroke="#c98a00" strokeWidth="1.6" />
  </svg>
);
const rewardText = (r: { xp: number; cash: number }) => [r.xp > 0 ? `+${num(r.xp)} EXP` : '', r.cash > 0 ? `+${fmtMoney(r.cash)}` : ''].filter(Boolean).join(' · ');

function QuestRow({ q, busy, onClaim }: { q: Quest; busy: boolean; onClaim: () => void }) {
  const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100));
  return (
    <div className={`prog-quest${q.done ? ' done' : ''}${q.claimed ? ' claimed' : ''}`}>
      <p>{q.text}</p>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.goal} aria-valuenow={Math.min(q.progress, q.goal)}><i style={{ width: `${pct}%` }} /></div>
      <small>{num(Math.min(q.progress, q.goal))}/{num(q.goal)} · {rewardText(q.reward)}</small>
      {q.claimed ? <span className="tag">Đã nhận ✓</span> : <button type="button" className={q.done ? 'go' : ''} disabled={!q.done || busy} onClick={onClaim}>{q.done ? 'Nhận' : 'Chưa xong'}</button>}
    </div>
  );
}

/** Bảng tiến trình nhân vật. `refresh` để App tải lại tiền và cấp sau khi nhận thưởng. */
export function ProgressPanel({ me, refresh }: { me: Me; refresh: () => void }) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'chua' | 'xong'>('chua');
  const [now, setNow] = useState(Date.now());
  const road = useRef<HTMLOListElement>(null), scrolled = useRef(false);
  const load = useCallback(() => api<ProgressData>('GET', '/api/progress').then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e instanceof Error ? e.message : 'Không tải được.')), []);
  useEffect(() => { void load(); }, [load, me.user.cash]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const act = useAction(() => { void load(); refresh(); });
  // lần đầu có dữ liệu: cuộn đường đi tới cấp hiện tại
  useEffect(() => {
    if (!data || scrolled.current || !road.current) return; scrolled.current = true;
    const el = road.current.querySelector<HTMLElement>('li.now'); if (el) road.current.scrollTop = Math.max(0, el.offsetTop - 60);
  }, [data]);

  if (loadError) return <p className="error" role="alert">{loadError}</p>;
  if (!data) return <p className="hint">Đang mở con đường thăng hạng…</p>;
  const span = (data.nextXp ?? data.xp) - data.prevXp, pct = data.nextXp === null ? 100 : Math.max(0, Math.min(100, Math.round(((data.xp - data.prevXp) / Math.max(1, span)) * 100)));
  const claimable = new Map(data.levelRewards.map((r) => [r.level, r]));
  const next = data.nextUnlocks[0];
  const ach = data.achievements.filter((a) => (filter === 'xong' ? a.done : !a.done));
  const doneCount = data.achievements.filter((a) => a.done).length;

  return (
    <div className="prog" data-level={data.level}>
      <div className="prog-head">
        <div className="prog-shield"><Shield /><b>{data.level}</b></div>
        <div>
          <strong>{data.title}</strong>
          <small>{data.nextXp === null ? `${num(data.xp)} EXP · đã đạt cấp cao nhất` : `${num(data.xp)} / ${num(data.nextXp)} EXP · còn ${num(data.nextXp - data.xp)} nữa lên cấp ${data.level + 1}`}</small>
          <div className="prog-xp" role="progressbar" aria-label="Điểm kinh nghiệm" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        </div>
        {next && <div className="prog-next">Cấp {next.level} <b>{next.title}</b> mở: {next.unlocks.length ? next.unlocks.join(' · ') : 'thưởng tiền'}</div>}
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}

      <h3>Việc hôm nay <span className="prog-count">làm mới sau {fmtDuration(data.dailyResetsAt - now)}</span></h3>
      <div className="prog-list">
        {data.daily.map((q) => <QuestRow key={q.id} q={q} busy={act.busy} onClaim={() => act.run(() => api('POST', `/api/progress/daily/${q.id}/claim`, {}))} />)}
        {data.daily.length === 0 && <p className="hint">Hôm nay chưa có việc nào.</p>}
      </div>

      <h3>Con đường {data.maxLevel} cấp</h3>
      <ol className="prog-road" ref={road} aria-label="Các cấp và thứ mở khoá">
        {data.levels.map((l) => {
          const state = l.level < data.level ? 'got' : l.level === data.level ? 'now' : 'later', rw = claimable.get(l.level);
          return (
            <li key={l.level} className={state} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="prog-node" aria-hidden="true">{l.level}</span>
              <div className="t">
                <strong>{l.title}</strong>
                <small>{l.level === 1 ? 'Bắt đầu' : `${num(l.xp)} EXP`}{state === 'now' ? ' · bạn đang ở đây' : ''}</small>
                {l.unlocks.length > 0 && <ul>{l.unlocks.map((u, i) => <li key={i}>{u}</li>)}</ul>}
              </div>
              <div className="r">
                {l.reward > 0 && <span className="prog-coin">🪙 {fmtMoney(l.reward)}</span>}
                {rw && !rw.claimed && <button type="button" className="go" disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/progress/levels/${l.level}/claim`, {}))}>Nhận thưởng</button>}
                {rw?.claimed && l.reward > 0 && <span className="tag">Đã nhận ✓</span>}
              </div>
            </li>
          );
        })}
      </ol>

      <h3>Thành tựu <span className="prog-count">{doneCount}/{data.achievements.length} đã đạt</span></h3>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={filter === 'chua'} onClick={() => setFilter('chua')}>Đang theo đuổi</button>
        <button type="button" role="tab" aria-selected={filter === 'xong'} onClick={() => setFilter('xong')}>Đã đạt</button>
      </div>
      <div className="prog-list">
        {ach.map((q) => <QuestRow key={q.id} q={q} busy={act.busy} onClaim={() => act.run(() => api('POST', `/api/progress/achievements/${q.id}/claim`, {}))} />)}
        {ach.length === 0 && <p className="hint">{filter === 'xong' ? 'Chưa đạt thành tựu nào. Cứ chơi đều, mốc đầu tiên tới rất nhanh.' : 'Bạn đã đạt hết các thành tựu hiện có.'}</p>}
      </div>

      <details>
        <summary>EXP đến từ đâu</summary>
        {data.xpRules.map((r) => (
          <div className="prog-rule" key={r.source}>
            <span>{r.label}</span><b>+{num(r.xp)} EXP</b>
            <small>
              {[r.perValue && r.maxBonus ? `thêm theo giá trị giao dịch, tối đa +${num(r.maxBonus)}` : '', r.dailyCap ? `trần ${num(r.dailyCap)} EXP mỗi ngày` : 'không giới hạn mỗi ngày', r.todayXp > 0 ? `hôm nay đã nhận ${num(r.todayXp)}` : ''].filter(Boolean).join(' · ')}
            </small>
          </div>
        ))}
      </details>
      <details>
        <summary>Vừa nhận</summary>
        {data.xpLog.length === 0 && <p className="hint">Chưa có dòng nào.</p>}
        {data.xpLog.map((x, i) => <div className="prog-log" key={i}><span>{x.label}</span><b>+{num(x.xp)} EXP</b></div>)}
      </details>
    </div>
  );
}
