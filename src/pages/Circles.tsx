import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, api } from "@/store";
import { formatDateShort } from "@/utils/formatDate";
import { Users, Plus, Copy, X, Check, Clock, Crown, Shield, Mail, LogIn } from "lucide-react";

interface CircleData {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  role: "creator" | "admin" | "member";
  created_at: string;
}

interface InvitationData {
  id: number;
  circle_name: string;
  sender_username: string;
  invite_code: string;
  created_at: string;
}

interface CirclesResponse {
  circles: CircleData[];
  invitations: InvitationData[];
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; className: string }> = {
  creator: { label: "创建者", icon: Crown, className: "md-chip bg-md-tertiary-container text-md-on-tertiary-container" },
  admin: { label: "管理员", icon: Shield, className: "md-chip bg-md-secondary-container text-md-on-secondary-container" },
  member: { label: "成员", icon: Users, className: "md-chip bg-md-surface-variant text-md-on-surface-variant" },
};

export default function Circles() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const [circles, setCircles] = useState<CircleData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);

  // Create circle
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Copy
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Join circle by invite code
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  // Invitation handling
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);

  const fetchCircles = useCallback(async () => {
    try {
      const data = await api<CirclesResponse>("/circles");
      setCircles(data.circles || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error("Failed to fetch circles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCircles();
  }, []);

  const handleCopyCode = (code: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await api("/circles", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() }),
      });
      setShowCreateModal(false);
      setCreateName("");
      await fetchCircles();
    } catch (err: any) {
      setError(err.message || "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvitation = async (invitation: InvitationData) => {
    setAcceptingId(invitation.id);
    setError("");
    try {
      await api("/circles/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: invitation.invite_code }),
      });
      await fetchCircles();
    } catch (err: any) {
      setError(err.message || "加入失败");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineInvitation = async (invitation: InvitationData) => {
    setDecliningId(invitation.id);
    try {
      await api(`/circles/invitations/${invitation.id}/decline`, {
        method: "POST",
      });
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err: any) {
      console.error("Decline failed:", err);
    } finally {
      setDecliningId(null);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    setError("");
    setJoining(true);
    try {
      await api("/circles/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
      });
      setShowJoinModal(false);
      setJoinCode("");
      await fetchCircles();
    } catch (err: any) {
      setError(err.message || "加入失败");
    } finally {
      setJoining(false);
    }
  };

  const renderRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.member;
    const Icon = config.icon;
    return (
      <span className={`md-chip flex items-center gap-1 text-xs px-2 py-0.5 ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="md-card p-6 space-y-4">
          <div className="h-8 w-40 animate-pulse rounded bg-md-surface-variant" />
          <div className="h-16 w-full animate-pulse rounded bg-md-surface-variant" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="md-card p-5 space-y-3">
                <div className="h-6 w-32 animate-pulse rounded bg-md-surface-variant" />
                <div className="h-4 w-20 animate-pulse rounded bg-md-surface-variant" />
                <div className="h-4 w-28 animate-pulse rounded bg-md-surface-variant" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-md-on-surface flex items-center gap-2">
          <Users className="w-6 h-6" />
          自律圈子
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setError("");
              setShowJoinModal(true);
            }}
            className="md-btn md-btn-outlined md-btn-sm"
          >
            <LogIn className="w-4 h-4" />
            加入圈子
          </button>
          <button
            onClick={() => {
              setError("");
              setShowCreateModal(true);
            }}
            className="md-btn md-btn-filled md-btn-sm"
          >
            <Plus className="w-4 h-4" />
            创建圈子
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 md-card p-3 text-md-error text-sm flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
          <button
            onClick={() => setError("")}
            className="ml-auto md-btn md-btn-icon md-btn-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-md-on-surface flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-md-primary" />
            待处理邀请
            <span className="md-chip bg-md-primary-container text-md-on-primary-container text-xs px-2 py-0.5">
              {invitations.length}
            </span>
          </h2>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="md-card md-card-elevated p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-md-primary-container flex items-center justify-center">
                    <Users className="w-5 h-5 text-md-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-md-on-surface">{inv.circle_name}</p>
                    <p className="text-sm text-md-on-surface-variant flex items-center gap-1">
                      <span>{inv.sender_username} 邀请你加入</span>
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        {formatDateShort(inv.created_at)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAcceptInvitation(inv)}
                    disabled={acceptingId === inv.id}
                    className="md-btn md-btn-filled md-btn-sm"
                  >
                    <Check className="w-4 h-4" />
                    {acceptingId === inv.id ? "加入中..." : "接受"}
                  </button>
                  <button
                    onClick={() => handleDeclineInvitation(inv)}
                    disabled={decliningId === inv.id}
                    className="md-btn md-btn-outlined md-btn-sm"
                  >
                    <X className="w-4 h-4" />
                    {decliningId === inv.id ? "拒绝中..." : "拒绝"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="md-divider mt-4" />
        </div>
      )}

      
      {circles.length === 0 ? (
        <div className="md-card p-12 text-center">
          <Users className="w-16 h-16 text-md-outline-variant mx-auto mb-4" />
          <p className="text-md-on-surface-variant text-lg mb-2">还没有加入任何圈子</p>
          <p className="text-md-on-surface-variant text-sm opacity-70 mb-4">
            创建一个圈子，邀请好友一起自律打卡吧！
          </p>
          <button
            onClick={() => {
              setError("");
              setShowCreateModal(true);
            }}
            className="md-btn md-btn-filled"
          >
            <Plus className="w-4 h-4" />
            创建第一个圈子
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-md-on-surface flex items-center gap-2 mb-3">
            <Users className="w-5 h-5" />
            我的圈子
            <span className="text-md-on-surface-variant text-sm font-normal">
              ({circles.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {circles.map((circle) => (
              <div
                key={circle.id}
                onClick={() => navigate(`/circles/${circle.id}`)}
                className="md-card md-card-elevated rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-md-on-surface truncate pr-2">
                    {circle.name}
                  </h3>
                  <span className="flex items-center gap-1 text-sm text-md-on-surface-variant flex-shrink-0">
                    <Users className="w-4 h-4" />
                    {circle.member_count}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {renderRoleBadge(circle.role)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-md-on-surface-variant">邀请码:</span>
                    <code className="text-md-primary bg-md-primary-container/30 px-2 py-0.5 rounded font-mono text-xs">
                      {circle.invite_code}
                    </code>
                    <button
                      onClick={(e) => handleCopyCode(circle.invite_code, circle.id, e)}
                      className="text-md-on-surface-variant hover:text-md-primary transition-colors"
                      title="复制邀请码"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {copiedId === circle.id && (
                      <span className="text-md-primary text-xs animate-fade-in">
                        已复制
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="md-card-elevated p-6 w-full max-w-md mx-4 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-md-on-surface flex items-center gap-2">
                <Plus className="w-5 h-5" />
                创建圈子
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="md-btn md-btn-icon text-md-on-surface-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-md-on-surface-variant mb-1">
                  圈子名称
                </label>
                <input
                  type="text"
                  className="md-input"
                  placeholder="给你的圈子起个名字"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-md-error text-sm">{error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="md-btn md-btn-outlined md-btn-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !createName.trim()}
                  className="md-btn md-btn-filled md-btn-sm"
                >
                  {submitting ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="md-card-elevated p-6 w-full max-w-md mx-4 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-md-on-surface flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                加入圈子
              </h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="md-btn md-btn-icon text-md-on-surface-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-md-on-surface-variant mb-1">
                  输入邀请码
                </label>
                <input
                  type="text"
                  className="md-input"
                  placeholder="输入圈子邀请码"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                  autoFocus
                  maxLength={8}
                />
              </div>

              {error && (
                <p className="text-md-error text-sm">{error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="md-btn md-btn-outlined md-btn-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleJoinByCode}
                  disabled={joining || !joinCode.trim()}
                  className="md-btn md-btn-filled md-btn-sm"
                >
                  {joining ? "加入中..." : "加入"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}