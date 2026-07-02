import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Target } from "lucide-react";
import { useAppStore, api } from "@/store";

export default function Register() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const setTimezone = useAppStore((s) => s.setTimezone);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("请填写所有字段");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (password.length < 6) {
      setError("密码长度至少为 6 位");
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ id: number; username: string; token: string; timezone?: string }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ username: username.trim(), password }),
        }
      );
      setUser(data);
      if (data.timezone) setTimezone(data.timezone);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-md-surface px-4">
      <div className="md-card-elevated w-full max-w-md p-8 rounded-2xl">
        <div className="mb-8 text-center">
          <Target className="mx-auto mb-3 text-md-primary" size={40} />
          <h1 className="text-3xl font-bold tracking-wider text-md-primary">
            自律达人
          </h1>
          <p className="mt-2 text-sm text-md-on-surface-variant">
            创建你的账号
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-md-on-surface">
              用户名
            </label>
            <input
              type="text"
              className="md-input rounded-md px-3 py-2"
              placeholder="设置你的用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-md-on-surface">
              密码
            </label>
            <input
              type="password"
              className="md-input rounded-md px-3 py-2"
              placeholder="设置你的密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-md-on-surface">
              确认密码
            </label>
            <input
              type="password"
              className="md-input rounded-md px-3 py-2"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-md-error bg-md-error-container px-4 py-2.5 text-sm text-md-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="md-btn md-btn-filled w-full py-2.5 text-base"
            disabled={loading}
          >
            {loading ? "正在注册..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-md-on-surface-variant">
          已有账号？{" "}
          <Link
            to="/login"
            className="md-btn md-btn-outlined inline-flex items-center px-4 py-1.5 text-sm"
          >
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}