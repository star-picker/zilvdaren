import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, api } from "@/store";
import { formatDateTime } from "@/utils/formatDate";
import {
  Shield, Users, Settings, Trash2, Key, RefreshCw, Eye, Search,
  ChevronDown, ChevronUp, X, Lock, UserX, AlertTriangle, LogOut, ArrowLeft
} from "lucide-react";

interface AdminUser {
  id: number;
  username: string;
  is_admin: number;
  timezone: string;
  created_at: string;
  level: number;
  exp: number;
  title: string;
  current_streak: number;
  max_streak: number;
  total_checkins: number;
  habit_count: number;
  checkin_count: number;
  circle_count: number;
}

interface UserDetail {
  user: any;
  habits: any[];
  checkins: any[];
  achievements: any[];
  circles: any[];
}

type Tab = "users" | "settings";

export default function Admin() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Settings
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Confirm dialog
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<AdminUser[]>("/admin/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api<any>("/admin/settings");
      setApiKey(data.apiKey || "");
      setHasApiKey(data.hasApiKey);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate("/login");
      return;
    }
    fetchUsers();
    fetchSettings();
  }, [user]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => isError ? setError("") : setSuccess(""), 4000);
  };

  // ─── User Actions ───

  const handleViewDetail = async (userId: number) => {
    setDetailLoading(true);
    try {
      const data = await api<UserDetail>(`/admin/users/${userId}`);
      setSelectedUser(data);
    } catch (err: any) {
      showMsg(err.message, true);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetPassword = (userId: number, username: string) => {
    setConfirm({
      title: "重置密码",
      message: `确定要将用户 "${username}" 的密码重置为其用户名吗？`,
      action: async () => {
        await api(`/admin/users/${userId}/reset-password`, { method: "POST" });
        showMsg(`用户 "${username}" 密码已重置`);
        setConfirm(null);
      },
    });
  };

  const handleResetSecurity = (userId: number, username: string) => {
    setConfirm({
      title: "重置密保",
      message: `确定要清除用户 "${username}" 的密保问题吗？`,
      action: async () => {
        await api(`/admin/users/${userId}/reset-security`, { method: "POST" });
        showMsg(`用户 "${username}" 密保已清除`);
        setConfirm(null);
      },
    });
  };

  const handleResetCharacter = (userId: number, username: string) => {
    setConfirm({
      title: "重置角色数据",
      message: `确定要重置用户 "${username}" 的角色数据吗？\n\n这将清除：等级、经验、称号、连续打卡、成就、打卡记录、语录。`,
      action: async () => {
        await api(`/admin/users/${userId}/reset-character`, { method: "POST" });
        showMsg(`用户 "${username}" 角色数据已重置`);
        fetchUsers();
        setConfirm(null);
      },
    });
  };

  const handleDeleteUser = (userId: number, username: string) => {
    setConfirm({
      title: "删除用户",
      message: `确定要永久删除用户 "${username}" 吗？\n\n此操作不可撤销！`,
      action: async () => {
        await api(`/admin/users/${userId}`, { method: "DELETE" });
        showMsg(`用户 "${username}" 已删除`);
        fetchUsers();
        setConfirm(null);
      },
    });
  };

  // ─── Settings ───

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ apiKey }),
      });
      setHasApiKey(!!apiKey);
      showMsg("设置已保存");
    } catch (err: any) {
      showMsg(err.message, true);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredUsers = users.filter((u) =>
    searchQuery
      ? u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(u.id).includes(searchQuery)
      : true
  );

  if (!user?.isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-md-error-container flex items-center justify-center">
            <Shield className="w-5 h-5 text-md-error" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-md-on-surface">全局管理后台</h1>
            <p className="text-sm text-md-on-surface-variant">管理员: {user.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="md-btn md-btn-outlined md-btn-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主页
          </button>
          <button
            onClick={handleLogout}
            className="md-btn md-btn-outlined md-btn-sm text-md-error"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 md-card p-3 text-md-error text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError("")} className="ml-auto md-btn md-btn-icon md-btn-sm">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 md-card p-3 text-md-primary text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto md-btn md-btn-icon md-btn-sm">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("users")}
          className={`md-btn md-btn-sm ${activeTab === "users" ? "md-btn-filled" : "md-btn-outlined"}`}
        >
          <Users className="w-4 h-4" />
          用户管理
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`md-btn md-btn-sm ${activeTab === "settings" ? "md-btn-filled" : "md-btn-outlined"}`}
        >
          <Settings className="w-4 h-4" />
          系统设置
        </button>
      </div>

      {/* ─── Users Tab ─── */}
      {activeTab === "users" && (
        <div>
          {/* Search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-md-on-surface-variant" />
              <input
                type="text"
                className="md-input pl-9"
                placeholder="搜索用户名或ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={fetchUsers} className="md-btn md-btn-outlined md-btn-sm">
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>

          {loading ? (
            <div className="md-card p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-md-surface-variant" />
              ))}
            </div>
          ) : (
            <div className="md-card overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-md-outline-variant text-left">
                      <th className="p-3 text-md-on-surface-variant font-medium">ID</th>
                      <th className="p-3 text-md-on-surface-variant font-medium">用户名</th>
                      <th className="p-3 text-md-on-surface-variant font-medium hidden md:table-cell">等级</th>
                      <th className="p-3 text-md-on-surface-variant font-medium hidden md:table-cell">经验</th>
                      <th className="p-3 text-md-on-surface-variant font-medium hidden lg:table-cell">连续打卡</th>
                      <th className="p-3 text-md-on-surface-variant font-medium hidden lg:table-cell">总打卡</th>
                      <th className="p-3 text-md-on-surface-variant font-medium hidden lg:table-cell">习惯</th>
                      <th className="p-3 text-md-on-surface-variant font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-md-outline-variant/50 hover:bg-md-surface-variant/30">
                        <td className="p-3 font-mono text-xs">{u.id}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{u.username}</span>
                            {u.is_admin === 1 && (
                              <span className="md-chip bg-md-error-container text-md-error text-xs px-1.5 py-0.5">
                                管理员
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-md-on-surface-variant mt-0.5">
                            {u.title || "初心者"}
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">Lv.{u.level}</td>
                        <td className="p-3 hidden md:table-cell">{u.exp}</td>
                        <td className="p-3 hidden lg:table-cell">{u.current_streak}天</td>
                        <td className="p-3 hidden lg:table-cell">{u.total_checkins}次</td>
                        <td className="p-3 hidden lg:table-cell">{u.habit_count}个</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              onClick={() => handleViewDetail(u.id)}
                              className="md-btn md-btn-icon md-btn-sm"
                              title="查看详情"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(u.id, u.username)}
                              className="md-btn md-btn-icon md-btn-sm text-md-primary"
                              title="重置密码"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleResetSecurity(u.id, u.username)}
                              className="md-btn md-btn-icon md-btn-sm text-md-secondary"
                              title="重置密保"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleResetCharacter(u.id, u.username)}
                              className="md-btn md-btn-icon md-btn-sm text-md-tertiary"
                              title="重置角色数据"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            {u.is_admin !== 1 && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="md-btn md-btn-icon md-btn-sm text-md-error"
                                title="删除用户"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-md-on-surface-variant">
                          {searchQuery ? "没有匹配的用户" : "暂无用户数据"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Settings Tab ─── */}
      {activeTab === "settings" && (
        <div className="max-w-2xl">
          <div className="md-card p-6 space-y-6">
            <h2 className="text-lg font-bold text-md-on-surface flex items-center gap-2">
              <Key className="w-5 h-5" />
              DeepSeek API Key 配置
            </h2>

            <div className="space-y-2">
              <label className="text-sm text-md-on-surface-variant">
                API Key（用于 AI 语录生成）
              </label>
              <input
                type="password"
                className="md-input font-mono"
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-md-on-surface-variant">
                {hasApiKey
                  ? "当前已配置 API Key，AI 语录功能可用"
                  : "尚未配置 API Key，AI 语录将使用内置 fallback 语录"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="md-btn md-btn-filled"
              >
                {savingSettings ? "保存中..." : "保存设置"}
              </button>
              {hasApiKey && apiKey && (
                <span className="text-sm text-md-primary flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  已配置
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── User Detail Modal ─── */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="md-card-elevated p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-md-on-surface">
                用户详情: {selectedUser.user.username}
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="md-btn md-btn-icon"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-md-surface-variant" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <InfoCard label="ID" value={selectedUser.user.id} />
                  <InfoCard label="等级" value={`Lv.${selectedUser.user.level}`} />
                  <InfoCard label="经验" value={selectedUser.user.exp} />
                  <InfoCard label="称号" value={selectedUser.user.title} />
                  <InfoCard label="连续打卡" value={`${selectedUser.user.current_streak}天`} />
                  <InfoCard label="最高连续" value={`${selectedUser.user.max_streak}天`} />
                  <InfoCard label="总打卡" value={`${selectedUser.user.total_checkins}次`} />
                  <InfoCard label="时区" value={selectedUser.user.timezone} />
                </div>

                {/* Habits */}
                <Section title="习惯列表">
                  {selectedUser.habits.length === 0 ? (
                    <p className="text-sm text-md-on-surface-variant">无</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.habits.map((h: any) => (
                        <span key={h.id} className="md-chip bg-md-surface-variant text-xs px-2 py-1">
                          {h.name} (难度: {h.difficulty})
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Achievements */}
                <Section title="成就">
                  {selectedUser.achievements.length === 0 ? (
                    <p className="text-sm text-md-on-surface-variant">无</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.achievements.map((a: any) => (
                        <span
                          key={a.id}
                          className={`md-chip text-xs px-2 py-1 ${
                            a.unlocked_at
                              ? "bg-md-primary-container text-md-on-primary-container"
                              : "bg-md-surface-variant text-md-on-surface-variant opacity-50"
                          }`}
                        >
                          {a.name} {a.unlocked_at ? "✅" : "🔒"}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Checkins */}
                <Section title="最近打卡记录（最多100条）">
                  {selectedUser.checkins.length === 0 ? (
                    <p className="text-sm text-md-on-surface-variant">无</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto text-xs">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-md-on-surface-variant">
                            <th className="p-1">时间</th>
                            <th className="p-1">习惯ID</th>
                            <th className="p-1">经验</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.checkins.map((c: any) => (
                            <tr key={c.id} className="border-t border-md-outline-variant/30">
                              <td className="p-1">{formatDateTime(c.checked_at)}</td>
                              <td className="p-1">{c.habit_id}</td>
                              <td className="p-1">{c.exp_gained}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {/* Circles */}
                <Section title="所属圈子">
                  {selectedUser.circles.length === 0 ? (
                    <p className="text-sm text-md-on-surface-variant">无</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.circles.map((c: any, i: number) => (
                        <span key={i} className="md-chip bg-md-surface-variant text-xs px-2 py-1">
                          {c.name} ({c.role})
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Confirm Dialog ─── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="md-card-elevated p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-md-error-container flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-md-error" />
              </div>
              <h3 className="text-lg font-bold text-md-on-surface">{confirm.title}</h3>
            </div>
            <p className="text-sm text-md-on-surface-variant mb-6 whitespace-pre-line">
              {confirm.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="md-btn md-btn-outlined md-btn-sm"
              >
                取消
              </button>
              <button
                onClick={confirm.action}
                className="md-btn md-btn-filled md-btn-sm bg-md-error text-md-on-error"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-md-surface-variant/40 rounded-xl p-3">
      <div className="text-xs text-md-on-surface-variant">{label}</div>
      <div className="font-medium text-sm mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-md-on-surface mb-2">{title}</h3>
      {children}
    </div>
  );
}