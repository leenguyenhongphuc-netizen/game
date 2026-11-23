// Trang thử cánh đồng trong thế giới thật: /field-world-test.html (máy chủ chạy với TESTER_USERNAMES có "f4farm").
// Tự tạo tài khoản nhà nông thử, cấp ruộng + máy qua /api/test/field, dựng World (xóm + cánh đồng sau xóm) và lớp điều khiển FieldHud.
// Móc thử: window.__fw = { world, api, zone } để Playwright đi tới máy, lái, xem tua.
// ?khoi=8 số khối ruộng (mặc định 8 = 800 ô), ?may=1 cấp sẵn máy cày/gieo/gặt/drone.
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api.ts';
import { World } from './scene/World.ts';
import type { FieldLite } from './scene/fields.ts';
import { FieldHud } from './fieldHud.tsx';
import { fieldZone } from './fieldZone.ts';

const q = new URLSearchParams(location.search), blocks = Number(q.get('khoi') ?? 8), machines = q.get('may') !== '0';
const REGION = q.get('vung') ?? 'dt_caibe';

async function boot() {
  try { await api('POST', '/api/auth/login', { username: 'f4farm', password: 'matkhau123' }); }
  catch { await api('POST', '/api/auth/register', { username: 'f4farm', password: 'matkhau123', displayName: 'Nông dân thử' }); }
  const me = await api<{ user: { homeRegionId: string | null; role: string | null } }>('GET', '/api/me');
  if (!me.user.homeRegionId) await api('POST', '/api/onboard', { regionId: REGION });
  await api('POST', '/api/test/role', { role: 'nong_dan' });
  await api('POST', '/api/test/cash', { amount: 5_000_000_000 });
  const cur = await api<{ fields: FieldLite[] }>('GET', '/api/fields');
  if (!cur.fields.length) {
    let left = blocks; while (left > 0) { const b = Math.min(10, left); left -= b; await api('POST', '/api/test/field', { blocks: b }); }
  }
  if (machines) await api('POST', '/api/test/field', { machines: ['may_cay', 'may_gieo', 'may_thu', 'drone', 'he_tuoi'] });
  const me2 = await api<{ user: { homeRegionId: string } }>('GET', '/api/me');
  const host = document.getElementById('game')!;
  const world = new World(host, { hour: 9 });
  world.setState({ regionId: me2.user.homeRegionId, clockOffset: 0, lots: [{ plotId: 1, ownerName: 'Nông dân thử', mine: true, friend: false, kind: 'ground', plantings: [], stall: [], ownerRole: 'nong_dan' }, null, null, null, null, null, null, null, null, null] });
  const d = await api<{ fields: FieldLite[]; machines: { kind: string }[] }>('GET', '/api/fields');
  world.setFields(d.fields);
  (window as unknown as Record<string, unknown>).__fw = { world, api, zone: fieldZone };
  createRoot(document.getElementById('hud')!).render(<FieldHud getWorld={() => world} />);
  document.title = 'SAN_SANG';
}
boot().catch((e) => { document.title = `LOI ${e instanceof Error ? e.message : e}`; });
