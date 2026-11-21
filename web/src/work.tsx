// Đơn hàng theo ngày, xưởng chế biến, hồ sơ (vai trò và xã/phường).
import { useCallback, useEffect, useState } from 'react';
import { CROPS, NPCS, PROVINCES, REGIONS, SPECIALTIES, recipeOf } from '../../shared/catalog.ts';
import { ORDER_PREMIUM, QUALITY_NAMES, ROLE_INFO, fmtMoney } from '../../shared/rules.ts';
import type { Role } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me, Order, Workshop } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';

export function NpcBadge({ id }: { id: string }) {
  const npc = NPCS.find((n) => n.id === id);
  if (!npc) return null;
  return <span className="npc" style={{ borderColor: npc.color }} title={npc.tagline}><b style={{ background: npc.color }}>{npc.logo}</b>{npc.name}</span>;
}

// ------------------------------------------------------------------ đơn hàng
export function OrdersPanel({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [data, setData] = useState<{ orders: Order[]; resetsAt: number } | null>(null);
  const load = useCallback(async () => { setData(await api('GET', '/api/orders')); }, []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  if (!data) return <p className="hint">Đang tải…</p>;
  const have = (id: string) => me.inventory.filter((i) => i.specialtyId === id).reduce((a, i) => a + i.kg, 0);
  return (
    <div>
      <p className="muted">Mỗi ngày có {data.orders.length} đơn, trả cao hơn giá tham chiếu {Math.round((ORDER_PREMIUM - 1) * 100)}%. Đơn cần đặc sản vùng khác thì mua ở Chợ, đi Du lịch, hoặc xin bạn bè. Đổi đơn sau {fmtDuration(data.resetsAt - Date.now())}.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {data.orders.map((o) => {
        const ok = o.items.every((it) => have(it.specialtyId) >= it.kg);
        return (
          <div className="row" key={o.slot}>
            <div className="row-line"><div className="grow"><strong>{o.title}</strong><br /><NpcBadge id={o.npcId} /></div><span className="price">{fmtMoney(o.reward)}</span></div>
            {o.items.map((it) => {
              const sp = SPECIALTIES[it.specialtyId], h = have(it.specialtyId);
              return (
                <div className="row-line" key={it.specialtyId}>
                  <span className="emoji">{CROPS[sp.crop].emoji}</span>
                  <div className="grow">{sp.name}<br /><small>{REGIONS[sp.regionId].name}</small></div>
                  <span className={`num ${h >= it.kg ? 'up' : 'down'}`}>{Math.min(h, it.kg)}/{it.kg} kg</span>
                </div>
              );
            })}
            {o.done ? <span className="tag">Đã giao ✓</span> : <button className="primary" disabled={act.busy || !ok} onClick={() => act.run(() => api('POST', `/api/orders/${o.slot}/deliver`, {}))}>{ok ? 'Giao hàng' : 'Chưa đủ hàng'}</button>}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ xưởng chế biến
export function WorkshopPanel({ me, priceOf, onChanged }: { me: Me; priceOf: (id: string) => number; onChanged: () => void }) {
  const [data, setData] = useState<Workshop | null>(null);
  const [pick, setPick] = useState('');
  const [kg, setKg] = useState(10);
  const [, tick] = useState(0);
  const load = useCallback(async () => { setData(await api<Workshop>('GET', '/api/workshop')); }, []);
  useEffect(() => { void load(); const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  if (!data) return <p className="hint">Đang tải…</p>;
  const item = me.inventory.find((i) => i.specialtyId + '|' + i.quality === pick);
  const recipe = item ? recipeOf(CROPS[SPECIALTIES[item.specialtyId].crop]) : null;
  const now = Date.now();
  return (
    <div>
      <p className="muted">Chế biến nông sản thành hàng khô, mứt, nước ép… để bán được giá hơn bán tươi. Xưởng có {data.slots} chỗ làm cùng lúc.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <h3>Đang làm ({data.jobs.length}/{data.slots})</h3>
      {data.jobs.length === 0 && <p className="hint">Xưởng đang trống.</p>}
      {data.jobs.map((j) => {
        const sp = SPECIALTIES[j.specialtyId], r = recipeOf(CROPS[sp.crop]), wait = j.readyAt - now;
        return (
          <div className="row row-line" key={j.id}>
            <span className="emoji">{r.emoji}</span>
            <div className="grow"><strong>{r.name} {sp.name}</strong><br /><small>{j.kgIn} kg tươi → {j.kgOut} kg thành phẩm</small></div>
            <button disabled={act.busy || wait > 0} onClick={() => act.run(() => api('POST', `/api/workshop/collect/${j.id}`, {}))}>{wait > 0 ? `Còn ${fmtDuration(wait)}` : 'Lấy hàng'}</button>
          </div>
        );
      })}
      <h3>Đưa hàng vào chế biến</h3>
      {me.inventory.length === 0 ? <p className="hint">Kho chưa có nông sản để chế biến.</p> : (
        <div className="row">
          <div className="row-actions">
            <label>Nông sản<select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">— Chọn —</option>
              {me.inventory.map((i) => <option key={i.specialtyId + i.quality} value={i.specialtyId + '|' + i.quality}>{SPECIALTIES[i.specialtyId].name} · {QUALITY_NAMES[i.quality]} · {i.kg} kg</option>)}</select></label>
            <label>Số kg<input type="number" min={1} max={item?.kg ?? 1} value={kg} onChange={(e) => setKg(Number(e.target.value))} /></label>
          </div>
          {item && recipe && <small className="muted">{recipe.emoji} {recipe.name}: 1 kg tươi ra {recipe.ratio} kg, bán khoảng {fmtMoney(Math.round(priceOf(item.specialtyId) * recipe.value))}/kg · làm trong {recipe.hours} giờ game.</small>}
          <button className="primary" disabled={act.busy || !item || data.jobs.length >= data.slots}
            onClick={() => act.run(() => api('POST', '/api/workshop/start', { specialtyId: item!.specialtyId, quality: item!.quality, kg: Math.min(Math.max(1, Math.floor(kg) || 1), item!.kg) }))}>
            {data.jobs.length >= data.slots ? 'Xưởng hết chỗ' : 'Bắt đầu chế biến'}
          </button>
        </div>
      )}
      <h3>Thành phẩm</h3>
      {data.products.length === 0 && <p className="hint">Chưa có thành phẩm.</p>}
      {data.products.map((p) => {
        const sp = SPECIALTIES[p.specialtyId], r = recipeOf(CROPS[sp.crop]);
        return (
          <div className="row row-line" key={p.specialtyId}>
            <span className="emoji">{r.emoji}</span>
            <div className="grow"><strong>{r.name} {sp.name}</strong><br /><small>{p.kg} kg</small></div>
            <button disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/workshop/sell', { specialtyId: p.specialtyId, kg: p.kg }))}>Bán hết</button>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ chọn xã/phường
export function WardPicker({ province, ward, onChange }: { province: string; ward: string; onChange: (province: string, ward: string) => void }) {
  const [wards, setWards] = useState<string[]>([]);
  useEffect(() => { let on = true; void api('GET', `/api/wards?province=${encodeURIComponent(province)}`).then((r) => { if (on) setWards(r.wards); }).catch(() => setWards([])); return () => { on = false; }; }, [province]);
  return (
    <div className="row-actions ward">
      <label>Tỉnh, thành<select value={province} onChange={(e) => onChange(e.target.value, '')}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
      <label>Xã, phường<select value={ward} onChange={(e) => onChange(province, e.target.value)}><option value="">— Không hiện —</option>{wards.map((w) => <option key={w}>{w}</option>)}</select></label>
    </div>
  );
}

// ------------------------------------------------------------------ hồ sơ
export function ProfilePanel({ me, homePlotId, wardProvince, wardName, onChanged }: { me: Me; homePlotId: number; wardProvince: string | null; wardName: string | null; onChanged: () => void }) {
  const [prov, setProv] = useState(wardProvince ?? REGIONS[me.user.homeRegionId!].province);
  const [ward, setWard] = useState(wardName ?? '');
  const act = useAction(onChanged);
  const city = me.user.homeKind === 'rooftop';
  const roles = Object.keys(ROLE_INFO) as Role[];
  return (
    <div>
      <h3>Nơi ở hiển thị</h3>
      <p className="muted">Người khác chỉ thấy tên xã, phường bạn chọn ở đây và tên vùng trồng. Toạ độ của bạn không được lưu và không ai xem được.</p>
      <WardPicker province={prov} ward={ward} onChange={(p, w) => { setProv(p); setWard(w); }} />
      <button disabled={act.busy || !ward} onClick={() => act.run(() => api('POST', `/api/plots/${homePlotId}/ward`, { wardProvince: prov, wardName: ward }))}>Lưu xã, phường</button>
      <h3>Vai trò</h3>
      {!city && <p className="muted">Vai trò thương lái, chủ sạp và chủ xưởng dành cho người làm vườn sân thượng ở trung tâm thành phố. Bạn là nhà vườn.</p>}
      {roles.map((r) => (
        <div className={`row row-line ${me.user.role === r || (!me.user.role && r === 'nong_dan') ? 'picked' : ''}`} key={r}>
          <span className="emoji">{ROLE_INFO[r].icon}</span>
          <div className="grow"><strong>{ROLE_INFO[r].name}</strong><br /><small>{ROLE_INFO[r].desc}</small></div>
          {(me.user.role ?? 'nong_dan') === r ? <span className="tag">Đang chọn</span> : <button disabled={act.busy || (!city && r !== 'nong_dan')} onClick={() => act.run(() => api('POST', '/api/role', { role: r }))}>Chọn</button>}
        </div>
      ))}
      {act.error && <p className="error" role="alert">{act.error}</p>}
    </div>
  );
}
