import { useContext, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input } from "antd";
import { ArrowRight, Brain } from "lucide-react";
import type { User } from "../../shared/contracts";
import { errorText, write } from "./api";
import { Auth, Brand } from "./shared";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, signIn } = useContext(Auth);
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/" replace />;
  async function submit(values: {
    name?: string;
    email: string;
    password: string;
  }) {
    setBusy(true);
    setError("");
    try {
      const result = await write<{ user: User; csrfToken: string }>(
        "post",
        register ? "/auth/register" : "/auth/login",
        values,
      );
      signIn(result.user, result.csrfToken);
      nav("/");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <Brand />
        <div className="auth-message">
          <span className="eyebrow">MỖI NGÀY MỘT CHÚT</span>
          <h1>
            Một tâm trí
            <br />
            <em>linh hoạt hơn.</em>
          </h1>
          <p>
            Dành vài phút mỗi ngày cho những bài tập nhỏ, và theo dõi tiến bộ
            của chính bạn.
          </p>
          <div className="auth-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <Brain size={100} strokeWidth={0.8} />
          </div>
        </div>
        <span className="aside-foot">KHÔNG CẦN VỘI VÃ · CHỈ CẦN ĐỀU ĐẶN</span>
      </div>
      <main className="auth-main">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <span className="eyebrow">BẮT ĐẦU HÀNH TRÌNH</span>
          <h2>{register ? "Tạo tài khoản" : "Chào mừng trở lại"}</h2>
          <p>
            {register
              ? "Tạo tài khoản để lưu lại hành trình của bạn."
              : "Đăng nhập để tiếp tục hành trình của bạn."}
          </p>
          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              className="form-error"
            />
          )}
          <Form
            layout="vertical"
            onFinish={submit}
            requiredMark={false}
            size="large"
          >
            {register && (
              <Form.Item
                label="Họ và tên"
                name="name"
                rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
              >
                <Input autoComplete="name" placeholder="Tên của bạn" />
              </Form.Item>
            )}
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Vui lòng nhập email" },
                { type: "email", message: "Email chưa hợp lệ" },
              ]}
            >
              <Input autoComplete="email" placeholder="ban@email.com" />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu" },
                { min: 8, message: "Mật khẩu cần ít nhất 8 ký tự" },
              ]}
            >
              <Input.Password
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Ít nhất 8 ký tự"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={busy}>
              {register ? "Tạo tài khoản" : "Đăng nhập"}{" "}
              <ArrowRight size={16} />
            </Button>
          </Form>
          <p className="auth-switch">
            {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
        </div>
        <div className="auth-bottom">
          BRAIN TRAINING <span>·</span> DÀNH THỜI GIAN CHO BẢN THÂN
        </div>
      </main>
    </div>
  );
}
