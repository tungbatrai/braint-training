import type {
  Choice,
  ExerciseCode,
  ReviewAnswer,
  SessionStatus,
  SessionView,
} from "../shared/contracts";

type Question = { prompt: string; choices: Choice[]; correct: string };
export interface TrainingState {
  status: SessionStatus;
  phase: "MEMORIZE" | "ANSWER" | "RESULT";
  index: number;
  questions: Question[];
  answers: ReviewAnswer[];
  words: string[];
  started: number;
  shown: number;
  deadline: number | null;
  score: number;
  keys: Record<string, { fingerprint: string; response: SessionView }>;
}
const bank = [
  "mặt trời",
  "dòng sông",
  "ngọn núi",
  "cánh chim",
  "quả táo",
  "chiếc thuyền",
  "bông hoa",
  "cây cầu",
  "ngôi sao",
  "cánh đồng",
  "đám mây",
  "con mèo",
  "chiếc lá",
  "hạt mưa",
  "ngọn đèn",
  "cánh cửa",
  "quyển sách",
  "chiếc ghế",
  "con đường",
  "đại dương",
  "rừng xanh",
  "hoa sen",
  "con cá",
  "vầng trăng",
];
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function choices(
  correct: string,
  wrong: string[],
): { choices: Choice[]; correct: string } {
  const options = shuffle([correct, ...wrong]).map((text, i) => ({
    id: String(i),
    text,
  }));
  return {
    choices: options,
    correct: options.find((o) => o.text === correct)!.id,
  };
}
export function createMath(now: number): TrainingState {
  const questions = Array.from({ length: 10 }, (_, i) => {
    const limit = 10 + i * 5;
    const a = 1 + Math.floor(Math.random() * limit),
      b = 1 + Math.floor(Math.random() * (i < 5 ? 10 : 15));
    const op = ["+", "−", "×"][i % 3];
    const n = op === "+" ? a + b : op === "−" ? a - b : a * b;
    const wrong = [n - 2, n - 1, n + 1].map(String);
    return { prompt: `${a} ${op} ${b} = ?`, ...choices(String(n), wrong) };
  });
  return {
    status: "IN_PROGRESS",
    phase: "ANSWER",
    index: 0,
    questions,
    answers: [],
    words: [],
    started: now,
    shown: now,
    deadline: now + 16000,
    score: 0,
    keys: {},
  };
}
export function createMemory(now: number): TrainingState {
  const shuffled = shuffle(bank),
    words = shuffled.slice(0, 6),
    outsiders = shuffled.slice(6);
  const questions = shuffle(words).map((word) => ({
    prompt: "Từ nào đã xuất hiện trong danh sách?",
    ...choices(word, shuffle(outsiders).slice(0, 3)),
  }));
  return {
    status: "IN_PROGRESS",
    phase: "MEMORIZE",
    index: 0,
    questions,
    answers: [],
    words,
    started: now,
    shown: now,
    deadline: now + 30000,
    score: 0,
    keys: {},
  };
}
export function answer(
  s: TrainingState,
  selected: string | null,
  now: number,
): void {
  const q = s.questions[s.index];
  const correct = selected === q.correct;
  s.answers.push({
    questionIndex: s.index,
    prompt: q.prompt,
    choices: q.choices,
    selectedChoiceId: selected,
    correctChoiceId: q.correct,
    isCorrect: correct,
    responseTimeMs: Math.max(0, now - s.shown),
  });
  if (correct) s.score++;
  s.index++;
  if (s.index === s.questions.length) {
    s.status = "SUBMITTED";
    s.phase = "RESULT";
    s.deadline = null;
    return;
  }
  s.shown = now;
  s.deadline = s.words.length ? null : now + (16 - s.index) * 1000;
}
export function advance(s: TrainingState, now: number): void {
  if (s.status !== "IN_PROGRESS" && s.status !== "SUBMITTED") return;
  if (now >= s.started + 86400000) {
    s.status = "EXPIRED";
    s.deadline = null;
    return;
  }
  if (s.status !== "IN_PROGRESS") return;
  if (s.phase === "MEMORIZE" && s.deadline !== null && now >= s.deadline) {
    s.phase = "ANSWER";
    s.shown = s.deadline;
    s.deadline = null;
  }
  while (s.phase === "ANSWER" && s.deadline !== null && now >= s.deadline) {
    answer(s, null, s.deadline);
  }
}
export function view(
  id: string,
  code: ExerciseCode,
  s: TrainingState,
  now: number,
): SessionView {
  const result: SessionView = {
    id,
    exerciseCode: code,
    status: s.status,
    phase: s.phase,
    questionIndex: s.index,
    total: s.questions.length,
    serverNow: now,
    deadlineAt: s.deadline,
    maxScore: s.questions.length,
  };
  if (s.phase === "MEMORIZE" && s.status === "IN_PROGRESS")
    result.words = s.words;
  if (s.phase === "ANSWER" && s.status === "IN_PROGRESS") {
    const q = s.questions[s.index];
    result.question = { prompt: q.prompt, choices: q.choices };
  }
  if (s.status === "SUBMITTED" || s.status === "COMPLETED") {
    result.score = s.score;
    result.answers = s.answers;
    if (s.words.length) result.wordsReview = s.words;
  }
  return result;
}
