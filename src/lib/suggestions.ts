// Daily personalized mission suggestions.
// Activates once the user has completed 20+ missions. Analyzes their history
// (category/skill distribution, recent titles) and returns 5 suggestions per
// day, avoiding recent repetition. Deterministic per day via a seeded shuffle.

import { detectTask } from "./xp-calc";

export type SuggestionTemplate = {
  id: string;
  title: string;
  category: "estudo" | "treino" | "leitura" | "meditacao" | "nutricao" | "financas" | "habito" | "outro";
  skill: "mente" | "corpo" | "conhecimento" | "financas" | "disciplina" | "social";
  tags: string[];
};

export const TEMPLATES: SuggestionTemplate[] = [
  { id: "read-20p", title: "Ler 20 páginas", category: "leitura", skill: "conhecimento", tags: ["leitura", "livro"] },
  { id: "read-30min", title: "30min de leitura focada", category: "leitura", skill: "conhecimento", tags: ["leitura"] },
  { id: "workout", title: "Treinar 45min", category: "treino", skill: "corpo", tags: ["treino", "academia"] },
  { id: "run-3k", title: "Correr 3km", category: "treino", skill: "corpo", tags: ["corrida", "cardio"] },
  { id: "stretch", title: "10min de alongamento", category: "treino", skill: "corpo", tags: ["alongamento"] },
  { id: "water-3l", title: "Beber 3L de água", category: "nutricao", skill: "corpo", tags: ["hidratacao"] },
  { id: "meditate-10", title: "Meditar 10min", category: "meditacao", skill: "mente", tags: ["meditacao"] },
  { id: "cold-shower", title: "Banho frio", category: "habito", skill: "disciplina", tags: ["disciplina"] },
  { id: "sleep-23", title: "Dormir antes das 23:00", category: "habito", skill: "disciplina", tags: ["sono"] },
  { id: "no-social", title: "1h sem redes sociais", category: "habito", skill: "disciplina", tags: ["foco"] },
  { id: "study-1h", title: "1h de estudo focado", category: "estudo", skill: "conhecimento", tags: ["estudo"] },
  { id: "study-2h", title: "2h de estudo profundo", category: "estudo", skill: "conhecimento", tags: ["estudo", "deep"] },
  { id: "journal", title: "Escrever no diário", category: "habito", skill: "mente", tags: ["diario", "reflexao"] },
  { id: "gratitude", title: "Listar 3 gratidões", category: "habito", skill: "mente", tags: ["gratidao"] },
  { id: "walk-30", title: "Caminhar 30min ao ar livre", category: "treino", skill: "corpo", tags: ["caminhada"] },
  { id: "healthy-meal", title: "Refeição saudável sem processados", category: "nutricao", skill: "corpo", tags: ["nutricao"] },
  { id: "budget-review", title: "Revisar gastos do dia", category: "financas", skill: "financas", tags: ["financas"] },
  { id: "save-money", title: "Guardar dinheiro hoje", category: "financas", skill: "financas", tags: ["poupanca"] },
  { id: "call-friend", title: "Ligar para alguém importante", category: "outro", skill: "social", tags: ["social"] },
  { id: "learn-new", title: "Aprender algo novo por 20min", category: "estudo", skill: "conhecimento", tags: ["curiosidade"] },
  { id: "no-sugar", title: "Dia sem açúcar", category: "nutricao", skill: "disciplina", tags: ["nutricao", "disciplina"] },
  { id: "deep-breath", title: "5min de respiração consciente", category: "meditacao", skill: "mente", tags: ["respiracao"] },
];

export type TaskRow = {
  title: string;
  category?: string | null;
  skill_category?: string | null;
  completed?: boolean | null;
  created_at?: string | null;
};

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dayseed(date = new Date()): number {
  const s = date.toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

export function shouldSuggest(tasks: TaskRow[]): boolean {
  return tasks.filter((t) => t.completed).length >= 20;
}

/**
 * Build up to `count` personalized suggestions for today.
 * - Weights templates by user's completed category/skill affinity.
 * - Excludes templates whose title or tags match tasks created in last 7 days.
 * - Deterministic per day (same suggestions if you reload).
 */
export function buildDailySuggestions(tasks: TaskRow[], count = 5): SuggestionTemplate[] {
  const completed = tasks.filter((t) => t.completed);
  const catCount: Record<string, number> = {};
  const skillCount: Record<string, number> = {};
  for (const t of completed) {
    if (t.category) catCount[t.category] = (catCount[t.category] || 0) + 1;
    if (t.skill_category) skillCount[t.skill_category] = (skillCount[t.skill_category] || 0) + 1;
  }

  // Recent titles (last 7 days) to avoid repetition.
  const weekAgo = Date.now() - 7 * 86400_000;
  const recentTitles = new Set<string>();
  for (const t of tasks) {
    const created = t.created_at ? new Date(t.created_at).getTime() : 0;
    if (created >= weekAgo) recentTitles.add(t.title.toLowerCase().trim());
  }

  const totalCat = Object.values(catCount).reduce((a, b) => a + b, 0) || 1;
  const totalSkill = Object.values(skillCount).reduce((a, b) => a + b, 0) || 1;

  const scored = TEMPLATES.map((tpl) => {
    const catAffinity = (catCount[tpl.category] || 0) / totalCat;
    const skillAffinity = (skillCount[tpl.skill] || 0) / totalSkill;
    // Base score favors user's habits, but keep a floor so we also introduce variety.
    let score = 0.3 + catAffinity * 2 + skillAffinity * 1.5;
    // Penalize repetition.
    if (recentTitles.has(tpl.title.toLowerCase())) score *= 0.15;
    for (const t of recentTitles) {
      if (tpl.tags.some((tag) => t.includes(tag))) {
        score *= 0.6;
        break;
      }
    }
    return { tpl, score };
  });

  // Sort by score, then shuffle among top slice for daily variety.
  scored.sort((a, b) => b.score - a.score);
  const pool = scored.slice(0, Math.max(count * 2, 8)).map((x) => x.tpl);
  const shuffled = seededShuffle(pool, dayseed());
  // Ensure category diversity in final pick.
  const picked: SuggestionTemplate[] = [];
  const usedCats = new Set<string>();
  for (const tpl of shuffled) {
    if (picked.length >= count) break;
    if (usedCats.has(tpl.category) && picked.length < count - 1) continue;
    picked.push(tpl);
    usedCats.add(tpl.category);
  }
  // Fill if short.
  for (const tpl of shuffled) {
    if (picked.length >= count) break;
    if (!picked.includes(tpl)) picked.push(tpl);
  }
  return picked;
}

export function suggestionToTask(tpl: SuggestionTemplate) {
  const det = detectTask(tpl.title);
  return {
    title: tpl.title,
    category: tpl.category,
    skill_category: tpl.skill,
    detected: det,
  };
}
