import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Popconfirm } from "antd";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, X } from "lucide-react";
import type { ExerciseCode, SessionView } from "../../shared/contracts";
import { errorText, get, write } from "./api";
import { createChoiceLock, remainingSeconds } from "./exerciseLogic";
import { names, ErrorState, Loading } from "./shared";

export function TrainingPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["session", id],
    queryFn: async () => ({
      ...(await get<SessionView>(`/training/sessions/${id}`)),
      receivedAt: performance.now(),
    }),
    refetchOnWindowFocus: false,
  });
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [problem, setProblem] = useState("");
  const lock = useRef(createChoiceLock());
  const saveKey = useRef(crypto.randomUUID());
  const startKeys = useRef({
    math: crypto.randomUUID(),
    memory: crypto.randomUUID(),
  });
  const timeoutKey = useRef(crypto.randomUUID());
  const autoSent = useRef("");
  const s = q.data;
  useEffect(() => {
    saveKey.current = crypto.randomUUID();
    startKeys.current = {
      math: crypto.randomUUID(),
      memory: crypto.randomUUID(),
    };
  }, [id]);
  // Giữ khóa yêu cầu khi chỉ đồng bộ lại cùng một câu hỏi.
  useEffect(() => {
    if (!s) return;
    lock.current.reset();
    autoSent.current = "";
    timeoutKey.current = crypto.randomUUID();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id, s?.questionIndex, s?.phase, s?.deadlineAt]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  async function refresh() {
    await q.refetch();
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["history"] });
  }
  async function action(path: string, body?: unknown, key?: string) {
    setBusy(true);
    setProblem("");
    try {
      const result = await write<SessionView>(
        "post",
        `/training/sessions/${id}/${path}`,
        body,
        key,
      );
      if (result?.id)
        qc.setQueryData(["session", id], {
          ...result,
          receivedAt: performance.now(),
        });
      else await refresh();
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["history"] });
      return true;
    } catch (e) {
      setProblem(errorText(e));
      await q.refetch();
      return false;
    } finally {
      setBusy(false);
    }
  }
  const seconds = s
    ? remainingSeconds(
        s.deadlineAt,
        s.serverNow,
        s.receivedAt,
        Math.max(now, s.receivedAt),
      )
    : 0;
  // Đồng hồ chỉ đồng bộ lại khi trạng thái máy chủ hoặc thời gian còn lại thay đổi.
  useEffect(() => {
    if (
      !s ||
      s.status !== "IN_PROGRESS" ||
      s.deadlineAt === null ||
      seconds > 0
    )
      return;
    const marker = `${s.id}-${s.phase}-${s.questionIndex}-${s.deadlineAt}`;
    if (autoSent.current === marker) return;
    autoSent.current = marker;
    if (s.phase === "MEMORIZE")
      void action("recall", undefined, timeoutKey.current).then((ok) => {
        if (!ok)
          window.setTimeout(() => {
            autoSent.current = "";
            setRetryTick((t) => t + 1);
          }, 3000);
      });
    else if (s.phase === "ANSWER")
      void q.refetch().then((result) => {
        if (result.error)
          window.setTimeout(() => {
            autoSent.current = "";
            setRetryTick((t) => t + 1);
          }, 3000);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s?.id,
    s?.phase,
    s?.questionIndex,
    s?.status,
    s?.deadlineAt,
    seconds,
    retryTick,
  ]);
  async function startNew(code: ExerciseCode) {
    setBusy(true);
    setProblem("");
    try {
      const next = await write<SessionView>(
        "post",
        "/training/sessions",
        { exerciseCode: code },
        startKeys.current[code],
      );
      nav(`/training/${next.id}`);
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function answer(choice: string) {
    if (!lock.current.acquire()) return;
    const ok = await action("answers", {
      questionIndex: s?.questionIndex,
      selectedChoiceId: choice,
    });
    if (!ok) lock.current.reset();
  }
  if (q.isLoading) return <Loading />;
  if (q.error || !s)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const isResult =
    s.phase === "RESULT" ||
    s.status === "COMPLETED" ||
    s.status === "SUBMITTED";
  return (
    <div className="page training-page">
      <div className="training-top">
        <Link className="back-link" to="/exercises">
          <ArrowLeft size={17} /> Bài tập
        </Link>
        <span className="eyebrow">{names[s.exerciseCode].toUpperCase()}</span>
        <span className="session-number">
          {!isResult && s.phase === "ANSWER"
            ? `CÂU ${s.questionIndex + 1} / ${s.total}`
            : isResult
              ? "KẾT QUẢ"
              : "CHUẨN BỊ"}
        </span>
      </div>
      {problem && (
        <Alert
          type="error"
          showIcon
          message={problem}
          action={
            <Button size="small" onClick={() => void refresh()}>
              Tải lại
            </Button>
          }
          className="form-error"
        />
      )}
      {isResult ? (
        <div className="result">
          <span className="eyebrow">BÀI TẬP ĐÃ KẾT THÚC</span>
          <h1>Bạn đã hoàn thành!</h1>
          <p>Hãy xem lại các câu trả lời của bạn.</p>
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
                    Đáp án của bạn:{" "}
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
          <div className="result-actions">
            {s.status === "SUBMITTED" ? (
              <Button
                type="primary"
                size="large"
                loading={busy}
                onClick={() =>
                  void action("complete", undefined, saveKey.current)
                }
              >
                Lưu kết quả <ArrowRight size={16} />
              </Button>
            ) : (
              <Button type="primary" size="large" onClick={() => nav("/")}>
                Về tổng quan <ArrowRight size={16} />
              </Button>
            )}
            {s.status === "COMPLETED" && (
              <>
                <Button
                  size="large"
                  loading={busy}
                  onClick={() => void startNew(s.exerciseCode)}
                >
                  Luyện lại với bộ mới
                </Button>
                {s.exerciseCode === "math" && (
                  <Button
                    size="large"
                    loading={busy}
                    onClick={() => void startNew("memory")}
                  >
                    Tiếp tục bài ghi nhớ <ArrowRight size={16} />
                  </Button>
                )}
              </>
            )}
            <Button size="large" onClick={() => nav("/exercises")}>
              Chọn bài tập khác
            </Button>
          </div>
        </div>
      ) : s.status !== "IN_PROGRESS" ? (
        <div className="empty training-empty">
          <h2>
            Bài tập đã {s.status === "ABANDONED" ? "được dừng" : "kết thúc"}
          </h2>
          <p>Hãy chọn bài tập để bắt đầu một lượt mới.</p>
          <Button type="primary" onClick={() => nav("/exercises")}>
            Chọn bài tập
          </Button>
        </div>
      ) : (
        <>
          <div className="training-progress">
            <span
              style={{
                width: `${s.phase === "MEMORIZE" ? 0 : (s.questionIndex / s.total) * 100}%`,
              }}
            />
          </div>
          <div className="workspace">
            <div className="workspace-meta">
              <span>
                {s.phase === "MEMORIZE" ? "GHI NHỚ CÁC TỪ" : "CHỌN MỘT ĐÁP ÁN"}
              </span>
              {s.deadlineAt !== null && (
                <div className={`timer ${seconds <= 5 ? "timer-low" : ""}`}>
                  <Clock3 size={17} />
                  <strong>{seconds}</strong> giây
                </div>
              )}
            </div>
            {s.phase === "MEMORIZE" ? (
              <>
                <h1>Hãy ghi nhớ những từ này.</h1>
                <p>
                  Bạn có 30 giây. Sau đó, hãy trả lời các câu hỏi về những gì
                  bạn nhớ.
                </p>
                <div className="word-grid memorize">
                  {s.words?.map((word, i) => (
                    <span key={i}>{word}</span>
                  ))}
                </div>
                <Button
                  size="large"
                  type="primary"
                  loading={busy}
                  onClick={() =>
                    void action("recall", undefined, timeoutKey.current)
                  }
                >
                  Tôi đã ghi nhớ <ArrowRight size={16} />
                </Button>
              </>
            ) : (
              <>
                <h1 className="question">{s.question?.prompt}</h1>
                <div className="choices">
                  {s.question?.choices.map((choice, i) => (
                    <button
                      disabled={
                        busy || (s.deadlineAt !== null && seconds === 0)
                      }
                      onClick={() => void answer(choice.id)}
                      key={choice.id}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      <strong>{choice.text}</strong>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="workspace-foot">
              <span>Hãy tập trung và trả lời theo nhịp của bạn.</span>
              <Popconfirm
                title="Dừng bài tập này?"
                description="Tiến độ của lượt này sẽ không được tính hoàn thành."
                okText="Dừng bài"
                cancelText="Tiếp tục"
                onConfirm={async () => {
                  if (await action("abandon")) nav("/exercises");
                }}
              >
                <Button type="text" loading={busy}>
                  Dừng bài tập
                </Button>
              </Popconfirm>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
