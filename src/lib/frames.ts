// Molduras (frames) desbloqueáveis do avatar.
// A condição de desbloqueio é derivada do estado do jogador — nada é salvo
// além da moldura escolhida (profiles.avatar_frame).

export type FrameStats = {
  level: number;
  totalXp: number;
  streak: number;
  achievements: number;
  missions: number;
  titles: number;
  lifeScore: number;
};

export type Frame = {
  id: string;
  name: string;
  description: string;
  /** classes aplicadas ao anel externo (gradiente) */
  ring: string;
  /** classes de brilho */
  glow: string;
  /** partícula/emoji decorativo opcional */
  badge?: string;
  animated?: boolean;
  requirement: (s: FrameStats) => boolean;
  requirementLabel: string;
};

export const FRAMES: Frame[] = [
  {
    id: "none",
    name: "Sem moldura",
    description: "Visual limpo, sem adornos.",
    ring: "from-white/10 to-white/5",
    glow: "",
    requirement: () => true,
    requirementLabel: "Sempre disponível",
  },
  {
    id: "bronze",
    name: "Bronze",
    description: "Os primeiros passos da jornada.",
    ring: "from-amber-700 via-amber-500 to-amber-800",
    glow: "shadow-[0_0_20px_-6px_rgba(217,119,6,0.7)]",
    requirement: (s) => s.level >= 2,
    requirementLabel: "Nível 2",
  },
  {
    id: "prata",
    name: "Prata",
    description: "Consistência começa a aparecer.",
    ring: "from-slate-300 via-slate-100 to-slate-400",
    glow: "shadow-[0_0_22px_-6px_rgba(226,232,240,0.7)]",
    requirement: (s) => s.level >= 5,
    requirementLabel: "Nível 5",
  },
  {
    id: "ouro",
    name: "Ouro",
    description: "Disciplina comprovada.",
    ring: "from-yellow-300 via-amber-400 to-yellow-600",
    glow: "shadow-[0_0_26px_-4px_rgba(251,191,36,0.75)]",
    badge: "⭐",
    requirement: (s) => s.level >= 10,
    requirementLabel: "Nível 10",
  },
  {
    id: "chama",
    name: "Chama Eterna",
    description: "Sequência de fogo.",
    ring: "from-orange-500 via-red-500 to-amber-400",
    glow: "shadow-[0_0_26px_-4px_rgba(249,115,22,0.8)]",
    badge: "🔥",
    animated: true,
    requirement: (s) => s.streak >= 7,
    requirementLabel: "7 dias de sequência",
  },
  {
    id: "inferno",
    name: "Inferno",
    description: "Trinta dias sem falhar.",
    ring: "from-rose-600 via-orange-500 to-yellow-400",
    glow: "shadow-[0_0_32px_-4px_rgba(244,63,94,0.85)]",
    badge: "🔥",
    animated: true,
    requirement: (s) => s.streak >= 30,
    requirementLabel: "30 dias de sequência",
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    description: "Missões cumpridas em série.",
    ring: "from-emerald-400 via-teal-300 to-emerald-600",
    glow: "shadow-[0_0_26px_-4px_rgba(16,185,129,0.75)]",
    requirement: (s) => s.missions >= 50,
    requirementLabel: "50 missões concluídas",
  },
  {
    id: "safira",
    name: "Safira",
    description: "Colecionador de conquistas.",
    ring: "from-sky-400 via-indigo-400 to-blue-600",
    glow: "shadow-[0_0_26px_-4px_rgba(56,189,248,0.75)]",
    requirement: (s) => s.achievements >= 10,
    requirementLabel: "10 conquistas",
  },
  {
    id: "ametista",
    name: "Ametista",
    description: "Títulos acumulados na coleção.",
    ring: "from-violet-400 via-fuchsia-400 to-purple-600",
    glow: "shadow-[0_0_28px_-4px_rgba(167,139,250,0.8)]",
    badge: "🔮",
    requirement: (s) => s.titles >= 5,
    requirementLabel: "5 títulos desbloqueados",
  },
  {
    id: "equilibrio",
    name: "Equilíbrio",
    description: "Vida em harmonia.",
    ring: "from-cyan-300 via-emerald-300 to-lime-300",
    glow: "shadow-[0_0_28px_-4px_rgba(103,232,249,0.8)]",
    badge: "☯️",
    requirement: (s) => s.lifeScore >= 80,
    requirementLabel: "Life Score 80+",
  },
  {
    id: "mitica",
    name: "Mítica",
    description: "Poucos chegam até aqui.",
    ring: "from-fuchsia-500 via-rose-400 to-amber-300",
    glow: "shadow-[0_0_34px_-2px_rgba(232,121,249,0.9)]",
    badge: "✨",
    animated: true,
    requirement: (s) => s.level >= 20,
    requirementLabel: "Nível 20",
  },
  {
    id: "ascendida",
    name: "Ascendida",
    description: "A moldura dos lendários.",
    ring: "from-amber-200 via-fuchsia-400 to-cyan-300",
    glow: "shadow-[0_0_40px_-2px_rgba(255,255,255,0.6)]",
    badge: "👑",
    animated: true,
    requirement: (s) => s.totalXp >= 20000,
    requirementLabel: "20.000 XP total",
  },
];

export function frameById(id: string | null | undefined): Frame {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

export function isFrameUnlocked(frame: Frame, stats: FrameStats) {
  return frame.requirement(stats);
}
