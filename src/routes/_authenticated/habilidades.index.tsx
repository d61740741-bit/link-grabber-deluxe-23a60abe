import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, ChevronRight, Sparkles } from "lucide-react";
import {
  resolveSkill,
  skillLevelProgress,
  SKILL_COLOR_PRESETS,
  SKILL_ICON_PRESETS,
  slugifySkillName,
  type SkillRow,
} from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/habilidades/")({
  component: SkillsPage,
});

function SkillsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: skills } = useQuery({
    queryKey: ["skills-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("skills")
        .select("*")
        .order("is_custom", { ascending: true })
        .order("total_xp", { ascending: false });
      return (data ?? []) as SkillRow[];
    },
  });

  const { data: xpBySkill } = useQuery({
    queryKey: ["xp-by-skill-total"],
    queryFn: async () => {
      const { data } = await supabase
        .from("xp_history")
        .select("skill_category, custom_skill_id, amount");
      const byCat: Record<string, number> = {};
      const byCustom: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.skill_category) byCat[r.skill_category] = (byCat[r.skill_category] || 0) + r.amount;
        else if (r.custom_skill_id) byCustom[r.custom_skill_id] = (byCustom[r.custom_skill_id] || 0) + r.amount;
      });
      return { byCat, byCustom };
    },
  });

  return (
    <div className="px-5 pt-8 pb-24 safe-top">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Sua evolução</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Habilidades</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            Toque numa skill para ver o painel completo. Crie skills próprias.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant hover:scale-105 transition"
          aria-label="Nova skill"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-3">
        {(skills ?? []).map((s) => {
          const identity = resolveSkill(s);
          const total = s.is_custom
            ? xpBySkill?.byCustom[s.id] ?? s.total_xp
            : s.category ? xpBySkill?.byCat[s.category] ?? s.total_xp : s.total_xp;
          const prog = skillLevelProgress(total);
          return (
            <Link
              to="/habilidades/$id"
              params={{ id: s.id }}
              key={s.id}
              className={`group relative block glass-strong rounded-3xl p-5 overflow-hidden bg-gradient-to-br ${identity.color} transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{identity.emoji}</span>
                    {s.is_custom && (
                      <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground">
                        Custom
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-xl font-black truncate">{identity.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {total.toLocaleString("pt-BR")} XP total
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nível</p>
                  <p className="text-4xl font-black gradient-text leading-none">{prog.level}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-2 group-hover:translate-x-1 transition" />
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{prog.inLevel} XP</span>
                  <span>{prog.remaining} p/ nv {prog.nextLevel}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/80 transition-all duration-500"
                    style={{ width: `${prog.pct}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {(skills ?? []).length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <Sparkles className="h-6 w-6 mx-auto text-electric mb-2" />
            <p className="text-sm text-muted-foreground">Ainda sem skills.</p>
          </div>
        )}
      </div>

      {creating && (
        <SkillFormSheet
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["skills-full"] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

export function SkillFormSheet({
  mode,
  skill,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  skill?: SkillRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(skill?.display_name ?? "");
  const [icon, setIcon] = useState(skill?.icon ?? "✨");
  const [colorKey, setColorKey] = useState(skill?.color ?? "electric");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (mode === "create" && !name.trim()) {
      toast.error("Dê um nome à skill");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("skills").insert({
          user_id: user.id,
          category: null,
          is_custom: true,
          custom_slug: slugifySkillName(name),
          display_name: name.trim(),
          icon,
          color: colorKey,
          level: 1,
          xp: 0,
          total_xp: 0,
        } as any);
        if (error) throw error;
        toast.success("Skill criada");
      } else if (skill) {
        const { error } = await supabase
          .from("skills")
          .update({
            display_name: name.trim() || null,
            icon,
            color: colorKey,
          } as any)
          .eq("id", skill.id);
        if (error) throw error;
        toast.success("Skill atualizada");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass-strong rounded-t-3xl sm:rounded-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-xl font-black">{mode === "create" ? "Nova skill" : "Editar skill"}</h2>
          <p className="text-xs text-muted-foreground mt-1">Personalize nome, ícone e cor.</p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Criatividade"
            className="mt-1 w-full glass rounded-2xl px-4 py-3 text-sm bg-transparent outline-none focus:ring-2 focus:ring-electric/40"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Ícone</label>
          <div className="mt-2 grid grid-cols-8 gap-2">
            {SKILL_ICON_PRESETS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`h-10 rounded-xl text-lg flex items-center justify-center transition ${
                  icon === i ? "bg-primary text-primary-foreground scale-110" : "glass hover:scale-105"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Cor</label>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {SKILL_COLOR_PRESETS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColorKey(c.key)}
                className={`rounded-xl p-2 flex flex-col items-center gap-1 transition ${
                  colorKey === c.key ? "ring-2 ring-foreground scale-105" : "glass"
                }`}
              >
                <span className={`h-6 w-6 rounded-full ${c.swatch}`} />
                <span className="text-[9px] text-muted-foreground">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl glass px-4 py-3 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
