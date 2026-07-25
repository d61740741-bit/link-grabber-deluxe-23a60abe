import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { skillLabels } from "@/lib/ascension";
import {
  Zap, Flame, Target, Dumbbell, BookOpen, Smile, Wallet, TrendingUp, Award,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/estatisticas")({
  component: Stats,
});

type RangeKey = "week" | "month" | "year";

const RANGES: { key: RangeKey; label: string; days: number; bucket: "day" | "week" | "month" }[] = [
  { key: "week", label: "Semana", days: 7, bucket: "day" },
  { key: "month", label: "Mês", days: 30, bucket: "day" },
  { key: "year", label: "Ano", days: 365, bucket: "month" },
];

const AXIS = { fill: "oklch(0.68 0.01 260)", fontSize: 10 } as const;
const TOOLTIP = {
  contentStyle: {
    background: "oklch(0.18 0.006 260)",
    border: "1px solid oklch(1 0 0 / 0.1)",
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: "oklch(0.98 0 0)" },
} as const;
const GRID = <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />;

function dayKey(d: Date | string) {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}
function monthKey(d: Date | string) {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 7);
}
function fmtDay(k: string) {
  const [y, m, d] = k.split("-");
  return `${d}/${m}`;
}
function fmtMonth(k: string) {
  const [, m] = k.split("-");
  return ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][Number(m) - 1];
}

function Stats() {
  const [range, setRange] = useState<RangeKey>("month");
  const cfg = RANGES.find((r) => r.key === range)!;

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - cfg.days + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cfg.days]);
  const sinceIso = since.toISOString();
  const sinceDate = dayKey(since);

  const { data } = useQuery({
    queryKey: ["stats-center", range],
    queryFn: async () => {
      const [xp, tasks, workouts, health, finance, journal, library, habits] = await Promise.all([
        supabase.from("xp_history").select("amount, source, skill_category, created_at").gte("created_at", sinceIso),
        supabase.from("tasks").select("id, completed, completed_at, xp_reward, skill_category, created_at").gte("created_at", sinceIso),
        supabase.from("workouts").select("duration_min, workout_type, performed_at").gte("performed_at", sinceIso),
        supabase.from("health_logs").select("log_date, mood, sleep_hours, weight_kg").gte("log_date", sinceDate),
        supabase.from("finance_transactions").select("kind, amount, occurred_on").gte("occurred_on", sinceDate),
        supabase.from("journal_entries").select("entry_date, mood").gte("entry_date", sinceDate),
        supabase.from("library_items").select("id, progress, completed, updated_at").gte("updated_at", sinceIso),
        supabase.from("habits").select("id, streak, best_streak, title"),
      ]);
      return {
        xp: xp.data ?? [], tasks: tasks.data ?? [], workouts: workouts.data ?? [],
        health: health.data ?? [], finance: finance.data ?? [], journal: journal.data ?? [],
        library: library.data ?? [], habits: habits.data ?? [],
      };
    },
  });

  // Build time buckets
  const buckets = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (cfg.bucket === "month") {
      const d = new Date(); d.setDate(1);
      for (let i = 11; i >= 0; i--) {
        const x = new Date(d); x.setMonth(d.getMonth() - i);
        const k = monthKey(x);
        out.push({ key: k, label: fmtMonth(k) });
      }
    } else {
      for (let i = cfg.days - 1; i >= 0; i--) {
        const x = new Date(); x.setDate(x.getDate() - i);
        const k = dayKey(x);
        out.push({ key: k, label: fmtDay(k) });
      }
    }
    return out;
  }, [cfg]);

  const bucketOf = (iso: string) => (cfg.bucket === "month" ? iso.slice(0, 7) : iso.slice(0, 10));

  // XP growth (cumulative)
  const xpSeries = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.xp ?? []).forEach((r: any) => {
      const k = bucketOf(r.created_at);
      map[k] = (map[k] || 0) + r.amount;
    });
    let cum = 0;
    return buckets.map((b) => {
      cum += map[b.key] || 0;
      return { label: b.label, xp: map[b.key] || 0, total: cum };
    });
  }, [data, buckets, cfg.bucket]);

  // Skill radar (current period)
  const skillSeries = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.xp ?? []).forEach((r: any) => {
      if (!r.skill_category) return;
      map[r.skill_category] = (map[r.skill_category] || 0) + r.amount;
    });
    return Object.keys(skillLabels).map((k) => ({
      skill: skillLabels[k].label, xp: map[k] || 0,
    }));
  }, [data]);

  // Missions per bucket (from xp source=task) & habits (source=habit)
  const activitySeries = useMemo(() => {
    const t: Record<string, number> = {};
    const h: Record<string, number> = {};
    (data?.xp ?? []).forEach((r: any) => {
      const k = bucketOf(r.created_at);
      if (r.source === "task") t[k] = (t[k] || 0) + 1;
      else if (r.source === "habit") h[k] = (h[k] || 0) + 1;
    });
    return buckets.map((b) => ({ label: b.label, missões: t[b.key] || 0, hábitos: h[b.key] || 0 }));
  }, [data, buckets, cfg.bucket]);

  // Workouts (minutes per bucket)
  const workoutSeries = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.workouts ?? []).forEach((w: any) => {
      const k = bucketOf(w.performed_at);
      map[k] = (map[k] || 0) + (w.duration_min || 0);
    });
    return buckets.map((b) => ({ label: b.label, min: map[b.key] || 0 }));
  }, [data, buckets, cfg.bucket]);

  // Study (XP earned in conhecimento — proxy for study effort)
  const studySeries = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.xp ?? []).forEach((r: any) => {
      if (r.skill_category !== "conhecimento") return;
      const k = bucketOf(r.created_at);
      map[k] = (map[k] || 0) + r.amount;
    });
    return buckets.map((b) => ({ label: b.label, xp: map[b.key] || 0 }));
  }, [data, buckets, cfg.bucket]);

  // Mood (avg per bucket, mixing journal + health)
  const moodSeries = useMemo(() => {
    const sum: Record<string, { s: number; n: number }> = {};
    const push = (k: string, v: number | null) => {
      if (v == null) return;
      sum[k] = sum[k] || { s: 0, n: 0 };
      sum[k].s += v; sum[k].n += 1;
    };
    (data?.journal ?? []).forEach((j: any) => push(cfg.bucket === "month" ? j.entry_date.slice(0,7) : j.entry_date, j.mood));
    (data?.health ?? []).forEach((h: any) => push(cfg.bucket === "month" ? h.log_date.slice(0,7) : h.log_date, h.mood));
    return buckets.map((b) => {
      const v = sum[b.key];
      return { label: b.label, mood: v ? +(v.s / v.n).toFixed(2) : null };
    });
  }, [data, buckets, cfg.bucket]);

  // Finance cumulative saldo
  const financeSeries = useMemo(() => {
    const inMap: Record<string, number> = {};
    const outMap: Record<string, number> = {};
    (data?.finance ?? []).forEach((f: any) => {
      const k = cfg.bucket === "month" ? f.occurred_on.slice(0,7) : f.occurred_on;
      const a = Number(f.amount) || 0;
      if (f.kind === "receita") inMap[k] = (inMap[k] || 0) + a;
      else outMap[k] = (outMap[k] || 0) + a;
    });
    let saldo = 0;
    return buckets.map((b) => {
      const inc = inMap[b.key] || 0, exp = outMap[b.key] || 0;
      saldo += inc - exp;
      return { label: b.label, entrada: inc, saída: exp, saldo };
    });
  }, [data, buckets, cfg.bucket]);

  // Habit completion — chart of habit streaks
  const habitSeries = useMemo(() => {
    return (data?.habits ?? [])
      .map((h: any) => ({ title: h.title.length > 14 ? h.title.slice(0, 12) + "…" : h.title, streak: h.streak, melhor: h.best_streak }))
      .sort((a: any, b: any) => b.streak - a.streak)
      .slice(0, 8);
  }, [data]);

  // Totals for the report card
  const totals = useMemo(() => {
    const xp = (data?.xp ?? []).reduce((s: number, r: any) => s + r.amount, 0);
    const missions = (data?.xp ?? []).filter((r: any) => r.source === "task").length;
    const habits = (data?.xp ?? []).filter((r: any) => r.source === "habit").length;
    const workoutMin = (data?.workouts ?? []).reduce((s: number, w: any) => s + (w.duration_min || 0), 0);
    const inc = (data?.finance ?? []).filter((f: any) => f.kind === "receita").reduce((s: number, f: any) => s + Number(f.amount), 0);
    const exp = (data?.finance ?? []).filter((f: any) => f.kind !== "receita").reduce((s: number, f: any) => s + Number(f.amount), 0);
    const moodNums = [...(data?.journal ?? []), ...(data?.health ?? [])].map((r: any) => r.mood).filter((m: any) => m != null);
    const moodAvg = moodNums.length ? +(moodNums.reduce((a: number, b: number) => a + b, 0) / moodNums.length).toFixed(1) : null;
    const activeDays = new Set((data?.xp ?? []).map((r: any) => r.created_at.slice(0, 10))).size;
    return { xp, missions, habits, workoutMin, inc, exp, moodAvg, activeDays, saldo: inc - exp };
  }, [data]);

  return (
    <div className="px-5 pt-8 pb-6 safe-top">
      <header className="mb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Central</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Estatísticas</h1>
        <p className="text-sm text-muted-foreground mt-2">Sua evolução em tempo real — tudo calculado automaticamente.</p>
      </header>

      {/* Range switch */}
      <div className="glass-strong rounded-full p-1 flex mb-5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
              range === r.key ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Report summary */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <Kpi icon={Zap} label="XP no período" value={totals.xp.toLocaleString("pt-BR")} tint="gold" />
        <Kpi icon={Target} label="Missões" value={totals.missions.toString()} tint="electric" />
        <Kpi icon={Flame} label="Hábitos concluídos" value={totals.habits.toString()} tint="orange" />
        <Kpi icon={Dumbbell} label="Min. treino" value={totals.workoutMin.toString()} tint="emerald" />
        <Kpi icon={Smile} label="Humor médio" value={totals.moodAvg == null ? "—" : `${totals.moodAvg}`} tint="pink" />
        <Kpi icon={Wallet} label="Saldo (R$)" value={totals.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} tint={totals.saldo >= 0 ? "emerald" : "red"} />
      </section>

      <Card title="Crescimento de XP" caption={cfg.label + " • acumulado + por período"} icon={TrendingUp}>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={xpSeries}>
              <defs>
                <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.12 88)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="oklch(0.82 0.12 88)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Area type="monotone" dataKey="total" stroke="oklch(0.82 0.12 88)" strokeWidth={2.5} fill="url(#xpFill)" isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="xp" stroke="oklch(0.72 0.2 250)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Evolução por skill" caption="XP conquistado por área no período" icon={Award}>
        <div className="h-64">
          <ResponsiveContainer>
            <RadarChart data={skillSeries}>
              <PolarGrid stroke="oklch(1 0 0 / 0.08)" />
              <PolarAngleAxis dataKey="skill" tick={{ ...AXIS, fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="xp" stroke="oklch(0.72 0.2 250)" fill="oklch(0.72 0.2 250)" fillOpacity={0.35} isAnimationActive animationDuration={900} />
              <Tooltip {...TOOLTIP} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Missões & hábitos" caption="Conclusões por período" icon={Target}>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={activitySeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="missões" stackId="a" fill="oklch(0.72 0.2 250)" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={800} />
              <Bar dataKey="hábitos" stackId="a" fill="oklch(0.75 0.16 40)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Consistência de hábitos" caption="Streak atual vs. melhor" icon={Flame}>
        {habitSeries.length === 0 ? (
          <Empty label="Sem hábitos ainda." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={habitSeries} layout="vertical">
                {GRID}
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="title" tick={AXIS} axisLine={false} tickLine={false} width={90} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="melhor" fill="oklch(0.42 0.06 260)" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800} />
                <Bar dataKey="streak" fill="oklch(0.75 0.16 40)" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Horas de estudo" caption="XP em Conhecimento (proxy de estudo)" icon={BookOpen}>
        <div className="h-48">
          <ResponsiveContainer>
            <AreaChart data={studySeries}>
              <defs>
                <linearGradient id="studyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.2 250)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.72 0.2 250)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Area type="monotone" dataKey="xp" stroke="oklch(0.72 0.2 250)" strokeWidth={2.5} fill="url(#studyFill)" isAnimationActive animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Histórico de treinos" caption="Minutos por período" icon={Dumbbell}>
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={workoutSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="min" fill="oklch(0.72 0.15 155)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Evolução do humor" caption="Média por período (1–10)" icon={Smile}>
        <div className="h-48">
          <ResponsiveContainer>
            <LineChart data={moodSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={AXIS} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...TOOLTIP} />
              <Line type="monotone" dataKey="mood" stroke="oklch(0.78 0.14 340)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Progresso financeiro" caption="Entradas, saídas e saldo acumulado" icon={Wallet}>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={financeSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="entrada" fill="oklch(0.72 0.15 155)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Bar dataKey="saída" fill="oklch(0.65 0.18 25)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Line type="monotone" dataKey="saldo" stroke="oklch(0.82 0.12 88)" strokeWidth={2.5} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={`Resumo ${cfg.label.toLowerCase()}`} caption="Gerado automaticamente dos seus dados" icon={TrendingUp}>
        <ul className="text-sm space-y-2">
          <ReportLine label="XP ganho" value={`${totals.xp.toLocaleString("pt-BR")} pts`} />
          <ReportLine label="Missões completas" value={String(totals.missions)} />
          <ReportLine label="Hábitos concluídos" value={String(totals.habits)} />
          <ReportLine label="Tempo de treino" value={`${totals.workoutMin} min`} />
          <ReportLine label="Dias ativos" value={`${totals.activeDays}/${cfg.days}`} />
          <ReportLine label="Humor médio" value={totals.moodAvg == null ? "—" : `${totals.moodAvg}/10`} />
          <ReportLine label="Entradas" value={`R$ ${totals.inc.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
          <ReportLine label="Saídas" value={`R$ ${totals.exp.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
          <ReportLine label="Saldo" value={`R$ ${totals.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} accent={totals.saldo >= 0 ? "pos" : "neg"} />
        </ul>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  const tints: Record<string, string> = {
    gold: "text-gold bg-gold/15",
    electric: "text-electric bg-electric/15",
    orange: "text-orange-400 bg-orange-400/15",
    emerald: "text-emerald-400 bg-emerald-400/15",
    pink: "text-pink-400 bg-pink-400/15",
    red: "text-red-400 bg-red-400/15",
  };
  return (
    <div className="glass-strong rounded-2xl p-4 animate-fade-in">
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-2 ${tints[tint]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  );
}

function Card({ title, caption, icon: Icon, children }: { title: string; caption?: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="glass-strong rounded-3xl p-5 mb-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-2xl bg-foreground/5 ring-hair flex items-center justify-center">
          <Icon className="h-4 w-4 text-foreground/80" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black leading-tight">{title}</h3>
          {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ReportLine({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  return (
    <li className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-black ${accent === "pos" ? "text-emerald-400" : accent === "neg" ? "text-red-400" : ""}`}>{value}</span>
    </li>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center text-xs text-muted-foreground py-8">{label}</div>;
}
