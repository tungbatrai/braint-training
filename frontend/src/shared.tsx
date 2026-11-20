import React, { createContext, useContext, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { Alert, Button, Spin, message } from "antd";
import {
  Activity,
  Brain,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  X,
} from "lucide-react";
import type { ExerciseCode, User } from "../../shared/contracts";
import {
  errorText,
  get,
  isUnauthorized,
  onSessionExpired,
  setCsrf,
  write,
} from "./api";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
export const names: Record<ExerciseCode, string> = {
  math: "Tính toán",
  memory: "Ghi nhớ",
};
export const dates = (s: string) =>
  new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export const fmtStatus: Record<string, string> = {
  IN_PROGRESS: "Đang thực hiện",
  SUBMITTED: "Chờ lưu",
  COMPLETED: "Hoàn thành",
  EXPIRED: "Hết thời gian",
  ABANDONED: "Đã dừng",
};
export const Auth = createContext<{
  user: User | null;
  loading: boolean;
  signIn: (user: User, token: string) => void;
  signOut: () => Promise<void>;
}>({ user: null, loading: true, signIn: () => {}, signOut: async () => {} });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setCsrf("");
        queryClient.clear();
      }),
    [],
  );
  useEffect(() => {
    get<{ user: User; csrfToken: string }>("/users/me")
      .then((data) => {
        setUser(data.user);
        setCsrf(data.csrfToken);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  function signIn(next: User, token: string) {
    setUser(next);
    setCsrf(token);
    queryClient.clear();
  }
  async function signOut() {
    try {
      await write("post", "/auth/logout");
    } catch (e) {
      if (!isUnauthorized(e)) {
        message.error(errorText(e));
        return;
      }
    }
    setUser(null);
    setCsrf("");
    queryClient.clear();
  }
  return (
    <Auth.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </Auth.Provider>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="error-state">
      <Alert
        type="error"
        showIcon
        message={errorText(error)}
        action={<Button onClick={retry}>Thử lại</Button>}
      />
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <Spin size="large" />
    </div>
  );
}
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Brain size={20} />
      </span>
      <span>
        brain<span className="brand-light">training</span>
        <small>RÈN LUYỆN MỖI NGÀY</small>
      </span>
    </Link>
  );
}
export function Shell() {
  const { user, signOut } = useContext(Auth);
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Brand />
        <nav aria-label="Điều hướng chính" onClick={() => setOpen(false)}>
          <div className="nav-label">KHÔNG GIAN CỦA BẠN</div>
          <NavLink end to="/">
            <LayoutDashboard />
            Tổng quan
          </NavLink>
          <NavLink to="/exercises">
            <Activity />
            Luyện tập
          </NavLink>
          <NavLink to="/history">
            <History />
            Lịch sử
          </NavLink>
          {user?.role === "ADMIN" && (
            <>
              <div className="nav-label second">QUẢN LÝ</div>
              <NavLink to="/admin">
                <Shield />
                Quản trị
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <div className="user-meta">
            <strong>{user?.name}</strong>
            <span>
              {user?.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="Đăng xuất"
            onClick={() => void signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <header className="mobile-header">
        <Brand />
        <button
          className="icon-button"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <button
          className="mobile-scrim"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        />
      )}
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
export function Protected() {
  const { user, loading } = useContext(Auth);
  if (loading) return <Loading />;
  return user ? <Shell /> : <Navigate to="/login" replace />;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Score({ value }: { value: number | null }) {
  return <>{value === null ? "—" : `${Math.round(value)}%`}</>;
}
