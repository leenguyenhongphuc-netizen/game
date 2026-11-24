// Đơn hàng theo ngày, xưởng chế biến, hồ sơ (vai trò và xã/phường).
import { useCallback, useEffect, useState } from 'react';
import { CROPS, NPCS, PROVINCES, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import { ORDER_PREMIUM, ROLES, ROLE_INFO, fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me, Order } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';

export function NpcBadge({ id }: { id: string }) {
  const npc = NPCS.find((n) => n.id === id);
  if (!npc) return null;
  return <span className="npc" style={{ borderColor: npc.color }} title={npc.tagline}><b style={{ background: npc.color }}>{npc.logo}</b>{npc.name}</span>;
}

// ------------------------------------------------------------------ đơn hàng
interface OrderItemV2 { specialtyId: string; kg: number; processed?: boolean; name?: string }
interface OrderV2 { slot: number; npcId: string; title: string; kind?: string; items: OrderItemV2[]; reward: number; bonus?: number; xp?: number; done: boolean }
export function OrdersPanel({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [data, setData] = useState<{ orders: OrderV2[]; resetsAt: number; premium?: number; scale?: number } | null>(null);
  const [products, setProducts] = useState<{ specialtyId: string; kg: number }[]>([]);
  const load = useCallback(async () => {
    const d = await api<{ orders: OrderV2[]; resetsAt: number; premium?: number; scale?: number }>('GET', '/api/orders');
    setData(d);
    // đơn hàng chế biến cần biết kho thành phẩm
    if (d.orders.some((o) => o.items.some((it) => it.processed))) setProducts((await api<{ products: { specialtyId: string; kg: number }[] }>('GET', '/api/workshop')).products ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  if (!data) return <p className="hint">Đang tải…</p>;
  const have = (it: OrderItemV2) => it.processed
    ? products.find((p) => p.specialtyId === it.specialtyId)?.kg ?? 0
    : me.inventory.filter((i) => i.specialtyId === it.specialtyId).reduce((a, i) => a + i.kg, 0);
  const premium = data.premium ?? ORDER_PREMIUM;
  return (
    <div>
      <p className="muted">Mỗi ngày có {data.orders.length} đơn, trả cao hơn giá tham chiếu {Math.round((premium - 1) * 100)}% cộng tiền thưởng theo cấp; khối lượng đơn lớn dần khi bạn lên cấp{data.scale && data.scale > 1 ? ` (đang ×${data.scale})` : ''}. Đơn cuối là đơn riêng theo vai: chủ xưởng giao thành phẩm, thương lái giao đơn sỉ lớn. Đổi đơn sau {fmtDuration(data.resetsAt - Date.now())}.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {data.orders.map((o) => {
        const ok = o.items.every((it) => have(it) >= it.kg);
        return (
          <div className="row" key={o.slot}>
            <div className="row-line"><div className="grow"><strong>{o.title}</strong><br /><NpcBadge id={o.npcId} /></div>
              <span className="price">{fmtMoney(o.reward)}{o.xp ? <small className="order-xp"> · +{o.xp} EXP</small> : null}</span></div>
            {o.items.map((it) => {
              const sp = SPECIALTIES[it.specialtyId], h = have(it);
              return (
                <div className="row-line" key={it.specialtyId + (it.processed ? 'P' : '')}>
                  <span className="emoji">{it.processed ? '📦' : CROPS[sp.crop].emoji}</span>
                  <div className="grow">{it.name ?? sp.name}<br /><small>{it.processed ? 'Thành phẩm chế biến' : REGIONS[sp.regionId].name}</small></div>
                  <span className={`num ${h >= it.kg ? 'up' : 'down'}`}>{Math.min(h, it.kg)}/{it.kg} kg</span>
                </div>
              );
            })}
            {o.bonus ? <small className="muted">Gồm thưởng {fmtMoney(o.bonus)} theo cấp.</small> : null}
            {o.done ? <span className="tag">Đã giao ✓</span> : <button className="primary" disabled={act.busy || !ok} onClick={() => act.run(() => api('POST', `/api/orders/${o.slot}/deliver`, {}))}>{ok ? 'Giao hàng' : 'Chưa đủ hàng'}</button>}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ xưởng chế biến (dàn máy): xem workshop.tsx
export { WorkshopPanel } from './workshop.tsx';

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
export function ProfilePanel({ me, homePlotId, wardProvince, wardName, onChanged, onRespin }: { me: Me; homePlotId: number; wardProvince: string | null; wardName: string | null; onChanged: () => void; onRespin: () => void }) {
  const [prov, setProv] = useState(wardProvince ?? REGIONS[me.user.homeRegionId!].province);
  const [ward, setWard] = useState(wardName ?? '');
  const act = useAction(onChanged);
  return (
    <div>
      <h3>Nơi ở hiển thị</h3>
      <p className="muted">Người khác chỉ thấy tên xã, phường bạn chọn ở đây và tên vùng trồng. Toạ độ của bạn không được lưu và không ai xem được.</p>
      <WardPicker province={prov} ward={ward} onChange={(p, w) => { setProv(p); setWard(w); }} />
      <button disabled={act.busy || !ward} onClick={() => act.run(() => api('POST', `/api/plots/${homePlotId}/ward`, { wardProvince: prov, wardName: ward }))}>Lưu xã, phường</button>
      <h3>Vai trò mùa này</h3>
      {me.user.role && (
        <div className="row row-line picked">
          <span className="emoji">{ROLE_INFO[me.user.role].icon}</span>
          <div className="grow"><strong>{ROLE_INFO[me.user.role].name}</strong><br /><small>{ROLE_INFO[me.user.role].desc}</small></div>
        </div>
      )}
      {me.user.roleNextSpinAt && me.user.roleNextSpinAt > Date.now()
        ? <p className="muted">Được quay lại vai trò sau {fmtDuration(me.user.roleNextSpinAt - Date.now())}.</p>
        : <button className="primary" onClick={onRespin}>🎡 Quay lại vai trò cho mùa mới</button>}
      {me.user.tester && <TesterTools me={me} act={act} />}
      {act.error && <p className="error" role="alert">{act.error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ công cụ cho tài khoản thử nghiệm
function TesterTools({ me, act }: { me: Me; act: ReturnType<typeof useAction> }) {
  const [region, setRegion] = useState(me.user.homeRegionId ?? '');
  const [kind, setKind] = useState<'ground' | 'rooftop'>(me.user.homeKind ?? 'ground');
  const [sp, setSp] = useState(Object.keys(SPECIALTIES)[0]);
  const post = (path: string, body: unknown = {}) => act.run(() => api('POST', path, body));
  return (
    <div className="tester">
      <h3>🧪 Công cụ thử nghiệm</h3>
      <p className="muted">Chỉ tài khoản thử nghiệm mới thấy mục này. Mọi thay đổi chỉ tác động lên tài khoản này.</p>
      <label>Đổi vai trò ngay</label>
      <div className="pick-row">{ROLES.map((r) => <button key={r} className="pick" aria-pressed={me.user.role === r} disabled={act.busy} onClick={() => post('/api/test/role', { role: r })}><span className="emoji">{ROLE_INFO[r].icon}</span><strong>{ROLE_INFO[r].name}</strong></button>)}</div>
      <button disabled={act.busy} onClick={() => post('/api/test/truck')}>⛽ Đổ đầy bình và nạp ETC 2 triệu (cho Thương lái)</button>
      <button disabled={act.busy} onClick={() => post('/api/test/season')}>🎡 Xoá vai để quay lại vòng quay</button>
      <div className="row-actions ward">
        <label>Chuyển vườn nhà tới vùng<select value={region} onChange={(e) => setRegion(e.target.value)}>{Object.values(REGIONS).map((r) => <option key={r.id} value={r.id}>{r.name}, {r.province}</option>)}</select></label>
        <label>Kiểu vườn<select value={kind} onChange={(e) => setKind(e.target.value as 'ground' | 'rooftop')}><option value="ground">Vườn đất</option><option value="rooftop">Sân thượng</option></select></label>
      </div>
      <button disabled={act.busy} onClick={() => { if (confirm('Chuyển vùng sẽ xoá cây đang trồng trên vườn nhà. Tiếp tục?')) void post('/api/test/region', { regionId: region, kind }); }}>📍 Chuyển vùng</button>
      <div className="pick-row">
        <button className="pick" disabled={act.busy} onClick={() => post('/api/test/cash', { amount: 1_000_000_000 })}><span className="emoji">💰</span><strong>Đặt 1 tỷ đồng</strong></button>
        <button className="pick" disabled={act.busy} onClick={() => post('/api/test/ripen')}><span className="emoji">⏩</span><strong>Cây tới bước kế ngay</strong></button>
      </div>
      <div className="row-actions ward">
        <label>Thêm vào kho 100 kg<select value={sp} onChange={(e) => setSp(e.target.value)}>{Object.values(SPECIALTIES).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button disabled={act.busy} onClick={() => post('/api/test/stock', { specialtyId: sp, kg: 100 })}>Thêm</button>
      </div>
    </div>
  );
}
