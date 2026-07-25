// Automatic XP calculator based on title + category + skill.
// Analyzes keywords for duration, difficulty, mental/physical effort, consistency.
// Returns { xp, tier, label } where tier is one of the 5 difficulty bands.

export type XpTier = "muito_facil" | "facil" | "medio" | "dificil" | "extremo";

const TIER_LABEL: Record<XpTier, string> = {
  muito_facil: "Muito fácil",
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  extremo: "Extremo",
};

const TIER_RANGE: Record<XpTier, [number, number]> = {
  muito_facil: [5, 10],
  facil: [10, 20],
  medio: [20, 40],
  dificil: [40, 70],
  extremo: [70, 120],
};

// Keyword weights — accumulated into a numeric score, then mapped to a tier.
const KW: Array<{ re: RegExp; w: number }> = [
  // trivial / very easy
  { re: /\b(agua|água|beber agua|cama|arrumar|escovar|dente|vitamina|alongar)\b/i, w: -3 },
  // easy
  { re: /\b(10\s?min|15\s?min|20\s?min|caminh|meditar|respirar|10\s?p[aá]g|ler\s?um\s?pouco)\b/i, w: -1 },
  // medium markers
  { re: /\b(30\s?min|45\s?min|1h|uma\s?hora|treino|estudo|estudar|limpar|organizar|arrumar\s?quarto)\b/i, w: 2 },
  // hard markers
  { re: /\b(2h|duas\s?horas|3h|projeto|dif[ií]cil|longo|banho\s?frio|frio|desafio|foco\s?profundo|deep\s?work)\b/i, w: 4 },
  // extreme
  { re: /\b(5h|dia\s?inteiro|dia\s?produtivo|finalizar\s?projeto|maratona|entregar\s?projeto|prova\s?final)\b/i, w: 7 },
  // mental effort
  { re: /\b(estud|program|c[oó]digo|matem|escrever|redigir|planejar|analisar)\b/i, w: 1 },
  // physical effort
  { re: /\b(corrida|correr|muscula|academia|treino|hiit|for[çc]a|cardio|nata[çc]|bike|pedal)\b/i, w: 1 },
  // consistency / repetition
  { re: /\b(di[aá]rio|todo\s?dia|h[aá]bito|streak|consist)\b/i, w: 1 },
];

const CATEGORY_BIAS: Record<string, number> = {
  estudo: 2,
  treino: 2,
  leitura: 0,
  meditacao: -1,
  nutricao: -1,
  financas: 1,
  habito: -1,
  outro: 0,
};

function tierFromScore(s: number): XpTier {
  if (s <= -2) return "muito_facil";
  if (s <= 1) return "facil";
  if (s <= 4) return "medio";
  if (s <= 7) return "dificil";
  return "extremo";
}

export interface XpCalc {
  xp: number;
  tier: XpTier;
  tierLabel: string;
  range: [number, number];
}

export function calculateXp(title: string, category?: string | null): XpCalc {
  const t = (title || "").toLowerCase();
  let score = 0;
  for (const { re, w } of KW) if (re.test(t)) score += w;
  if (category && category in CATEGORY_BIAS) score += CATEGORY_BIAS[category];

  // Duration extraction: "45 min" / "2h" boosts
  const minMatch = t.match(/(\d{1,3})\s?(?:min|minutos)/);
  const hMatch = t.match(/(\d{1,2})\s?(?:h|hora|horas)\b/);
  const minutes = (minMatch ? parseInt(minMatch[1], 10) : 0) + (hMatch ? parseInt(hMatch[1], 10) * 60 : 0);
  if (minutes > 0) {
    if (minutes <= 15) score += -1;
    else if (minutes <= 30) score += 1;
    else if (minutes <= 60) score += 3;
    else if (minutes <= 120) score += 5;
    else score += 8;
  }

  const tier = tierFromScore(score);
  const [lo, hi] = TIER_RANGE[tier];
  // Position within the tier band based on overshoot
  const bandSpan = hi - lo;
  const overshoot = Math.max(0, Math.min(1, (score - scoreFloor(tier)) / Math.max(1, scoreCeil(tier) - scoreFloor(tier))));
  const xp = Math.round(lo + bandSpan * overshoot);
  return { xp, tier, tierLabel: TIER_LABEL[tier], range: [lo, hi] };
}

function scoreFloor(t: XpTier): number {
  return { muito_facil: -10, facil: -1, medio: 2, dificil: 5, extremo: 8 }[t];
}
function scoreCeil(t: XpTier): number {
  return { muito_facil: -2, facil: 1, medio: 4, dificil: 7, extremo: 15 }[t];
}

// -------- Auto-detection of category, skill, duration --------

type Category = "estudo" | "treino" | "leitura" | "meditacao" | "nutricao" | "financas" | "habito" | "outro";
type Skill = "mente" | "corpo" | "conhecimento" | "financas" | "disciplina" | "social";

const CAT_RULES: Array<{ re: RegExp; cat: Category; skill: Skill }> = [
  { re: /\b(estud|matem|matemática|f[ií]sica|qu[ií]mica|hist[oó]ria|prova|revis|aula|curso|program|c[oó]digo|code|coding)\b/i, cat: "estudo", skill: "conhecimento" },
  { re: /\b(ler|leitura|livro|book|read|atomic|habits|artigo|cap[ií]tulo|p[aá]gina)\b/i, cat: "leitura", skill: "conhecimento" },
  { re: /\b(treino|academia|gym|muscula|corrida|correr|cardio|hiit|for[çc]a|natação|bike|pedal|caminhada|walk|run|workout|exercicio|exercício)\b/i, cat: "treino", skill: "corpo" },
  { re: /\b(medit|respirar|mindful|yoga|relax|calma|breath)\b/i, cat: "meditacao", skill: "mente" },
  { re: /\b(comer|comida|refei[çc][aã]o|dieta|nutri|prote[ií]na|salada|jantar|almo[çc]o|caf[eé]\s?da\s?manh[ãa]|meal)\b/i, cat: "nutricao", skill: "corpo" },
  { re: /\b(dinheiro|money|financ|investir|invest|poupar|orçamento|budget|pagar\s?conta|planilha|gastos)\b/i, cat: "financas", skill: "financas" },
  { re: /\b(agua|água|beber|hidrat|escovar|dente|cama|arrumar\s?a\s?cama|vitamina|dormir|sono|acordar\s?cedo|frio|banho\s?frio|di[aá]rio|streak|h[aá]bito)\b/i, cat: "habito", skill: "disciplina" },
  { re: /\b(amigo|familia|família|ligar|ligação|encontro|conversar|social|reuni[aã]o|call|meeting)\b/i, cat: "outro", skill: "social" },
];

export interface TaskAutoDetect {
  category: Category;
  skill: Skill;
  durationMin: number | null;
  xp: number;
  tier: XpTier;
  tierLabel: string;
}

export function detectTask(title: string): TaskAutoDetect {
  const t = (title || "").toLowerCase().trim();
  let category: Category = "outro";
  let skill: Skill = "disciplina";
  for (const r of CAT_RULES) {
    if (r.re.test(t)) {
      category = r.cat;
      skill = r.skill;
      break;
    }
  }

  const minMatch = t.match(/(\d{1,3})\s?(?:min|minutos)/);
  const hMatch = t.match(/(\d{1,2})\s?(?:h|hora|horas)\b/);
  let durationMin: number | null = null;
  if (minMatch || hMatch) {
    durationMin = (minMatch ? parseInt(minMatch[1], 10) : 0) + (hMatch ? parseInt(hMatch[1], 10) * 60 : 0);
  } else if (t) {
    // Heuristic defaults per category when no duration is specified
    const defaults: Record<Category, number> = {
      meditacao: 15,
      leitura: 30,
      treino: 60,
      estudo: 45,
      nutricao: 20,
      financas: 30,
      habito: 5,
      outro: 20,
    };
    durationMin = defaults[category];
  }

  const calc = calculateXp(title, category);
  return { category, skill, durationMin, xp: calc.xp, tier: calc.tier, tierLabel: calc.tierLabel };
}
