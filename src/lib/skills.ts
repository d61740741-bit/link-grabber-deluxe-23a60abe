// Skill display helpers — resolve a `skills` row (default or custom) to a
// consistent identity (label, emoji, gradient) that the UI can render.

import { skillLabels } from "./ascension";

export type SkillRow = {
  id: string;
  user_id: string;
  category: string | null;
  level: number;
  xp: number;
  total_xp: number;
  display_name: string | null;
  icon: string | null;
  color: string | null;
  is_custom: boolean;
  custom_slug: string | null;
};

export type SkillIdentity = {
  label: string;
  emoji: string;
  color: string; // tailwind gradient classes, e.g. "from-purple-500/40 to-purple-500/5"
  ring: string; // solid tailwind classes for accents (border/text)
};

export const SKILL_COLOR_PRESETS: {
  key: string;
  label: string;
  color: string;
  ring: string;
  swatch: string;
}[] = [
  { key: "purple", label: "Ametista", color: "from-purple-500/40 to-purple-500/5", ring: "text-purple-300 border-purple-500/40", swatch: "bg-purple-500" },
  { key: "emerald", label: "Esmeralda", color: "from-emerald-500/40 to-emerald-500/5", ring: "text-emerald-300 border-emerald-500/40", swatch: "bg-emerald-500" },
  { key: "electric", label: "Elétrico", color: "from-electric/40 to-electric/5", ring: "text-electric border-electric/40", swatch: "bg-sky-400" },
  { key: "gold", label: "Ouro", color: "from-gold/40 to-gold/5", ring: "text-gold border-gold/40", swatch: "bg-amber-400" },
  { key: "orange", label: "Fogo", color: "from-orange-500/40 to-orange-500/5", ring: "text-orange-300 border-orange-500/40", swatch: "bg-orange-500" },
  { key: "pink", label: "Rosé", color: "from-pink-500/40 to-pink-500/5", ring: "text-pink-300 border-pink-500/40", swatch: "bg-pink-500" },
  { key: "red", label: "Rubi", color: "from-red-500/40 to-red-500/5", ring: "text-red-300 border-red-500/40", swatch: "bg-red-500" },
  { key: "teal", label: "Turquesa", color: "from-teal-500/40 to-teal-500/5", ring: "text-teal-300 border-teal-500/40", swatch: "bg-teal-500" },
  { key: "indigo", label: "Índigo", color: "from-indigo-500/40 to-indigo-500/5", ring: "text-indigo-300 border-indigo-500/40", swatch: "bg-indigo-500" },
  { key: "lime", label: "Limão", color: "from-lime-500/40 to-lime-500/5", ring: "text-lime-300 border-lime-500/40", swatch: "bg-lime-500" },
];

export const SKILL_ICON_PRESETS = [
  "🧠","💪","📚","💎","⚡","🤝","🎯","🔥","🚀","🎨","🎵","🌱","🏆","⚔️","🛡️","💡","🧘","🏃","💰","📊","🌊","🌙","☀️","🧬","🧗","♟️","🎮","✍️","🍎","🕉️",
];

export function colorPresetByKey(key: string | null | undefined) {
  return SKILL_COLOR_PRESETS.find((c) => c.key === key) ?? SKILL_COLOR_PRESETS[2];
}

export function resolveSkill(skill: SkillRow): SkillIdentity {
  if (skill.is_custom) {
    const preset = colorPresetByKey(skill.color);
    return {
      label: skill.display_name?.trim() || "Skill",
      emoji: skill.icon || "✨",
      color: preset.color,
      ring: preset.ring,
    };
  }
  const meta = skill.category ? skillLabels[skill.category] : undefined;
  const preset = skill.color ? colorPresetByKey(skill.color) : null;
  return {
    label: skill.display_name?.trim() || meta?.label || "Skill",
    emoji: skill.icon || meta?.emoji || "✨",
    color: preset?.color || meta?.color || "from-electric/40 to-electric/5",
    ring: preset?.ring || "text-electric border-electric/40",
  };
}

// Level curve mirrors the DB: level = floor(sqrt(total_xp/30)) + 1
export function skillLevelProgress(totalXp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, totalXp) / 30)) + 1);
  const currentLevelXp = Math.pow(level - 1, 2) * 30;
  const nextLevelXp = Math.pow(level, 2) * 30;
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const inLevel = Math.max(0, totalXp - currentLevelXp);
  return {
    level,
    nextLevel: level + 1,
    pct: Math.min(100, Math.round((inLevel / span) * 100)),
    inLevel,
    span,
    remaining: Math.max(0, span - inLevel),
    nextLevelXp,
  };
}

export function slugifySkillName(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `skill-${Date.now().toString(36)}`
  );
}
