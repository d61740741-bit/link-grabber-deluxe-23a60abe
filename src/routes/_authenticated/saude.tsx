import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { awardXp } from "@/lib/ascension";
import { Dumbbell, Scale, Moon, Smile, Droplets, Plus, X, Loader2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saude")({
  component: Saude,
});

function Saude() {
  const qc = useQueryClient();
  const [openWorkout, setOpenWorkout] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const { data: log } = useQuery({
    queryKey: ["health", today],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("*").eq("log_date", today).maybeSingle();
      return data;
    },
  });

  const { data: workouts } = useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").order("performed_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  async function updateLog(patch: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("health_logs").upsert(
      { user_id: user.id, log_date: today, ...log, ...patch },
      { onConflict: "user_id,log_date" }
    );
    qc.invalidateQueries({ queryKey: ["health"] });
  }

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Área</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Saúde</h1>
        </div>
        <button onClick={() => setOpenWorkout(true)} className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant">
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Metric icon={Scale} label="Peso (kg)" value={log?.weight_kg ?? ""} onSave={(v) => updateLog({ weight_kg: v })} step={0.1} />
        <Metric icon={Moon} label="Sono (h)" value={log?.sleep_hours ?? ""} onSave={(v) => updateLog({ sleep_hours: v })} step={0.5} />
        <Metric icon={Droplets} label="Água (ml)" value={log?.water_ml ?? ""} onSave={(v) => updateLog({ water_ml: v })} step={100} />
        <Metric icon={Smile} label="Humor 1-10" value={log?.mood ?? ""} onSave={(v) => updateLog({ mood: v })} step={1} />
      </div>

      <section className="mb-6">
        <Link to="/treinos" className="glass-strong rounded-2xl p-4 mb-3 flex items-center gap-3 tap">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 ring-hair flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Módulo de Treinos</p>
            <p className="text-xs text-muted-foreground">Exercícios, séries, calorias e streak</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <h2 className="text-lg font-black tracking-tight mb-3">Treinos recentes</h2>
        <div className="space-y-2">
          {(workouts ?? []).length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Registre seu primeiro treino</div>
          )}
          {(workouts ?? []).map((w) => (
            <div key={w.id} className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Dumbbell className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{w.workout_type}</p>
                <p className="text-xs text-muted-foreground">{w.duration_min} min · {new Date(w.performed_at).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {openWorkout && <WorkoutSheet onClose={() => setOpenWorkout(false)} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, onSave, step }: { icon: any; label: string; value: any; onSave: (v: number) => void; step: number }) {
  const [v, setV] = useState<string>(String(value ?? ""));
  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-electric" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <input
        type="number"
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v && onSave(Number(v))}
        className="w-full bg-transparent text-2xl font-black outline-none"
        placeholder="—"
      />
    </div>
  );
}

function WorkoutSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState("Treino de força");
  const [duration, setDuration] = useState(45);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("workouts").insert({ user_id: user.id, workout_type: type, duration_min: duration });
    const xp = Math.round(duration * 0.8);
    await awardXp(xp, "workout", "corpo");
    toast.success(`+${xp} XP em corpo`);
    qc.invalidateQueries();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Registrar treino</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <input value={type} onChange={(e) => setType(e.target.value)} className="w-full glass rounded-2xl px-4 py-4 text-sm outline-none" placeholder="Tipo" />
          <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm">Duração (min)</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setDuration(Math.max(5, duration - 5))} className="h-8 w-8 rounded-full glass">-</button>
              <span className="w-10 text-center font-black">{duration}</span>
              <button onClick={() => setDuration(duration + 5)} className="h-8 w-8 rounded-full glass">+</button>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
