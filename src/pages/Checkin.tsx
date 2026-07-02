import { useEffect, useState, useMemo } from "react";
import { api } from "@/store";
import { formatDateShort, formatTime } from "@/utils/formatDate";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
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
  X,
  type LucideIcon,
} from "lucide-react";

// ---- Types ----

interface CheckinRecord {
  id: number;
  user_id: number;
  habit_id: number;
  exp_gained: number;
  checked_at: string;
  habit_name: string;
  habit_icon: string;
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
  zap: Zap,
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] || Target;
}

// ---- Constants ----

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getCellColor(count: number): string {
  if (count === 0) return "bg-md-surface-variant";
  if (count === 1) return "bg-green-400/60";
  if (count === 2) return "bg-green-500/70";
  return "bg-green-600/80";
}

function getCellTextColor(count: number): string {
  return count > 0
    ? "text-white"
    : "text-md-on-surface-variant";
}

// ---- Skeleton loader ----

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ backgroundColor: "var(--md-surface-variant)" }}
    />
  );
}

// ---- Main component ----

export default function Checkin() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<CheckinRecord[]>(`/checkin/records?year=${year}&month=${month}`)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        console.error("Failed to fetch checkin records:", err);
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  // ---- Navigation ----

  const goPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    const today = new Date();
    const isCurrentOrFuture =
      year > today.getFullYear() ||
      (year === today.getFullYear() && month >= today.getMonth() + 1);
    if (isCurrentOrFuture) return;

    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const canGoNext = (() => {
    const today = new Date();
    return !(
      year > today.getFullYear() ||
      (year === today.getFullYear() && month >= today.getMonth() + 1)
    );
  })();

  // ---- Calendar data ----

  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const startOffset = (firstDay + 6) % 7; // Monday=0, ... Sunday=6
    const daysInMonth = new Date(year, month, 0).getDate();

    const countMap = new Map<number, number>();
    for (const r of records) {
      const d = new Date(r.checked_at).getDate();
      countMap.set(d, (countMap.get(d) || 0) + 1);
    }

    const totalCells = startOffset + daysInMonth;
    const weekCount = Math.ceil(totalCells / 7);

    const weeks: (number | null)[][] = [];
    let day = 1;
    for (let w = 0; w < weekCount; w++) {
      const week: (number | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const idx = w * 7 + d;
        if (idx < startOffset || idx >= startOffset + daysInMonth) {
          week.push(null);
        } else {
          week.push(day++);
        }
      }
      weeks.push(week);
    }

    return { weeks, countMap };
  }, [year, month, records]);

  // ---- Today highlight check ----

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = today.getDate();

  // ---- Sorted records (newest first) ----

  const sortedRecords = useMemo(() => {
    let filtered = records;
    if (selectedDate) {
      filtered = records.filter((r) => {
        const d = new Date(r.checked_at);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return dateStr === selectedDate;
      });
    }
    return [...filtered].sort(
      (a, b) =>
        new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
    );
  }, [records, selectedDate]);

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  };

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="min-h-screen bg-md-surface p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Month selector skeleton */}
          <div className="md-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-6 w-36 rounded" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>

          {/* Calendar skeleton */}
          <div className="md-card-elevated p-6">
            <div className="flex justify-center">
              <div className="flex gap-1">
                <div className="flex flex-col gap-1 mr-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="w-7 h-7 rounded" />
                  ))}
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {Array.from({ length: 7 }).map((_, di) => (
                        <Skeleton key={di} className="w-7 h-7 rounded" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline skeleton */}
          <div className="md-card p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Main content ----

  return (
    <div className="min-h-screen bg-md-surface p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ===== Month/Year Selector ===== */}
        <div className="md-card p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              className="md-btn md-btn-icon md-btn-text"
              aria-label="上个月"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-md-on-surface flex items-center gap-2">
              <Calendar className="w-5 h-5 text-md-primary" />
              {year}年{month}月
            </h2>

            <button
              onClick={goNext}
              disabled={!canGoNext}
              className={`md-btn md-btn-icon ${
                canGoNext
                  ? "md-btn-text"
                  : "text-md-on-surface-variant/30 cursor-not-allowed"
              }`}
              aria-label="下个月"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===== Calendar Heatmap ===== */}
        <div className="md-card-elevated p-6">
          <div className="flex justify-center">
            <div className="flex gap-1">
              {/* Day-of-week labels */}
              <div className="flex flex-col gap-1 mr-1">
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 flex items-center justify-center text-[10px] text-md-on-surface-variant"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {calendarData.weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day, di) => {
                    if (day === null) {
                      return <div key={di} className="w-7 h-7 rounded" />;
                    }
                    const count = calendarData.countMap.get(day) || 0;
                    const isToday = isCurrentMonth && day === todayDate;
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = selectedDate === dateStr;
                    return (
                      <button
                        key={di}
                        onClick={() => handleDateClick(day)}
                        className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-medium transition-colors cursor-pointer ${
                          isToday
                            ? "ring-2 ring-md-primary ring-offset-1 ring-offset-md-surface-container-high"
                            : ""
                        } ${isSelected ? "ring-2 ring-md-tertiary ring-offset-1 ring-offset-md-surface-container-high" : ""} ${getCellColor(count)} ${getCellTextColor(count)}`}
                        title={`${month}月${day}日: ${count}次打卡${isSelected ? ' (已选中)' : ''}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-4 justify-end">
            <span className="text-[10px] text-md-on-surface-variant">少</span>
            <div className="w-3 h-3 rounded bg-md-surface-variant" />
            <div className="w-3 h-3 rounded bg-green-400/60" />
            <div className="w-3 h-3 rounded bg-green-500/70" />
            <div className="w-3 h-3 rounded bg-green-600/80" />
            <span className="text-[10px] text-md-on-surface-variant">多</span>
          </div>
        </div>

        {/* ===== Checkin Timeline ===== */}
        <div className="md-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-md-on-surface flex items-center gap-2">
              <Clock className="w-5 h-5 text-md-primary" />
              {selectedDate ? (
                <span>
                  打卡记录
                  <span className="text-md-primary text-base ml-1">
                    ({selectedDate})
                  </span>
                </span>
              ) : (
                "打卡记录"
              )}
            </h2>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="md-btn md-btn-sm md-btn-outlined"
              >
                <X className="w-4 h-4" />
                清除筛选
              </button>
            )}
          </div>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-md-on-surface-variant">
              <Calendar className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">本月暂无打卡记录</p>
              <p className="text-xs mt-1 opacity-70">快去完成今日任务吧！</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedRecords.map((record) => {
                const Icon = getIcon(record.habit_icon);
                const dateStr = formatDateShort(record.checked_at);
                const timeStr = formatTime(record.checked_at);

                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-md-outline-variant hover:bg-md-surface-container-high transition-colors"
                  >
                    <div className="p-2 rounded-full bg-md-primary-container flex-shrink-0">
                      <Icon className="w-4 h-4 text-md-on-primary-container" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-md-on-surface truncate">
                        {record.habit_name}
                      </p>
                      <p className="text-xs text-md-on-surface-variant">
                        {dateStr} {timeStr}
                      </p>
                    </div>

                    <span className="md-chip flex-shrink-0">
                      <Zap className="w-3 h-3" />+{record.exp_gained}
                    </span>
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