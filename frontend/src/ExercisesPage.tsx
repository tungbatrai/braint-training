import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, message } from "antd";
import { ArrowRight, Brain, Clock3, Sparkles } from "lucide-react";
import type {
  Dashboard,
  Exercise,
  ExerciseCode,
  SessionView,
} from "../../shared/contracts";
import { errorText, get, write } from "./api";
import { ErrorState, Loading, PageTitle } from "./shared";

export function ExercisesPage() {
  const q = useQuery({
    queryKey: ["exercises"],
    queryFn: () => get<Exercise[]>("/exercises"),
  });
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<Dashboard>("/progress/dashboard"),
  });
  const nav = useNavigate();
  const [busy, setBusy] = useState("");
  const startKeys = useRef({
    math: crypto.randomUUID(),
    memory: crypto.randomUUID(),
  });
  async function start(code: ExerciseCode) {
    const active = dash.data?.activeSessions.find(
      (x) => x.exerciseCode === code,
    );
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
    } finally {
      setBusy("");
    }
  }
  if (q.isLoading) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <div className="page">
      <PageTitle
        eyebrow="LUYỆN TẬP"
        title="Chọn bài tập của bạn"
        description="Mỗi bài tập là một khoảng thời gian nhỏ dành cho bản thân."
      />
      <div className="exercise-list">
        {q.data?.map((ex, i) => (
          <article className="exercise-detail" key={ex.code}>
            <div className={`exercise-icon icon-${ex.code}`}>
              {ex.code === "math" ? <span>∑</span> : <Brain />}
            </div>
            <div>
              <span className="eyebrow">
                0{i + 1} / {ex.code === "math" ? "PHẢN XẠ" : "TRÍ NHỚ"}
              </span>
              <h2>{ex.name}</h2>
              <p>{ex.description}</p>
              <span className="detail-meta">
                <Clock3 size={15} />{" "}
                {ex.code === "math" ? "10 câu hỏi" : "6 từ · 6 câu hỏi"}
              </span>
            </div>
            <Button
              type="primary"
              disabled={!ex.enabled}
              loading={busy === ex.code}
              onClick={() => void start(ex.code)}
            >
              {!ex.enabled
                ? "Tạm đóng"
                : dash.data?.activeSessions.some(
                      (s) => s.exerciseCode === ex.code,
                    )
                  ? "Tiếp tục"
                  : "Bắt đầu"}{" "}
              <ArrowRight size={15} />
            </Button>
          </article>
        ))}
      </div>
      <div className="coming">
        <Sparkles size={20} />
        <div>
          <strong>Thêm thử thách đang được chuẩn bị</strong>
          <p>Các bài tập tư duy và tập trung sẽ sớm có mặt.</p>
        </div>
      </div>
    </div>
  );
}
