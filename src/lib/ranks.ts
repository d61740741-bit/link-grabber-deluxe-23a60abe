// Complete Rank System — derived automatically from the player's stats.
// Never set manually. The rank is the highest tier whose ALL requirements are met.

export type RankRequirements = {
  level: number;
  xp: number;
  skillLevel: number;   // required level in at least `skillCount` skills
  skillCount: number;
  achievements: number;
  streak: number;       // consecutive day streak
  missions: number;     // completed tasks/missions
};

export type Rank = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  // Tailwind class fragments used across gradients & rings.
  tone: string;         // gradient (from-... to-...)
  ring: string;         // ring color
  glow: string;         // outer glow
  requires: RankRequirements;
};

export const RANKS: Rank[] = [
  {
    id: "beginner",
    name: "Iniciante",
    icon: "🌱",
    tagline: "A jornada começa aqui.",
    tone: "from-slate-400/50 to-slate-500/10",
    ring: "ring-slate-300/30",
    glow: "shadow-[0_0_40px_-10px_rgba(148,163,184,0.6)]",
    requires: { level: 1, xp: 0, skillLevel: 0, skillCount: 0, achievements: 0, streak: 0, missions: 0 },
  },
  {
    id: "explorer",
    name: "Explorador",
    icon: "🧭",
    tagline: "Você já está no caminho.",
    tone: "from-sky-400/60 to-cyan-500/10",
    ring: "ring-sky-300/40",
    glow: "shadow-[0_0_50px_-8px_rgba(56,189,248,0.55)]",
    requires: { level: 5, xp: 500, skillLevel: 3, skillCount: 1, achievements: 2, streak: 3, missions: 10 },
  },
  {
    id: "warrior",
    name: "Guerreiro",
    icon: "⚔️",
    tagline: "Disciplina forjada em batalha.",
    tone: "from-emerald-400/60 to-teal-500/10",
    ring: "ring-emerald-300/40",
    glow: "shadow-[0_0_55px_-8px_rgba(52,211,153,0.6)]",
    requires: { level: 10, xp: 2000, skillLevel: 5, skillCount: 2, achievements: 5, streak: 7, missions: 30 },
  },
  {
    id: "elite",
    name: "Elite",
    icon: "🛡️",
    tagline: "Poucos chegam a este nível.",
    tone: "from-orange-400/60 to-amber-500/10",
    ring: "ring-orange-300/50",
    glow: "shadow-[0_0_60px_-8px_rgba(251,146,60,0.65)]",
    requires: { level: 20, xp: 6000, skillLevel: 8, skillCount: 3, achievements: 10, streak: 14, missions: 75 },
  },
  {
    id: "master",
    name: "Mestre",
    icon: "🏆",
    tagline: "Domínio absoluto do ofício.",
    tone: "from-yellow-400/70 to-amber-500/10",
    ring: "ring-yellow-300/60",
    glow: "shadow-[0_0_70px_-6px_rgba(250,204,21,0.7)]",
    requires: { level: 35, xp: 15000, skillLevel: 12, skillCount: 4, achievements: 18, streak: 30, missions: 150 },
  },
  {
    id: "legend",
    name: "Lenda",
    icon: "👑",
    tagline: "Seu nome ecoa pelo tempo.",
    tone: "from-fuchsia-400/70 to-purple-500/10",
    ring: "ring-fuchsia-300/60",
    glow: "shadow-[0_0_80px_-6px_rgba(232,121,249,0.75)]",
    requires: { level: 55, xp: 35000, skillLevel: 18, skillCount: 5, achievements: 30, streak: 60, missions: 300 },
  },
  {
    id: "ascended",
    name: "Ascendido",
    icon: "✨",
    tagline: "Além da mortalidade.",
    tone: "from-cyan-300/80 via-fuchsia-400/60 to-amber-400/40",
    ring: "ring-white/60",
    glow: "shadow-[0_0_100px_-4px_rgba(255,255,255,0.6)]",
    requires: { level: 80, xp: 80000, skillLevel: 25, skillCount: 6, achievements: 50, streak: 100, missions: 600 },
  },
];

export type PlayerStats = {
  level: number;
  xp: number;
  skills: { level: number }[];
  achievements: number;
  streak: number;
  missions: number;
};

function meets(req: RankRequirements, stats: PlayerStats) {
  const qualifyingSkills = stats.skills.filter((s) => (s.level ?? 0) >= req.skillLevel).length;
  return (
    stats.level >= req.level &&
    stats.xp >= req.xp &&
    stats.achievements >= req.achievements &&
    stats.streak >= req.streak &&
    stats.missions >= req.missions &&
    (req.skillCount === 0 || qualifyingSkills >= req.skillCount)
  );
}

export function computeRank(stats: PlayerStats) {
  let current = RANKS[0];
  let currentIndex = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (meets(RANKS[i].requires, stats)) {
      current = RANKS[i];
      currentIndex = i;
    }
  }
  const next = currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
  const progress = next ? computeProgress(next.requires, stats) : null;
  return { current, next, currentIndex, progress };
}

export type Requirement = {
  key: keyof RankRequirements;
  label: string;
  icon: string;
  have: number;
  need: number;
  done: boolean;
};

export function computeProgress(req: RankRequirements, stats: PlayerStats) {
  const qualifyingSkills = stats.skills.filter((s) => (s.level ?? 0) >= req.skillLevel).length;
  const base: Array<Omit<Requirement, "done">> = [
    { key: "level",        label: "Nível",              icon: "⭐", have: stats.level,        need: req.level },
    { key: "xp",           label: "XP total",           icon: "⚡", have: stats.xp,           need: req.xp },
    { key: "skillCount",   label: `Skills Lv ${req.skillLevel}+`, icon: "🌿", have: qualifyingSkills, need: req.skillCount },
    { key: "missions",     label: "Missões concluídas", icon: "🎯", have: stats.missions,     need: req.missions },
    { key: "achievements", label: "Conquistas",         icon: "🏅", have: stats.achievements, need: req.achievements },
    { key: "streak",       label: "Sequência (dias)",   icon: "🔥", have: stats.streak,       need: req.streak },
  ];
  const items: Requirement[] = base
    .filter((r) => r.need > 0)
    .map((r) => ({ ...r, done: r.have >= r.need }));

  const overallPct = items.length
    ? Math.round(
        items.reduce((sum, r) => sum + Math.min(1, r.have / Math.max(1, r.need)), 0) /
          items.length *
          100,
      )
    : 100;

  return { items, overallPct };
}
