// Lựa chọn kiểu hiển thị vườn: tranh vẽ nhìn chéo (2,5D) hay 3D. Mặc định 3D; bật bằng ?tranh=1 hoặc localStorage vv-tranh=1.
const KEY = 'vv-tranh';
export function isPainted(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('tranh');
    if (q === '1') { localStorage.setItem(KEY, '1'); return true; }
    if (q === '0') { localStorage.setItem(KEY, '0'); return false; }
    return localStorage.getItem(KEY) === '1';
  } catch { return false; }
}
/** Đã từng chọn kiểu hiển thị (để hiện nút chuyển đổi cả khi đang ở 3D). */
export function hasPaintedPref(): boolean { try { return localStorage.getItem(KEY) !== null; } catch { return false; } }
/** Lưu lựa chọn và báo cho màn vườn đổi ngay, không cần tải lại trang. */
export function setPaintedPref(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* bỏ qua */ }
  window.dispatchEvent(new CustomEvent('vv-tranh', { detail: on }));
}
