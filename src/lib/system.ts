// Sistema Central — camada de progressão do Life OS.
// Atributos, sincronia, passivas, relíquias, ranks e bosses.
// Tudo derivado do estado real do usuário (nada é definido manualmente).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Attribute, CharacterState } from "@/lib/rpg";

/* ─────────────── Atributos ─────────────── */

export type AttrMeta = {
  key: string;
  tone: string; // gradient
  text: string;
  bar: string;
  sources: string[];
};

export const ATTR_META: Record<string, AttrMeta> = {
  forca: { key: "forca", tone: "from-orange-500/30 to-transparent", text: "text-orange-300", bar: "bg-orange-400", sources: ["Treinos de força", "Volume total de treino"] },
  agilidade: { key: "agilidade", tone: "from-lime-500/30 to-transparent", text: "text-lime-300", bar: "bg-lime-400", sources: ["Cardio e corridas", "Hábitos ativos"] },
  resistencia: { key: "resistencia", tone: "from-teal-500/30 to-transparent", text: "text-teal-300", bar: "bg-teal-400", sources: ["Minutos de treino", "Dias limpo", "Sequência de hábitos"] },
  disciplina: { key: "disciplina", tone: "from-violet-500/30 to-transparent", text: "text-violet-300", bar: "bg-violet-400", sources: ["Missões concluídas", "Hábitos", "Foco", "Recuperação"] },
  foco: { key: "foco", tone: "from-indigo-500/30 to-transparent", text: "text-indigo-300", bar: "bg-indigo-400", sources: ["Sessões de foco", "Tempo de estudo"] },
  intelecto: { key: "intelecto", tone: "from-sky-500/30 to-transparent", text: "text-sky-300", bar: "bg-sky-400", sources: ["Livros concluídos", "Biblioteca", "Estudo"] },
  carisma: { key: "carisma", tone: "from-pink-500/30 to-transparent", text: "text-pink-300", bar: "bg-pink-400", sources: ["Diário", "Constância de hábitos"] },
  lideranca: { key: "lideranca", tone: "from-fuchsia-500/30 to-transparent", text: "text-fuchsia-300", bar: "bg-fuchsia-400", sources: ["Metas concluídas", "Missões difíceis", "Títulos"] },
  riqueza: { key: "riqueza", tone: "from-amber-500/30 to-transparent", text: "text-amber-300", bar: "bg-amber-400", sources: ["Registros financeiros", "Saldo positivo"] },
  equilibrio: { key: "equilibrio", tone: "from-cyan-500/30 to-transparent", text: "text-cyan-300", bar: "bg-cyan-400", sources: ["Diário", "Humor", "Qualidade do sono"] },
  vitalidade: { key: "vitalidade", tone: "from-rose-500/30 to-transparent", text: "text-rose-300", bar: "bg-rose-400", sources: ["Água", "Sono", "Registros de saúde"] },
};

export function attrMeta(key: string): AttrMeta {
  return ATTR_META[key] ?? ATTR_META.disciplina;
}

/* ─────────────── Sincronia do Sistema ─────────────── */

export type SyncState = {
  pct: number;
  stage: string;
  aura: string;
  nextStage: string | null;
  nextAt: number;
};

const SYNC_STAGES = [
  { at: 0, stage: "Dormente", aura: "text-slate-300" },
  { at: 15, stage: "Observado", aura: "text-sky-300" },
  { at: 30, stage: "Sincronizando", aura: "text-cyan-300" },
  { at: 50, stage: "Desperto", aura: "text-violet-300" },
  { at: 70, stage: "Ressonante", aura: "text-fuchsia-300" },
  { at: 85, stage: "Transcendente", aura: "text-amber-300" },
  { at: 96, stage: "Singularidade", aura: "text-white" },
];

export function computeSync(state?: CharacterState | null): SyncState {
  const p = state?.profile;
  const attrs = state?.attributes ?? [];
  const avgAttr = attrs.length ? attrs.reduce((s, a) => s + a.level, 0) / attrs.length : 1;
  const raw =
    Math.min(30, ((p?.level ?? 1) / 60) * 30) +
    Math.min(20, ((p?.streak_days ?? 0) / 60) * 20) +
    Math.min(20, ((avgAttr - 1) / 9) * 20) +
    Math.min(15, ((state?.achievements ?? 0) / 40) * 15) +
    Math.min(10, ((state?.titles ?? 0) / 12) * 10) +
    Math.min(5, ((p?.life_score ?? 0) / 100) * 5);
  const pct = Math.max(0, Math.min(100, Math.round(raw)));
  let idx = 0;
  SYNC_STAGES.forEach((s, i) => {
    if (pct >= s.at) idx = i;
  });
  const next = SYNC_STAGES[idx + 1] ?? null;
  return {
    pct,
    stage: SYNC_STAGES[idx].stage,
    aura: SYNC_STAGES[idx].aura,
    nextStage: next ? next.stage : null,
    nextAt: next ? next.at : 100,
  };
}

/* ─────────────── Passivas ─────────────── */

export type Passive = {
  key: string;
  name: string;
  desc: string;
  icon: string;
  hint: string;
  check: (s: CharacterState, attr: (k: string) => number) => boolean;
  secret?: boolean;
};

export const PASSIVES: Passive[] = [
  { key: "foco_absoluto", name: "Foco Absoluto", desc: "Sessões longas rendem mais clareza.", icon: "🎯", hint: "Foco Lv 4", check: (_s, a) => a("foco") >= 4 },
  { key: "disciplina_inabalavel", name: "Disciplina Inabalável", desc: "Sequências não quebram com facilidade.", icon: "⚡", hint: "Disciplina Lv 5", check: (_s, a) => a("disciplina") >= 5 },
  { key: "aprendizado_rapido", name: "Aprendizado Rápido", desc: "Conhecimento absorvido em menos tempo.", icon: "📚", hint: "Conhecimento Lv 4", check: (_s, a) => a("intelecto") >= 4 },
  { key: "corpo_resistente", name: "Corpo Resistente", desc: "O cansaço demora mais a chegar.", icon: "🛡️", hint: "Resistência Lv 4", check: (_s, a) => a("resistencia") >= 4 },
  { key: "mente_estrategica", name: "Mente Estratégica", desc: "Decisões financeiras mais frias.", icon: "🧩", hint: "Gestão Financeira Lv 4", check: (_s, a) => a("riqueza") >= 4 },
  { key: "reflexos", name: "Reflexos Aguçados", desc: "Reage rápido a mudanças de rotina.", icon: "🏃", hint: "Agilidade Lv 3", check: (_s, a) => a("agilidade") >= 3 },
  { key: "presenca", name: "Presença Magnética", desc: "Sua constância inspira.", icon: "🤝", hint: "Comunicação Lv 4", check: (_s, a) => a("carisma") >= 4 },
  { key: "comando", name: "Instinto de Comando", desc: "Metas maiores parecem possíveis.", icon: "🦅", hint: "Liderança Lv 4", check: (_s, a) => a("lideranca") >= 4 },
  { key: "serenidade", name: "Serenidade", desc: "Recupera energia mental mais rápido.", icon: "🌙", hint: "Equilíbrio Mental Lv 4", check: (_s, a) => a("equilibrio") >= 4 },
  { key: "vigor", name: "Vigor Renovado", desc: "Corpo bem cuidado, dias mais longos.", icon: "❤️", hint: "Vitalidade Lv 4", check: (_s, a) => a("vitalidade") >= 4 },
  { key: "titan", name: "Força de Titã", desc: "Cargas antes impossíveis viram rotina.", icon: "⚔️", hint: "Força Lv 6", check: (_s, a) => a("forca") >= 6 },
  { key: "sombra", name: "Passiva Selada", desc: "O Sistema ainda não revelou este poder.", icon: "❔", hint: "?????", secret: true, check: (s) => (s.profile?.level ?? 1) >= 30 },
  { key: "sombra2", name: "Passiva Selada", desc: "Registro corrompido. Continue evoluindo.", icon: "❔", hint: "?????", secret: true, check: (s) => (s.profile?.streak_days ?? 0) >= 100 },
];

export function computePassives(state?: CharacterState | null) {
  const attrs = (state?.attributes ?? []) as Attribute[];
  const a = (k: string) => attrs.find((x) => x.key === k)?.level ?? 0;
  const s = state ?? ({ attributes: [], profile: null } as unknown as CharacterState);
  return PASSIVES.map((p) => ({ ...p, unlocked: !!state && p.check(s, a) }));
}

/* ─────────────── Relíquias ─────────────── */

export const RELIC_KEYS = ["relic_chronos", "relic_atlas", "relic_oraculo", "relic_vault", "relic_phoenix"];

export function isRelic(itemKey: string) {
  return RELIC_KEYS.some((k) => itemKey.includes(k));
}

/* ─────────────── Consultas ─────────────── */

export type AchievementRow = {
  id: string;
  badge_key: string;
  name: string;
  description: string | null;
  icon: string | null;
  unlocked_at: string;
};

export function useAchievementsList() {
  return useQuery({
    queryKey: ["achievements-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("unlocked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AchievementRow[];
    },
    staleTime: 30_000,
  });
}

export type BossRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: string;
  xp_reward: number;
  week_start: string;
  completed_at: string | null;
  objectives: Array<{ key: string; label: string; target: number; current: number }>;
};

export function useBossHistory() {
  return useQuery({
    queryKey: ["boss-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_bosses")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as unknown as BossRow[];
    },
    staleTime: 30_000,
  });
}

/** Boss mensal derivado: soma dos bosses semanais do mês corrente. */
export function monthlyBoss(bosses: BossRow[] = []) {
  const now = new Date();
  const month = bosses.filter((b) => {
    const d = new Date(b.week_start);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const target = Math.max(4, month.length || 4);
  const done = month.filter((b) => b.status === "completed").length;
  return {
    target,
    done,
    pct: Math.min(100, Math.round((done / target) * 100)),
    reward: month.reduce((s, b) => s + (b.xp_reward ?? 0), 0) || 500,
    defeated: done >= target,
  };
}

/* ─────────────── Rarity de conquistas ─────────────── */

export type AchvTier = "comum" | "rara" | "epica" | "lendaria" | "secreta";

export function achievementTier(key: string): AchvTier {
  if (key.startsWith("secret")) return "secreta";
  if (/1000|365|legend|mythic|500/.test(key)) return "lendaria";
  if (/100|180|90|epic/.test(key)) return "epica";
  if (/30|60|21|rare/.test(key)) return "rara";
  return "comum";
}

export const TIER_STYLE: Record<AchvTier, { label: string; ring: string; text: string; bg: string }> = {
  comum: { label: "Comuns", ring: "ring-slate-400/30", text: "text-slate-200", bg: "bg-slate-500/10" },
  rara: { label: "Raras", ring: "ring-sky-400/40", text: "text-sky-200", bg: "bg-sky-500/10" },
  epica: { label: "Épicas", ring: "ring-violet-400/50", text: "text-violet-200", bg: "bg-violet-500/10" },
  lendaria: { label: "Lendárias", ring: "ring-amber-400/60", text: "text-amber-200", bg: "bg-amber-500/10" },
  secreta: { label: "Secretas", ring: "ring-rose-400/60", text: "text-rose-200", bg: "bg-rose-500/10" },
};

/* ─────────────── Inventário por categoria ─────────────── */

export const INV_CATEGORIES = [
  { key: "artifact", label: "Artefatos", icon: "🗝️" },
  { key: "relic", label: "Relíquias", icon: "🔮" },
  { key: "boost", label: "Boosts", icon: "🔆" },
  { key: "box", label: "Caixas", icon: "📦" },
  { key: "cosmetic", label: "Cosméticos", icon: "🌌" },
  { key: "medal", label: "Medalhas", icon: "🏵️" },
  { key: "badge", label: "Especiais", icon: "🏅" },
  { key: "title", label: "Títulos", icon: "👑" },
] as const;

export function inventoryCategory(item: { kind: string; item_key: string }) {
  if (isRelic(item.item_key)) return "relic";
  if (item.item_key.includes("box_")) return "box";
  return item.kind;
}
