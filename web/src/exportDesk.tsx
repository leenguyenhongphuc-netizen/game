// Hội thoại với nhân viên Đại lý xuất khẩu (quầy ở đầu xóm, web/src/scene/exportDesk.ts).
// Đọc nhanh đơn đang mở của các công ty xuất nhập khẩu, rồi cho người chơi chọn: xem hợp đồng hay tạo lô xuất.
import { useEffect, useState } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import './trade.css';

interface Line { id: string; name: string; emoji: string; companyName: string; marketName: string; price: number; refPrice: number; remainingKg: number; expiresAt: number }

/** Lời chào đổi theo giờ trong ngày cho đỡ nhàm. */
function greet(): string {
  const h = new Date().getHours();
  return h < 11 ? 'Chào buổi sáng! Sáng nay tàu vừa cập cảng, công ty đang cần gom hàng.' : h < 17 ? 'Chào anh chị! Chiều nay mấy công ty còn thiếu hàng cho chuyến tàu tới.' : 'Tối rồi mà kho cảng vẫn nhận hàng, anh chị ghé đúng lúc.';
}

export function ExportDeskDialog({ onContracts, onExport, onClose }: { onContracts: () => void; onExport: () => void; onClose: () => void }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  useEffect(() => {
    let live = true;
    void api<{ companies: { contracts: Line[] }[] }>('GET', '/api/companies')
      .then((r) => { if (live) setLines(r.companies.flatMap((c) => c.contracts).filter((c) => c.remainingKg > 0).sort((a, b) => b.price / b.refPrice - a.price / a.refPrice).slice(0, 3)); })
      .catch(() => live && setLines([]));
    return () => { live = false; };
  }, []);
  return (
    <div className="desk-dialog" role="dialog" aria-label="Đại lý xuất khẩu">
      <div className="desk-card">
        <div className="desk-who"><span className="desk-face" aria-hidden="true">🧑‍💼</span><div><strong>Chị Hạnh · Đại lý xuất khẩu</strong><small>Nhận hàng đi cảng, làm giấy kiểm dịch, gom lô lẻ</small></div>
          <button className="round" aria-label="Đóng" onClick={onClose}>✕</button></div>
        <p className="desk-say">{greet()}</p>
        {lines === null ? <p className="hint">Chị đang xem sổ đơn…</p> : lines.length === 0 ? <p className="desk-say">Hôm nay các công ty đủ hàng rồi. Anh chị vẫn tự gửi lô ra nước ngoài được, em báo giá từng thị trường cho.</p> : (
          <>
            <p className="desk-say">Đơn đang trả cao nhất:</p>
            <ul className="desk-orders">
              {lines.map((c) => (
                <li key={c.id}>
                  <span aria-hidden="true">{c.emoji}</span>
                  <span className="desk-o-name"><b>{c.name}</b><small>{c.companyName} · đi {c.marketName}</small></span>
                  <span className="desk-o-num"><b>{fmtMoney(c.price)}/kg</b><small>còn {c.remainingKg.toLocaleString('vi-VN')} kg</small></span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="desk-actions">
          <button className="primary" onClick={onContracts}>📋 Xem đơn của công ty</button>
          <button className="go" onClick={onExport}>🚢 Tự gửi lô xuất khẩu</button>
        </div>
      </div>
    </div>
  );
}
