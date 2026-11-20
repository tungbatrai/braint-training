import { useLayoutEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { queryClient, AuthProvider, Protected } from "./shared";
import { AuthPage } from "./AuthPage";
import { DashboardPage } from "./DashboardPage";
import { ExercisesPage } from "./ExercisesPage";
import { HistoryPage } from "./HistoryPage";
import { TrainingPage } from "./TrainingPage";
import { AdminPage } from "./AdminPage";
import { AdminTrainingPage } from "./AdminTrainingPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#257d5c",
          borderRadius: 8,
          fontFamily: "Inter, system-ui, sans-serif",
          colorText: "#24332e",
          colorBorder: "#dce3dc",
          controlHeight: 40,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage register />} />
              <Route element={<Protected />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/training/:id" element={<TrainingPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route
                  path="/admin/training/:id"
                  element={<AdminTrainingPage />}
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
