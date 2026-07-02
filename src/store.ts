import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  token: string;
  isAdmin?: boolean;
}

interface Character {
  id: number;
  userId: number;
  level: number;
  exp: number;
  expToNext: number;
  title: string;
  currentStreak: number;
  maxStreak: number;
  totalCheckins: number;
  achievements: Achievement[];
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

interface Habit {
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

interface Circle {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  is_member: number;
  created_at: string;
}

interface Quote {
  id: number;
  content: string;
  type: 'encourage' | 'warning';
  generated_at: string;
}

interface AppStore {
  user: User | null;
  character: Character | null;
  habits: Habit[];
  circles: Circle[];
  quotes: Quote[];
  darkMode: boolean;
  debugMode: boolean;
  debugTimeOffset: number;
  timezone: string;
  setUser: (user: User | null) => void;
  setCharacter: (character: Character) => void;
  setHabits: (habits: Habit[]) => void;
  addHabit: (habit: Habit) => void;
  updateHabit: (habit: Habit) => void;
  removeHabit: (id: number) => void;
  setCircles: (circles: Circle[]) => void;
  addQuote: (quote: Quote) => void;
  setQuotes: (quotes: Quote[]) => void;
  toggleDarkMode: () => void;
  setDebugMode: (enabled: boolean) => void;
  setDebugTimeOffset: (offset: number) => void;
  setTimezone: (timezone: string) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      character: null,
      habits: [],
      circles: [],
      quotes: [],
      darkMode: false,
      debugMode: false,
      debugTimeOffset: 0,
      timezone: 'Asia/Shanghai',
      setUser: (user) => set({ user }),
      setCharacter: (character) => set({ character }),
      setHabits: (habits) => set({ habits }),
      addHabit: (habit) => set((s) => ({ habits: [...s.habits, habit] })),
      updateHabit: (habit) => set((s) => ({ habits: s.habits.map((h) => (h.id === habit.id ? habit : h)) })),
      removeHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
      setCircles: (circles) => set({ circles }),
      addQuote: (quote) => set((s) => ({ quotes: [quote, ...s.quotes] })),
      setQuotes: (quotes) => set({ quotes }),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      setDebugTimeOffset: (offset) => set({ debugTimeOffset: offset }),
      setTimezone: (timezone) => set({ timezone }),
      logout: () => set({ user: null, character: null, habits: [], circles: [], quotes: [] }),
    }),
    {
      name: 'self-discipline-storage',
      partialize: (state) => ({
        user: state.user,
        darkMode: state.darkMode,
        timezone: state.timezone,
      }),
    }
  )
);

const API_BASE = '/api';

// ─── URL Token 支持（多用户同时登录） ───
// URL token 优先级高于 localStorage 中的 token，允许多个标签页使用不同用户登录
let urlToken: string | null = null;

/** 从 URL 参数中提取并设置 token */
export function captureUrlToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    urlToken = token;
  }
  return urlToken;
}

/** 设置 URL token（供外部调用） */
export function setUrlToken(token: string | null) {
  urlToken = token;
}

/** 获取当前有效的 token：URL token > 持久化 token */
export function getActiveToken(): string | null {
  if (urlToken) return urlToken;
  return useAppStore.getState().user?.token || null;
}

// ─── API 请求 ───

function headers() {
  const state = useAppStore.getState();
  const token = urlToken || state.user?.token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(state.debugMode ? { 'X-Debug-Mode': 'true' } : {}),
    ...(state.debugTimeOffset !== 0 ? { 'X-Debug-Time-Offset': String(state.debugTimeOffset) } : {}),
  };
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const hdrs = headers();
  const body = options?.body;
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: { ...hdrs, ...(options?.headers as Record<string, string> || {}) },
  };
  if (body !== undefined) {
    fetchOptions.body = body;
  }
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);
  const data = await res.json();
  if (!data.success) {
    console.error(`API Error [${options?.method || 'GET'} ${path}]:`, data.error, `(status: ${res.status})`);
    throw new Error(data.error || '请求失败');
  }
  return data.data;
}