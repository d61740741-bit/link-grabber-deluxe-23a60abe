// Helpers for the Recovery / Quit Bad Habits module.

export type Difficulty = "easy" | "medium" | "hard";
export type Priority = "low" | "medium" | "high";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const DIFFICULTY_BASE_XP: Record<Difficulty, number> = {
  easy: 5,
  medium: 8,
  hard: 12,
};

export const HABIT_PRESETS = [
  { name: "Pornografia", icon: "🔞", color: "#ef4444" },
  { name: "Cigarro", icon: "🚬", color: "#f97316" },
  { name: "Álcool", icon: "🍺", color: "#eab308" },
  { name: "Açúcar", icon: "🍭", color: "#ec4899" },
  { name: "Fast Food", icon: "🍔", color: "#f59e0b" },
  { name: "Redes Sociais", icon: "📱", color: "#3b82f6" },
  { name: "Apostas", icon: "🎰", color: "#8b5cf6" },
  { name: "Jogos", icon: "🎮", color: "#10b981" },
  { name: "Maconha", icon: "🌿", color: "#22c55e" },
] as const;

export const COLOR_CHOICES = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f43f5e",
];

export const ICON_CHOICES = [
  "🚫", "🔞", "🚬", "🍺", "🍭", "🍔", "📱", "🎰", "🎮", "🌿",
  "☕", "🍿", "🧊", "💊", "💸", "📺", "🍩", "🍫", "🥤", "🎲",
];

export type CleanTime = {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  weeks: number;
  months: number;
  years: number;
};

export function cleanTimeFrom(startedAt: string | Date, now: Date = new Date()): CleanTime {
  const start = new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor((now.getTime() - start) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const weeks = Math.floor((days % 30) / 7);
  return { totalSeconds, days, hours, minutes, seconds, weeks, months, years };
}

export function formatShort(t: CleanTime): string {
  if (t.years > 0) return `${t.years}a ${t.months}m`;
  if (t.months > 0) return `${t.months}m ${t.days % 30}d`;
  if (t.days > 0) return `${t.days}d ${t.hours}h`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m`;
  if (t.minutes > 0) return `${t.minutes}m ${t.seconds}s`;
  return `${t.seconds}s`;
}

export function formatFull(t: CleanTime): string {
  const parts: string[] = [];
  if (t.years) parts.push(`${t.years}a`);
  if (t.months) parts.push(`${t.months % 12}mes`);
  if (t.days) parts.push(`${t.days % 30}d`);
  parts.push(`${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}:${String(t.seconds).padStart(2, "0")}`);
  return parts.join(" ");
}

// Recovery Score 0-100
export function recoveryScore(input: {
  currentStreakSec: number;
  bestStreakSec: number;
  relapseCount: number;
  totalCleanSec: number;
  ageDays: number;
}): number {
  const streakDays = input.currentStreakSec / 86400;
  const bestDays = input.bestStreakSec / 86400;
  const totalDays = input.totalCleanSec / 86400 + streakDays;
  // Base: current streak logistic
  const streakScore = Math.min(50, 50 * (1 - Math.exp(-streakDays / 30)));
  // Best streak achievement
  const bestScore = Math.min(20, 20 * (1 - Math.exp(-bestDays / 60)));
  // Consistency: clean vs total time tracked
  const consistency = input.ageDays > 0
    ? Math.min(20, 20 * (totalDays / Math.max(1, input.ageDays)))
    : 0;
  // Relapse penalty
  const penalty = Math.min(20, input.relapseCount * 2);
  const raw = streakScore + bestScore + consistency + 10 - penalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function scoreColor(score: number): { name: string; hex: string; className: string } {
  if (score < 20) return { name: "Crítico", hex: "#ef4444", className: "text-red-400" };
  if (score < 40) return { name: "Baixo", hex: "#f97316", className: "text-orange-400" };
  if (score < 60) return { name: "Em progresso", hex: "#eab308", className: "text-yellow-400" };
  if (score < 80) return { name: "Bom", hex: "#22c55e", className: "text-emerald-400" };
  if (score < 95) return { name: "Excelente", hex: "#3b82f6", className: "text-blue-400" };
  return { name: "Lendário", hex: "#a855f7", className: "text-purple-400" };
}

export const RECOVERY_MISSION_TEMPLATES = [
  { title: "Ficar limpo hoje", xp: 10 },
  { title: "Caminhar 20 minutos", xp: 6 },
  { title: "Meditar 10 minutos", xp: 6 },
  { title: "Ler 10 páginas", xp: 5 },
  { title: "Treinar o corpo", xp: 8 },
  { title: "Beber 2L de água", xp: 4 },
  { title: "Dormir antes das 24h", xp: 6 },
  { title: "Escrever no diário", xp: 5 },
  { title: "Respiração 4-7-8", xp: 4 },
];
