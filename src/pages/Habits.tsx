import { useEffect, useState, useCallback } from "react";
import { useAppStore, api } from "@/store";
import {
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
  Moon as MoonIcon,
  Sun as SunIcon,
  Trophy,
  Star,
  Zap,
  Plus,
  Edit3,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

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
  moon: MoonIcon,
  sun: SunIcon,
  trophy: Trophy,
  star: Star,
  zap: Zap,
};

const iconKeys = Object.keys(iconMap);

function getIcon(name: string): LucideIcon {
  return iconMap[name] || Target;
}

// ---- Difficulty stars ----

function DifficultyStars({ difficulty }: { difficulty: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < difficulty ? "text-md-primary fill-md-primary" : "text-md-outline-variant"}`}
        />
      ))}
    </div>
  );
}

// ---- Confirm dialog ----

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="md-card-elevated rounded-2xl p-6 w-full max-w-sm mx-4 animate-scale-in">
        <h3 className="text-lg font-bold text-md-on-surface mb-3">{title}</h3>
        <p className="text-md-on-surface-variant mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="md-btn md-btn-text">
            取消
          </button>
          <button onClick={onConfirm} className="md-btn md-btn-danger">
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal form ----

interface HabitFormData {
  name: string;
  icon: string;
  difficulty: number;
  frequency: string;
}

interface HabitModalProps {
  open: boolean;
  editing: ({ id: number } & HabitFormData) | null;
  onClose: () => void;
  onSubmit: (data: HabitFormData) => Promise<void>;
}

function HabitModal({ open, editing, onClose, onSubmit }: HabitModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("target");
  const [difficulty, setDifficulty] = useState(3);
  const [frequency, setFrequency] = useState("daily");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setIcon(editing.icon);
      setDifficulty(editing.difficulty);
      setFrequency(editing.frequency);
    } else {
      setName("");
      setIcon("target");
      setDifficulty(3);
      setFrequency("daily");
    }
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon, difficulty, frequency });
      onClose();
    } catch (err) {
      console.error("Failed to submit habit:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const SelectedIcon = getIcon(icon);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="md-card-elevated rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-md-on-surface">
            {editing ? "编辑习惯" : "创建习惯"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-md-on-surface-variant hover:bg-md-surface-container transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-sm text-md-on-surface-variant mb-2">
            习惯名称
          </label>
          <input
            type="text"
            className="md-input"
            placeholder="例如：每天运动"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
        </div>

        {/* Icon selector */}
        <div className="mb-5">
          <label className="block text-sm text-md-on-surface-variant mb-2">
            图标
            <span className="ml-2 inline-flex items-center gap-1 text-md-primary">
              <SelectedIcon className="w-4 h-4" />
              <span className="text-xs">当前选择</span>
            </span>
          </label>
          <div className="grid grid-cols-8 gap-2">
            {iconKeys.map((key) => {
              const IconComponent = iconMap[key];
              const isSelected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={`p-2 rounded-xl transition-all ${
                    isSelected
                      ? "bg-md-primary-container ring-2 ring-md-primary"
                      : "bg-md-surface-container hover:bg-md-surface-container-high"
                  }`}
                  title={key}
                >
                  <IconComponent
                    className={`w-5 h-5 ${
                      isSelected ? "text-md-on-primary-container" : "text-md-on-surface-variant"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty slider */}
        <div className="mb-5">
          <label className="block text-sm text-md-on-surface-variant mb-2">
            难度
            <span className="ml-2 text-md-primary text-xs">
              {difficulty} / 5
            </span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-[var(--md-primary)]"
              style={{
                background: `linear-gradient(90deg, var(--md-primary) ${((difficulty - 1) / 4) * 100}%, var(--md-surface-variant) ${((difficulty - 1) / 4) * 100}%)`,
              }}
            />
            <DifficultyStars difficulty={difficulty} />
          </div>
        </div>

        {/* Frequency toggle */}
        <div className="mb-6">
          <label className="block text-sm text-md-on-surface-variant mb-2">
            频率
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFrequency("daily")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                frequency === "daily"
                  ? "bg-md-primary-container text-md-on-primary-container"
                  : "bg-md-surface-container text-md-on-surface-variant hover:bg-md-surface-container-high"
              }`}
            >
              <SunIcon className="w-4 h-4" />
              每日
            </button>
            <button
              type="button"
              onClick={() => setFrequency("weekly")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                frequency === "weekly"
                  ? "bg-md-secondary-container text-md-on-secondary-container"
                  : "bg-md-surface-container text-md-on-surface-variant hover:bg-md-surface-container-high"
              }`}
            >
              <MoonIcon className="w-4 h-4" />
              每周
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="md-divider mb-6" />

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="md-btn md-btn-text flex-1">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="md-btn md-btn-filled flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "提交中..." : editing ? "保存修改" : "创建习惯"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main component ----

export default function Habits() {
  const { habits, setHabits } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<{
    id: number;
    name: string;
    icon: string;
    difficulty: number;
    frequency: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<typeof habits>("/habits");
      setHabits(data);
    } catch (err) {
      console.error("Failed to fetch habits:", err);
    } finally {
      setLoading(false);
    }
  }, [setHabits]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const handleCreate = async (data: HabitFormData) => {
    await api("/habits", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await fetchHabits();
  };

  const handleEdit = async (data: HabitFormData) => {
    if (!editingHabit) return;
    await api(`/habits/${editingHabit.id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    await fetchHabits();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api(`/habits/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    await fetchHabits();
  };

  const openEdit = (habit: (typeof habits)[number]) => {
    setEditingHabit({
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      difficulty: habit.difficulty,
      frequency: habit.frequency,
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

  // ---- Loading skeleton ----

  if (loading) {
    return (
      <div className="min-h-screen bg-md-surface p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 w-32 animate-pulse rounded-full bg-md-surface-container" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-md-surface-container" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="md-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full animate-pulse bg-md-surface-container-high" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-24 animate-pulse rounded-full bg-md-surface-container-high" />
                    <div className="h-4 w-16 animate-pulse rounded-full bg-md-surface-container-high" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-6 w-12 animate-pulse rounded-lg bg-md-surface-container-high" />
                  <div className="flex gap-2">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-md-surface-container-high" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-md-surface-container-high" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Main content ----

  return (
    <div className="min-h-screen bg-md-surface p-4 md:p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-md-on-surface flex items-center gap-2">
            <Target className="w-5 h-5 text-md-primary" />
            我的习惯
          </h2>
        </div>

        {/* Habit list */}
        {habits.length === 0 ? (
          <div className="md-card rounded-2xl p-12 text-center">
            <Target className="w-12 h-12 text-md-outline-variant mx-auto mb-4" />
            <p className="text-md-on-surface-variant mb-4">
              还没有习惯，快去创建一个吧！
            </p>
            <button onClick={openCreate} className="md-btn md-btn-filled">
              <Plus className="w-4 h-4" />
              创建第一个习惯
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {habits.map((habit) => {
              const Icon = getIcon(habit.icon);

              return (
                <div
                  key={habit.id}
                  className="md-card rounded-2xl p-5 flex flex-col gap-3"
                >
                  {/* Top: icon + name + difficulty */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-md-primary-container flex-shrink-0">
                      <Icon className="w-5 h-5 text-md-on-primary-container" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-md-on-surface truncate text-sm">
                        {habit.name}
                      </p>
                      <DifficultyStars difficulty={habit.difficulty} />
                    </div>
                  </div>

                  {/* Bottom: frequency chip + actions */}
                  <div className="flex items-center justify-between">
                    <span className="md-chip">
                      {habit.frequency === "daily" ? (
                        <SunIcon className="w-3 h-3" />
                      ) : (
                        <MoonIcon className="w-3 h-3" />
                      )}
                      {habit.frequency === "daily" ? "每日" : "每周"}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(habit)}
                        className="md-btn md-btn-icon text-md-on-surface-variant hover:bg-md-surface-container-high"
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({ id: habit.id, name: habit.name })
                        }
                        className="md-btn md-btn-icon text-md-on-surface-variant hover:bg-md-error-container hover:text-md-error"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB - Create habit */}
      <button
        onClick={openCreate}
        className="md-fab fixed bottom-6 right-6 z-40"
        title="创建习惯"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create / Edit modal */}
      <HabitModal
        open={modalOpen}
        editing={editingHabit}
        onClose={() => {
          setModalOpen(false);
          setEditingHabit(null);
        }}
        onSubmit={editingHabit ? handleEdit : handleCreate}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除习惯"
        message={`确定要删除「${deleteTarget?.name}」吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}