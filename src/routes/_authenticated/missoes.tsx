import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { skillLabels, categoryLabels } from "@/lib/ascension";
import { calculateXp, detectTask } from "@/lib/xp-calc";
import { buildDailySuggestions, shouldSuggest, suggestionToTask, type SuggestionTemplate } from "@/lib/suggestions";
import { Plus, X, CheckCircle2, Circle, Trash2, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/missoes")({
  component: Missoes,
});

const CATS = ["estudo", "treino", "leitura", "meditacao", "nutricao", "financas", "habito", "outro"] as const;
const SKILLS = ["mente", "corpo", "conhecimento", "financas", "disciplina", "social"] as const;

function Missoes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"todas" | "hoje" | "concluidas">("hoje");
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (filter === "hoje") q = q.eq("completed", false).or(`due_date.eq.${today},due_date.is.null`);
      if (filter === "concluidas") q = q.eq("completed", true).order("completed_at", { ascending: false });
      const { data } = await q;
      return data ?? [];
    },
  });

  // Full history for personalization (not filtered).
  const { data: allTasks } = useQuery({
    queryKey: ["tasks", "all-history"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("title,category,skill_category,completed,created_at").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  async function complete(t: any) {
    const { data } = await supabase.from("tasks").update({ completed: true }).eq("id", t.id).select("xp_granted,xp_reward").single();
    const gained = (data as any)?.xp_granted ?? t.xp_reward;
    const bonus = gained - t.xp_reward;
    toast.success(`+${gained} XP`, {
      description: bonus > 0 ? `Missão concluída · bônus +${bonus}` : bonus < 0 ? `Missão concluída · penalidade ${bonus}` : "Missão concluída",
    });
    qc.invalidateQueries();
  }


  async function remove(id: string) {
    const { data } = await supabase.from("tasks").select("xp_granted,completed").eq("id", id).single();
    await supabase.from("tasks").delete().eq("id", id);
    if ((data as any)?.completed && (data as any)?.xp_granted > 0) {
      toast.info(`-${(data as any).xp_granted} XP devolvidos`, { description: "Missão concluída removida" });
    }
    qc.invalidateQueries();
  }


  const canSuggest = shouldSuggest(allTasks ?? []);
  const suggestions = canSuggest ? buildDailySuggestions(allTasks ?? [], 5) : [];
  const dismissKey = `sug-dismissed-${today}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(dismissKey) || "[]"); } catch { return []; }
  });
  const visibleSuggestions = suggestions.filter((s) => !dismissed.includes(s.id));

  function persistDismissed(next: string[]) {
    setDismissed(next);
    try { localStorage.setItem(dismissKey, JSON.stringify(next)); } catch {}
  }

  async function acceptSuggestion(tpl: SuggestionTemplate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const info = suggestionToTask(tpl);
    const xp = calculateXp(tpl.title, tpl.category).xp;
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: tpl.title,
      category: tpl.category,
      skill_category: tpl.skill,
      xp_reward: xp,
      due_date: today,
    });
    toast.success("Missão adicionada", { description: `+${xp} XP quando concluir` });
    persistDismissed([...dismissed, tpl.id]);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }


  return (
    <div className="px-5 pt-8 safe-top">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Diário</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Missões</h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant hover:scale-105 transition"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        {(["hoje", "todas", "concluidas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              filter === f ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
            }`}
          >
            {f === "hoje" && "Hoje"}
            {f === "todas" && "Todas"}
            {f === "concluidas" && "Concluídas"}
          </button>
        ))}
      </div>

      {canSuggest && visibleSuggestions.length > 0 && filter !== "concluidas" && (
        <div className="glass-strong rounded-3xl p-4 mb-6 border border-electric/20">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="h-4 w-4 text-electric" />
            <p className="text-xs uppercase tracking-widest font-bold">Sugestões para hoje</p>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Personalizadas com base no seu histórico</p>
          <div className="space-y-2">
            {visibleSuggestions.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{categoryLabels[s.category]}</span>
                    <span className="text-[10px] font-bold text-gold">+{calculateXp(s.title, s.category).xp} XP</span>
                  </div>
                </div>
                <button
                  onClick={() => acceptSuggestion(s)}
                  className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => persistDismissed([...dismissed, s.id])}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Dispensar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">

        {(tasks ?? []).length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma missão. Crie a primeira.</p>
          </div>
        )}
        {(tasks ?? []).map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4 flex items-center gap-3">
            <button onClick={() => !t.completed && complete(t)} disabled={t.completed}>
              {t.completed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{categoryLabels[t.category]}</span>
                {t.skill_category && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-electric/10 text-electric font-semibold">
                    {skillLabels[t.skill_category]?.label}
                  </span>
                )}
                <span className="text-[10px] font-bold text-gold">+{t.xp_reward} XP</span>
              </div>
            </div>
            <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {open && <CreateTaskSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreateTaskSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATS)[number]>("estudo");
  const [skill, setSkill] = useState<(typeof SKILLS)[number] | "">("conhecimento");
  const [today, setToday] = useState(true);
  const [saving, setSaving] = useState(false);
  // Track whether user manually overrode the auto-suggestion.
  const [catTouched, setCatTouched] = useState(false);
  const [skillTouched, setSkillTouched] = useState(false);
  const [customSkillId, setCustomSkillId] = useState<string | null>(null);

  const { data: customSkills } = useQuery({
    queryKey: ["skills-custom-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("skills")
        .select("id, display_name, icon, color")
        .eq("is_custom", true)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const detected = detectTask(title);
  const effectiveCategory = catTouched ? category : detected.category;
  const effectiveSkill = skillTouched ? skill : detected.skill;
  const calc = calculateXp(title, effectiveCategory);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("tasks").insert({
        user_id: user.id,
        title: title.trim(),
        category: effectiveCategory,
        skill_category: customSkillId ? null : (effectiveSkill || null),
        custom_skill_id: customSkillId,
        xp_reward: calc.xp,
        due_date: today ? new Date().toISOString().slice(0, 10) : null,
      } as any);
      toast.success("Missão criada");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Nova missão</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: 45min de estudo focado"
            className="w-full glass rounded-2xl px-4 py-4 text-sm outline-none placeholder:text-muted-foreground"
          />

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</label>
              {title.trim() && !catTouched && (
                <span className="text-[10px] text-electric">Sugerido automaticamente</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setCatTouched(true); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${effectiveCategory === c ? "bg-primary text-primary-foreground" : "glass"}`}
                >
                  {categoryLabels[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Skill que ganha XP</label>
              {title.trim() && !skillTouched && !customSkillId && (
                <span className="text-[10px] text-electric">Sugerido automaticamente</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSkill(s); setSkillTouched(true); setCustomSkillId(null); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!customSkillId && effectiveSkill === s ? "bg-electric/20 text-electric border border-electric/30" : "glass"}`}
                >
                  {skillLabels[s].emoji} {skillLabels[s].label}
                </button>
              ))}
              {(customSkills ?? []).map((cs: any) => (
                <button
                  key={cs.id}
                  onClick={() => { setCustomSkillId(cs.id); setSkillTouched(true); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${customSkillId === cs.id ? "bg-electric/20 text-electric border border-electric/30" : "glass"}`}
                >
                  {cs.icon || "✨"} {cs.display_name || "Skill"}
                </button>
              ))}
            </div>
          </div>


          {title.trim() && detected.durationMin != null && (
            <div className="glass rounded-2xl px-4 py-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Duração estimada</span>
              <span className="text-sm font-semibold">{detected.durationMin} min</span>
            </div>
          )}

          <div className="glass rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold">Recompensa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{calc.tierLabel}</span>
                <span className="font-black text-gold">+{calc.xp} XP</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">XP calculado automaticamente</p>
          </div>

          <label className="flex items-center justify-between glass rounded-2xl px-4 py-3">
            <span className="text-sm font-semibold">Para hoje</span>
            <input type="checkbox" checked={today} onChange={(e) => setToday(e.target.checked)} className="h-5 w-5 accent-electric" />
          </label>

          <button
            onClick={create}
            disabled={saving || !title.trim()}
            className="w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar missão
          </button>
        </div>
      </div>
    </div>
  );
}
