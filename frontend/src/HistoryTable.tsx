import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { HistoryItem } from "../../shared/contracts";
import { dates, names, fmtStatus } from "./shared";

export function HistoryTable({
  items,
  admin = false,
}: {
  items: HistoryItem[];
  admin?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>BÀI TẬP</th>
            <th>NGÀY THỰC HIỆN</th>
            <th>TRẠNG THÁI</th>
            <th>ĐIỂM</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((h) => (
            <tr key={h.id}>
              <td>
                <strong>{names[h.exerciseCode]}</strong>
              </td>
              <td>{dates(h.startedAt)}</td>
              <td>
                <span className={`status status-${h.status.toLowerCase()}`}>
                  {fmtStatus[h.status] || h.status}
                </span>
              </td>
              <td>{h.score === null ? "—" : `${h.score} / ${h.maxScore}`}</td>
              <td>
                {(admin || ["COMPLETED", "SUBMITTED"].includes(h.status)) && (
                  <Link
                    to={`${admin ? "/admin/training" : "/training"}/${h.id}`}
                  >
                    Xem <ChevronRight size={14} />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <div className="empty">Chưa có hoạt động luyện tập nào.</div>
      )}
    </div>
  );
}
