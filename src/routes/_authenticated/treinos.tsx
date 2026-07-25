import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/ascension";
import { toast } from "sonner";
import {
  Dumbbell,
  Flame,
  Timer,
  Plus,
  X,
  Loader2,
  TrendingUp,
  Trophy,
  Trash2,
  ChevronLeft,
  Activity,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/treinos")({
  component: TreinosPage,
});

type Workout = {
  id: string;
  user_id: string;
  workout_type: string;
  duration_min: number;
  intensity: string | null;
  notes: string | null;
  performed_at: string;
  calories_burned: number | null;
};

type Exercise = {
  id: string;
  workout_id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  position: number;
};

/* --------------------------------- helpers -------------------------------- */

// MET-based rough estimate: kcal ≈ MET × 3.5 × 70kg / 200 × min
function estimateCalories(type: string, duration: number, intensity: string | null) {
  const t = type.toLowerCase();
  let met = 5;
  if (/corrida|run|hiit/.test(t)) met = 9;
  else if (/força|forca|musc|peso/.test(t)) met = 6;
  else if (/yoga|alongamento|mobilidade/.test(t)) met = 3;
  else if (/bike|ciclismo|spinning/.test(t)) met = 7.5;
  else if (/nata|swim/.test(t)) met = 8;
  else if (/caminh|walk/.test(t)) met = 3.8;
  if (intensity === "alta") met *= 1.15;
  if (intensity === "baixa") met *= 0.85;
  return Math.round((met * 3.5 * 70 * duration) / 200);
}

function computeStreak(dates: string[]) {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  // allow today OR yesterday to start the streak
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------------------------------- page ---------------------------------- */

function TreinosPage() {
  const [open, setOpen] = useState(false);

  const { data: workouts } = useQuery({
    queryKey: ["workouts", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("*")
        .order("performed_at", { ascending: false });
      return (data ?? []) as Workout[];
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["workout_exercises", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_exercises")
        .select("*")
        .order("position", { ascending: true });
      return (data ?? []) as Exercise[];
    },
  });

  const stats = useMemo(() => {
    const list = workouts ?? [];
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const weekList = list.filter((w) => new Date(w.performed_at) >= weekAgo);
    const totalCalories = list.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
    const weekCalories = weekList.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
    const totalMin = list.reduce((s, w) => s + (w.duration_min ?? 0), 0);
    const weekMin = weekList.reduce((s, w) => s + (w.duration_min ?? 0), 0);
    return {
      streak: computeStreak(list.map((w) => w.performed_at)),
      totalWorkouts: list.length,
      weekWorkouts: weekList.length,
      totalCalories,
      weekCalories,
      totalMin,
      weekMin,
    };
  }, [workouts]);

  const exByWorkout = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    (exercises ?? []).forEach((e) => {
      if (!map.has(e.workout_id)) map.set(e.workout_id, []);
      map.get(e.workout_id)!.push(e);
    });
    return map;
  }, [exercises]);

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link to="/saude" className="h-10 w-10 rounded-2xl glass flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Módulo</p>
            <h1 className="text-3xl font-black tracking-tight mt-1">Treinos</h1>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* Hero stat: streak */}
      <div className="relative rounded-3xl overflow-hidden mb-4 glass-strong p-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-orange-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-orange-400" /> Streak de treinos
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tighter leading-none">{stats.streak}</span>
              <span className="text-sm font-semibold text-muted-foreground pb-2">dias</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.streak === 0 ? "Treine hoje para começar" : "Continue firme"}
            </p>
          </div>
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-orange-500/30 to-orange-500/5 ring-hair flex items-center justify-center">
            <Trophy className="h-8 w-8 text-orange-300" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={Flame}
          tint="from-orange-500/25 to-orange-500/5 text-orange-300"
          label="Calorias (7d)"
          value={stats.weekCalories.toLocaleString("pt-BR")}
          sub={`${stats.totalCalories.toLocaleString("pt-BR")} totais`}
        />
        <StatCard
          icon={Dumbbell}
          tint="from-emerald-500/25 to-emerald-500/5 text-emerald-300"
          label="Treinos (7d)"
          value={stats.weekWorkouts.toString()}
          sub={`${stats.totalWorkouts} totais`}
        />
        <StatCard
          icon={Timer}
          tint="from-electric/25 to-electric/5 text-electric"
          label="Minutos (7d)"
          value={stats.weekMin.toString()}
          sub={`${stats.totalMin} totais`}
        />
        <StatCard
          icon={Activity}
          tint="from-purple-500/25 to-purple-500/5 text-purple-300"
          label="Média/treino"
          value={
            stats.totalWorkouts
              ? Math.round(stats.totalMin / stats.totalWorkouts).toString()
              : "0"
          }
          sub="min por sessão"
        />
      </div>

      {/* History */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black tracking-tight">Histórico</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> {(workouts ?? []).length} sessões
          </span>
        </div>

        {(workouts ?? []).length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-3">
              <Dumbbell className="h-6 w-6 text-emerald-300" />
            </div>
            <p className="text-sm font-semibold">Nenhum treino ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Registre sua primeira sessão para começar</p>
            <button
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Novo treino
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(workouts ?? []).map((w) => (
              <WorkoutCard key={w.id} workout={w} exercises={exByWorkout.get(w.id) ?? []} />
            ))}
          </div>
        )}
      </section>

      {open && <WorkoutSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

/* --------------------------------- cards ---------------------------------- */

function StatCard({
  icon: Icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: any;
  tint: string;
  label: string;
  value: string;
  sub: string;
}) {
  const [gradient, text] = [tint.split(" text-")[0], "text-" + tint.split(" text-")[1]];
  return (
    <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} blur-2xl pointer-events-none opacity-70`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center ring-hair`}>
            <Icon className={`h-4 w-4 ${text}`} />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function WorkoutCard({ workout, exercises }: { workout: Workout; exercises: Exercise[] }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const date = new Date(workout.performed_at);
  const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeLabel = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  async function remove() {
    if (!confirm("Remover este treino?")) return;
    await supabase.from("workouts").delete().eq("id", workout.id);
    qc.invalidateQueries();
    toast.success("Treino removido");
  }

  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 flex items-center gap-3 text-left tap"
      >
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 ring-hair flex items-center justify-center shrink-0">
          <Dumbbell className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{workout.workout_type}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span>{dateLabel} · {timeLabel}</span>
            <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{workout.duration_min}min</span>
            {workout.calories_burned != null && (
              <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" />{workout.calories_burned}kcal</span>
            )}
          </div>
        </div>
        {workout.intensity && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ring-hair ${
            workout.intensity === "alta" ? "bg-red-500/15 text-red-300"
              : workout.intensity === "baixa" ? "bg-blue-500/15 text-blue-300"
              : "bg-yellow-500/15 text-yellow-300"
          }`}>
            {workout.intensity}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-2">
          {exercises.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Sem exercícios registrados</p>
          ) : (
            exercises.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-1.5">
                <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-electric" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.name}</p>
                </div>
                <div className="text-xs font-mono text-muted-foreground tabular-nums">
                  {e.sets}×{e.reps}{e.weight_kg != null ? ` · ${e.weight_kg}kg` : ""}
                </div>
              </div>
            ))
          )}
          {workout.notes && (
            <p className="text-xs text-muted-foreground italic pt-2 border-t border-white/5">{workout.notes}</p>
          )}
          <div className="pt-2 flex justify-end">
            <button
              onClick={remove}
              className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- sheet ---------------------------------- */

type Draft = { name: string; sets: number; reps: number; weight: string };

function WorkoutSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState("Treino de força");
  const [duration, setDuration] = useState(45);
  const [intensity, setIntensity] = useState<"baixa" | "media" | "alta">("media");
  const [notes, setNotes] = useState("");
  const [calories, setCalories] = useState<string>("");
  const [drafts, setDrafts] = useState<Draft[]>([
    { name: "", sets: 3, reps: 10, weight: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const autoCalories = useMemo(
    () => estimateCalories(type, duration, intensity),
    [type, duration, intensity],
  );
  const finalCalories = calories.trim() ? Number(calories) : autoCalories;

  function updateDraft(i: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addDraft() {
    setDrafts((d) => [...d, { name: "", sets: 3, reps: 10, weight: "" }]);
  }
  function removeDraft(i: number) {
    setDrafts((d) => d.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: w, error } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          workout_type: type,
          duration_min: duration,
          intensity,
          notes: notes || null,
          calories_burned: finalCalories,
        })
        .select("id")
        .single();
      if (error || !w) throw error;

      const valid = drafts
        .map((d, i) => ({ ...d, position: i }))
        .filter((d) => d.name.trim());
      if (valid.length) {
        await supabase.from("workout_exercises").insert(
          valid.map((d) => ({
            workout_id: w.id,
            user_id: user.id,
            name: d.name.trim(),
            sets: d.sets,
            reps: d.reps,
            weight_kg: d.weight ? Number(d.weight) : null,
            position: d.position,
          })),
        );
      }

      const xp = Math.round(duration * 0.8) + valid.length * 5;
      await awardXp(xp, "workout", "corpo");
      toast.success(`+${xp} XP em corpo`);
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass-strong rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Novo</p>
            <h3 className="text-xl font-black tracking-tight">Registrar treino</h3>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-2xl glass flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tipo</label>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full glass rounded-2xl px-4 py-3.5 text-sm outline-none font-medium"
              placeholder="Ex: Peito e tríceps"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Duração</div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setDuration(Math.max(5, duration - 5))}
                  className="h-8 w-8 rounded-full bg-white/5 ring-hair font-bold"
                >−</button>
                <div className="text-center">
                  <div className="text-xl font-black tabular-nums">{duration}</div>
                  <div className="text-[9px] text-muted-foreground">min</div>
                </div>
                <button
                  onClick={() => setDuration(duration + 5)}
                  className="h-8 w-8 rounded-full bg-white/5 ring-hair font-bold"
                >+</button>
              </div>
            </div>
            <div className="glass rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Intensidade</div>
              <div className="grid grid-cols-3 gap-1">
                {(["baixa", "media", "alta"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setIntensity(k)}
                    className={`text-[10px] font-bold uppercase py-2 rounded-lg tap ${
                      intensity === k ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {k === "media" ? "média" : k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calories */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-orange-400" /> Calorias
              </div>
              <button
                onClick={() => setCalories("")}
                className="text-[10px] uppercase tracking-widest text-electric font-bold"
              >
                Auto: {autoCalories}
              </button>
            </div>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder={String(autoCalories)}
              className="w-full bg-transparent text-2xl font-black outline-none tabular-nums"
            />
          </div>

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Exercícios</label>
              <button
                onClick={addDraft}
                className="text-[11px] font-bold text-electric inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {drafts.map((d, i) => (
                <div key={i} className="glass rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={d.name}
                      onChange={(e) => updateDraft(i, { name: e.target.value })}
                      placeholder={`Exercício ${i + 1}`}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none"
                    />
                    {drafts.length > 1 && (
                      <button
                        onClick={() => removeDraft(i)}
                        className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumField
                      label="Séries"
                      value={d.sets}
                      onChange={(v) => updateDraft(i, { sets: v })}
                    />
                    <NumField
                      label="Reps"
                      value={d.reps}
                      onChange={(v) => updateDraft(i, { reps: v })}
                    />
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Peso kg</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={d.weight}
                        onChange={(e) => updateDraft(i, { weight: e.target.value })}
                        placeholder="—"
                        className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-sm font-bold tabular-nums outline-none text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full glass rounded-2xl px-4 py-3 text-sm outline-none resize-none"
              placeholder="Como se sentiu?"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-elegant disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar treino
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center bg-white/5 rounded-lg">
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          className="h-7 w-7 flex items-center justify-center text-sm font-bold text-muted-foreground"
        >−</button>
        <div className="flex-1 text-center text-sm font-bold tabular-nums">{value}</div>
        <button
          onClick={() => onChange(value + 1)}
          className="h-7 w-7 flex items-center justify-center text-sm font-bold text-muted-foreground"
        >+</button>
      </div>
    </div>
  );
}
