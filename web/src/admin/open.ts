// Mở Trung tâm hành chính công từ bất cứ đâu (Sổ địa chính, giấy phép xây dựng...): phát sự kiện, App nghe và hiện <AdminCenter>.
import type { CounterId } from '../../../shared/admin.ts';

export interface AdminOpen { province: string; counter?: CounterId }
export const ADMIN_EVENT = 'vv:admin-center';
export function openAdminCenter(province: string, counter?: CounterId) {
  window.dispatchEvent(new CustomEvent<AdminOpen>(ADMIN_EVENT, { detail: { province, counter } }));
}
/** App: `useEffect(() => onAdminCenter((o) => setAdmin(o)), [])`. Trả hàm gỡ. */
export function onAdminCenter(fn: (o: AdminOpen) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<AdminOpen>).detail);
  window.addEventListener(ADMIN_EVENT, h);
  return () => window.removeEventListener(ADMIN_EVENT, h);
}
