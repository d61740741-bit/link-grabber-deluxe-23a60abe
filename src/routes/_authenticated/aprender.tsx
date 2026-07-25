import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { awardXp } from "@/lib/ascension";
import { BookOpen, Plus, Trash2, Book, GraduationCap, StickyNote, Timer, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/aprender")({
  component: Aprender,
});

const TABS = [
  { key: "biblioteca", label: "Biblioteca", icon: BookOpen },
  { key: "livros", label: "Livros", icon: Book },
  { key: "cursos", label: "Cursos", icon: GraduationCap },
  { key: "notas", label: "Notas", icon: StickyNote },
] as const;

function Aprender() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("biblioteca");
  const [open, setOpen] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["learning", tab],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("category", tab === "biblioteca" ? "leitura" : "estudo").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [readingMin, setReadingMin] = useState(0);
  async function logReading() {
    if (readingMin <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const xp = Math.round(readingMin * 1.5);
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: `${readingMin}min de leitura`,
      category: "leitura",
      skill_category: "conhecimento",
      xp_reward: xp,
      completed: true,
      completed_at: new Date().toISOString(),
    });
    await awardXp(xp, "reading", "conhecimento");
    toast.success(`+${xp} XP em conhecimento`);
    setReadingMin(0);
    qc.invalidateQueries();
  }

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Área</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Aprender</h1>
        </div>
        <button onClick={() => setOpen(true)} className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant">
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* Reading tracker */}
      <section className="glass-strong rounded-3xl p-5 mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-electric/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-electric/15 flex items-center justify-center">
            <Timer className="h-6 w-6 text-electric" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black">Registrar leitura</p>
            <p className="text-xs text-muted-foreground">1,5 XP por minuto lido</p>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={readingMin || ""}
            onChange={(e) => setReadingMin(Number(e.target.value))}
            placeholder="Minutos"
            className="flex-1 glass rounded-2xl px-4 py-3 text-sm outline-none"
          />
          <button onClick={logReading} className="rounded-2xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold">
            Registrar
          </button>
        </div>
      </section>

      <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${
                tab === t.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {(items ?? []).length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Nada por aqui ainda.</div>
        )}
        {(items ?? []).map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">+{t.xp_reward} XP · {new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <button onClick={async () => { await supabase.from("tasks").delete().eq("id", t.id); qc.invalidateQueries({ queryKey: ["learning"] }); }}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>

      {open && <QuickAdd tab={tab} onClose={() => setOpen(false)} />}
    </div>
  );
}

function QuickAdd({ tab, onClose }: { tab: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: title.trim(),
      category: tab === "biblioteca" ? "leitura" : "estudo",
      skill_category: "conhecimento",
      xp_reward: 25,
    });
    qc.invalidateQueries({ queryKey: ["learning"] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Adicionar</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full glass rounded-2xl px-4 py-4 text-sm outline-none mb-4" />
        <button onClick={save} disabled={saving || !title.trim()} className="w-full rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
      </div>
    </div>
  );
}
