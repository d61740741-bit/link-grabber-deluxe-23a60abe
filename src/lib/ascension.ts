import { supabase } from "@/integrations/supabase/client";

// Level thresholds MUST mirror the database:
//   profile.level = floor(sqrt(total_xp / 50)) + 1  ⇒  xpForLevel(L) = 50 * (L-1)²
//   skill.level   = floor(sqrt(total_xp / 30)) + 1  ⇒  xpForSkillLevel(L) = 30 * (L-1)²
// Keep in sync with public._award_xp_for_user and public._refund_xp_for_user.
export function xpForLevel(level: number) {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) * (l - 1);
}

export function xpForSkillLevel(level: number) {
  const l = Math.max(1, Math.floor(level));
  return 30 * (l - 1) * (l - 1);
}

export function levelFromXp(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

export function skillLevelFromXp(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  return Math.max(1, Math.floor(Math.sqrt(xp / 30)) + 1);
}

export function progressToNext(totalXp: number, level?: number) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  const lvl = level ?? levelFromXp(xp);
  const current = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  const span = Math.max(1, next - current);
  const done = Math.max(0, Math.min(span, xp - current));
  return {
    pct: Math.min(100, Math.round((done / span) * 100)),
    current: done,
    needed: span,
    remaining: Math.max(0, span - done),
    level: lvl,
    nextLevel: lvl + 1,
  };
}

export function progressToNextSkill(totalXp: number, level?: number) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  const lvl = level ?? skillLevelFromXp(xp);
  const current = xpForSkillLevel(lvl);
  const next = xpForSkillLevel(lvl + 1);
  const span = Math.max(1, next - current);
  const done = Math.max(0, Math.min(span, xp - current));
  return {
    pct: Math.min(100, Math.round((done / span) * 100)),
    current: done,
    needed: span,
    remaining: Math.max(0, span - done),
    level: lvl,
    nextLevel: lvl + 1,
  };
}

export async function awardXp(amount: number, source: string, skill?: string) {
  const { error } = await supabase.rpc("award_xp", {
    p_amount: amount,
    p_source: source,
    p_skill: (skill as any) ?? null,
  });
  if (error) throw error;
}

/**
 * Recalcula XP, nível, streak, skills, rank, títulos e Life Score a partir
 * dos registros existentes (fonte única: xp_history). Idempotente.
 * O banco já dispara isso automaticamente em qualquer INSERT/UPDATE/DELETE
 * no ledger — este helper é para forçar sincronização manual quando útil.
 */
export async function RecalcularXP() {
  const { error } = await supabase.rpc("recalc_xp" as any);
  if (error) throw error;
}

export async function completeHabitToday(habitId: string) {
  const { error } = await supabase.rpc("complete_habit_today", { p_habit_id: habitId });
  if (error) throw error;
}


export const skillLabels: Record<string, { label: string; emoji: string; color: string }> = {
  mente: { label: "Mente", emoji: "🧠", color: "from-purple-500/40 to-purple-500/5" },
  corpo: { label: "Corpo", emoji: "💪", color: "from-emerald-500/40 to-emerald-500/5" },
  conhecimento: { label: "Conhecimento", emoji: "📚", color: "from-electric/40 to-electric/5" },
  financas: { label: "Finanças", emoji: "💎", color: "from-gold/40 to-gold/5" },
  disciplina: { label: "Disciplina", emoji: "⚡", color: "from-orange-500/40 to-orange-500/5" },
  social: { label: "Social", emoji: "🤝", color: "from-pink-500/40 to-pink-500/5" },
};

export const categoryLabels: Record<string, string> = {
  estudo: "Estudo",
  treino: "Treino",
  leitura: "Leitura",
  meditacao: "Meditação",
  nutricao: "Nutrição",
  financas: "Finanças",
  habito: "Hábito",
  outro: "Outro",
};
