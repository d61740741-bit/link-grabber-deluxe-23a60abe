import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { awardXp } from "@/lib/ascension";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/diario")({
  component: Diario,
});

const MOOD_EMOJIS = ["😔", "😕", "😐", "🙂", "😄"];

function Diario() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: entry } = useQuery({
    queryKey: ["journal", today],
    queryFn: async () => {
      const { data } = await supabase.from("journal_entries").select("*").eq("entry_date", today).maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["journal-history"],
    queryFn: async () => {
      const { data } = await supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const [mood, setMood] = useState<number>(entry?.mood ?? 3);
  const [thoughts, setThoughts] = useState(entry?.thoughts ?? "");
  const [gratitude, setGratitude] = useState(entry?.gratitude ?? "");
  const [lessons, setLessons] = useState(entry?.lessons ?? "");
  const [goals_today, setGoals] = useState(entry?.goals_today ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = { user_id: user.id, entry_date: today, mood, thoughts, gratitude, lessons, goals_today };
      if (entry) await supabase.from("journal_entries").update(payload).eq("id", entry.id);
      else {
        await supabase.from("journal_entries").insert(payload);
        await awardXp(15, "journal", "mente");
        toast.success("Reflexão salva · +15 XP em mente");
      }
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["journal-history"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Reflexão diária</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Diário</h1>
        <p className="text-sm text-muted-foreground mt-2">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </header>

      <section className="glass-strong rounded-3xl p-5 mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Como você se sente hoje?</p>
        <div className="flex justify-between">
          {MOOD_EMOJIS.map((e, i) => (
            <button
              key={i}
              onClick={() => setMood(i + 1)}
              className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl transition ${
                mood === i + 1 ? "bg-electric/20 border border-electric/40 scale-110" : "glass"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4 mb-6">
        <Field label="Pensamentos" value={thoughts} onChange={setThoughts} placeholder="O que passou pela sua mente hoje?" />
        <Field label="Gratidão" value={gratitude} onChange={setGratitude} placeholder="Por que ou por quem você é grato?" />
        <Field label="Lições aprendidas" value={lessons} onChange={setLessons} placeholder="O que você aprendeu?" />
        <Field label="Metas de amanhã" value={goals_today} onChange={setGoals} placeholder="O que você quer conquistar?" />
      </div>

      <button onClick={save} disabled={saving} className="w-full rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-elegant">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Salvar reflexão
      </button>

      {(history ?? []).length > 1 && (
        <section className="mt-8">
          <h2 className="text-lg font-black mb-3">Histórico</h2>
          <div className="space-y-2">
            {(history ?? []).filter((h) => h.entry_date !== today).map((h) => (
              <div key={h.id} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{new Date(h.entry_date).toLocaleDateString("pt-BR")}</p>
                  {h.mood && <span className="text-lg">{MOOD_EMOJIS[h.mood - 1]}</span>}
                </div>
                <p className="text-sm line-clamp-2">{h.thoughts || h.gratitude || h.lessons || "—"}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none resize-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
