import { supabase } from "@/integrations/supabase/client";
import { detectTask } from "@/lib/xp-calc";

// ---------------------------------------------------------------- types
export type Difficulty = "muito_facil" | "facil" | "media" | "dificil" | "epica" | "lendaria";
export type Priority = "baixa" | "normal" | "alta" | "urgente";
export type Status = "pendente" | "em_andamento" | "concluida" | "falhada" | "atrasada" | "cancelada";
export type RepeatKind = "unica" | "diaria" | "semanal" | "mensal" | "personalizada";
export type RepeatRule =
  | "every_day"
  | "weekdays"
  | "weekends"
  | "specific_days"
  | "every_x_days"
  | "every_x_weeks"
  | "every_x_months"
  | "custom_date";

export const DIFFICULTIES: Difficulty[] = ["muito_facil", "facil", "media", "dificil", "epica", "lendaria"];

export const difficultyMeta: Record<Difficulty, { label: string; icon: string; mult: number; className: string }> = {
  muito_facil: { label: "Muito Fácil", icon: "🌱", mult: 0.6, className: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" },
  facil: { label: "Fácil", icon: "🍃", mult: 1, className: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  media: { label: "Média", icon: "⚔️", mult: 1.45, className: "text-sky-300 border-sky-400/30 bg-sky-400/10" },
  dificil: { label: "Difícil", icon: "🔥", mult: 1.95, className: "text-orange-300 border-orange-400/30 bg-orange-400/10" },
  epica: { label: "Épica", icon: "💜", mult: 2.6, className: "text-purple-300 border-purple-400/30 bg-purple-400/10" },
  lendaria: { label: "Lendária", icon: "👑", mult: 3.4, className: "text-gold border-gold/30 bg-gold/10" },
};

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "text-muted-foreground border-border bg-muted/20" },
  normal: { label: "Normal", className: "text-sky-300 border-sky-400/30 bg-sky-400/10" },
  alta: { label: "Alta", className: "text-orange-300 border-orange-400/30 bg-orange-400/10" },
  urgente: { label: "Urgente", className: "text-red-300 border-red-400/30 bg-red-400/10" },
};

export const statusMeta: Record<Status, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "text-muted-foreground border-border bg-muted/20" },
  em_andamento: { label: "Em andamento", className: "text-electric border-electric/30 bg-electric/10" },
  concluida: { label: "Concluída", className: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  falhada: { label: "Falhada", className: "text-red-400 border-red-400/30 bg-red-400/10" },
  atrasada: { label: "Atrasada", className: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  cancelada: { label: "Cancelada", className: "text-muted-foreground border-border bg-muted/10" },
};

export const repeatKindLabels: Record<RepeatKind, string> = {
  unica: "Única",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  personalizada: "Personalizada",
};

export const repeatRuleLabels: Record<RepeatRule, string> = {
  every_day: "Todos os dias",
  weekdays: "Segunda a sexta",
  weekends: "Apenas finais de semana",
  specific_days: "Dias específicos da semana",
  every_x_days: "A cada X dias",
  every_x_weeks: "A cada X semanas",
  every_x_months: "A cada X meses",
  custom_date: "Data personalizada",
};

export const WEEKDAYS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
  { v: 7, label: "Dom" },
];

// ------------------------------------------------- inteligência de dificuldade
const COMPLEX_KW = /\b(projeto|entregar|finalizar|apresenta[çc][aã]o|prova|maratona|dia\s?inteiro|deep\s?work|foco\s?profundo|desafio|dif[ií]cil|planejar|analisar|refator|estrat[eé]gia)\b/i;
const TRIVIAL_KW = /\b(agua|água|beber|cama|escovar|dente|vitamina|alongar|respirar|5\s?min)\b/i;

const CATEGORY_WEIGHT: Record<string, number> = {
  estudo: 1.5,
  treino: 1.5,
  leitura: 0.5,
  meditacao: -0.5,
  nutricao: -0.5,
  financas: 1,
  habito: -1,
  outro: 0,
};

export interface MissionAnalysis {
  difficulty: Difficulty;
  score: number;
  baseXp: number;
  bonusXp: number;
  xp: number;
  estimatedMin: number;
}

/** Analisa nome, descrição, tempo estimado, categoria e complexidade. */
export function analyzeMission(input: {
  title: string;
  description?: string | null;
  estimatedMin?: number | null;
  category?: string | null;
  difficulty?: Difficulty | null; // dificuldade manual (trava a classificação)
}): MissionAnalysis {
  const title = (input.title || "").trim();
  const desc = (input.description || "").trim();
  const text = `${title} ${desc}`.toLowerCase();
  const detected = detectTask(title);
  const minutes = Math.max(0, Math.round(input.estimatedMin ?? detected.durationMin ?? 0));

  let score = 0;
  // tempo estimado é o fator dominante
  if (minutes > 0) {
    if (minutes <= 10) score -= 2;
    else if (minutes <= 20) score += 0;
    else if (minutes <= 45) score += 2;
    else if (minutes <= 90) score += 4;
    else if (minutes <= 180) score += 6;
    else score += 9;
  }
  // complexidade textual
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 12) score += 1;
  if (desc.length >= 120) score += 1;
  if (COMPLEX_KW.test(text)) score += 3;
  if (TRIVIAL_KW.test(text)) score -= 3;
  // categoria
  score += CATEGORY_WEIGHT[input.category ?? detected.category] ?? 0;

  const difficulty = input.difficulty ?? difficultyFromScore(score);
  const meta = difficultyMeta[difficulty];
  const baseXp = Math.max(5, Math.round(8 + minutes * 0.45));
  const xp = Math.max(3, Math.round(baseXp * meta.mult));
  return { difficulty, score, baseXp, bonusXp: xp - baseXp, xp, estimatedMin: minutes };
}

export function difficultyFromScore(score: number): Difficulty {
  if (score <= -2) return "muito_facil";
  if (score <= 1) return "facil";
  if (score <= 4) return "media";
  if (score <= 7) return "dificil";
  if (score <= 10) return "epica";
  return "lendaria";
}

export function suggestedPenalty(xp: number) {
  return Math.max(5, Math.round(xp * 0.5));
}

// ------------------------------------------------------------------ datas
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function dueDateTime(t: { due_date?: string | null; due_time?: string | null }): Date | null {
  if (!t.due_date) return null;
  const time = (t.due_time || "23:59").slice(0, 5);
  return new Date(`${t.due_date}T${time}:00`);
}

export function countdown(target: Date | null, now = Date.now()) {
  if (!target) return null;
  const diff = target.getTime() - now;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const parts = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
  return { late: diff < 0, text: diff < 0 ? `atrasada há ${parts}` : `faltam ${parts}`, ms: diff };
}

export type MissionFilter = "hoje" | "amanha" | "semana" | "mes" | "concluidas" | "falhadas" | "pendentes" | "todas";

export const filterLabels: Record<MissionFilter, string> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  semana: "Esta semana",
  mes: "Este mês",
  pendentes: "Pendentes",
  concluidas: "Concluídas",
  falhadas: "Falhadas",
  todas: "Todas",
};

export function matchesFilter(t: any, filter: MissionFilter): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = t.due_date ? new Date(`${t.due_date}T00:00:00`) : null;
  const dayMs = 86400000;
  switch (filter) {
    case "hoje":
      return !t.completed && t.status !== "cancelada" && (!due || due.getTime() <= today.getTime());
    case "amanha":
      return !t.completed && !!due && due.getTime() === today.getTime() + dayMs;
    case "semana": {
      const end = new Date(today.getTime() + (7 - ((today.getDay() + 6) % 7)) * dayMs);
      return !!due && due >= today && due < end;
    }
    case "mes":
      return !!due && due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
    case "pendentes":
      return !t.completed && ["pendente", "em_andamento", "atrasada"].includes(t.status);
    case "concluidas":
      return !!t.completed;
    case "falhadas":
      return t.status === "falhada";
    default:
      return true;
  }
}

// ------------------------------------------------------------------- RPCs
export async function refreshMissionStates() {
  const { error } = await supabase.rpc("refresh_mission_states" as any);
  if (error) throw error;
}

export async function generateRecurringMissions() {
  const { error } = await supabase.rpc("generate_recurring_missions" as any);
  if (error) throw error;
}

export async function getMissionStats() {
  const { data, error } = await supabase.rpc("get_mission_stats" as any);
  if (error) throw error;
  return (data ?? null) as null | {
    completed: number;
    failed: number;
    pending: number;
    success_rate: number;
    best_streak: number;
    xp_from_missions: number;
    time_spent_min: number;
  };
}

// ---------------------------------------------------------- notificações
export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function notify(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* noop */
  }
}
