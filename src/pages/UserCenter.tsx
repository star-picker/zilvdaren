import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, api } from "@/store";
import { formatDate } from "@/utils/formatDate";
import {
  Shield,
  Key,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Check,
  X,
  Globe,
  Copy,
  Link2,
} from "lucide-react";

const PRESET_QUESTIONS = [
  "你小时候的昵称是什么？",
  "你第一只宠物叫什么名字？",
  "你最喜欢的老师叫什么名字？",
  "你出生的城市是哪里？",
  "你母亲的姓氏是什么？",
  "你最喜欢的电影是？",
];

const TIMEZONES = [
  { value: "Asia/Shanghai", label: "北京时间 (UTC+8)" },
  { value: "Asia/Tokyo", label: "东京 (UTC+9)" },
  { value: "Asia/Seoul", label: "首尔 (UTC+9)" },
  { value: "Asia/Singapore", label: "新加坡 (UTC+8)" },
  { value: "Asia/Hong_Kong", label: "香港 (UTC+8)" },
  { value: "Asia/Taipei", label: "台北 (UTC+8)" },
  { value: "Asia/Bangkok", label: "曼谷 (UTC+7)" },
  { value: "Asia/Jakarta", label: "雅加达 (UTC+7)" },
  { value: "Asia/Kolkata", label: "印度 (UTC+5:30)" },
  { value: "Asia/Dubai", label: "迪拜 (UTC+4)" },
  { value: "Europe/London", label: "伦敦 (UTC+0)" },
  { value: "Europe/Paris", label: "巴黎 (UTC+1)" },
  { value: "Europe/Berlin", label: "柏林 (UTC+1)" },
  { value: "Europe/Moscow", label: "莫斯科 (UTC+3)" },
  { value: "America/New_York", label: "纽约 (UTC-5)" },
  { value: "America/Chicago", label: "芝加哥 (UTC-6)" },
  { value: "America/Los_Angeles", label: "洛杉矶 (UTC-8)" },
  { value: "America/Toronto", label: "多伦多 (UTC-5)" },
  { value: "America/Sao_Paulo", label: "圣保罗 (UTC-3)" },
  { value: "Australia/Sydney", label: "悉尼 (UTC+10)" },
  { value: "Pacific/Auckland", label: "奥克兰 (UTC+12)" },
  { value: "Pacific/Honolulu", label: "夏威夷 (UTC-10)" },
];

interface SecurityInfo {
  username: string;
  hasSecurityQuestion: boolean;
  securityQuestion: string | null;
  timezone: string;
  createdAt: string;
}

export default function UserCenter() {
  const { user, logout, setTimezone } = useAppStore();
  const navigate = useNavigate();
  const [securityInfo, setSecurityInfo] = useState<SecurityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [timezoneLoading, setTimezoneLoading] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Security question
  const [showSecurityForm, setShowSecurityForm] = useState(false);
  const [useCustomQuestion, setUseCustomQuestion] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(PRESET_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // Token URL 复制
  const [tokenCopied, setTokenCopied] = useState(false);
  const tokenUrl = user ? `${window.location.origin}/?token=${user.token}` : "";

  const handleCopyTokenUrl = () => {
    navigator.clipboard.writeText(tokenUrl).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  useEffect(() => {
    fetchSecurityInfo();
  }, []);

  const fetchSecurityInfo = async () => {
    try {
      const data = await api<SecurityInfo>("/user-center/security-info");
      setSecurityInfo(data);
    } catch (err) {
      console.error("Failed to fetch security info:", err);
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Change password
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showMsg("error", "请填写所有字段");
      return;
    }
    if (newPassword.length < 4) {
      showMsg("error", "新密码长度不能少于4位");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMsg("error", "两次输入的新密码不一致");
      return;
    }

    try {
      await api("/user-center/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showMsg("success", "密码修改成功");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showMsg("error", err.message || "修改失败");
    }
  };

  // Set security question
  const handleSetSecurityQuestion = async () => {
    const question = useCustomQuestion ? customQuestion.trim() : selectedQuestion;
    if (!question || !securityAnswer) {
      showMsg("error", "请填写安全问题和答案");
      return;
    }
    if (securityAnswer.length < 2) {
      showMsg("error", "答案长度不能少于2位");
      return;
    }

    try {
      await api("/user-center/security-question", {
        method: "PUT",
        body: JSON.stringify({ question, answer: securityAnswer, isCustom: useCustomQuestion }),
      });
      showMsg("success", "安全问题设置成功");
      setShowSecurityForm(false);
      setSecurityAnswer("");
      setCustomQuestion("");
      await fetchSecurityInfo();
    } catch (err: any) {
      showMsg("error", err.message || "设置失败");
    }
  };

  // Set timezone
  const handleSetTimezone = async (tz: string) => {
    setTimezoneLoading(true);
    try {
      await api("/user-center/timezone", {
        method: "PUT",
        body: JSON.stringify({ timezone: tz }),
      });
      setTimezone(tz);
      setSecurityInfo((prev) => prev ? { ...prev, timezone: tz } : null);
      showMsg("success", "时区设置成功");
    } catch (err: any) {
      showMsg("error", err.message || "设置失败");
    } finally {
      setTimezoneLoading(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showMsg("error", "请输入密码确认");
      return;
    }

    try {
      await api("/user-center/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      logout();
      navigate("/login");
    } catch (err: any) {
      showMsg("error", err.message || "注销失败");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-md-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-md-on-surface">用户中心</h1>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* User Info Card */}
      <div className="md-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-md-primary-container flex items-center justify-center">
            <Shield className="w-7 h-7 text-md-on-primary-container" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-md-on-surface">
              {securityInfo?.username}
            </h2>
            <p className="text-sm text-md-on-surface-variant">
              注册于 {formatDate(securityInfo?.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Token URL - 多标签页登录 */}
      <div className="md-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Link2 className="w-5 h-5 text-md-primary" />
          <div>
            <span className="text-md-on-surface font-medium">Token 链接</span>
            <p className="text-xs text-md-on-surface-variant mt-0.5">
              复制此链接到其他浏览器标签页中打开，即可同时登录当前账号
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            className="md-input font-mono text-xs flex-1"
            value={tokenUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopyTokenUrl}
            className="md-btn md-btn-outlined md-btn-sm flex-shrink-0"
          >
            {tokenCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {tokenCopied ? "已复制" : "复制"}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="md-card overflow-hidden">
        <button
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="w-full p-4 flex items-center justify-between hover:bg-md-surface-variant/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-md-primary" />
            <span className="text-md-on-surface font-medium">修改密码</span>
          </div>
          <ChevronRight
            className={`w-5 h-5 text-md-on-surface-variant transition-transform ${
              showPasswordForm ? "rotate-90" : ""
            }`}
          />
        </button>

        {showPasswordForm && (
          <div className="px-4 pb-4 space-y-3">
            <input
              type="password"
              className="md-input w-full"
              placeholder="当前密码"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              className="md-input w-full"
              placeholder="新密码（至少4位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              className="md-input w-full"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button onClick={handleChangePassword} className="md-btn md-btn-filled w-full">
              确认修改
            </button>
          </div>
        )}
      </div>

      {/* Security Question */}
      <div className="md-card overflow-hidden">
        <button
          onClick={() => setShowSecurityForm(!showSecurityForm)}
          className="w-full p-4 flex items-center justify-between hover:bg-md-surface-variant/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-md-primary" />
            <div>
              <span className="text-md-on-surface font-medium">密码恢复问题</span>
              {securityInfo?.hasSecurityQuestion && (
                <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                  <Check className="w-3 h-3 inline" /> 已设置
                </span>
              )}
            </div>
          </div>
          <ChevronRight
            className={`w-5 h-5 text-md-on-surface-variant transition-transform ${
              showSecurityForm ? "rotate-90" : ""
            }`}
          />
        </button>

        {showSecurityForm && (
          <div className="px-4 pb-4 space-y-3">
            {securityInfo?.hasSecurityQuestion && (
              <p className="text-xs text-md-on-surface-variant bg-md-surface-variant/30 p-2 rounded-lg">
                当前问题：{securityInfo.securityQuestion}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setUseCustomQuestion(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !useCustomQuestion
                    ? "bg-md-primary-container text-md-on-primary-container"
                    : "bg-md-surface-variant/30 text-md-on-surface-variant"
                }`}
              >
                预设问题
              </button>
              <button
                onClick={() => setUseCustomQuestion(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  useCustomQuestion
                    ? "bg-md-primary-container text-md-on-primary-container"
                    : "bg-md-surface-variant/30 text-md-on-surface-variant"
                }`}
              >
                自定义问题
              </button>
            </div>

            {useCustomQuestion ? (
              <input
                type="text"
                className="md-input w-full"
                placeholder="输入你的自定义问题..."
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
              />
            ) : (
              <select
                className="md-input w-full"
                value={selectedQuestion}
                onChange={(e) => setSelectedQuestion(e.target.value)}
              >
                {PRESET_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              className="md-input w-full"
              placeholder="你的答案"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />

            <button
              onClick={handleSetSecurityQuestion}
              className="md-btn md-btn-filled w-full"
            >
              {securityInfo?.hasSecurityQuestion ? "更新安全问题" : "设置安全问题"}
            </button>
          </div>
        )}
      </div>

      {/* Timezone */}
      <div className="md-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Globe className="w-5 h-5 text-md-primary" />
          <div>
            <span className="text-md-on-surface font-medium">时区设置</span>
            <p className="text-xs text-md-on-surface-variant mt-0.5">
              当前时区：{TIMEZONES.find((t) => t.value === securityInfo?.timezone)?.label || securityInfo?.timezone || "未知"}
            </p>
          </div>
        </div>
        <select
          className="md-input w-full"
          value={securityInfo?.timezone || "Asia/Shanghai"}
          onChange={(e) => handleSetTimezone(e.target.value)}
          disabled={timezoneLoading}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {/* Danger Zone - Delete Account */}
      <div className="md-card border border-[var(--md-error)]/30 overflow-hidden">
        <button
          onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
          className="w-full p-4 flex items-center justify-between hover:bg-[var(--md-error)]/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-[var(--md-error)]" />
            <span className="text-[var(--md-error)] font-medium">注销账户</span>
          </div>
          <ChevronRight
            className={`w-5 h-5 text-[var(--md-error)] transition-transform ${
              showDeleteConfirm ? "rotate-90" : ""
            }`}
          />
        </button>

        {showDeleteConfirm && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--md-error)]/10">
              <AlertTriangle className="w-5 h-5 text-[var(--md-error)] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--md-error)]">
                <p className="font-semibold">此操作不可逆！</p>
                <p className="mt-1">
                  注销后，你的所有数据（角色、习惯、打卡记录、成就、圈子成员资格等）将被永久删除，无法恢复。
                </p>
              </div>
            </div>

            <input
              type="password"
              className="md-input w-full"
              placeholder="输入密码确认注销"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />

            <button
              onClick={handleDeleteAccount}
              className="w-full py-2.5 rounded-xl bg-[var(--md-error)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              确认注销，永久删除我的账户
            </button>
          </div>
        )}
      </div>
    </div>
  );
}