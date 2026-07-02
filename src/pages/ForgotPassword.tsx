import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/store";
import { ArrowLeft, Key, Shield, Check, Clock } from "lucide-react";

export default function ForgotPassword() {
  const [step, setStep] = useState<"username" | "question" | "reset" | "done">("username");
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [lockCountdown, setLockCountdown] = useState("");

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      if (remaining <= 0) {
        setLockedUntil(null);
        setLockCountdown("");
        setError("");
        setRemainingAttempts(3);
        clearInterval(interval);
      } else {
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        setLockCountdown(`${min}:${String(sec).padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  // Step 1: Enter username to get security question
  const handleGetQuestion = async () => {
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api<{ userId: number; question: string }>(
        `/auth/security-question?username=${encodeURIComponent(username.trim())}`
      );
      setQuestion(data.question);
      setStep("question");
    } catch (err: any) {
      setError(err.message || "获取安全问题失败");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Answer security question
  const handleAnswerQuestion = async () => {
    if (!answer.trim()) {
      setError("请输入答案");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api("/auth/verify-answer", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), answer: answer.trim() }),
      });
      setStep("reset");
    } catch (err: any) {
      // Handle rate limiting / lockout
      if (err.message?.includes("锁定")) {
        setLockedUntil(Date.now() + 5 * 60 * 1000);
      }
      setError(err.message || "验证失败");
      // Extract remaining attempts from error message
      const match = err.message?.match(/(\d+)\s*次/);
      if (match) {
        setRemainingAttempts(parseInt(match[1]));
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setError("新密码长度不能少于4位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          answer: answer.trim(),
          newPassword,
        }),
      });
      setStep("done");
    } catch (err: any) {
      setError(err.message || "重置密码失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-md-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-md-primary mb-6 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </Link>

        <div className="md-card p-6">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-md-primary-container flex items-center justify-center mx-auto mb-3">
              <Key className="w-7 h-7 text-md-on-primary-container" />
            </div>
            <h1 className="text-xl font-bold text-md-on-surface">忘记密码</h1>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    (step === "username" && s === 1) ||
                    (step === "question" && s === 2) ||
                    (step === "reset" && s === 3) ||
                    step === "done"
                      ? "bg-md-primary text-white"
                      : "bg-md-surface-variant/50 text-md-on-surface-variant"
                  }`}
                >
                  {s < (step === "done" ? 4 : step === "username" ? 1 : step === "question" ? 2 : 3) ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    s
                  )}
                </div>
                {s < 3 && (
                  <div
                    className={`w-6 h-0.5 mx-1 transition-colors ${
                      (step === "question" && s === 1) ||
                      (step === "reset" && s <= 2) ||
                      step === "done"
                        ? "bg-md-primary"
                        : "bg-md-surface-variant/50"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Username */}
          {step === "username" && (
            <div className="space-y-4">
              <p className="text-sm text-md-on-surface-variant">
                请输入你的用户名，我们将查找你设置的安全问题。
              </p>
              <input
                type="text"
                className="md-input w-full"
                placeholder="用户名"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleGetQuestion()}
              />
              <button
                onClick={handleGetQuestion}
                disabled={loading || !username.trim()}
                className="md-btn md-btn-filled w-full"
              >
                {loading ? "查找中..." : "查找安全问题"}
              </button>
            </div>
          )}

          {/* Step 2: Answer */}
          {step === "question" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-md-surface-variant/30">
                <Shield className="w-5 h-5 text-md-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-md-on-surface-variant">安全问题</p>
                  <p className="text-sm font-medium text-md-on-surface">{question}</p>
                </div>
              </div>

              {lockedUntil ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm">
                  <Clock className="w-5 h-5 flex-shrink-0" />
                  <span>已锁定，请在 {lockCountdown} 后重试</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-md-on-surface-variant">
                    剩余尝试次数：{remainingAttempts} / 3
                  </p>
                  <input
                    type="text"
                    className="md-input w-full"
                    placeholder="你的答案"
                    value={answer}
                    onChange={(e) => { setAnswer(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleAnswerQuestion()}
                  />
                  <button
                    onClick={handleAnswerQuestion}
                    disabled={loading || !answer.trim()}
                    className="md-btn md-btn-filled w-full"
                  >
                    {loading ? "验证中..." : "验证答案"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 3: New Password */}
          {step === "reset" && (
            <div className="space-y-4">
              <p className="text-sm text-md-on-surface-variant">
                答案验证通过！请设置新密码。
              </p>
              <input
                type="password"
                className="md-input w-full"
                placeholder="新密码（至少4位）"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
              />
              <input
                type="password"
                className="md-input w-full"
                placeholder="确认新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
              />
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="md-btn md-btn-filled w-full"
              >
                {loading ? "重置中..." : "重置密码"}
              </button>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-md-on-surface font-semibold">密码重置成功！</p>
              <p className="text-sm text-md-on-surface-variant">
                请使用新密码登录。
              </p>
              <Link to="/login" className="md-btn md-btn-filled w-full inline-block text-center">
                前往登录
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}