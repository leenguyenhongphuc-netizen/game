// Lò lai tạo & phối trộn: lai giống (nhà vườn), phối hộp quà và ghép máy (chủ xưởng). Tỉ lệ thành công luôn hiện rõ.
import { useCallback, useEffect, useState } from 'react';
import { CROPS, SPECIALTIES } from '../../shared/catalog.ts';
import { fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import './progress.css';

type Kind = 'giong' | 'san_pham' | 'may';
interface Recipe {
  id: string; kind: Kind; name: string; emoji: string; note: string;
  inputs: { type: string; count: number; kgEach?: number; quality?: string; rule: string }[];
  extras: { cost: number | null; boostCost: number | null; costRule?: string };
  successRate: number; boostedRate: number; keepOnFail: number;
  result: { type: string; name?: string; note: string; packets?: number; boxes?: number };
  minLevel: number; have: boolean; options: unknown[]; whyNot: string | null;
}
interface SeedRow { specialtyId: string; trait: string; qty: number; name: string; effect: string }
interface BoxRow { boxId: string; name: string; emoji: string; qty: number; value: number; exportValue: number }
export interface FusionData {
  level: number; role: string | null; cash: number; recipes: Recipe[]; seeds: SeedRow[]; boxes: BoxRow[];
  boxExport: { bonus: number; minBoxes: number; minLevel: number };
  history: { recipeId: string; success: boolean; at: number }[]; rule: string;
}
interface FusionOut { ok: boolean; success: boolean; successRate: number; result: { type: string; name?: string; packets?: number; boxes?: number; value?: number; level?: number } | null; kept: unknown; spent: number; cash: number; xpGained?: number }

const TABS: { kind: Kind; label: string; icon: string }[] = [{ kind: 'giong', label: 'Lai giống', icon: '🌱' }, { kind: 'san_pham', label: 'Hộp quà', icon: '🎁' }, { kind: 'may', label: 'Ghép máy', icon: '🛠️' }];
const pct = (r: number) => `${Math.round(r * 100)}%`;
const spName = (id: unknown) => SPECIALTIES[String(id)]?.name ?? String(id);
const spEmoji = (id: unknown) => { const sp = SPECIALTIES[String(id)]; return sp ? CROPS[sp.crop]?.emoji ?? '🌿' : '🌿'; };
const CONFETTI = ['#e2573c', '#ffcf3a', '#4caf3f', '#4aa3d8', '#b56cd8', '#ff8a3d'];

/** Một công thức: chọn nguyên liệu, xem tỉ lệ, bấm dung hợp. */
function RecipeCard({ r, cash, busy, onRun }: { r: Recipe; cash: number; busy: boolean; onRun: (inputs: unknown[], boost: boolean) => void }) {
  const need = r.inputs[0]?.count ?? 2;
  const [pairIdx, setPairIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [boost, setBoost] = useState(false);
  const pairs = r.kind === 'san_pham' ? [] : (r.options as unknown[][]);
  const singles = r.kind === 'san_pham' ? (r.options as string[]) : [];
  const chosen: unknown[] = r.kind === 'san_pham' ? picked : pairs[Math.min(pairIdx, Math.max(0, pairs.length - 1))] ?? [];
  const ready = chosen.length === need, canBoost = r.boostedRate > r.successRate;
  const rate = boost && canBoost ? r.boostedRate : r.successRate;
  const cost = (r.extras.cost ?? 0) + (boost && canBoost ? r.extras.boostCost ?? 0 : 0);
  const label = (x: unknown) => (r.kind === 'may' ? `Máy số ${x}` : spName(x));
  const icon = (x: unknown) => (r.kind === 'may' ? '⚙️' : spEmoji(x));
  const locked = !!r.whyNot;
  return (
    <section className={`fu-recipe${locked ? ' off' : ''}`} data-recipe={r.id}>
      <header><span className="emoji" aria-hidden="true">{r.emoji}</span><div><strong>{r.name}</strong><small>Mở ở cấp {r.minLevel}</small></div></header>
      <p className="fu-note">{r.note}</p>
      <div className="fu-slots" aria-label="Nguyên liệu và kết quả">
        <div className="fu-in">
        {Array.from({ length: need }, (_, i) => {
          const x = chosen[i];
          return (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="fu-plus" aria-hidden="true">+</span>}
              <button type="button" className={`fu-slot${x !== undefined ? ' filled' : ''}`} disabled={locked || r.kind !== 'san_pham' || x === undefined} onClick={() => setPicked(picked.filter((p) => p !== x))}
                aria-label={x !== undefined ? `${label(x)}${r.kind === 'san_pham' ? ', bấm để bỏ ra' : ''}` : `Ô nguyên liệu ${i + 1} đang trống`}>
                {x !== undefined ? <><span className="emoji" aria-hidden="true">{icon(x)}</span>{label(x)}{r.inputs[0]?.kgEach ? <small>{r.inputs[0].kgEach} kg</small> : null}</> : <small>Chọn bên dưới</small>}
              </button>
            </span>
          );
        })}
        </div>
        <div className="fu-out"><span className="fu-arrow" aria-hidden="true">➜</span>
        <div className="fu-result">{r.result.name ?? (r.kind === 'may' ? 'Máy cao hơn 1 cấp' : 'Kết quả')}<small>{r.result.packets ? `${r.result.packets} gói` : r.result.boxes ? `${r.result.boxes} hộp` : ''}</small></div>
        </div>
      </div>
      <small>{r.inputs[0]?.rule}. {r.result.note}</small>
      {!locked && r.kind !== 'san_pham' && pairs.length > 0 && (
        <div className="fu-opts" role="group" aria-label="Chọn cặp nguyên liệu">
          {pairs.map((p, i) => <button type="button" key={i} aria-pressed={i === pairIdx} onClick={() => setPairIdx(i)}><span aria-hidden="true">{icon(p[0])}</span>{label(p[0])} + {label(p[1])}</button>)}
        </div>
      )}
      {!locked && r.kind === 'san_pham' && (
        <div className="fu-opts" role="group" aria-label="Chọn thành phẩm bỏ vào hộp">
          {singles.map((id) => {
            const on = picked.includes(id);
            return <button type="button" key={id} aria-pressed={on} disabled={!on && picked.length >= need} onClick={() => setPicked(on ? picked.filter((p) => p !== id) : [...picked, id])}><span aria-hidden="true">{spEmoji(id)}</span>{spName(id)}</button>;
          })}
        </div>
      )}
      <div className="fu-rate">
        <b>{pct(rate)}</b>
        <div className="bar" role="progressbar" aria-label="Tỉ lệ thành công" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rate * 100)}><i style={{ width: pct(rate) }} /></div>
        <small>Tỉ lệ thành công. Nếu hỏng: {r.keepOnFail >= 1 ? 'giữ nguyên toàn bộ, chỉ mất tiền vật tư' : `được trả lại ${pct(r.keepOnFail)} nguyên liệu`}.</small>
      </div>
      {canBoost && !locked && (
        <label className="fu-boost">
          <input type="checkbox" checked={boost} onChange={(e) => setBoost(e.target.checked)} />
          <span>Thêm vật tư tăng tỉ lệ lên <b>{pct(r.boostedRate)}</b>{r.extras.boostCost !== null ? ` · thêm ${fmtMoney(r.extras.boostCost)}` : ' · tính theo giá linh kiện'}</span>
        </label>
      )}
      {locked ? <p className="fu-why">{r.whyNot}</p> : (
        <button type="button" className="go fu-go" disabled={busy || !ready || cash < cost} onClick={() => onRun(chosen, boost && canBoost)}>
          Dung hợp<small>{!ready ? `chọn đủ ${need} nguyên liệu` : cash < cost ? 'chưa đủ tiền vật tư' : r.extras.cost !== null ? `vật tư ${fmtMoney(cost)}` : r.extras.costRule ?? ''}</small>
        </button>
      )}
    </section>
  );
}

/** Lò lai tạo & phối trộn. `refresh` để App tải lại tiền, kho sau mỗi lần dung hợp hay bán hộp quà. */
export function FusionPanel({ me, refresh }: { me: Me; refresh: () => void }) {
  const [data, setData] = useState<FusionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Kind>(me.user.role === 'xuong' ? 'san_pham' : 'giong');
  const [stage, setStage] = useState<{ phase: 'shake' | 'ok' | 'fail'; recipe: Recipe; out?: FusionOut; error?: string } | null>(null);
  const load = useCallback(() => api<FusionData>('GET', '/api/fusion').then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e instanceof Error ? e.message : 'Không tải được.')), []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); refresh(); });

  const run = async (r: Recipe, inputs: unknown[], boost: boolean) => {
    setStage({ phase: 'shake', recipe: r });
    const wait = new Promise((ok) => window.setTimeout(ok, (window as unknown as { __rideStep?: number }).__rideStep ? 200 : 1300));
    try {
      const [out] = await Promise.all([api<FusionOut>('POST', '/api/fusion', { recipeId: r.id, inputs, boost }), wait]);
      setStage({ phase: out.success ? 'ok' : 'fail', recipe: r, out });
    } catch (e) { await wait; setStage({ phase: 'fail', recipe: r, error: e instanceof Error ? e.message : 'Có lỗi xảy ra.' }); }
    void load(); refresh();
  };

  if (loadError) return <p className="error" role="alert">{loadError}</p>;
  if (!data) return <p className="hint">Đang nhóm lò…</p>;
  const list = data.recipes.filter((r) => r.kind === tab);
  const nameOf = (id: string) => data.recipes.find((r) => r.id === id)?.name ?? id;
  const out = stage?.out;
  return (
    <div className="fusion" data-tab={tab}>
      <p className="muted">Gộp nguyên liệu để tạo ra thứ đặc biệt. Tỉ lệ thành công ghi rõ ở từng công thức; hỏng thì vẫn được giữ lại một phần.</p>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button type="button" role="tab" key={t.kind} aria-selected={tab === t.kind} onClick={() => setTab(t.kind)}><span aria-hidden="true">{t.icon} </span>{t.label}</button>)}
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {list.map((r) => <RecipeCard key={r.id} r={r} cash={Math.max(data.cash, me.user.cash)} busy={!!stage || act.busy} onRun={(inputs, boost) => void run(r, inputs, boost)} />)}
      {list.length === 0 && <p className="hint">Chưa có công thức nào ở mục này.</p>}

      {tab === 'giong' && (
        <>
          <h3>Kho giống lai ({data.seeds.reduce((a, s) => a + s.qty, 0)} gói)</h3>
          {data.seeds.length === 0 && <p className="hint">Chưa có gói giống nào. Lai thành công thì giống nằm ở đây; khi trồng, chọn giống lai ở bảng chọn giống.</p>}
          {data.seeds.map((s) => (
            <div className="fu-item" key={`${s.specialtyId}:${s.trait}`}><span className="emoji" aria-hidden="true">{spEmoji(s.specialtyId)}</span><div><strong>{s.name}</strong><small>{s.effect}</small></div><span className="tag">{s.qty} gói</span></div>
          ))}
        </>
      )}
      {tab === 'san_pham' && (
        <>
          <h3>Hộp quà trong kho</h3>
          {data.boxes.length === 0 && <p className="hint">Chưa có hộp quà nào.</p>}
          {data.boxes.map((b) => {
            const canExport = b.qty >= data.boxExport.minBoxes && data.level >= data.boxExport.minLevel;
            return (
              <div className="fu-item box" key={b.boxId} data-box={b.boxId}>
                <span className="emoji" aria-hidden="true">{b.emoji}</span>
                <div><strong>{b.name}</strong><small>{b.qty} hộp · {fmtMoney(b.value)}/hộp</small></div>
                <div className="acts">
                  <button type="button" disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/fusion/boxes/sell', { boxId: b.boxId, qty: b.qty, channel: 'doanh_nghiep' }))}>Bán doanh nghiệp<small>{fmtMoney(b.value * b.qty)}</small></button>
                  <button type="button" className="go" disabled={act.busy || !canExport} onClick={() => act.run(() => api('POST', '/api/fusion/boxes/sell', { boxId: b.boxId, qty: b.qty, channel: 'xuat_khau' }))}>
                    Xuất khẩu<small>{canExport ? fmtMoney(b.exportValue * b.qty) : data.level < data.boxExport.minLevel ? `cần cấp ${data.boxExport.minLevel}` : `từ ${data.boxExport.minBoxes} hộp`}</small>
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {data.history.length > 0 && (
        <>
          <h3>Lần gần đây</h3>
          {data.history.map((h, i) => <div className="fu-hist" key={i}><span>{nameOf(h.recipeId)}</span><b style={{ color: h.success ? 'var(--green-dark)' : 'var(--danger)' }}>{h.success ? 'Thành công' : 'Hỏng'}</b></div>)}
        </>
      )}
      <p className="fu-rule">{data.rule}</p>

      {stage && (
        <div className="fu-stage" role="dialog" aria-label="Đang dung hợp" data-phase={stage.phase}>
          <div className={`fu-box ${stage.phase}`}>
            {stage.phase === 'ok' && <div className="fu-confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 7) * 0.08}s` }} />)}</div>}
            {stage.phase === 'fail' && <div className="fu-smoke" aria-hidden="true">{[-50, -18, 14, 46].map((dx, i) => <i key={i} style={{ ['--dx' as string]: `${dx}px`, animationDelay: `${i * 0.12}s` }} />)}</div>}
            <div className="fu-pot" aria-hidden="true">{stage.phase === 'ok' ? stage.recipe.emoji : stage.phase === 'fail' ? '💨' : '⚗️'}</div>
            {stage.phase === 'shake' && <><h3>Đang dung hợp…</h3><p>{stage.recipe.name}</p></>}
            {stage.phase === 'ok' && out && (
              <>
                <h3>Thành công!</h3>
                <p>
                  {out.result?.type === 'giong' && <>Nhận <b>{out.result.packets} gói</b> {out.result.name}.</>}
                  {out.result?.type === 'hop_qua' && <>Nhận <b>{out.result.boxes} hộp</b> {out.result.name}, mỗi hộp trị giá {fmtMoney(out.result.value ?? 0)}.</>}
                  {out.result?.type === 'may' && <>Hai máy đã ráp thành <b>một máy cấp {out.result.level}</b>.</>}
                  <br /><small>Tỉ lệ lần này {pct(out.successRate)}{out.spent > 0 ? ` · vật tư ${fmtMoney(out.spent)}` : ''}{out.xpGained ? ` · +${out.xpGained} EXP` : ''}</small>
                </p>
              </>
            )}
            {stage.phase === 'fail' && (
              <>
                <h3>{stage.error ? 'Chưa dung hợp được' : 'Lần này hỏng rồi'}</h3>
                <p>
                  {stage.error ?? (stage.recipe.kind === 'may' ? 'Hai máy vẫn còn nguyên, chỉ mất tiền linh kiện.' : `Bạn được trả lại ${pct(stage.recipe.keepOnFail)} nguyên liệu.`)}
                  {out && <><br /><small>Tỉ lệ lần này {pct(out.successRate)}{out.spent > 0 ? ` · vật tư ${fmtMoney(out.spent)}` : ''}</small></>}
                </p>
              </>
            )}
            {stage.phase !== 'shake' && <button type="button" className="primary" onClick={() => setStage(null)}>Đã hiểu</button>}
          </div>
        </div>
      )}
    </div>
  );
}
