import { useAppStore } from "@/store";

/**
 * 将数据库中的 UTC 时间字符串标准化为 JS 可正确解析的 UTC 格式
 * SQLite 返回 "YYYY-MM-DD HH:MM:SS"，JS 会误解析为本地时间
 * 需要转为 "YYYY-MM-DDTHH:MM:SSZ" 确保解析为 UTC
 */
function parseAsUTC(dateStr: string): Date {
  // 如果已经是 ISO 格式（含 T 或 Z），直接解析
  if (dateStr.includes('T') || dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
    return new Date(dateStr);
  }
  // SQLite 格式 "YYYY-MM-DD HH:MM:SS" → 转为 UTC 解析
  const normalized = dateStr.replace(' ', 'T') + 'Z';
  return new Date(normalized);
}

/**
 * 使用用户设置的时区格式化日期
 */
export function formatDate(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
): string {
  if (!dateStr) return "未知";
  try {
    const tz = useAppStore.getState().timezone || "Asia/Shanghai";
    const date = parseAsUTC(dateStr);
    if (isNaN(date.getTime())) return "未知";
    return new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: tz }).format(date);
  } catch {
    return "未知";
  }
}

/**
 * 格式化日期（短格式，如 6月29日）
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  return formatDate(dateStr, { month: "numeric", day: "numeric" });
}

/**
 * 格式化时间（如 14:30）
 */
export function formatTime(dateStr: string | null | undefined): string {
  return formatDate(dateStr, { hour: "2-digit", minute: "2-digit" });
}

/**
 * 格式化日期+时间（如 6月29日 14:30）
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  return formatDate(dateStr, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}