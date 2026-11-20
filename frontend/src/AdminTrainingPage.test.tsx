// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoryTable } from "./HistoryTable";
import { AdminTrainingPage } from "./AdminTrainingPage";
import * as api from "./api";

vi.mock("./api", () => ({
  get: vi.fn(),
  write: vi.fn(),
  errorText: () => "Không thể kết nối",
  setCsrf: vi.fn(),
}));
vi.mock("antd", () => ({
  Alert: () => null,
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  Spin: () => null,
  message: { error: vi.fn() },
}));
const item = {
  id: "session-1",
  exerciseCode: "memory" as const,
  score: 3,
  maxScore: 6,
  status: "COMPLETED" as const,
  startedAt: "2026-11-09T00:00:00Z",
  completedAt: "2026-11-09T00:01:00Z",
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("lịch sử quản trị", () => {
  it("dẫn tới trang xem của quản trị viên", () => {
    render(
      <MemoryRouter>
        <HistoryTable items={[item]} admin />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Xem/ }).getAttribute("href")).toBe(
      "/admin/training/session-1",
    );
  });
  it("chỉ đọc phiên đang luyện tập và không gửi thay đổi", async () => {
    vi.mocked(api.get).mockResolvedValue({
      id: "session-1",
      exerciseCode: "memory",
      status: "IN_PROGRESS",
      phase: "MEMORIZE",
      questionIndex: 0,
      total: 6,
      serverNow: 1000,
      deadlineAt: 500,
      words: ["bí mật"],
      maxScore: 6,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/admin/training/session-1"]}>
          <Routes>
            <Route path="/admin/training/:id" element={<AdminTrainingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("Phiên đang luyện tập");
    expect(api.get).toHaveBeenCalledWith("/admin/training/sessions/session-1");
    expect(screen.queryByText("bí mật")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Lưu|Dừng|ghi nhớ|Luyện lại/ }),
    ).toBeNull();
    expect(api.write).not.toHaveBeenCalled();
  });
});
