import { useEffect, useState, useCallback } from "react";
import { useAppStore, api } from "@/store";
import { formatDateShort } from "@/utils/formatDate";
import {
  Crown,
  Star,
  Flame,
  Trophy,
  Heart,
  Award,
  Lock,
  Shield,
  Zap,
  Sword,
  Sunrise,
  type LucideIcon,
} from "lucide-react";

// ---- Types (mirrored from store) ----

interface CharacterData {
  id: number;
  userId: number;
  level: number;
  exp: number;
  expToNext: number;
  title: string;
  currentStreak: number;
  maxStreak: number;
  totalCheckins: number;
  achievements: AchievementData[];
}

interface AchievementData {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

// ---- Icon mapping for achievements ----

const achievementIconMap: Record<string, LucideIcon> = {
  sword: Sword,
  shield: Shield,
  heart: Heart,
  zap: Zap,
  flame: Flame,
  trophy: Trophy,
  star: Star,
  award: Award,
  crown: Crown,
  sunrise: Sunrise,
  lock: Lock,
};

function getAchievementIcon(name: string): LucideIcon {
  return achievementIconMap[name] || Star;
}

// ---- Skeleton loader ----

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-md-surface-container-high ${className}`} />
  );
}

// ---- Main component ----

export default function Character() {
  const { character, setCharacter } = useAppStore();
  const [loading, setLoading] = useState(true);

  const fetchCharacter = useCallback(async () => {
    try {
      const data = await api<CharacterData>("/character");
      setCharacter(data as any);
    } catch (err) {
      console.error("Failed to fetch character:", err);
    } finally {
      setLoading(false);
    }
  }, [setCharacter]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  // ---- Loading skeleton ----

  if (loading) {
    return (
      <div className="min-h-screen bg-md-surface p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Hero skeleton */}
          <div className="md-card md-card-elevated p-8 flex flex-col items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>

          {/* Stats skeleton */}
          <div className="md-card p-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Achievements skeleton */}
          <div className="md-card md-card-elevated p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Not loaded ----

  if (!character) {
    return (
      <div className="min-h-screen bg-md-surface p-4 md:p-6 flex items-center justify-center">
        <div className="md-card md-card-elevated p-8 text-center">
          <Shield className="w-16 h-16 text-md-on-surface-variant/40 mx-auto mb-4" />
          <p className="text-md-on-surface-variant text-lg">角色数据加载失败，请重试</p>
        </div>
      </div>
    );
  }

  const expPercent = Math.min(
    (character.exp / Math.max(character.expToNext, 1)) * 100,
    100
  );
  const unlockedAchievements = character.achievements.filter((a) => a.unlockedAt);
  const lockedAchievements = character.achievements.filter((a) => !a.unlockedAt);

  // ---- Stats data ----

  const stats = [
    { icon: Crown, label: "等级", value: character.level },
    { icon: Star, label: "总经验", value: character.exp },
    { icon: Flame, label: "当前连续", value: character.currentStreak },
    { icon: Trophy, label: "最长连续", value: character.maxStreak },
    { icon: Heart, label: "总打卡", value: character.totalCheckins },
  ];

  // ---- Main content ----

  return (
    <div className="min-h-screen bg-md-surface p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ===== Hero Section ===== */}
        <div className="md-card md-card-elevated p-8 flex flex-col items-center gap-3">
          {/* Level number with decorative icons */}
          <div className="relative inline-flex items-center justify-center">
            <Sword className="w-8 h-8 text-md-primary/30 absolute -left-10" />
            <div className="relative">
              <div className="text-7xl font-bold text-md-primary tabular-nums leading-none">
                Lv.{character.level}
              </div>
              <Sunrise className="absolute -top-3 -right-5 w-5 h-5 text-md-primary/50" />
            </div>
            <Shield className="w-8 h-8 text-md-primary/30 absolute -right-10" />
          </div>

          {/* Title */}
          <div className="text-xl text-md-on-primary-container font-semibold tracking-wide bg-md-primary-container/60 px-4 py-1 rounded-full">
            {character.title}
          </div>

          {/* EXP Progress Bar */}
          <div className="w-full max-w-md mt-2">
            <div className="flex justify-between text-sm text-md-on-surface-variant mb-1.5">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                EXP
              </span>
              <span>
                {character.exp} / {character.expToNext}
              </span>
            </div>
            <div className="md-progress">
              <div
                className="md-progress-fill"
                style={{ width: `${expPercent}%` }}
              />
            </div>
            <div className="text-xs text-md-on-surface-variant/60 text-right mt-1">
              {expPercent >= 100
                ? "可以升级了！"
                : `距离升级还需 ${character.expToNext - character.exp} 经验`}
            </div>
          </div>
        </div>

        {/* ===== Stats Grid ===== */}
        <div className="md-card p-6">
          <h2 className="text-xl font-bold text-md-on-surface mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-md-primary" />
            属性面板
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="text-center p-4 rounded-xl bg-md-surface-container transition-colors"
                >
                  <Icon className="w-6 h-6 text-md-primary mx-auto mb-1.5" />
                  <div className="text-xl font-bold text-md-on-surface">
                    {stat.value}
                  </div>
                  <div className="text-xs text-md-on-surface-variant">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Achievement Wall ===== */}
        <div className="md-card md-card-elevated p-6">
          <h2 className="text-xl font-bold text-md-on-surface mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-md-primary" />
            成就墙
            <span className="text-sm text-md-on-surface-variant font-normal ml-2">
              {unlockedAchievements.length}/{character.achievements.length}
            </span>
          </h2>

          {character.achievements.length === 0 ? (
            <p className="text-md-on-surface-variant text-center py-8">
              暂无成就，继续坚持即可解锁！
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Unlocked achievements first */}
              {unlockedAchievements.map((ach) => {
                const Icon = getAchievementIcon(ach.icon);
                return (
                  <div
                    key={ach.id}
                    className="p-4 rounded-xl bg-md-primary-container border border-md-primary transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-full bg-md-surface">
                        <Icon className="w-5 h-5 text-md-on-primary-container" />
                      </div>
                      <Award className="w-4 h-4 text-md-primary" />
                    </div>
                    <div className="text-md-on-surface font-semibold text-sm truncate">
                      {ach.name}
                    </div>
                    <div className="text-xs text-md-on-surface-variant mt-1 line-clamp-2">
                      {ach.description}
                    </div>
                    {ach.unlockedAt && (
                      <div className="text-xs text-md-primary mt-2">
                        {formatDateShort(ach.unlockedAt)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Locked achievements */}
              {lockedAchievements.map((ach) => {
                const Icon = getAchievementIcon(ach.icon);
                return (
                  <div
                    key={ach.id}
                    className="p-4 rounded-xl bg-md-surface-container-high opacity-60 border border-md-outline-variant"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-full bg-md-surface">
                        <Icon className="w-5 h-5 text-md-on-surface-variant" />
                      </div>
                      <Lock className="w-4 h-4 text-md-on-surface-variant" />
                    </div>
                    <div className="text-md-on-surface-variant font-semibold text-sm truncate">
                      {ach.name}
                    </div>
                    <div className="text-xs text-md-on-surface-variant/60 mt-1 line-clamp-2">
                      {ach.description}
                    </div>
                    <div className="text-xs text-md-on-surface-variant/60 mt-2">
                      未解锁
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}