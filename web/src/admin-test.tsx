// Trang thử Trung tâm hành chính công: /admin-test.html?tinh=Đà Nẵng[&quay=cong_chung]
// Cần đăng nhập sẵn (cookie). Trang chính mở trung tâm qua sự kiện openAdminCenter (web/src/admin/open.ts).
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AdminCenter } from './admin/AdminCenter.tsx';
import { onAdminCenter } from './admin/open.ts';
import type { AdminOpen } from './admin/open.ts';
import type { CounterId } from '../../shared/admin.ts';
import { LandRegistry } from './properties.tsx';

const q = new URLSearchParams(location.search);
function Page() {
  const [open, setOpen] = useState<AdminOpen | null>(q.get('so') ? null : { province: q.get('tinh') ?? 'Đà Nẵng', counter: (q.get('quay') as CounterId) || undefined });
  useEffect(() => onAdminCenter(setOpen), []);
  return (
    <div className="panel-body" style={{ padding: 12, maxWidth: 720, margin: '0 auto' }}>
      {!open && <LandRegistry province={q.get('tinh') ?? 'Đà Nẵng'} />}
      {open && <AdminCenter province={open.province} counter={open.counter} onClose={() => setOpen(null)} />}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>);
