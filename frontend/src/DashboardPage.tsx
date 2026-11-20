import { useContext, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popconfirm, message } from "antd";
import { ArrowRight, Brain, CalendarDays, Check } from "lucide-react";
import type {
  Dashboard,
  ExerciseCode,
  SessionView,
} from "../../shared/contracts";
import { errorText, get, write } from "./api";
import {
  Auth,
  dates,
  names,
  ErrorState,
  Loading,
  PageTitle,
  Score,
} from "./shared";
import { HistoryTable } from "./HistoryTable";

const dayLabels = {
  FUTURE: "Sắp tới",
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  MISSED: "Đã bỏ lỡ",
} as const;

export function DashboardPage() {
  const { user } = useContext(Auth);
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<Dashboard>("/progress/dashboard"),
  });
  const qc = useQueryClient();
  const [busy, setBusy] = useState<ExerciseCode | null>(null);
  const startKeys = useRef({
    math: crypto.randomUUID(),
    memory: crypto.randomUUID(),
  });
  const nav = useNavigate();
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const d = q.data;
  async function start(code: ExerciseCode) {
    const active = d.activeSessions.find((s) => s.exerciseCode === code);
    if (active) {
      nav(`/training/${active.id}`);
      return;
    }
    setBusy(code);
    try {
      const s = await write<SessionView>(
        "post",
        "/training/sessions",
        { exerciseCode: code },
        startKeys.current[code],
      );
      startKeys.current[code] = crypto.randomUUID();
      nav(`/training/${s.id}`);
    } catch (e) {
      message.error(errorText(e));
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setBusy(null);
    }
  }
  async function cycle() {
    try {
      await write("post", "/progress/cycles");
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      message.success("Đã bắt đầu chu kỳ mới");
    } catch (e) {
      message.error(errorText(e));
    }
  }
  return (
    <div className="page dashboard">
      <PageTitle
        eyebrow="TỔNG QUAN"
        title={`Xin chào, ${user?.name.split(" ").at(-1)}.`}
        description="Một chút luyện tập hôm nay tạo nên thói quen ngày mai."
        action={
          <div className="date-label">
            <CalendarDays size={16} />
            {dates(d.today)}
          </div>
        }
      />
      <section className="today-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THÓI QUEN HÔM NAY</span>
            <h2>Sẵn sàng luyện tập?</h2>
            <p>Hoàn thành cả hai bài tập để đánh dấu một ngày trọn vẹn.</p>
          </div>
          <span className="day-progress">
            <strong>
              {Number(d.todayStatus.math) + Number(d.todayStatus.memory)}
            </strong>{" "}
            / 2 bài
          </span>
        </div>
        <div className="exercise-rows">
          {(["math", "memory"] as ExerciseCode[]).map((code, i) => (
            <div className="exercise-row" key={code}>
              <div className={`exercise-icon icon-${code}`}>
                {code === "math" ? <span>∑</span> : <Brain size={23} />}
              </div>
              <div className="exercise-copy">
                <div>
                  <strong>{names[code]}</strong>
                  {d.todayStatus[code] && (
                    <span className="done-label">
                      <Check size={13} /> Đã hoàn thành
                    </span>
                  )}
                </div>
                <p>
                  {i === 0
                    ? "10 câu hỏi · Rèn luyện phản xạ tính toán"
                    : "6 từ · Thử thách khả năng ghi nhớ"}
                </p>
              </div>
              <Button onClick={() => void start(code)} loading={busy === code}>
                {d.activeSessions.some((s) => s.exerciseCode === code)
                  ? "Tiếp tục"
                  : d.todayStatus[code]
                    ? "Luyện tập lại"
                    : "Bắt đầu"}{" "}
                <ArrowRight size={15} />
              </Button>
            </div>
          ))}
        </div>
      </section>
      <div className="stats-strip">
        <div>
          <span>Ngày luyện tập</span>
          <strong>{d.totalTrainingDays}</strong>
          <small>ngày đã bắt đầu</small>
        </div>
        <div>
          <span>Ngày hoàn thành</span>
          <strong>{d.totalCompletedDays}</strong>
          <small>đủ cả hai bài</small>
        </div>
        <div>
          <span>Chuỗi hiện tại</span>
          <strong>
            {d.currentStreak}
            <i> ngày</i>
          </strong>
          <small>Dài nhất: {d.longestStreak} ngày</small>
        </div>
        <div>
          <span>Điểm trung bình</span>
          <strong>
            <Score value={d.averages.math} />
            <i> / </i>
            <Score value={d.averages.memory} />
          </strong>
          <small>Tính toán / Ghi nhớ</small>
        </div>
      </div>
      <section className="timeline-section">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">HÀNH TRÌNH CỦA BẠN</span>
            <h2>14 ngày luyện tập</h2>
            <p>
              {d.cycle
                ? `Bắt đầu từ ${dates(d.cycle.startDate)}`
                : "Bắt đầu một chu kỳ để theo dõi tiến độ."}
            </p>
          </div>
          <Popconfirm
            title="Bắt đầu chu kỳ mới?"
            description="Lịch sử luyện tập trước đó vẫn được giữ lại."
            onConfirm={() => void cycle()}
            okText="Bắt đầu"
            cancelText="Hủy"
          >
            <Button>{d.cycle ? "Chu kỳ mới" : "Bắt đầu chu kỳ"}</Button>
          </Popconfirm>
        </div>
        <div className="timeline">
          {d.days.length ? (
            d.days.map((day, i) => (
              <div className="day" key={day.date}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div
                  className={`day-dot ${day.status.toLowerCase()}`}
                  title={`${dates(day.date)}: ${dayLabels[day.status]}`}
                  aria-label={`${dates(day.date)}: ${day.status}`}
                >
                  {day.status === "COMPLETED" ? <Check size={16} /> : i + 1}
                </div>
                <small>
                  {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                </small>
              </div>
            ))
          ) : (
            <p className="muted">Chưa có chu kỳ luyện tập.</p>
          )}
        </div>
        <div className="legend">
          <span>
            <i className="legend-done" /> Hoàn thành
          </span>
          <span>
            <i className="legend-progress" /> Đang thực hiện
          </span>
          <span>
            <i /> Chưa hoàn thành
          </span>
        </div>
      </section>
      <section className="chart-section">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">ĐIỂM SỐ THEO NGÀY</span>
            <h2>Tiến bộ của bạn</h2>
            <p>Điểm của các bài đã lưu trong chu kỳ hiện tại.</p>
          </div>
        </div>
        {d.days.some(
          (day) => day.mathScore !== null || day.memoryScore !== null,
        ) ? (
          <div className="chart-wrap">
            <svg
              viewBox="0 0 700 170"
              role="img"
              aria-label="Biểu đồ điểm tính toán và ghi nhớ theo ngày, thang điểm phần trăm"
            >
              {[0, 50, 100].map((v) => (
                <g key={v}>
                  <line
                    x1="35"
                    y1={135 - v}
                    x2="690"
                    y2={135 - v}
                    stroke="#e1e8df"
                  />
                  <text x="0" y={139 - v} fill="#9aa99d" fontSize="10">
                    {v}%
                  </text>
                </g>
              ))}
              {d.days.map((day, i) => (
                <g key={day.date}>
                  <rect
                    x={45 + i * 46}
                    y={135 - (day.mathScore ?? 0) * 10}
                    width="13"
                    height={(day.mathScore ?? 0) * 10}
                    rx="3"
                    fill="#368766"
                  >
                    <title>{`${dates(day.date)} · Tính toán: ${day.mathScore === null ? "chưa có điểm" : Math.round(day.mathScore * 10) + "%"}`}</title>
                  </rect>
                  <rect
                    x={60 + i * 46}
                    y={135 - ((day.memoryScore ?? 0) / 6) * 100}
                    width="13"
                    height={((day.memoryScore ?? 0) / 6) * 100}
                    rx="3"
                    fill="#b0c7a2"
                  >
                    <title>{`${dates(day.date)} · Ghi nhớ: ${day.memoryScore === null ? "chưa có điểm" : Math.round((day.memoryScore / 6) * 100) + "%"}`}</title>
                  </rect>
                  <text x={45 + i * 46} y="155" fill="#a1aea3" fontSize="9">
                    {day.date.slice(8, 10)}
                  </text>
                </g>
              ))}
            </svg>
            <div className="legend">
              <span>
                <i className="legend-done" /> Tính toán
              </span>
              <span>
                <i className="legend-memory" /> Ghi nhớ
              </span>
            </div>
          </div>
        ) : (
          <div className="empty">Chưa có điểm trong chu kỳ này.</div>
        )}
      </section>
      <section className="history-preview">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">NHÌN LẠI TIẾN BỘ</span>
            <h2>Hoạt động gần đây</h2>
          </div>
          <Link className="text-link" to="/history">
            Xem lịch sử <ArrowRight size={15} />
          </Link>
        </div>
        <HistoryTable items={d.history.slice(0, 5)} />
      </section>
    </div>
  );
}
