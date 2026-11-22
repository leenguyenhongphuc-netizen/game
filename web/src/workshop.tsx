// Xưởng chế biến theo dây chuyền: nguyên liệu trong kho → dàn máy → thành phẩm → siêu thị, xuất khẩu hoặc doanh nghiệp.
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { CROPS, SPECIALTIES } from '../../shared/catalog.ts';
import { MACHINES, QUALITY_MULT, QUALITY_NAMES, ROLE_INFO, fmtMoney, machineStats } from '../../shared/rules.ts';
import type { MachineKind, Quality } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { WhyLimit } from './trade.tsx';
import { fmtDuration, useAction } from './ui.ts';

interface Job { id: number; machineId: number | null; specialtyId: string; recipeId: string; kgIn: number; kgOut: number; readyAt: number }
interface Machine { id: number; kind: MachineKind; name: string; emoji: string; level: number; slots: number; time: number; recipes: string[]; support: boolean; bonus: { yield?: number; value?: number; grade?: number } | null; upgradeCost: number | null; jobs: Job[] }
interface RecipeRow { id: string; name: string; emoji: string; ratio: number; value: number; hours: number; machines: MachineKind[] }
interface StockRow { specialtyId: string; quality: Quality; kg: number; recipeId: string; machineKinds: MachineKind[]; canProcess: boolean }
interface ProductRow { specialtyId: string; kg: number; name: string; recipeId: string; refPrice: number }
interface CatalogRow { kind: MachineKind; name: string; emoji: string; price: number; slots: number; recipes: string[]; bonus?: { yield?: number; value?: number; grade?: number }; note: string; owned: number; canBuy: boolean }
interface WorkshopData {
  slots: number; jobs: Job[]; products: { specialtyId: string; kg: number }[];
  isWorkshop?: boolean; machines?: Machine[]; catalog?: CatalogRow[]; recipes?: RecipeRow[]; stock?: StockRow[]; productInfo?: ProductRow[];
  bonus?: { yield: number; value: number; grade: number }; runFeePerKg?: number; energyCost?: number; maxMachines?: number; maxPerKind?: number; maxLevel?: number;
}
export type WorkshopExit = 'cho' | 'sieuthi' | 'xuatkhau';

const O = '#56310f', S = { stroke: O, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
/** Hình vẽ riêng cho từng loại máy; `run` bật hoạt ảnh hơi nước, băng chuyền. */
const ART: Record<MachineKind, JSX.Element> = {
  may_say: (
    <>
      <rect x="10" y="12" width="44" height="40" rx="4" fill="#d9dee3" {...S} /><rect x="15" y="17" width="26" height="30" rx="2" fill="#3b2a17" {...S} />
      <path d="M17 24h22M17 31h22M17 38h22" stroke="#f0a92a" strokeWidth="3" strokeLinecap="round" /><circle cx="22" cy="22" r="2" fill="#ff8a3d" /><circle cx="31" cy="29" r="2" fill="#ffd23f" /><circle cx="26" cy="36" r="2" fill="#ff8a3d" />
      <circle cx="48" cy="22" r="3" fill="#e2573c" {...S} /><path d="M45 32h6M45 37h6" {...S} strokeWidth={1.6} /><path className="wk-steam" d="M22 9q-3-3 0-6M32 9q-3-3 0-6M42 9q-3-3 0-6" fill="none" stroke="#b9c4cc" strokeWidth="2.4" strokeLinecap="round" />
    </>),
  may_ep: (
    <>
      <path d="M18 8h28l-4 14H22z" fill="#bfe9ff" {...S} /><circle cx="27" cy="13" r="3" fill="#ff8a3d" /><circle cx="36" cy="14" r="3" fill="#ffd23f" /><circle cx="32" cy="10" r="2.4" fill="#7ccf4f" />
      <rect x="20" y="22" width="24" height="18" rx="3" fill="#d9dee3" {...S} /><path d="M32 22v-6" {...S} strokeWidth={3} /><path d="M44 34h8v6" fill="none" {...S} />
      <path className="wk-drip" d="M52 42v5" stroke="#f0a92a" strokeWidth="3" strokeLinecap="round" /><path d="M46 48h12l-1.5 8h-9z" fill="#ffe27a" {...S} /><path d="M14 40h36v6H14z" fill="#a86a2a" {...S} />
    </>),
  day_chuyen_mut: (
    <>
      <path d="M6 40h52v6H6z" fill="#8b949c" {...S} /><circle cx="12" cy="49" r="4" fill="#3b2a17" {...S} /><circle cx="32" cy="49" r="4" fill="#3b2a17" {...S} /><circle cx="52" cy="49" r="4" fill="#3b2a17" {...S} />
      <g className="wk-belt"><rect x="12" y="28" width="9" height="12" rx="2" fill="#e2573c" {...S} /><rect x="12" y="25" width="9" height="4" rx="1" fill="#ffd23f" {...S} /><rect x="42" y="28" width="9" height="12" rx="2" fill="#f0a92a" {...S} /><rect x="42" y="25" width="9" height="4" rx="1" fill="#ffd23f" {...S} /></g>
      <rect x="24" y="6" width="16" height="16" rx="2" fill="#d9dee3" {...S} /><path d="M32 22v6M28 28h8" {...S} strokeWidth={3} /><circle cx="32" cy="13" r="3" fill="#7ccf4f" {...S} />
    </>),
  may_rang_xay: (
    <>
      <path d="M22 6h20l-4 9H26z" fill="#d9a35b" {...S} /><ellipse cx="32" cy="27" rx="19" ry="12" fill="#a86a2a" {...S} /><ellipse cx="32" cy="27" rx="11" ry="6.5" fill="#3b2a17" {...S} />
      <g className="wk-spin"><path d="M32 21v12M26 27h12" stroke="#f0a92a" strokeWidth="2.6" strokeLinecap="round" /></g>
      <path d="M18 37l-4 15M46 37l4 15" {...S} strokeWidth={3} /><path d="M24 52h16l-2-6H26z" fill="#ffe27a" {...S} /><path className="wk-steam" d="M50 14q3-3 0-6M56 18q3-3 0-6" fill="none" stroke="#b9c4cc" strokeWidth="2.4" strokeLinecap="round" />
    </>),
  may_rua: (
    <>
      <path d="M8 26h48l-4 18H12z" fill="#8fd3f0" {...S} /><path d="M12 32q5-4 10 0t10 0 10 0 10 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="24" r="4" fill="#ff8a3d" {...S} /><circle cx="33" cy="23" r="4.5" fill="#7ccf4f" {...S} /><circle cx="44" cy="24" r="3.6" fill="#ffd23f" {...S} />
      <path d="M14 8h36" {...S} strokeWidth={3} /><path className="wk-drip" d="M20 11v7M32 11v7M44 11v7" stroke="#4aa3d8" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 3" /><path d="M14 44l-3 9M50 44l3 9" {...S} strokeWidth={3} />
    </>),
  may_dong_goi: (
    <>
      <path d="M6 42h52v6H6z" fill="#a86a2a" {...S} /><path d="M12 48v6M52 48v6" {...S} strokeWidth={3} />
      <rect x="12" y="26" width="18" height="16" rx="2" fill="#e0a55a" {...S} /><path d="M12 32h18M21 26v16" stroke="#a86a2a" strokeWidth="1.6" />
      <rect x="36" y="8" width="18" height="10" rx="2" fill="#d9dee3" {...S} /><path d="M45 18v8" {...S} strokeWidth={3} /><path d="M38 26h14l-2 16H40z" fill="#bfe9ff" fillOpacity=".8" {...S} /><circle cx="45" cy="34" r="3" fill="#ff8a3d" />
    </>),
  kho_lanh: (
    <>
      <rect x="8" y="12" width="48" height="40" rx="3" fill="#f4f7f9" {...S} /><path d="M32 12v40" stroke={O} strokeWidth="2" /><path d="M27 28v8M37 28v8" {...S} strokeWidth={3} />
      <rect x="40" y="4" width="14" height="8" rx="1.6" fill="#8b949c" {...S} /><path d="M20 20v10M15.7 22.5l8.6 5M24.3 22.5l-8.6 5" stroke="#4aa3d8" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 46h40" stroke="#b9c4cc" strokeWidth="2" strokeLinecap="round" />
    </>),
};
function MachineArt({ kind, run }: { kind: MachineKind; run: boolean }) {
  return <svg className={run ? 'wk-art run' : 'wk-art'} viewBox="0 0 64 58" width="64" height="58" aria-hidden="true" focusable="false">{ART[kind] ?? ART.may_say}</svg>;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const bonusText = (b?: { yield?: number; value?: number; grade?: number } | null) => !b ? '' : b.yield ? `mỗi mẻ ra thêm ${pct(b.yield)} thành phẩm` : b.value ? `thành phẩm bán thêm ${pct(b.value)}` : b.grade ? `hàng Loại 2, Loại 3 chỉ thiệt ${pct(1 - b.grade)} so với thường` : '';

/** Xưởng chế biến. `onOpen` (tuỳ chọn) để App mở Chợ, Siêu thị hay thẻ Xuất khẩu khi người chơi bấm lối ra. */
export function WorkshopPanel({ me, priceOf, onChanged, onOpen }: { me: Me; priceOf: (id: string) => number; onChanged: () => void; onOpen?: (where: WorkshopExit) => void }) {
  const [data, setData] = useState<WorkshopData | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [kg, setKg] = useState(10);
  const [shop, setShop] = useState(false);
  const [, tick] = useState(0);
  const load = useCallback(async () => { setData(await api<WorkshopData>('GET', '/api/workshop')); }, []);
  useEffect(() => { void load(); const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [load]);
  const act = useAction(useCallback(() => { void load(); onChanged(); }, [load, onChanged]));
  if (!data) return <p className="hint">Đang mở cửa xưởng…</p>;

  const now = Date.now(), scale = me.config.timeScale || 1;
  const machines = data.machines ?? [], recipes = data.recipes ?? [], stock = data.stock ?? [], catalog = data.catalog ?? [];
  const bonus = data.bonus ?? { yield: 0, value: 0, grade: 0 }, fee = data.runFeePerKg ?? 0;
  const recipeOfId = (id: string) => recipes.find((r) => r.id === id);
  const products: ProductRow[] = data.productInfo ?? data.products.map((p) => ({ ...p, name: SPECIALTIES[p.specialtyId]?.name ?? p.specialtyId, recipeId: '', refPrice: 0 }));
  const isWorkshop = data.isWorkshop ?? me.user.role === 'xuong';
  const collect = (j: Job) => act.run(() => api('POST', `/api/workshop/collect/${j.id}`, {}));

  const jobRow = (j: Job, m?: Machine) => {
    const sp = SPECIALTIES[j.specialtyId], r = recipeOfId(j.recipeId), wait = j.readyAt - now;
    const total = Math.max(1, ((r?.hours ?? 3) * 3_600_000 * (m?.time ?? 1)) / scale), p = wait <= 0 ? 1 : Math.min(0.97, Math.max(0.03, 1 - wait / total));
    return (
      <div className={wait <= 0 ? 'wk-job ready' : 'wk-job'} key={j.id}>
        <span className="emoji" aria-hidden="true">{r?.emoji ?? '📦'}</span>
        <div className="grow">
          <strong>{r?.name ?? 'Chế biến'} {sp?.name}</strong>
          <div className="bar"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
          <small>{j.kgIn} kg tươi → {j.kgOut} kg thành phẩm · {wait > 0 ? `còn ${fmtDuration(wait)}` : 'đã xong'}</small>
        </div>
        {wait <= 0 && <button type="button" className="go" disabled={act.busy} onClick={() => collect(j)}>Lấy hàng</button>}
      </div>
    );
  };

  const exits = (
    <div className="wk-exits">
      <button type="button" onClick={() => onOpen?.('sieuthi')} disabled={!onOpen}><span aria-hidden="true">🏬</span><b>Ký gửi siêu thị nội địa</b><small>Tự đặt giá, bán cho khách du lịch. Phải đang ở tỉnh có siêu thị.</small></button>
      <button type="button" onClick={() => onOpen?.('xuatkhau')} disabled={!onOpen}><span aria-hidden="true">🚢</span><b>Xuất khẩu</b><small>Giá cao nhất, hao hụt thấp, miễn kiểm dịch; tiền về khi lô tới nơi.</small></button>
    </div>
  );
  const productList = (
    <>
      {products.length === 0 ? <p className="hint">Chưa có thành phẩm. Chạy một mẻ rồi bấm "Lấy hàng" khi xong.</p> : products.map((p) => {
        const sp = SPECIALTIES[p.specialtyId], r = recipeOfId(p.recipeId);
        return (
          <div className="deal" key={p.specialtyId}>
            <span className="emoji" aria-hidden="true">{r?.emoji ?? '📦'}</span>
            <div className="grow"><strong>{p.name || `${r?.name ?? ''} ${sp?.name ?? ''}`}</strong><small><b>{p.kg} kg</b>{p.refPrice > 0 ? ` · doanh nghiệp mua khoảng ${fmtMoney(p.refPrice)}/kg` : ''}</small></div>
            <button type="button" disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/workshop/sell', { specialtyId: p.specialtyId, kg: p.kg }))}>Bán cho doanh nghiệp<br /><small>{p.refPrice > 0 ? `≈ ${fmtMoney(p.refPrice * p.kg)}` : 'bán hết'}</small></button>
          </div>
        );
      })}
      {products.length > 0 && <><p className="muted">Ba lối ra cho thành phẩm: bán ngay cho doanh nghiệp ở trên (nhanh, giá vừa), hoặc:</p>{exits}</>}
    </>
  );

  if (!isWorkshop) {
    const role = me.user.role ? ROLE_INFO[me.user.role] : null;
    return (
      <div className="workshop">
        <div className="notice">
          <strong>🏭 Xưởng chế biến là việc của Chủ xưởng</strong>
          <span>{role ? `Bạn đang là ${role.name}. ` : ''}Chủ xưởng không trồng trọt: họ mua nông sản tươi rồi dùng máy sấy, máy ép, máy rang xay… làm ra hàng khô, mứt, nước ép để bán cho siêu thị hoặc xuất khẩu. Muốn có hàng chế biến, hãy bán nông sản cho chủ xưởng qua sạp, hoặc mua thành phẩm của họ ở siêu thị.</span>
        </div>
        {act.error && <p className="error" role="alert">{act.error}</p>}
        {data.jobs.length > 0 && <><h3>Mẻ còn dở từ trước</h3>{data.jobs.map((j) => jobRow(j))}</>}
        {products.length > 0 && <><h3>Thành phẩm còn trong kho</h3>{productList}</>}
      </div>
    );
  }

  const busyJobs = machines.reduce((n, m) => n + m.jobs.length, 0);
  const openMachine = machines.find((m) => m.id === open) ?? null;
  const fits = openMachine ? stock.filter((s) => openMachine.recipes.includes(s.recipeId)) : [];
  const item = fits.find((s) => s.specialtyId + s.quality === pick) ?? null;
  const recipe = item ? recipeOfId(item.recipeId) : null;
  const n = item ? Math.min(Math.max(1, kg), item.kg) : 0, step = item && item.kg > 100 ? 10 : item && item.kg > 20 ? 5 : 1;
  const gradeMult = item ? 1 - (1 - QUALITY_MULT[item.quality]) * (1 - bonus.grade) : 1;
  const kgOut = recipe ? Math.floor(n * recipe.ratio * gradeMult * (1 + bonus.yield) + 1e-9) : 0;
  const startOn = (m: Machine) => { setOpen(open === m.id ? null : m.id); setPick(null); };
  const choose = (s: StockRow) => { setPick(s.specialtyId + s.quality); setKg(Math.min(s.kg, 50)); };

  return (
    <div className="workshop">
      <p className="muted">Xưởng không trồng trọt: mua nông sản tươi, đưa vào máy làm thành hàng khô, mứt, nước ép… rồi bán cho siêu thị nội địa, xuất khẩu hoặc doanh nghiệp. Đang chạy {busyJobs}/{data.slots} mẻ.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}

      <h3><span className="wk-n">1</span> Nguyên liệu trong kho</h3>
      {stock.length === 0 ? (
        <div className="notice">
          <span>Kho chưa có nông sản tươi. Xưởng không tự trồng nên phải mua: ở <b>Chợ</b> (sạp của nhà vườn), <b>siêu thị</b> ở các tỉnh, hoặc nhờ thương lái chở tới.</span>
          <button type="button" onClick={() => onOpen?.('cho')} disabled={!onOpen}>🛒 Ra chợ mua nguyên liệu</button>
        </div>
      ) : (
        <div className="wk-stock">
          {stock.map((s) => {
            const sp = SPECIALTIES[s.specialtyId], r = recipeOfId(s.recipeId);
            return (
              <div className={s.canProcess ? 'wk-raw' : 'wk-raw off'} key={s.specialtyId + s.quality}>
                <span className="emoji" aria-hidden="true">{sp ? CROPS[sp.crop].emoji : '📦'}</span>
                <div className="grow">
                  <strong>{sp?.name ?? s.specialtyId}</strong>
                  <small>{QUALITY_NAMES[s.quality]} · <b>{s.kg} kg</b></small>
                  <small>→ {r?.emoji} {r?.name ?? '—'} · {s.canProcess ? `chạy bằng ${s.machineKinds.filter((k) => machines.some((m) => m.kind === k)).map((k) => MACHINES[k].name).join(', ')}` : <span className="error">cần mua {s.machineKinds.map((k) => MACHINES[k].name).join(' hoặc ')}</span>}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3><span className="wk-n">2</span> Dàn máy ({machines.length}/{data.maxMachines ?? 8})</h3>
      <div className="wk-machines">
        {machines.map((m) => {
          const free = m.slots - m.jobs.length, running = m.jobs.some((j) => j.readyAt > now), next = m.upgradeCost !== null ? machineStats(m.kind, m.level + 1) : null;
          const usable = stock.some((s) => m.recipes.includes(s.recipeId));
          return (
            <div className={`wk-machine${m.support ? ' support' : ''}${open === m.id ? ' on' : ''}`} key={m.id} data-machine={m.kind}>
              <div className="wk-head">
                <MachineArt kind={m.kind} run={running || (m.support && busyJobs > 0)} />
                <div className="grow">
                  <strong>{m.name}</strong>
                  <small><span className="tag">Cấp {m.level}</span> {m.support ? `Phụ trợ: ${bonusText(m.bonus)}` : `${m.slots} mẻ cùng lúc${m.time < 1 ? ` · nhanh hơn ${pct(1 - m.time)}` : ''}`}</small>
                  {!m.support && <small className="muted">Làm được: {m.recipes.map((id) => recipeOfId(id)?.name ?? id).join(', ')}</small>}
                </div>
              </div>
              {m.jobs.map((j) => jobRow(j, m))}
              {!m.support && m.jobs.length === 0 && <p className="hint">Máy đang nghỉ.</p>}
              <div className="wk-actions">
                {!m.support && <button type="button" className="go" aria-expanded={open === m.id} disabled={act.busy || free <= 0 || !usable} onClick={() => startOn(m)}>{free <= 0 ? 'Máy kín mẻ' : !usable ? 'Chưa có nguyên liệu hợp máy' : open === m.id ? 'Đóng lại' : `Chạy mẻ mới (${free} chỗ trống)`}</button>}
                {m.upgradeCost !== null && next && (
                  <button type="button" disabled={act.busy || me.user.cash < m.upgradeCost} onClick={() => act.run(() => api('POST', `/api/workshop/machines/${m.id}/upgrade`, {}))}>
                    Nâng cấp {fmtMoney(m.upgradeCost)}<br /><small>{m.support ? 'cấp cao hơn' : `${next.slots} mẻ cùng lúc, nhanh hơn ${pct(1 - next.time)}`}</small>
                  </button>
                )}
              </div>
              {open === m.id && (
                <div className="wk-new">
                  <div className="pick-row wrap">
                    {fits.map((s) => { const sp = SPECIALTIES[s.specialtyId], id = s.specialtyId + s.quality; return <button type="button" key={id} className="pick" aria-pressed={pick === id} onClick={() => choose(s)}><span className="emoji" aria-hidden="true">{sp ? CROPS[sp.crop].emoji : '📦'}</span><strong>{sp?.name}</strong><small>{QUALITY_NAMES[s.quality]} · {s.kg} kg</small></button>; })}
                  </div>
                  {item && recipe && (
                    <>
                      <div className="stepper"><button type="button" aria-label="Bớt" disabled={n <= 1} onClick={() => setKg(Math.max(1, n - step))}>−</button><b>{n} kg tươi</b><button type="button" aria-label="Thêm" disabled={n >= item.kg} onClick={() => setKg(Math.min(item.kg, n + step))}>+</button><button type="button" className="wk-all" disabled={n >= item.kg} onClick={() => setKg(item.kg)}>Hết kho</button></div>
                      <dl className="consign-sum">
                        <div><dt>{recipe.emoji} Ra thành phẩm</dt><dd>{kgOut} kg {recipe.name.toLowerCase()}</dd></div>
                        <div><dt>⏱️ Thời gian</dt><dd>{fmtDuration((recipe.hours * 3_600_000 * m.time) / scale)}</dd></div>
                        <div><dt>🔌 Điện và bảo trì</dt><dd>−{fmtMoney(fee * n)}</dd></div>
                        <div><dt>💪 Thể lực</dt><dd>−{data.energyCost ?? 0}</dd></div>
                        <div className="net"><dt>Giá trị ước tính</dt><dd>{fmtMoney(Math.round((kgOut * priceOf(item.specialtyId) * recipe.value * (1 + bonus.value)) / 1000) * 1000)}</dd></div>
                      </dl>
                      {kgOut < 1 && <p className="error">Mẻ quá ít, chưa ra nổi 1 kg thành phẩm. Hãy tăng số kg.</p>}
                      <button type="button" className="go wide" disabled={act.busy || kgOut < 1 || me.user.cash < fee * n}
                        onClick={() => act.run(async () => { await api('POST', '/api/workshop/start', { specialtyId: item.specialtyId, quality: item.quality, kg: n, machineId: m.id }); setOpen(null); setPick(null); })}>
                        Cho {n} kg vào {m.name.toLowerCase()}<small>{me.user.cash < fee * n ? 'không đủ tiền điện' : `bán tươi chỉ được khoảng ${fmtMoney(n * priceOf(item.specialtyId))}`}</small>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {machines.length < (data.maxMachines ?? 8) && <button type="button" className="wk-slot" aria-expanded={shop} onClick={() => setShop(!shop)}><span aria-hidden="true">＋</span>Chỗ đặt máy<small>{shop ? 'đóng danh mục' : 'mua thêm máy'}</small></button>}
      </div>

      {(shop || machines.length === 0) && (
        <>
          <h3><span className="wk-n">＋</span> Mua thêm máy</h3>
          <div className="wk-catalog">
            {catalog.map((c) => {
              const cap = c.slots ? (data.maxPerKind ?? 2) : 1;
              const why = c.owned >= cap ? (c.slots ? `Đã đủ ${cap} máy loại này, hãy nâng cấp` : 'Máy phụ trợ chỉ cần một cái') : machines.length >= (data.maxMachines ?? 8) ? 'Xưởng hết chỗ đặt máy' : me.user.cash < c.price ? 'Chưa đủ tiền' : '';
              return (
                <div className={c.canBuy ? 'wk-cat' : 'wk-cat off'} key={c.kind}>
                  <MachineArt kind={c.kind} run={false} />
                  <div className="grow">
                    <strong>{c.name}</strong>
                    <small>{c.note}</small>
                    <small className="muted">{c.slots ? `${c.slots} mẻ cùng lúc · làm ${c.recipes.map((id) => recipeOfId(id)?.name ?? id).join(', ')}` : `Phụ trợ: ${bonusText(c.bonus)}`}{c.owned > 0 ? ` · đang có ${c.owned}` : ''}</small>
                  </div>
                  <button type="button" className="go" disabled={act.busy || !c.canBuy} onClick={() => act.run(() => api('POST', '/api/workshop/machines/buy', { kind: c.kind }))}>{fmtMoney(c.price)}<small>{c.canBuy ? 'mua máy' : why || 'chưa mua được'}</small></button>
                </div>
              );
            })}
          </div>
          <WhyLimit k="workshop_machines" />
        </>
      )}

      <h3><span className="wk-n">3</span> Thành phẩm</h3>
      {productList}
      {products.length === 0 && exits}
      <WhyLimit k="tiles_xuong" />
    </div>
  );
}
