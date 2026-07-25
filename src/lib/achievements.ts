import {
  Sparkles, Flame, Target, Trophy, Book, Dumbbell, Wallet, Brain, Rocket,
  Crown, Star, Zap, Award, Medal, Gem, Compass, TrendingUp, Sunrise,
  type LucideIcon,
} from "lucide-react";

export type Tier = "bronze" | "silver" | "gold" | "diamond" | "legendary";

export type BadgeDef = {
  key: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  tier: Tier;
  xp: number;
  check: (s: AchievementStats) => boolean;
};

export type AchievementStats = {
  totalXp: number;
  level: number;
  streak: number;
  tasksCompleted: number;
  workouts: number;
  journals: number;
  finances: number;
  readings: number;
  maxSkillLevel: number;
  customSkills: { id: string; name: string; level: number }[];
};

const CORE_BADGES: BadgeDef[] = [
  // First-time milestones
  { key: "primeira_missao", name: "Primeiro passo", desc: "Complete sua primeira missão", icon: Sparkles, tier: "bronze", xp: 25, check: (s) => s.tasksCompleted >= 1 },
  { key: "primeiro_streak", name: "Primeira fagulha", desc: "Comece uma sequência de dias", icon: Flame, tier: "bronze", xp: 25, check: (s) => s.streak >= 1 },
  { key: "primeiro_nivel", name: "Ascensão inicial", desc: "Alcance o nível 2", icon: Rocket, tier: "bronze", xp: 30, check: (s) => s.level >= 2 },
  { key: "primeira_skill", name: "Talento desperto", desc: "Suba uma habilidade ao nível 2", icon: Compass, tier: "bronze", xp: 30, check: (s) => s.maxSkillLevel >= 2 },

  // XP milestones
  { key: "xp_100", name: "100 XP", desc: "Acumule 100 XP", icon: Zap, tier: "bronze", xp: 20, check: (s) => s.totalXp >= 100 },
  { key: "xp_500", name: "500 XP", desc: "Acumule 500 XP", icon: Zap, tier: "silver", xp: 40, check: (s) => s.totalXp >= 500 },
  { key: "xp_1000", name: "1.000 XP", desc: "Acumule 1.000 XP", icon: TrendingUp, tier: "silver", xp: 60, check: (s) => s.totalXp >= 1000 },
  { key: "xp_5000", name: "5.000 XP", desc: "Acumule 5.000 XP", icon: Trophy, tier: "gold", xp: 120, check: (s) => s.totalXp >= 5000 },
  { key: "xp_10000", name: "10.000 XP", desc: "Acumule 10.000 XP", icon: Trophy, tier: "diamond", xp: 200, check: (s) => s.totalXp >= 10000 },
  { key: "xp_50000", name: "Mito de XP", desc: "Acumule 50.000 XP", icon: Crown, tier: "legendary", xp: 500, check: (s) => s.totalXp >= 50000 },

  // Streak milestones
  { key: "streak_3", name: "Três dias firme", desc: "3 dias de sequência", icon: Flame, tier: "bronze", xp: 25, check: (s) => s.streak >= 3 },
  { key: "streak_7", name: "Semana de fogo", desc: "7 dias de sequência", icon: Flame, tier: "silver", xp: 60, check: (s) => s.streak >= 7 },
  { key: "streak_30", name: "Mês perfeito", desc: "30 dias de sequência", icon: Flame, tier: "gold", xp: 150, check: (s) => s.streak >= 30 },
  { key: "streak_100", name: "Inabalável", desc: "100 dias de sequência", icon: Crown, tier: "legendary", xp: 500, check: (s) => s.streak >= 100 },

  // Level milestones
  { key: "nivel_5", name: "Ascendente", desc: "Alcance o nível 5", icon: Sunrise, tier: "bronze", xp: 40, check: (s) => s.level >= 5 },
  { key: "nivel_10", name: "Elevado", desc: "Alcance o nível 10", icon: Star, tier: "silver", xp: 80, check: (s) => s.level >= 10 },
  { key: "nivel_25", name: "Mestre", desc: "Alcance o nível 25", icon: Award, tier: "gold", xp: 150, check: (s) => s.level >= 25 },
  { key: "nivel_50", name: "Lenda viva", desc: "Alcance o nível 50", icon: Gem, tier: "diamond", xp: 300, check: (s) => s.level >= 50 },
  { key: "nivel_100", name: "Imortal", desc: "Alcance o nível 100", icon: Crown, tier: "legendary", xp: 1000, check: (s) => s.level >= 100 },

  // Missions milestones
  { key: "missoes_10", name: "Em ritmo", desc: "Complete 10 missões", icon: Target, tier: "bronze", xp: 30, check: (s) => s.tasksCompleted >= 10 },
  { key: "missoes_50", name: "Determinado", desc: "Complete 50 missões", icon: Target, tier: "silver", xp: 60, check: (s) => s.tasksCompleted >= 50 },
  { key: "missoes_100", name: "Centurião", desc: "Complete 100 missões", icon: Medal, tier: "gold", xp: 150, check: (s) => s.tasksCompleted >= 100 },
  { key: "missoes_500", name: "Imparável", desc: "Complete 500 missões", icon: Crown, tier: "legendary", xp: 600, check: (s) => s.tasksCompleted >= 500 },

  // Skill mastery
  { key: "skill_5", name: "Especialista", desc: "Suba uma habilidade ao nível 5", icon: Star, tier: "silver", xp: 60, check: (s) => s.maxSkillLevel >= 5 },
  { key: "skill_10", name: "Mestre da arte", desc: "Suba uma habilidade ao nível 10", icon: Gem, tier: "diamond", xp: 200, check: (s) => s.maxSkillLevel >= 10 },

  // Área-específicas
  { key: "leitor", name: "Leitor voraz", desc: "10 sessões de leitura", icon: Book, tier: "silver", xp: 50, check: (s) => s.readings >= 10 },
  { key: "atleta", name: "Corpo em forma", desc: "10 treinos registrados", icon: Dumbbell, tier: "silver", xp: 50, check: (s) => s.workouts >= 10 },
  { key: "financeiro", name: "Consciência financeira", desc: "20 transações registradas", icon: Wallet, tier: "silver", xp: 50, check: (s) => s.finances >= 20 },
  { key: "mente_clara", name: "Mente clara", desc: "10 reflexões no diário", icon: Brain, tier: "silver", xp: 50, check: (s) => s.journals >= 10 },
];

/**
 * Auto-generates dynamic milestone badges for each custom skill the user creates.
 * A new custom skill => a new "First level" and "Level 5 mastery" achievement,
 * unlocked automatically as the user levels it up. No manual creation needed.
 */
export function buildBadges(customSkills: AchievementStats["customSkills"] = []): BadgeDef[] {
  const dynamic: BadgeDef[] = [];
  for (const s of customSkills) {
    const safe = s.id.slice(0, 8);
    dynamic.push({
      key: `custom_skill_${safe}_lv2`,
      name: `Marco: ${s.name}`,
      desc: `Alcance o nível 2 em ${s.name}`,
      icon: Compass,
      tier: "bronze",
      xp: 30,
      check: () => s.level >= 2,
    });
    dynamic.push({
      key: `custom_skill_${safe}_lv5`,
      name: `Domínio: ${s.name}`,
      desc: `Alcance o nível 5 em ${s.name}`,
      icon: Star,
      tier: "gold",
      xp: 120,
      check: () => s.level >= 5,
    });
  }
  return [...CORE_BADGES, ...dynamic];
}

// Static export for pages that don't know custom skills yet — always safe.
export const BADGES: BadgeDef[] = CORE_BADGES;

export const tierStyles: Record<Tier, {
  ring: string; grad: string; text: string; glow: string; label: string; particle: string;
}> = {
  bronze:    { ring: "ring-bronze/50",    grad: "from-bronze/50 to-bronze/5",       text: "text-bronze",    glow: "bg-bronze/25",    label: "Bronze",    particle: "bg-bronze" },
  silver:    { ring: "ring-silver/50",    grad: "from-silver/40 to-silver/5",       text: "text-silver",    glow: "bg-silver/25",    label: "Prata",     particle: "bg-silver" },
  gold:      { ring: "ring-gold/60",      grad: "from-gold/50 to-gold/10",          text: "text-gold",      glow: "bg-gold/30",      label: "Ouro",      particle: "bg-gold" },
  diamond:   { ring: "ring-diamond/60",   grad: "from-diamond/50 to-diamond/5",     text: "text-diamond",   glow: "bg-diamond/30",   label: "Diamante",  particle: "bg-diamond" },
  legendary: { ring: "ring-legendary/70", grad: "from-legendary/60 to-legendary/10",text: "text-legendary", glow: "bg-legendary/35", label: "Lendário",  particle: "bg-legendary" },
};

export const TIER_ORDER: Tier[] = ["bronze", "silver", "gold", "diamond", "legendary"];

export const ACHIEVEMENT_UNLOCK_EVENT = "ascension:achievement-unlocked";
export type UnlockDetail = { badge: BadgeDef };
