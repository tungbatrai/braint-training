// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrainingPage } from "./TrainingPage";
import * as api from "./api";

vi.mock("./api", () => ({
  get: vi.fn(),
  write: vi.fn(),
  errorText: () => "Không thể kết nối",
  setCsrf: vi.fn(),
}));
vi.mock("antd", () => ({
  Alert: ({ message }: { message: React.ReactNode }) => <div>{message}</div>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Popconfirm: ({ children }: { children: React.ReactNode }) => children,
  Spin: () => <div>Đang tải</div>,
  message: { error: vi.fn(), success: vi.fn() },
}));
const session = {
  id: "memory-1",
  exerciseCode: "memory",
  status: "IN_PROGRESS",
  phase: "ANSWER",
  questionIndex: 0,
  total: 6,
  serverNow: 1000,
  deadlineAt: null,
  maxScore: 6,
  question: {
    prompt: "Từ nào đã xuất hiện?",
    choices: [
      { id: "a", text: "Cây xanh" },
      { id: "b", text: "Dòng sông" },
    ],
  },
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("bài ghi nhớ", () => {
  it("cho phép chọn đáp án khi câu hỏi không có hạn giờ", async () => {
    vi.mocked(api.get).mockResolvedValue(session);
    vi.mocked(api.write).mockResolvedValue({ ...session, questionIndex: 1 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/training/memory-1"]}>
          <Routes>
            <Route path="/training/:id" element={<TrainingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const choice = await screen.findByRole("button", { name: /Cây xanh/ });
    expect((choice as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(choice);
    await waitFor(() =>
      expect(api.write).toHaveBeenCalledWith(
        "post",
        "/training/sessions/memory-1/answers",
        { questionIndex: 0, selectedChoiceId: "a" },
        undefined,
      ),
    );
  });
});

describe("xem và lưu kết quả", () => {
  it("hiển thị đáp án đúng và dùng lại mã lưu sau lỗi kết nối", async () => {
    const result = {
      ...session,
      status: "SUBMITTED",
      phase: "RESULT",
      score: 0,
      question: undefined,
      answers: [
        {
          questionIndex: 0,
          prompt: "Từ nào đã xuất hiện?",
          choices: [
            { id: "a", text: "Cây xanh" },
            { id: "b", text: "Dòng sông" },
          ],
          selectedChoiceId: "a",
          correctChoiceId: "b",
          isCorrect: false,
          responseTimeMs: 1000,
        },
      ],
      wordsReview: ["Dòng sông"],
    };
    vi.mocked(api.get).mockResolvedValue(result);
    vi.mocked(api.write).mockRejectedValue(new Error("Mất mạng"));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/training/memory-1"]}>
          <Routes>
            <Route path="/training/:id" element={<TrainingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect((await screen.findByText(/Đáp án đúng:/)).textContent).toContain(
      "Dòng sông",
    );
    fireEvent.click(screen.getByRole("button", { name: /Lưu kết quả/ }));
    await screen.findByText("Không thể kết nối");
    fireEvent.click(screen.getByRole("button", { name: /Lưu kết quả/ }));
    await waitFor(() => expect(api.write).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.write).mock.calls[0][3]).toBe(
      vi.mocked(api.write).mock.calls[1][3],
    );
  });
});
