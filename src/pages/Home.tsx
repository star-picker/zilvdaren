import { useEffect, useState, useCallback } from "react";
import { useAppStore, api } from "@/store";
import { formatDateShort } from "@/utils/formatDate";
import {
  Flame,
  Star,
  Trophy,
  CheckCircle2,
  Sparkles,
  Zap,
  Target,
  Dumbbell,
  BookOpen,
  Bed,
  Apple,
  Music,
  Pen,
  Code,
  Heart,
  Coffee,
  Brain,
  Moon,
  Sun,
  AlertTriangle,
  X,
  type LucideIcon,
} from "lucide-react";

// ---- Types (mirrored from store since not exported) ----

interface HabitData {
  id: number;
  user_id: number;
  name: string;
  icon: string;
  difficulty: number;
  frequency: string;
  reminder_time: string | null;
  created_at: string;
  checked_today: number;
}

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
  penalty?: {
    totalPenalty: number;
    missedHabits: string[];
  } | null;
}

interface AchievementData {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

interface QuoteData {
  id: number;
  content: string;
  type: "encourage" | "warning";
  generated_at: string;
}

interface CheckinTodayItem {
  habitId: number;
  checked: boolean;
}

interface CheckinResult {
  expGained: number;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
  currentStreak: number;
  quote?: QuoteData;
}

// ---- Icon mapping ----

const iconMap: Record<string, LucideIcon> = {
  target: Target,
  dumbbell: Dumbbell,
  book: BookOpen,
  bed: Bed,
  apple: Apple,
  music: Music,
  pen: Pen,
  code: Code,
  heart: Heart,
  coffee: Coffee,
  brain: Brain,
  moon: Moon,
  sun: Sun,
  star: Star,
  zap: Zap,
  flame: Flame,
  trophy: Trophy,
  sparkles: Sparkles,
  check: CheckCircle2,
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] || Target;
}

// ---- Skeleton loader ----

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-md-surface-container ${className}`} />
  );
}

// ---- Difficulty stars ----

function DifficultyStars({ difficulty }: { difficulty: number }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < difficulty ? "text-yellow-500 fill-yellow-500" : "text-gray-400"
          }`}
        />
      ))}
    </div>
  );
}

// ---- EXP floating animation ----

interface ExpAnimation {
  id: number;
  exp: number;
  x: number;
  y: number;
}

// ---- Main component ----

export default function Home() {
  const { habits, character, quotes, setHabits, setCharacter, setQuotes } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [expAnimations, setExpAnimations] = useState<ExpAnimation[]>([]);
  const [penaltyInfo, setPenaltyInfo] = useState<CharacterData['penalty'] | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [habitsData, checkinData, characterData, quotesData] = await Promise.all([
        api<HabitData[]>("/habits"),
        api<CheckinTodayItem[]>("/checkin/today"),
        api<CharacterData>("/character"),
        api<QuoteData[]>("/quotes"),
      ]);

      const checkedMap = new Map<number, boolean>();
      for (const item of checkinData) {
        checkedMap.set(item.habitId, item.checked);
      }
      const merged = habitsData.map((h) => ({
        ...h,
        checked_today: checkedMap.get(h.id) ? 1 : h.checked_today,
      }));

      setHabits(merged as any);
      setCharacter(characterData as any);
      setQuotes(quotesData as any);

      // Show penalty notification if any
      const charData = characterData as unknown as CharacterData;
      if (charData.penalty) {
        setPenaltyInfo(charData.penalty);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [setHabits, setCharacter, setQuotes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckin = async (habit: HabitData, event: React.MouseEvent) => {
    if (checkingId !== null || habit.checked_today > 0) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    setCheckingId(habit.id);
    try {
      const result = await api<CheckinResult>("/checkin", {
        method: "POST",
        body: JSON.stringify({ habitId: habit.id }),
      });

      const animId = Date.now();
      setExpAnimations((prev) => [...prev, { id: animId, exp: result.expGained, x, y }]);
      setTimeout(() => {
        setExpAnimations((prev) => prev.filter((a) => a.id !== animId));
      }, 1500);

      // If a quote was auto-generated, prepend it to the quotes list
      if (result.quote) {
        setQuotes([result.quote as any, ...quotes]);
      }

      await fetchData();
    } catch (err) {
      console.error("Checkin failed:", err);
    } finally {
      setCheckingId(null);
    }
  };

  const latestQuote = quotes[0] as QuoteData | undefined;

  // ---- Loading skeleton ----

  if (loading) {
    return (
      <div className="min-h-screen bg-md-surface p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top row: left + right */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left skeleton */}
            <div className="md:col-span-2 md-card-elevated rounded-2xl p-6 space-y-4">
              <Skeleton className="h-8 w-40" />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-xl bg-md-surface-container"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              ))}
            </div>

            {/* Right skeleton */}
            <div className="md-card-elevated rounded-2xl p-6 space-y-5">
              <Skeleton className="h-8 w-40" />
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-10 w-16 rounded-lg" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom skeleton */}
          <div className="md-card-elevated rounded-2xl p-6 space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ---- Main content ----

  return (
    <div className="min-h-screen bg-md-surface p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* EXP floating animations */}
        {expAnimations.map((anim) => (
          <div
            key={anim.id}
            className="fixed pointer-events-none z-50 text-md-primary font-bold text-lg animate-slide-up"
            style={{ left: anim.x, top: anim.y, transform: "translate(-50%, 0)" }}
          >
            EXP +{anim.exp}
          </div>
        ))}

        {/* Penalty Notification */}
        {penaltyInfo && (
          <div className="md-card border-l-4 border-l-[var(--md-error)] bg-[var(--md-error-container)]/40 p-4 animate-slide-up">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--md-error)] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--md-error)]">
                    漏打卡惩罚！
                  </h3>
                  <button
                    onClick={() => setPenaltyInfo(null)}
                    className="text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-[var(--md-on-surface)] mt-1">
                  昨日以下习惯未完成：
                  <span className="font-medium">
                    {penaltyInfo.missedHabits.join('、')}
                  </span>
                </p>
                <p className="text-sm text-[var(--md-error)] font-semibold mt-1">
                  EXP -{penaltyInfo.totalPenalty}，连续打卡已中断
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top row: left (tasks) + right (character) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ===== LEFT: 今日任务 ===== */}
          <div className="md:col-span-2 md-card-elevated rounded-2xl p-6">
            <h2 className="text-xl font-bold text-md-primary mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              今日任务
            </h2>

            {habits.length === 0 ? (
              <p className="text-md-on-surface-variant text-center py-8">
                还没有习惯，快去创建一个吧！
              </p>
            ) : (
              <div className="space-y-3">
                {(habits as unknown as HabitData[]).map((habit) => {
                  const Icon = getIcon(habit.icon);
                  const isChecked = habit.checked_today > 0;
                  const isChecking = checkingId === habit.id;

                  return (
                    <div
                      key={habit.id}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${
                        isChecked
                          ? "bg-md-tertiary-container/30 border border-md-outline-variant"
                          : "bg-md-surface-container border border-transparent hover:border-md-outline-variant"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-full flex-shrink-0 ${
                            isChecked ? "bg-md-primary-container" : "bg-md-surface-container-high"
                          }`}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="w-5 h-5 text-md-primary" />
                          ) : (
                            <Icon className="w-5 h-5 text-md-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-md-on-surface truncate">
                            {habit.name}
                          </p>
                          <DifficultyStars difficulty={habit.difficulty} />
                        </div>
                      </div>

                      {isChecked ? (
                        <button
                          disabled
                          className="md-btn md-btn-tonal md-btn-sm flex-shrink-0 ml-3 opacity-70 cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          已完成
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleCheckin(habit, e)}
                          disabled={checkingId !== null}
                          className="md-btn md-btn-filled md-btn-sm flex-shrink-0 ml-3"
                        >
                          {isChecking ? (
                            <Sparkles className="w-4 h-4 animate-spin" />
                          ) : (
                            "打卡"
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== RIGHT: 角色面板 ===== */}
          <div className="md-card-elevated rounded-2xl p-6">
            <h2 className="text-xl font-bold text-md-primary mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              角色面板
            </h2>

            {character ? (
              <div className="space-y-5">
                {/* Level & Title */}
                <div className="text-center">
                  <div className="text-5xl font-bold text-md-primary mb-1">
                    Lv.{character.level}
                  </div>
                  <div className="text-md-on-primary-container font-medium">
                    {character.title}
                  </div>
                </div>

                {/* EXP Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-md-on-surface-variant mb-1.5">
                    <span>EXP</span>
                    <span>
                      {character.exp} / {character.expToNext}
                    </span>
                  </div>
                  <div className="md-progress">
                    <div
                      className="md-progress-fill"
                      style={{
                        width: `${Math.min(
                          (character.exp / Math.max(character.expToNext, 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Stats Chips */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="md-chip flex-col py-2 gap-1 text-center">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-md-on-surface font-bold">
                      {character.currentStreak}
                    </span>
                    <span className="text-[0.65rem] text-md-on-surface-variant">
                      当前连续
                    </span>
                  </div>
                  <div className="md-chip flex-col py-2 gap-1 text-center">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="text-md-on-surface font-bold">
                      {character.maxStreak}
                    </span>
                    <span className="text-[0.65rem] text-md-on-surface-variant">
                      最长连续
                    </span>
                  </div>
                  <div className="md-chip flex-col py-2 gap-1 text-center">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-md-on-surface font-bold">
                      {character.totalCheckins}
                    </span>
                    <span className="text-[0.65rem] text-md-on-surface-variant">
                      总打卡
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-md-on-surface-variant text-center py-8">
                角色数据加载中...
              </p>
            )}
          </div>
        </div>

        {/* ===== BOTTOM: AI 语录 ===== */}
        <div className="md-card-elevated rounded-2xl p-6">
          <h2 className="text-xl font-bold text-md-primary mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI 语录
          </h2>

          <div className="relative">
            <div className="absolute -top-2 -left-2 text-md-primary/20 text-4xl select-none leading-none">
              &ldquo;
            </div>

            {latestQuote ? (
              <p className="text-md-on-surface text-lg italic leading-relaxed px-4 py-4 border-l-4 border-md-primary bg-md-surface-container rounded-r-xl">
                {latestQuote.content}
              </p>
            ) : (
              <p className="text-md-on-surface-variant text-lg italic leading-relaxed px-4 py-4 border-l-4 border-md-primary bg-md-surface-container rounded-r-xl">
                勇士，每一天的坚持都是对自我的超越。拿起你的自律之剑，踏上今日的征程吧！
              </p>
            )}

            {latestQuote && (
              <div className="flex items-center gap-2 mt-3 px-4">
                <span
                  className={`md-chip ${
                    latestQuote.type === "encourage"
                      ? "!bg-green-100 dark:!bg-green-900/40 !text-green-700 dark:!text-green-300"
                      : "!bg-red-100 dark:!bg-red-900/40 !text-red-700 dark:!text-red-300"
                  }`}
                >
                  {latestQuote.type === "encourage" ? "鼓励" : "警示"}
                </span>
                <span className="text-xs text-md-on-surface-variant">
                  {formatDateShort(latestQuote.generated_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}