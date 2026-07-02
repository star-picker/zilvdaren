import { useState, useEffect } from 'react';
import { useAppStore, api } from '@/store';
import { X } from 'lucide-react';

const DAY_SECONDS = 86400;
const ACHIEVEMENT_NAMES = ['初出茅庐', '持之以恒', '早起达人', '全能选手', '百天传奇'];
const EXP_PER_DIFFICULTY = [0, 10, 20, 30, 50, 80];

export default function DebugPanel({ onClose }: { onClose: () => void }) {
  const {
    character, setCharacter,
    habits, setHabits,
    debugMode, setDebugMode,
    debugTimeOffset, setDebugTimeOffset,
  } = useAppStore();

  // ---- Form state ----
  const [timeOffsetInput, setTimeOffsetInput] = useState("");
  // Character modification
  const [attrLevel, setAttrLevel] = useState("");
  const [attrExp, setAttrExp] = useState("");
  const [attrStreak, setAttrStreak] = useState("");
  const [attrMaxStreak, setAttrMaxStreak] = useState("");
  const [attrTotalCheckins, setAttrTotalCheckins] = useState("");
  const [attrTitle, setAttrTitle] = useState("");
  const [charMsg, setCharMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkinHabitId, setCheckinHabitId] = useState('');
  const [checkinDaysAgo, setCheckinDaysAgo] = useState('');

  // ---- Init form from character ----
  useEffect(() => {
    if (character) {
      setAttrLevel(String(character.level));
      setAttrExp(String(character.exp));
      setAttrStreak(String(character.currentStreak));
      setAttrMaxStreak(String(character.maxStreak));
      setAttrTotalCheckins(String(character.totalCheckins));
      setAttrTitle(character.title);
    }
  }, [character]);

  // ---- Computed simulated time ----
  const simulatedTime = new Date(Date.now() + debugTimeOffset * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const simulatedTimeStr = `${simulatedTime.getFullYear()}-${pad(simulatedTime.getMonth() + 1)}-${pad(simulatedTime.getDate())} ${pad(simulatedTime.getHours())}:${pad(simulatedTime.getMinutes())}`;

  // ---- Refresh helpers ----
  const refreshCharacter = async () => {
    try {
      const data = await api<any>('/character');
      setCharacter(data);
    } catch (err) {
      console.error('刷新角色数据失败:', err);
    }
  };

  const refreshHabits = async () => {
    try {
      const data = await api<any[]>('/habits');
      setHabits(data as any);
    } catch (err) {
      console.error('刷新习惯数据失败:', err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshCharacter(), refreshHabits()]);
  };

  // ---- Time offset quick buttons ----
  const setTimeOffset = (offset: number) => {
    setDebugTimeOffset(offset);
    setTimeOffsetInput(String(offset));
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const nowMs = now.getTime();

  const timePresets: { label: string; offset: number }[] = [
    { label: '今天', offset: 0 },
    { label: '昨天', offset: Math.floor((todayStart - DAY_SECONDS * 1000 - nowMs) / 1000) },
    { label: '明天', offset: Math.floor((todayStart + DAY_SECONDS * 1000 - nowMs) / 1000) },
    { label: '上周', offset: -7 * DAY_SECONDS },
    { label: '下周', offset: 7 * DAY_SECONDS },
    { label: '30天前', offset: -30 * DAY_SECONDS },
    { label: '30天后', offset: 30 * DAY_SECONDS },
  ];

  // ---- Apply character attribute changes ----
  const applyCharacter = async () => {
    try {
      const body: Record<string, unknown> = {};
      const levelVal = attrLevel ? parseInt(attrLevel) : undefined;
      const expVal = attrExp ? parseInt(attrExp) : undefined;
      const streakVal = attrStreak ? parseInt(attrStreak) : undefined;
      const maxStreakVal = attrMaxStreak ? parseInt(attrMaxStreak) : undefined;
      const totalCheckinsVal = attrTotalCheckins ? parseInt(attrTotalCheckins) : undefined;
      const titleVal = attrTitle || undefined;

      if (levelVal !== undefined && !isNaN(levelVal)) body.level = levelVal;
      if (expVal !== undefined && !isNaN(expVal)) body.exp = expVal;
      if (streakVal !== undefined && !isNaN(streakVal)) body.currentStreak = streakVal;
      if (maxStreakVal !== undefined && !isNaN(maxStreakVal)) body.maxStreak = maxStreakVal;
      if (totalCheckinsVal !== undefined && !isNaN(totalCheckinsVal)) body.totalCheckins = totalCheckinsVal;
      if (titleVal !== undefined) body.title = titleVal;

      console.log('[Debug] Applying character:', body);
      await api('/debug/character', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await refreshCharacter();
      setCharMsg({ type: 'success', text: '角色属性修改成功' });
      setTimeout(() => setCharMsg(null), 2000);
    } catch (err: any) {
      console.error('修改角色属性失败:', err);
      setCharMsg({ type: 'error', text: err.message || '修改失败' });
      setTimeout(() => setCharMsg(null), 3000);
    }
  };

  // ---- Add checkin ----
  const addCheckin = async () => {
    if (!checkinHabitId || !checkinDaysAgo) return;
    const habitId = parseInt(checkinHabitId);
    const daysAgo = parseInt(checkinDaysAgo);
    const habit = habits.find((h) => h.id === habitId);
    const expGained = EXP_PER_DIFFICULTY[habit?.difficulty || 1];

    try {
      await api('/debug/add-checkin', {
        method: 'POST',
        body: JSON.stringify({ habitId, daysAgo, expGained }),
      });
      await refreshAll();
    } catch (err) {
      console.error('添加打卡失败:', err);
    }
  };

  // ---- Clear all checkins ----
  const clearCheckins = async () => {
    if (!window.confirm('确定要清除全部打卡记录吗？此操作不可恢复。')) return;
    try {
      await api('/debug/clear-checkins', { method: 'POST' });
      await refreshAll();
    } catch (err) {
      console.error('清除打卡失败:', err);
    }
  };

  // ---- Unlock all achievements ----
  const unlockAllAchievements = async () => {
    try {
      for (const name of ACHIEVEMENT_NAMES) {
        await api('/debug/unlock-achievement', {
          method: 'POST',
          body: JSON.stringify({ achievementName: name }),
        });
      }
      await refreshCharacter();
    } catch (err) {
      console.error('解锁成就失败:', err);
    }
  };

  // ---- Relock all achievements ----
  const relockAllAchievements = async () => {
    try {
      await api('/debug/relock-achievements', { method: 'POST' });
      await refreshCharacter();
    } catch (err) {
      console.error('锁定成就失败:', err);
    }
  };

  // ---- Toggle debug mode ----
  const toggleDebugMode = async () => {
    const newMode = !debugMode;
    if (newMode) {
      try {
        await api('/debug/snapshot', { method: 'POST' });
      } catch {}
    } else {
      try {
        await api('/debug/restore', { method: 'POST' });
      } catch {}
      setDebugTimeOffset(0);
      setTimeOffsetInput('');
    }
    setDebugMode(newMode);
  };

  // ---- Inline field ----
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-md-on-surface-variant whitespace-nowrap">{label}</span>
      <div className="flex-1 max-w-[140px]">{children}</div>
    </div>
  );

  return (
    <div className="fixed top-20 right-4 z-[100] w-80 md-card-elevated p-0 max-h-[calc(100vh-6rem)] overflow-y-auto animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-md-on-surface">调试面板</span>
        </div>
        <button onClick={onClose} className="md-btn md-btn-icon md-btn-sm text-md-on-surface-variant">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ===== Section 1: 时间偏移 ===== */}
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-md-on-surface-variant uppercase tracking-wide mb-2">时间偏移</h3>
        <div className="md-chip text-[10px] mb-2">
          模拟时间: {simulatedTimeStr}
        </div>
        <Field label="偏移(秒)">
          <input
            className="md-input text-xs py-1"
            type="number"
            value={timeOffsetInput}
            onChange={(e) => setTimeOffsetInput(e.target.value)}
            placeholder="秒数"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && timeOffsetInput !== '') {
                setDebugTimeOffset(parseInt(timeOffsetInput) || 0);
              }
            }}
          />
        </Field>
        <div className="flex flex-wrap gap-1 mt-2">
          {timePresets.map((p) => (
            <button
              key={p.label}
              onClick={() => setTimeOffset(p.offset)}
              className="md-btn md-btn-sm bg-md-surface-container text-md-on-surface-variant hover:text-md-on-surface"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setTimeOffset(0)}
            className="md-btn md-btn-sm md-btn-tonal"
          >
            重置
          </button>
        </div>
      </div>
      <div className="md-divider mx-4" />

      {/* ===== Section 2: 角色属性修改 ===== */}
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-md-on-surface-variant uppercase tracking-wide mb-2">角色属性修改</h3>
        <div className="space-y-2">
          <Field label="等级">
            <input className="md-input text-xs py-1" type="number" value={attrLevel} onChange={(e) => setAttrLevel(e.target.value)} />
          </Field>
          <Field label="经验">
            <input className="md-input text-xs py-1" type="number" value={attrExp} onChange={(e) => setAttrExp(e.target.value)} />
          </Field>
          <Field label="当前连续">
            <input className="md-input text-xs py-1" type="number" value={attrStreak} onChange={(e) => setAttrStreak(e.target.value)} />
          </Field>
          <Field label="最长连续">
            <input className="md-input text-xs py-1" type="number" value={attrMaxStreak} onChange={(e) => setAttrMaxStreak(e.target.value)} />
          </Field>
          <Field label="总打卡">
            <input className="md-input text-xs py-1" type="number" value={attrTotalCheckins} onChange={(e) => setAttrTotalCheckins(e.target.value)} />
          </Field>
          <Field label="称号">
            <input className="md-input text-xs py-1" type="text" value={attrTitle} onChange={(e) => setAttrTitle(e.target.value)} />
          </Field>
        </div>
        <button onClick={applyCharacter} className="md-btn md-btn-filled md-btn-sm w-full mt-3">
          应用修改
        </button>
        {charMsg && (
          <div className={`mt-2 text-xs p-2 rounded-md ${
            charMsg.type === 'success'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {charMsg.text}
          </div>
        )}
      </div>
      <div className="md-divider mx-4" />

      {/* ===== Section 3: 打卡测试 ===== */}
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-md-on-surface-variant uppercase tracking-wide mb-2">打卡测试</h3>

        {/* 选择习惯 */}
        <div className="mb-2">
          <select
            className="md-input text-xs py-1"
            value={checkinHabitId}
            onChange={(e) => setCheckinHabitId(e.target.value)}
          >
            <option value="">选择习惯...</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        {/* 添加历史打卡 */}
        <div className="bg-md-surface-container rounded-xl p-2 mb-2">
          <span className="text-[10px] text-md-on-surface-variant block mb-1">添加历史打卡</span>
          <div className="flex items-center gap-1">
            <input
              className="md-input text-xs py-1 flex-1"
              type="number"
              value={checkinDaysAgo}
              onChange={(e) => setCheckinDaysAgo(e.target.value)}
              placeholder="几天前"
            />
            <button onClick={addCheckin} className="md-btn md-btn-sm md-btn-filled">
              添加
            </button>
          </div>
        </div>

        {/* 清除全部打卡 */}
        <button onClick={clearCheckins} className="md-btn md-btn-sm md-btn-danger w-full">
          清除全部打卡
        </button>
      </div>
      <div className="md-divider mx-4" />

      {/* ===== Section 4: 成就测试 ===== */}
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-md-on-surface-variant uppercase tracking-wide mb-2">成就测试</h3>
        <p className="text-[10px] text-md-on-surface-variant leading-relaxed mb-2">
          使用上方"打卡测试"先添加打卡记录，再解锁对应成就。或直接使用下方按钮测试。
        </p>
        <div className="space-y-2">
          <button onClick={unlockAllAchievements} className="md-btn md-btn-sm md-btn-tonal w-full">
            解锁全部成就
          </button>
          <button onClick={relockAllAchievements} className="md-btn md-btn-sm md-btn-outlined w-full">
            锁定全部成就
          </button>
          <div className="text-[10px] text-md-on-surface-variant mt-1">单独解锁：</div>
          {ACHIEVEMENT_NAMES.map((name) => (
            <button
              key={name}
              onClick={async () => {
                try {
                  await api('/debug/unlock-achievement', {
                    method: 'POST',
                    body: JSON.stringify({ achievementName: name }),
                  });
                  await refreshCharacter();
                } catch (err) {
                  console.error(`解锁${name}失败:`, err);
                }
              }}
              className="md-btn md-btn-sm md-btn-outlined w-full text-xs"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="md-divider mx-4" />

      {/* ===== Section 5: 数据管理 ===== */}
      <div className="px-4 py-3 pb-4">
        <h3 className="text-xs font-semibold text-md-on-surface-variant uppercase tracking-wide mb-2">数据管理</h3>
        <button
          onClick={toggleDebugMode}
          className={`md-btn md-btn-sm w-full mb-2 ${debugMode ? 'md-btn-danger' : 'md-btn-tonal'}`}
        >
          {debugMode ? '退出调试模式' : '进入调试模式'}
        </button>
        <p className="text-[10px] text-md-on-surface-variant leading-relaxed mb-2">
          调试模式下所有操作不会写入实际数据库，关闭调试模式时自动恢复
        </p>
        <button onClick={refreshAll} className="md-btn md-btn-sm md-btn-outlined w-full">
          刷新数据
        </button>
      </div>
    </div>
  );
}