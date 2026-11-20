// @vitest-environment jsdom
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { api, get } from "./api";
import { AuthProvider, Protected, queryClient } from "./shared";

vi.mock("antd", () => ({
  Alert: () => null,
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  Spin: () => null,
  message: { error: vi.fn() },
}));
const user = {
  id: "1",
  name: "An",
  email: "an@example.test",
  role: "USER",
  status: "ACTIVE",
  createdAt: "2026-01-01",
};
const original = api.defaults.adapter;
function unauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError("Hết phiên", "ERR_BAD_REQUEST", config, undefined, {
    data: {},
    status: 401,
    statusText: "Unauthorized",
    headers: new AxiosHeaders(),
    config,
  });
}
afterEach(() => {
  cleanup();
  api.defaults.adapter = original;
  queryClient.clear();
});
function renderApp() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route element={<Protected />}>
            <Route
              path="/"
              element={
                <button
                  onClick={() =>
                    void get("/progress/dashboard").catch(() => {})
                  }
                >
                  Tải dữ liệu
                </button>
              }
            />
          </Route>
          <Route path="/login" element={<h1>Đăng nhập lại</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}
describe("phiên hết hạn", () => {
  it("đăng xuất về đăng nhập khi máy chủ trả 401", async () => {
    api.defaults.adapter = async (config) =>
      config.url === "/users/me"
        ? {
            data: { data: { user, csrfToken: "csrf" } },
            status: 200,
            statusText: "OK",
            headers: new AxiosHeaders(),
            config,
          }
        : unauthorized(config);
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    await screen.findByRole("heading", { name: "Đăng nhập lại" });
  });
  it("đưa về đăng nhập khi truy vấn bảo vệ trả 401", async () => {
    api.defaults.adapter = async (config) =>
      config.url === "/users/me"
        ? {
            data: { data: { user, csrfToken: "csrf" } },
            status: 200,
            statusText: "OK",
            headers: new AxiosHeaders(),
            config,
          }
        : unauthorized(config);
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Tải dữ liệu" }));
    await screen.findByRole("heading", { name: "Đăng nhập lại" });
  });
});
