import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dumbbell, Scale, Moon, Smile, Droplets, Plus, X, Loader2, ChevronRight,
  Target, TrendingDown, TrendingUp, Minus, Flame,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  useHealthGoals, useHealthLogs, useTodayLog, useHealthRealtime, saveHealth, saveGoals,
  avg, inLastDays, weightStats, moodStreak, fmtDay, todayISO, MOOD_FACES, sleepQualityLabel,
  type HealthLog,
} from "@/lib/health";

export const Route = createFileRoute("/_authenticated/saude")({
  component: Saude,
  head: () => ({
    meta: [
      { title: "Saúde — água, peso, sono e humor" },
      { name: "description", content: "Acompanhe água diária, evolução de peso, qualidade do sono e humor com gráficos e histórico completo." },
      { property: "og:title", content: "Saúde — água, peso, sono e humor" },
      { property: "og:description", content: "Água, peso, sono e humor com metas, gráficos e histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "hoje" | "agua" | "peso" | "sono" | "humor";

const TABS: { key: Tab; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "agua", label: "Água" },
  { key: "peso", label: "Peso" },
  { key: "sono", label: "Sono" },
  { key: "humor", label: "Humor" },
];

function Saude() {
  useHealthRealtime();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("hoje");
  const [openWorkout, setOpenWorkout] = useState(false);

  const { data: goals } = useHealthGoals();
  const { data: today } = useTodayLog();
  const { data: logs = [] } = useHealthLogs(365);

  async function patch(p: Partial<HealthLog>) {
    await saveHealth(p);
    await qc.invalidateQueries();
  }

  return (
    <div className="px-5 pt-8 safe-top pb-24">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Área</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Saúde</h1>
        </div>
        <button onClick={() => setOpenWorkout(true)} className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant">
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold tap transition ${
              tab === t.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hoje" && <TodayTab today={today ?? null} goals={goals} logs={logs} onPatch={patch} />}
      {tab === "agua" && <WaterTab today={today ?? null} goals={goals} logs={logs} onPatch={patch} />}
      {tab === "peso" && <WeightTab today={today ?? null} goals={goals} logs={logs} onPatch={patch} />}
      {tab === "sono" && <SleepTab today={today ?? null} goals={goals} logs={logs} onPatch={patch} />}
      {tab === "humor" && <MoodTab today={today ?? null} logs={logs} onPatch={patch} />}

      {openWorkout && <WorkoutSheet onClose={() => setOpenWorkout(false)} />}
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------ */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-strong rounded-2xl p-4 ${className}`}>{children}</div>;
}

function Stat({ label, value, sub, tone = "text-foreground" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function ChartFrame({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card className="mt-3">
      <p className="text-xs font-bold mb-3">{title}</p>
      {empty ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Sem dados suficientes ainda</p>
      ) : (
        <div className="h-48 -ml-3">{children}</div>
      )}
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
};

function History({ rows, render }: { rows: HealthLog[]; render: (l: HealthLog) => string }) {
  const list = [...rows].reverse().slice(0, 30);
  return (
    <Card className="mt-3">
      <p className="text-xs font-bold mb-3">Histórico</p>
      {list.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nenhum registro</p>}
      <div className="space-y-1.5">
        {list.map((l) => (
          <div key={l.log_date} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">{fmtDay(l.log_date)}</span>
            <span className="font-semibold">{render(l)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------------- Hoje ---------------------------------- */

function TodayTab({ today, goals, logs, onPatch }: any) {
  const water = today?.water_ml ?? 0;
  const goal = goals?.water_ml_goal ?? 2500;
  const pct = Math.min(100, Math.round((water / Math.max(1, goal)) * 100));
  const { data: workouts } = useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").order("performed_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  return (
    <>
      <Card className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="h-4 w-4 text-sky-400" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Água de hoje</span>
          <span className="ml-auto text-xs text-muted-foreground">meta {goal} ml</span>
        </div>
        <p className="text-3xl font-black">{water} <span className="text-base text-muted-foreground">ml · {pct}%</span></p>
        <div className="h-2 rounded-full bg-muted/40 mt-3 overflow-hidden">
          <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-2 mt-3">
          {[200, 350, 500].map((v) => (
            <button key={v} onClick={() => onPatch({ water_ml: water + v })} className="flex-1 glass rounded-xl py-2 text-xs font-bold tap">+{v}ml</button>
          ))}
          <button onClick={() => onPatch({ water_ml: 0 })} className="glass rounded-xl px-3 py-2 text-xs tap text-muted-foreground">Zerar</button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <NumberCard icon={Scale} label="Peso (kg)" value={today?.weight_kg ?? ""} step={0.1} onSave={(v) => onPatch({ weight_kg: v })} />
        <NumberCard icon={Moon} label="Sono (h)" value={today?.sleep_hours ?? ""} step={0.5} onSave={(v) => onPatch({ sleep_hours: v })} />
      </div>

      <Card className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Smile className="h-4 w-4 text-amber-400" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Humor de hoje</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_FACES.map((f, i) => (
            <button
              key={i}
              onClick={() => onPatch({ mood: i + 1 })}
              className={`h-10 w-10 rounded-xl text-lg tap ${today?.mood === i + 1 ? "bg-amber-400/25 ring-1 ring-amber-400/50" : "glass"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </Card>

      <section className="mb-4">
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
          {(workouts ?? []).map((w: any) => (
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
    </>
  );
}

function NumberCard({ icon: Icon, label, value, onSave, step }: { icon: any; label: string; value: any; onSave: (v: number) => void; step: number }) {
  const [v, setV] = useState<string>(String(value ?? ""));
  return (
    <Card>
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
    </Card>
  );
}

/* --------------------------------- Água ---------------------------------- */

function WaterTab({ today, goals, logs, onPatch }: any) {
  const qc = useQueryClient();
  const goal = goals?.water_ml_goal ?? 2500;
  const water = today?.water_ml ?? 0;
  const pct = Math.min(100, Math.round((water / Math.max(1, goal)) * 100));
  const [range, setRange] = useState<7 | 30>(7);
  const [goalDraft, setGoalDraft] = useState(String(goal));

  const rows = useMemo(() => {
    const days: { day: string; ml: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const l = logs.find((x: HealthLog) => x.log_date === iso);
      days.push({ day: fmtDay(iso), ml: l?.water_ml ?? 0 });
    }
    return days;
  }, [logs, range]);

  const week = avg(inLastDays(logs, 7).map((l: HealthLog) => l.water_ml ?? 0));
  const month = avg(inLastDays(logs, 30).map((l: HealthLog) => l.water_ml ?? 0));

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Hoje</span>
          <span className="text-xs text-muted-foreground">reinicia automaticamente à meia-noite</span>
        </div>
        <p className="text-4xl font-black">{water}<span className="text-base text-muted-foreground"> / {goal} ml</span></p>
        <p className="text-sm font-bold text-sky-400 mt-1">{pct}% da meta</p>
        <div className="h-2.5 rounded-full bg-muted/40 mt-3 overflow-hidden">
          <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-2 mt-3">
          {[200, 350, 500, 750].map((v) => (
            <button key={v} onClick={() => onPatch({ water_ml: water + v })} className="flex-1 glass rounded-xl py-2 text-xs font-bold tap">+{v}</button>
          ))}
        </div>
      </Card>

      <Card className="mt-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-sky-400" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Meta diária (ml)</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number" step={100} value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            className="flex-1 glass rounded-xl px-4 py-3 text-lg font-black outline-none"
          />
          <button
            onClick={async () => { await saveGoals({ water_ml_goal: Number(goalDraft) || 2500 }); await qc.invalidateQueries(); toast.success("Meta atualizada"); }}
            className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold tap"
          >
            Salvar
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat label="Média 7 dias" value={`${Math.round(week)} ml`} />
        <Stat label="Média 30 dias" value={`${Math.round(month)} ml`} />
      </div>

      <div className="flex gap-2 mt-3">
        {[7, 30].map((r) => (
          <button key={r} onClick={() => setRange(r as 7 | 30)} className={`rounded-full px-4 py-1.5 text-xs font-bold tap ${range === r ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
            {r === 7 ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      <ChartFrame title="Consumo de água" empty={rows.every((r) => r.ml === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={40} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="ml" fill="hsl(200 90% 60%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <History rows={logs.filter((l: HealthLog) => l.water_ml != null)} render={(l) => `${l.water_ml} ml`} />
    </>
  );
}

/* --------------------------------- Peso ---------------------------------- */

function WeightTab({ today, goals, logs, onPatch }: any) {
  const qc = useQueryClient();
  const stats = weightStats(logs);
  const [draft, setDraft] = useState(String(today?.weight_kg ?? ""));
  const [goalDraft, setGoalDraft] = useState(String(goals?.weight_goal_kg ?? ""));

  const chart = (stats?.rows ?? []).map((r) => ({ day: fmtDay(r.log_date), kg: r.weight_kg }));
  const DiffIcon = !stats ? Minus : stats.diff < 0 ? TrendingDown : stats.diff > 0 ? TrendingUp : Minus;

  return (
    <>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Scale className="h-4 w-4 text-electric" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Registrar peso de hoje (kg)</span>
        </div>
        <div className="flex gap-2">
          <input type="number" step={0.1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="—"
            className="flex-1 glass rounded-xl px-4 py-3 text-2xl font-black outline-none" />
          <button onClick={() => draft && onPatch({ weight_kg: Number(draft) })} className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold tap">Salvar</button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat label="Peso inicial" value={stats ? `${stats.first} kg` : "—"} />
        <Stat label="Peso atual" value={stats ? `${stats.current} kg` : "—"} />
        <Stat
          label="Diferença"
          value={stats ? `${stats.diff > 0 ? "+" : ""}${stats.diff} kg` : "—"}
          tone={!stats ? "" : stats.diff < 0 ? "text-emerald-400" : stats.diff > 0 ? "text-rose-400" : ""}
          sub={stats ? `${stats.count} registros` : undefined}
        />
        <Stat label="Meta" value={goals?.weight_goal_kg ? `${goals.weight_goal_kg} kg` : "—"} />
        <Stat label="Maior peso" value={stats ? `${stats.max} kg` : "—"} />
        <Stat label="Menor peso" value={stats ? `${stats.min} kg` : "—"} />
      </div>

      <Card className="mt-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-electric" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Meta de peso (kg)</span>
          <DiffIcon className="h-4 w-4 ml-auto text-muted-foreground" />
        </div>
        <div className="flex gap-2">
          <input type="number" step={0.1} value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)}
            className="flex-1 glass rounded-xl px-4 py-3 text-lg font-black outline-none" placeholder="—" />
          <button
            onClick={async () => { await saveGoals({ weight_goal_kg: goalDraft ? Number(goalDraft) : null }); await qc.invalidateQueries(); toast.success("Meta atualizada"); }}
            className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold tap">Salvar</button>
        </div>
      </Card>

      <ChartFrame title="Evolução do peso" empty={chart.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart}>
            <defs>
              <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(160 84% 45%)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(160 84% 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={40} domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="kg" stroke="hsl(160 84% 45%)" fill="url(#wg)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>

      <History rows={logs.filter((l: HealthLog) => l.weight_kg != null)} render={(l) => `${l.weight_kg} kg`} />
    </>
  );
}

/* --------------------------------- Sono ---------------------------------- */

function SleepTab({ today, goals, logs, onPatch }: any) {
  const qc = useQueryClient();
  const goal = Number(goals?.sleep_hours_goal ?? 8);
  const [draft, setDraft] = useState(String(today?.sleep_hours ?? ""));
  const [goalDraft, setGoalDraft] = useState(String(goal));
  const [range, setRange] = useState<7 | 30>(7);

  const rows = useMemo(() => {
    const out: { day: string; h: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const l = logs.find((x: HealthLog) => x.log_date === iso);
      out.push({ day: fmtDay(iso), h: Number(l?.sleep_hours ?? 0) });
    }
    return out;
  }, [logs, range]);

  const week = avg(inLastDays(logs, 7).filter((l: HealthLog) => l.sleep_hours != null).map((l: HealthLog) => Number(l.sleep_hours)));
  const month = avg(inLastDays(logs, 30).filter((l: HealthLog) => l.sleep_hours != null).map((l: HealthLog) => Number(l.sleep_hours)));

  return (
    <>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Moon className="h-4 w-4 text-indigo-300" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Sono de hoje (h)</span>
        </div>
        <div className="flex gap-2">
          <input type="number" step={0.5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="—"
            className="flex-1 glass rounded-xl px-4 py-3 text-2xl font-black outline-none" />
          <button onClick={() => draft && onPatch({ sleep_hours: Number(draft) })} className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold tap">Salvar</button>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-4 mb-2">Qualidade</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((q) => (
            <button key={q} onClick={() => onPatch({ sleep_quality: q })}
              className={`flex-1 rounded-xl py-2 text-xs font-bold tap ${today?.sleep_quality === q ? "bg-indigo-400/25 ring-1 ring-indigo-400/50" : "glass text-muted-foreground"}`}>
              {sleepQualityLabel(q)}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat label="Média semanal" value={`${week.toFixed(1)} h`} sub={`meta ${goal} h`} />
        <Stat label="Média mensal" value={`${month.toFixed(1)} h`} />
      </div>

      <Card className="mt-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-indigo-300" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Meta de sono (h)</span>
        </div>
        <div className="flex gap-2">
          <input type="number" step={0.5} value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)}
            className="flex-1 glass rounded-xl px-4 py-3 text-lg font-black outline-none" />
          <button onClick={async () => { await saveGoals({ sleep_hours_goal: Number(goalDraft) || 8 }); await qc.invalidateQueries(); toast.success("Meta atualizada"); }}
            className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold tap">Salvar</button>
        </div>
      </Card>

      <div className="flex gap-2 mt-3">
        {[7, 30].map((r) => (
          <button key={r} onClick={() => setRange(r as 7 | 30)} className={`rounded-full px-4 py-1.5 text-xs font-bold tap ${range === r ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
            {r === 7 ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      <ChartFrame title="Horas dormidas" empty={rows.every((r) => r.h === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={30} domain={[0, 12]} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="h" stroke="hsl(245 80% 72%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <History
        rows={logs.filter((l: HealthLog) => l.sleep_hours != null)}
        render={(l) => `${l.sleep_hours} h · ${sleepQualityLabel(l.sleep_quality)}`}
      />
    </>
  );
}

/* --------------------------------- Humor --------------------------------- */

function MoodTab({ today, logs, onPatch }: any) {
  const streak = moodStreak(logs);
  const month = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pad = first.getDay();
    const cells: ({ iso: string; mood: number | null } | null)[] = Array(pad).fill(null);
    for (let d = 1; d <= days; d++) {
      const iso = new Date(now.getFullYear(), now.getMonth(), d).toLocaleDateString("sv-SE");
      const l = logs.find((x: HealthLog) => x.log_date === iso);
      cells.push({ iso, mood: l?.mood ?? null });
    }
    return cells;
  }, [logs]);

  const chart = useMemo(() => {
    const out: { day: string; mood: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const l = logs.find((x: HealthLog) => x.log_date === iso);
      out.push({ day: fmtDay(iso), mood: l?.mood ?? 0 });
    }
    return out;
  }, [logs]);

  const moodAvg = avg(inLastDays(logs, 30).filter((l: HealthLog) => l.mood != null).map((l: HealthLog) => l.mood as number));

  return (
    <>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Smile className="h-4 w-4 text-amber-400" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Como você está hoje?</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_FACES.map((f, i) => (
            <button key={i} onClick={() => onPatch({ mood: i + 1 })}
              className={`h-11 w-11 rounded-xl text-xl tap ${today?.mood === i + 1 ? "bg-amber-400/25 ring-1 ring-amber-400/50" : "glass"}`}>
              {f}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat label="Sequência" value={`${streak} dias`} sub="registros consecutivos" />
        <Stat label="Média 30 dias" value={moodAvg ? moodAvg.toFixed(1) : "—"} />
      </div>

      <ChartFrame title="Humor nos últimos 30 dias" empty={chart.every((c) => c.mood === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart}>
            <defs>
              <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(42 96% 60%)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(42 96% 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={25} domain={[0, 10]} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="mood" stroke="hsl(42 96% 60%)" fill="url(#mg)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>

      <Card className="mt-3">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-bold">Calendário do mês</p>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <span key={i} className="text-[10px] text-muted-foreground">{d}</span>
          ))}
          {month.map((c, i) =>
            c === null ? <span key={`e${i}`} /> : (
              <div key={c.iso}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm ${c.mood ? "bg-amber-400/15" : "glass opacity-50"} ${c.iso === todayISO() ? "ring-1 ring-amber-400/60" : ""}`}>
                {c.mood ? MOOD_FACES[c.mood - 1] : <span className="text-[10px] text-muted-foreground">{Number(c.iso.slice(-2))}</span>}
              </div>
            )
          )}
        </div>
      </Card>

      <History rows={logs.filter((l: HealthLog) => l.mood != null)} render={(l) => `${MOOD_FACES[(l.mood as number) - 1]} ${l.mood}/10`} />
    </>
  );
}

/* -------------------------------- Treinos -------------------------------- */

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
    toast.success("Treino registrado");
    await qc.invalidateQueries();
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
