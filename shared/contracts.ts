export type ExerciseCode = "math" | "memory";
export type Role = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "DISABLED";
export type SessionStatus =
  "IN_PROGRESS" | "SUBMITTED" | "COMPLETED" | "EXPIRED" | "ABANDONED";
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}
export interface Exercise {
  code: ExerciseCode;
  name: string;
  description: string;
  enabled: boolean;
}
export interface Choice {
  id: string;
  text: string;
}
export interface ReviewAnswer {
  questionIndex: number;
  prompt: string;
  choices: Choice[];
  selectedChoiceId: string | null;
  correctChoiceId: string;
  isCorrect: boolean;
  responseTimeMs: number;
}
export interface SessionView {
  id: string;
  exerciseCode: ExerciseCode;
  status: SessionStatus;
  phase: "MEMORIZE" | "ANSWER" | "RESULT";
  questionIndex: number;
  total: number;
  serverNow: number;
  deadlineAt: number | null;
  words?: string[];
  question?: { prompt: string; choices: Choice[] };
  score?: number;
  maxScore: number;
  answers?: ReviewAnswer[];
  wordsReview?: string[];
}
export interface Day {
  date: string;
  status: "FUTURE" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
  mathScore: number | null;
  memoryScore: number | null;
}
export interface HistoryItem {
  id: string;
  exerciseCode: ExerciseCode;
  score: number | null;
  maxScore: number;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
}
export interface Cycle {
  id: string;
  startDate: string;
  targetDays: number;
}
export interface Dashboard {
  today: string;
  totalTrainingDays: number;
  totalCompletedDays: number;
  currentStreak: number;
  longestStreak: number;
  averages: { math: number | null; memory: number | null };
  todayStatus: { math: boolean; memory: boolean; completed: boolean };
  days: Day[];
  cycle: Cycle | null;
  activeSessions: SessionView[];
  history: HistoryItem[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AuditLog {
  id: string;
  actorEmail: string;
  action: string;
  targetId: string;
  createdAt: string;
  detail: string;
}
export interface AdminOverview {
  usersCount: number;
  activeUsers: number;
  completedSessions: number;
  completedDays: number;
}
export interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
  requestId: string;
}
