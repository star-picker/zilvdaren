import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore, api } from "@/store";
import { formatDateTime } from "@/utils/formatDate";
import {
  Users,
  Copy,
  Crown,
  Medal,
  Shield,
  UserPlus,
  Trash2,
  LogOut,
  Search,
  X,
  Flame,
  Trophy,
  Activity,
  ArrowLeft,
  UserMinus,
  UserCheck,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface MemberData {
  id: number;
  username: string;
  role: "creator" | "admin" | "member";
  level: number;
  streak: number;
  today_checkins: number;
}

interface ActivityData {
  id: number;
  user_id: number;
  username: string;
  habit_name: string;
  checked_at: string;
}

interface CircleDetailData {
  id: number;
  name: string;
  invite_code: string;
  creator_id: number;
  created_at: string;
  members: MemberData[];
  activities: ActivityData[];
}

interface SearchUser {
  id: number;
  username: string;
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-md-surface-variant ${className}`}
    />
  );
}

function getRankIcon(index: number) {
  switch (index) {
    case 0:
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 1:
      return <Medal className="w-5 h-5 text-gray-300" />;
    case 2:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return (
        <span className="w-5 h-5 flex items-center justify-center text-sm text-md-on-surface-variant font-bold">
          {index + 1}
        </span>
      );
  }
}

function getRankBg(index: number): string {
  switch (index) {
    case 0:
      return "bg-yellow-400/10 border-yellow-400/30";
    case 1:
      return "bg-gray-300/10 border-gray-300/30";
    case 2:
      return "bg-amber-600/10 border-amber-600/30";
    default:
      return "bg-md-surface-container/50 border-transparent";
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "creator":
      return (
        <span className="md-chip inline-flex items-center gap-1 text-xs bg-yellow-400/15 text-yellow-600 border-yellow-400/30">
          <Crown className="w-3 h-3" />
          创建者
        </span>
      );
    case "admin":
      return (
        <span className="md-chip inline-flex items-center gap-1 text-xs bg-purple-400/15 text-purple-500 border-purple-400/30">
          <Shield className="w-3 h-3" />
          管理员
        </span>
      );
    default:
      return null;
  }
}

export default function CircleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const [circle, setCircle] = useState<CircleDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Invite state
  const [inviteQuery, setInviteQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [showInviteSection, setShowInviteSection] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentUserId = user?.id;
  const currentMember = circle?.members.find((m) => m.id === currentUserId);
  const isCreator = currentMember?.role === "creator";
  const isAdmin = currentMember?.role === "admin";
  const canManage = isCreator || isAdmin;
  const adminCount = circle?.members.filter((m) => m.role === "admin").length ?? 0;

  const fetchCircleDetail = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api<CircleDetailData>(`/circles/${id}`);
      setCircle(data);
    } catch (err) {
      console.error("Failed to fetch circle detail:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCircleDetail();
  }, [fetchCircleDetail]);

  // --- Search users for invite ---
  useEffect(() => {
    if (!inviteQuery.trim() || !id) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const memberIds = circle?.members.map((m) => m.id) ?? [];
        const data = await api<SearchUser[]>(
          `/users/search?q=${encodeURIComponent(inviteQuery.trim())}`
        );
        setSearchResults(data.filter((u) => !memberIds.includes(u.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery, id, circle?.members]);

  // --- Actions ---
  const handleCopyCode = () => {
    if (!circle) return;
    navigator.clipboard.writeText(circle.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePromote = async (userId: number) => {
    if (!id) return;
    setError("");
    try {
      await api(`/circles/${id}/promote`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await fetchCircleDetail();
    } catch (err: any) {
      setError(err.message || "操作失败");
    }
  };

  const handleDemote = async (userId: number) => {
    if (!id) return;
    setError("");
    try {
      await api(`/circles/${id}/demote`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await fetchCircleDetail();
    } catch (err: any) {
      setError(err.message || "操作失败");
    }
  };

  const handleKick = async (userId: number) => {
    if (!id) return;
    setError("");
    try {
      await api(`/circles/${id}/kick`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await fetchCircleDetail();
    } catch (err: any) {
      setError(err.message || "操作失败");
    }
  };

  const handleLeave = async () => {
    if (!id) return;
    setError("");
    try {
      await api(`/circles/${id}/leave`, { method: "POST" });
      navigate("/circles");
    } catch (err: any) {
      setError(err.message || "操作失败");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setError("");
    try {
      await api(`/circles/${id}`, { method: "DELETE" });
      navigate("/circles");
    } catch (err: any) {
      setError(err.message || "删除失败");
    }
  };

  const handleInvite = async (userId: number) => {
    if (!id) return;
    setInviting(userId);
    setError("");
    try {
      await api(`/circles/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setInviteQuery("");
      setSearchResults([]);
      await fetchCircleDetail();
    } catch (err: any) {
      setError(err.message || "邀请失败");
    } finally {
      setInviting(null);
    }
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="md-card p-6 space-y-6">
          <Skeleton className="h-8 w-16" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Not found ---
  if (!circle) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="md-card p-12 text-center">
          <p className="text-md-on-surface-variant text-lg">圈子不存在或已解散</p>
          <button
            onClick={() => navigate("/circles")}
            className="md-btn md-btn-filled md-btn-sm mt-4"
          >
            返回圈子列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate("/circles")}
        className="md-btn md-btn-icon mb-4 text-md-on-surface-variant hover:text-md-on-surface"
        title="返回"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Circle Header */}
      <div className="md-card p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-md-on-surface flex items-center gap-2">
              <Users className="w-6 h-6" />
              {circle.name}
            </h1>
            <p className="text-md-on-surface-variant text-sm mt-1">
              {circle.members.length} 位成员
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-md-on-surface-variant text-sm">邀请码:</span>
            <code className="text-md-primary bg-md-primary-container/30 px-3 py-1 rounded font-mono text-sm">
              {circle.invite_code}
            </code>
            <button
              onClick={handleCopyCode}
              className="md-btn md-btn-icon text-md-on-surface-variant hover:text-md-primary"
              title="复制邀请码"
            >
              <Copy className="w-4 h-4" />
            </button>
            {copied && (
              <span className="text-md-primary text-xs">已复制</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Invite toggle */}
          <button
            onClick={() => setShowInviteSection(!showInviteSection)}
            className="md-btn md-btn-tonal md-btn-sm"
          >
            <UserPlus className="w-4 h-4" />
            邀请成员
            {showInviteSection ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Leave button (non-creator) */}
          {!isCreator && currentMember && (
            <button
              onClick={handleLeave}
              className="md-btn md-btn-outlined md-btn-sm"
            >
              <LogOut className="w-4 h-4" />
              退出圈子
            </button>
          )}

          {/* Delete button (creator only) */}
          {isCreator && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="md-btn md-btn-danger md-btn-sm"
            >
              <Trash2 className="w-4 h-4" />
              删除圈子
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-md-error text-sm mt-3">{error}</p>
        )}

        {/* Invite section */}
        {showInviteSection && (
          <div className="mt-4 pt-4 border-t border-md-outline-variant/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-md-on-surface-variant pointer-events-none" />
              <input
                type="text"
                className="md-input pl-9 pr-8 w-full"
                placeholder="搜索用户以邀请..."
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                autoFocus
              />
              {inviteQuery && (
                <button
                  onClick={() => {
                    setInviteQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-md-on-surface-variant hover:text-md-on-surface"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {inviteQuery.trim() && (
              <div className="md-card-elevated mt-2 rounded-lg overflow-hidden">
                {searching ? (
                  <div className="p-3 text-center text-sm text-md-on-surface-variant">
                    搜索中...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-sm text-md-on-surface-variant">
                    未找到可邀请的用户
                  </div>
                ) : (
                  searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleInvite(u.id)}
                      disabled={inviting === u.id}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-md-surface-container/50 transition-colors text-left"
                    >
                      <span className="text-md-on-surface font-medium">
                        {u.username}
                      </span>
                      <span className="md-btn md-btn-filled md-btn-sm">
                        {inviting === u.id ? "邀请中..." : "邀请"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Leaderboard */}
        <div className="md-card-elevated p-6">
          <h2 className="text-xl font-bold text-md-on-surface mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            成员排行榜
          </h2>

          {circle.members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-md-outline-variant mx-auto mb-3" />
              <p className="text-md-on-surface-variant">暂无成员</p>
            </div>
          ) : (
            <div className="space-y-2">
              {circle.members.map((member, index) => {
                const isSelf = member.id === currentUserId;
                const isMemberCreator = member.role === "creator";
                const isMemberAdmin = member.role === "admin";
                const isMemberPlain = member.role === "member";

                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getRankBg(index)}`}
                  >
                    <div className="flex-shrink-0 w-8 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-md-on-surface font-medium truncate">
                          {member.username}
                          {isSelf && (
                            <span className="text-xs text-md-on-surface-variant ml-1">
                              (你)
                            </span>
                          )}
                        </p>
                        {getRoleBadge(member.role)}
                      </div>
                      <p className="text-xs text-md-on-surface-variant">
                        Lv.{member.level}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-sm flex-shrink-0">
                      <div className="text-center">
                        <div className="text-md-primary font-bold">
                          {member.today_checkins}
                        </div>
                        <div className="text-xs text-md-on-surface-variant">
                          今日打卡
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-400 font-bold flex items-center justify-center gap-0.5">
                          <Flame className="w-3.5 h-3.5" />
                          {member.streak}
                        </div>
                        <div className="text-xs text-md-on-surface-variant">
                          连续
                        </div>
                      </div>
                    </div>

                    {/* Admin actions */}
                    {canManage && !isSelf && (
                      <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                        {/* Promote: creator only, only for members, max 3 admins */}
                        {isCreator && isMemberPlain && adminCount < 3 && (
                          <button
                            onClick={() => handlePromote(member.id)}
                            className="md-btn md-btn-icon md-btn-sm text-purple-400 hover:text-purple-500"
                            title="提升为管理员"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        {/* Demote: creator only, only for admins */}
                        {isCreator && isMemberAdmin && (
                          <button
                            onClick={() => handleDemote(member.id)}
                            className="md-btn md-btn-icon md-btn-sm text-amber-500 hover:text-amber-600"
                            title="降级"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        )}
                        {/* Kick: creator can remove anyone, admin can remove members */}
                        {!isMemberCreator &&
                          (isCreator || (isAdmin && isMemberPlain)) && (
                            <button
                              onClick={() => handleKick(member.id)}
                              className="md-btn md-btn-icon md-btn-sm text-md-error hover:text-red-600"
                              title="移除"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="md-card p-6">
          <h2 className="text-xl font-bold text-md-on-surface mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            动态
          </h2>

          {!circle.activities || circle.activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-md-outline-variant mx-auto mb-3" />
              <p className="text-md-on-surface-variant">暂无动态</p>
            </div>
          ) : (
            <div className="space-y-3">
              {circle.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-md-surface-container/30 border border-transparent hover:border-md-outline-variant/20 transition-all"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-md-primary-container/30 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-md-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-md-on-surface">
                      <span className="text-md-primary font-medium">
                        {activity.username}
                      </span>
                      <span className="text-md-on-surface-variant">
                        {" "}
                        完成了{" "}
                      </span>
                      <span className="text-md-on-surface font-medium">
                        {activity.habit_name}
                      </span>
                    </p>
                    <p className="text-xs text-md-on-surface-variant mt-1">
                      {formatDateTime(activity.checked_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="md-card-elevated p-6 w-full max-w-md mx-4 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-md-on-surface flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-md-error" />
                删除圈子
              </h2>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="md-btn md-btn-icon text-md-on-surface-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-md-on-surface-variant mb-6">
              确定要删除圈子「{circle.name}」吗？此操作不可撤销，所有成员将被移除。
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="md-btn md-btn-outlined md-btn-sm"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="md-btn md-btn-danger md-btn-sm"
              >
                <Trash2 className="w-4 h-4" />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}