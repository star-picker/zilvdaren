import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Target, Copy, Check, ArrowRight } from "lucide-react";
import { useAppStore, api } from "@/store";

export default function Login() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const setTimezone = useAppStore((s) => s.setTimezone);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 登录成功后的 token URL 展示
  const [loginResult, setLoginResult] = useState<{
    id: number; username: string; token: string; isAdmin?: boolean; timezone?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const tokenUrl = loginResult
    ? `${window.location.origin}/?token=${loginResult.token}`
    : "";

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(tokenUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEnterApp = () => {
    if (!loginResult) return;
    setUser({ id: loginResult.id, username: loginResult.username, token: loginResult.token, isAdmin: loginResult.isAdmin });
    if (loginResult.timezone) setTimezone(loginResult.timezone);
    navigate(loginResult.isAdmin ? "/admin" : "/");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请填写所有字段");
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ id: number; username: string; token: string; timezone?: string; isAdmin?: boolean }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username: username.trim(), password }),
        }
      );
      setLoginResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 登录成功后的 Token URL 展示界面
  if (loginResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-md-surface px-4">
        <div className="md-card-elevated w-full max-w-md p-8 rounded-2xl">
          <div className="mb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-md-primary-container flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-md-primary" />
            </div>
            <h2 className="text-xl font-bold text-md-on-surface">登录成功</h2>
            <p className="text-sm text-md-on-surface-variant mt-1">
              欢迎回来，{loginResult.username}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-md-on-surface-variant mb-1.5">
                你的专属 Token 链接（可在其他标签页/浏览器打开）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  className="md-input font-mono text-xs flex-1"
                  value={tokenUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyUrl}
                  className="md-btn md-btn-outlined md-btn-sm flex-shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
              <p className="text-xs text-md-on-surface-variant mt-1.5">
                将此链接复制到其他浏览器标签页中打开，即可同时登录同一个账号
              </p>
            </div>

            <button
              onClick={handleEnterApp}
              className="md-btn md-btn-filled w-full py-2.5 text-base flex items-center justify-center gap-2"
            >
              进入应用
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-md-surface px-4">
      <div className="md-card-elevated w-full max-w-md p-8 rounded-2xl">
        <div className="mb-8 text-center">
          <Target className="mx-auto mb-3 text-md-primary" size={40} />
          <h1 className="text-3xl font-bold tracking-wider text-md-primary">
            自律达人
          </h1>
          <p className="mt-2 text-sm text-md-on-surface-variant">
            踏上自律的冒险之旅
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
              placeholder="输入你的用户名"
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
              placeholder="输入你的密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "正在登录..." : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-md-on-surface-variant">
          还没有账号？{" "}
          <Link
            to="/register"
            className="md-btn md-btn-outlined inline-flex items-center px-4 py-1.5 text-sm"
          >
            注册账号
          </Link>
        </p>
        <p className="mt-3 text-center">
          <Link
            to="/forgot-password"
            className="text-sm text-md-primary hover:underline"
          >
            忘记密码？
          </Link>
        </p>
      </div>
    </div>
  );
}