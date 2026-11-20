import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import type { SessionView } from "../../shared/contracts";
import { get } from "./api";
import { ErrorState, Loading, names } from "./shared";

export function AdminTrainingPage() {
  const { id = "" } = useParams();
  const q = useQuery({
    queryKey: ["admin-session", id],
    queryFn: () => get<SessionView>(`/admin/training/sessions/${id}`),
  });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const s = q.data;
  const result = s.status === "SUBMITTED" || s.status === "COMPLETED";
  return (
    <div className="page training-page">
      <div className="training-top">
        <Link className="back-link" to="/admin">
          <ArrowLeft size={17} /> Quản trị
        </Link>
        <span className="eyebrow">{names[s.exerciseCode].toUpperCase()}</span>
        <span className="session-number">CHI TIẾT BÀI TẬP</span>
      </div>
      {result ? (
        <div className="result">
          <span className="eyebrow">KẾT QUẢ LUYỆN TẬP</span>
          <h1>Chi tiết bài tập</h1>
          <p>
            {s.status === "SUBMITTED"
              ? "Kết quả đang chờ thành viên lưu."
              : "Kết quả đã được lưu."}
          </p>
          <div className="result-score">
            <strong>{s.score ?? "—"}</strong>
            <span>
              / {s.maxScore}
              <small>câu trả lời đúng</small>
            </span>
          </div>
          {s.wordsReview && (
            <div className="review-words">
              <h3>Các từ cần ghi nhớ</h3>
              <div className="word-grid">
                {s.wordsReview.map((word, i) => (
                  <span key={i}>{word}</span>
                ))}
              </div>
            </div>
          )}
          <div className="review-list">
            {s.answers?.map((a) => (
              <div className="review-item" key={a.questionIndex}>
                <div className={a.isCorrect ? "review-good" : "review-bad"}>
                  {a.isCorrect ? <CheckCircle2 size={20} /> : <X size={20} />}
                </div>
                <div>
                  <span className="eyebrow">CÂU {a.questionIndex + 1}</span>
                  <h3>{a.prompt}</h3>
                  <p>
                    Đáp án đã chọn:{" "}
                    <strong>
                      {a.choices.find((c) => c.id === a.selectedChoiceId)
                        ?.text || "Không trả lời"}
                    </strong>
                  </p>
                  {!a.isCorrect && (
                    <p>
                      Đáp án đúng:{" "}
                      <strong>
                        {
                          a.choices.find((c) => c.id === a.correctChoiceId)
                            ?.text
                        }
                      </strong>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty training-empty">
          <h2>
            {s.status === "IN_PROGRESS"
              ? "Phiên đang luyện tập"
              : s.status === "ABANDONED"
                ? "Phiên đã được dừng"
                : "Phiên đã hết hạn"}
          </h2>
          <p>Không có kết quả hoàn chỉnh để xem.</p>
        </div>
      )}
    </div>
  );
}
