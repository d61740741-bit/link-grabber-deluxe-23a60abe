import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { skillLabels } from "@/lib/ascension";
import { isCardio, useLiveData } from "@/lib/dashboard";
import {
  Zap, Flame, Target, Dumbbell, BookOpen, Smile, Wallet, TrendingUp, Award,
  Droplets, Moon, Scale, HeartPulse, Shield, Library, CalendarDays, Activity,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/estatisticas")({
  component: Stats,
  head: () => ({
    meta: [
      { title: "Estatísticas — Evolução completa da sua vida" },
      { name: "description", content: "Gráficos de XP, missões, hábitos, treinos, cardio, leitura, água, sono, peso, humor, finanças e recuperação com heatmap de atividade." },
      { property: "og:title", content: "Estatísticas — Evolução completa da sua vida" },
      { property: "og:description", content: "Acompanhe XP, hábitos, saúde, finanças e recuperação em gráficos por dia, semana, mês, ano e total." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type RangeKey = "today" | "week" | "month" | "year" | "all";

const RANGES: { key: RangeKey; label: string; days: number; bucket: "hour" | "day" | "month" }[] = [
  { key: "today", label: "Hoje", days: 1, bucket: "hour" },
  { key: "week", label: "Semana", days: 7, bucket: "day" },
  { key: "month", label: "Mês", days: 30, bucket: "day" },
  { key: "year", label: "Ano", days: 365, bucket: "month" },
  { key: "all", label: "Total", days: 3650, bucket: "month" },
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

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDay = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const fmtMonth = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`;

function Stats() {
  const [range, setRange] = useState<RangeKey>("month");
  const cfg = RANGES.find((r) => r.key === range)!;
  useLiveData?.();

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - cfg.days + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cfg.days]);
  const sinceIso = since.toISOString();
  const sinceDate = localDay(since);

  const { data } = useQuery({
    queryKey: ["stats-center", range],
    queryFn: async () => {
      const [xp, tasks, workouts, health, finance, journal, library, habits, skills, bad, relapses] = await Promise.all([
        supabase.from("xp_history").select("amount, source, skill_category, custom_skill_id, created_at").gte("created_at", sinceIso),
        supabase.from("tasks").select("id, completed, status, completed_at, difficulty, priority, xp_reward").eq("is_template", false).gte("created_at", sinceIso),
        supabase.from("workouts").select("duration_min, workout_type, calories_burned, performed_at").gte("performed_at", sinceIso),
        supabase.from("health_logs").select("log_date, mood, sleep_hours, sleep_quality, weight_kg, water_ml").gte("log_date", sinceDate).order("log_date"),
        supabase.from("finance_transactions").select("kind, amount, category, occurred_on").gte("occurred_on", sinceDate),
        supabase.from("journal_entries").select("entry_date, mood").gte("entry_date", sinceDate),
        supabase.from("library_items").select("id, title, item_type, category, progress, completed, completed_at, study_seconds, updated_at").gte("updated_at", sinceIso),
        supabase.from("habits").select("id, streak, best_streak, title, last_completed_date"),
        supabase.from("skills").select("id, category, display_name, level, total_xp"),
        supabase.from("bad_habits").select("id, name, started_at, relapse_count, best_streak_seconds").is("archived_at", null),
        supabase.from("bad_habit_relapses").select("relapsed_at, bad_habit_id").gte("relapsed_at", sinceIso),
      ]);
      return {
        xp: xp.data ?? [], tasks: tasks.data ?? [], workouts: workouts.data ?? [],
        health: health.data ?? [], finance: finance.data ?? [], journal: journal.data ?? [],
        library: library.data ?? [], habits: habits.data ?? [], skills: skills.data ?? [],
        bad: bad.data ?? [], relapses: relapses.data ?? [],
      };
    },
  });

  /* heatmap year data */
  const [heatYear, setHeatYear] = useState(new Date().getFullYear());
  const { data: heat } = useQuery({
    queryKey: ["stats-heatmap", heatYear],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_activity_heatmap", { p_year: heatYear });
      return (data as any[]) ?? [];
    },
  });

  const buckets = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (cfg.bucket === "hour") {
      const today = localDay(new Date());
      for (let h = 0; h < 24; h++) out.push({ key: `${today}T${pad(h)}`, label: `${pad(h)}h` });
    } else if (cfg.bucket === "month") {
      const months = cfg.key === "all" ? 24 : 12;
      const d = new Date(); d.setDate(1);
      for (let i = months - 1; i >= 0; i--) {
        const x = new Date(d); x.setMonth(d.getMonth() - i);
        const k = `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
        out.push({ key: k, label: fmtMonth(k + "-01") });
      }
    } else {
      for (let i = cfg.days - 1; i >= 0; i--) {
        const x = new Date(); x.setDate(x.getDate() - i);
        const k = localDay(x);
        out.push({ key: k, label: fmtDay(k) });
      }
    }
    return out;
  }, [cfg]);

  const bTs = (iso: string) => {
    const d = new Date(iso);
    if (cfg.bucket === "hour") return `${localDay(d)}T${pad(d.getHours())}`;
    if (cfg.bucket === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    return localDay(d);
  };
  const bDate = (dateStr: string) => {
    if (cfg.bucket === "month") return dateStr.slice(0, 7);
    if (cfg.bucket === "hour") return `${dateStr}T00`;
    return dateStr;
  };

  const agg = (rows: any[], keyOf: (r: any) => string, valOf: (r: any) => number) => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { const k = keyOf(r); m[k] = (m[k] || 0) + (valOf(r) || 0); });
    return m;
  };
  const avg = (rows: any[], keyOf: (r: any) => string, valOf: (r: any) => number | null) => {
    const m: Record<string, { s: number; n: number }> = {};
    rows.forEach((r) => {
      const v = valOf(r); if (v == null) return;
      const k = keyOf(r); m[k] = m[k] || { s: 0, n: 0 }; m[k].s += Number(v); m[k].n++;
    });
    return m;
  };

  /* XP */
  const xpSeries = useMemo(() => {
    const m = agg(data?.xp ?? [], (r) => bTs(r.created_at), (r) => r.amount);
    let cum = 0;
    return buckets.map((b) => { cum += m[b.key] || 0; return { label: b.label, xp: m[b.key] || 0, total: cum }; });
  }, [data, buckets, cfg]);

  /* skills */
  const skillSeries = useMemo(() => {
    const m = agg((data?.xp ?? []).filter((r: any) => r.skill_category), (r) => r.skill_category, (r) => r.amount);
    return Object.keys(skillLabels).map((k) => ({ skill: skillLabels[k].label, xp: m[k] || 0 }));
  }, [data]);

  const skillEvolution = useMemo(() => {
    const keys = Object.keys(skillLabels);
    const map: Record<string, Record<string, number>> = {};
    (data?.xp ?? []).forEach((r: any) => {
      if (!r.skill_category) return;
      const k = bTs(r.created_at);
      map[k] = map[k] || {}; map[k][r.skill_category] = (map[k][r.skill_category] || 0) + r.amount;
    });
    const cum: Record<string, number> = {};
    return buckets.map((b) => {
      const row: any = { label: b.label };
      keys.forEach((k) => { cum[k] = (cum[k] || 0) + (map[b.key]?.[k] || 0); row[skillLabels[k].label] = cum[k]; });
      return row;
    });
  }, [data, buckets, cfg]);

  const skillLevels = useMemo(
    () => (data?.skills ?? [])
      .map((s: any) => ({
        name: s.display_name || skillLabels[s.category]?.label || "Skill",
        nivel: s.level, xp: s.total_xp,
      }))
      .sort((a: any, b: any) => b.xp - a.xp).slice(0, 10),
    [data],
  );

  /* missions */
  const missionSeries = useMemo(() => {
    const done = agg((data?.tasks ?? []).filter((t: any) => t.completed && t.completed_at), (t) => bTs(t.completed_at), () => 1);
    const failed = agg((data?.tasks ?? []).filter((t: any) => t.status === "falhada"), (t) => bTs(t.completed_at ?? new Date().toISOString()), () => 1);
    return buckets.map((b) => ({ label: b.label, concluídas: done[b.key] || 0, falhadas: failed[b.key] || 0 }));
  }, [data, buckets, cfg]);

  /* habits */
  const habitSeries = useMemo(() => {
    const m = agg((data?.xp ?? []).filter((r: any) => r.source === "habit"), (r) => bTs(r.created_at), () => 1);
    return buckets.map((b) => ({ label: b.label, hábitos: m[b.key] || 0 }));
  }, [data, buckets, cfg]);

  const habitStreaks = useMemo(
    () => (data?.habits ?? [])
      .map((h: any) => ({ title: h.title.length > 14 ? h.title.slice(0, 12) + "…" : h.title, streak: h.streak, melhor: h.best_streak }))
      .sort((a: any, b: any) => b.streak - a.streak).slice(0, 8),
    [data],
  );

  /* workouts / cardio */
  const workoutSeries = useMemo(() => {
    const strength = agg((data?.workouts ?? []).filter((w: any) => !isCardio(w.workout_type)), (w) => bTs(w.performed_at), (w) => w.duration_min);
    const cardio = agg((data?.workouts ?? []).filter((w: any) => isCardio(w.workout_type)), (w) => bTs(w.performed_at), (w) => w.duration_min);
    return buckets.map((b) => ({ label: b.label, força: strength[b.key] || 0, cardio: cardio[b.key] || 0 }));
  }, [data, buckets, cfg]);

  const cardioSeries = useMemo(() => {
    const cardio = (data?.workouts ?? []).filter((w: any) => isCardio(w.workout_type));
    const min = agg(cardio, (w) => bTs(w.performed_at), (w) => w.duration_min);
    const kcal = agg(cardio, (w) => bTs(w.performed_at), (w) => w.calories_burned);
    return buckets.map((b) => ({ label: b.label, min: min[b.key] || 0, kcal: kcal[b.key] || 0 }));
  }, [data, buckets, cfg]);

  /* library / reading */
  const readingSeries = useMemo(() => {
    const minutes = agg(data?.library ?? [], (l) => bTs(l.updated_at), (l) => Math.round((l.study_seconds || 0) / 60));
    const done = agg((data?.library ?? []).filter((l: any) => l.completed && l.completed_at), (l) => bTs(l.completed_at), () => 1);
    return buckets.map((b) => ({ label: b.label, minutos: minutes[b.key] || 0, concluídos: done[b.key] || 0 }));
  }, [data, buckets, cfg]);

  const libraryByType = useMemo(() => {
    const m = agg(data?.library ?? [], (l) => l.item_type, () => 1);
    return Object.entries(m).map(([k, v]) => ({ tipo: k, itens: v }));
  }, [data]);

  /* health */
  const waterSeries = useMemo(() => {
    const m = agg(data?.health ?? [], (h) => bDate(h.log_date), (h) => h.water_ml);
    return buckets.map((b) => ({ label: b.label, ml: m[b.key] || 0 }));
  }, [data, buckets, cfg]);

  const sleepSeries = useMemo(() => {
    const h = avg(data?.health ?? [], (r) => bDate(r.log_date), (r) => r.sleep_hours);
    const q = avg(data?.health ?? [], (r) => bDate(r.log_date), (r) => r.sleep_quality);
    return buckets.map((b) => ({
      label: b.label,
      horas: h[b.key] ? +(h[b.key].s / h[b.key].n).toFixed(1) : null,
      qualidade: q[b.key] ? +(q[b.key].s / q[b.key].n).toFixed(1) : null,
    }));
  }, [data, buckets, cfg]);

  const weightSeries = useMemo(
    () => (data?.health ?? []).filter((h: any) => h.weight_kg != null)
      .map((h: any) => ({ label: fmtDay(h.log_date), peso: Number(h.weight_kg) })),
    [data],
  );

  const moodSeries = useMemo(() => {
    const rows = [
      ...(data?.journal ?? []).map((j: any) => ({ d: j.entry_date, m: j.mood })),
      ...(data?.health ?? []).map((h: any) => ({ d: h.log_date, m: h.mood })),
    ];
    const m = avg(rows, (r) => bDate(r.d), (r) => r.m);
    return buckets.map((b) => ({ label: b.label, humor: m[b.key] ? +(m[b.key].s / m[b.key].n).toFixed(2) : null }));
  }, [data, buckets, cfg]);

  /* finance */
  const financeSeries = useMemo(() => {
    const inMap = agg((data?.finance ?? []).filter((f: any) => f.kind === "receita"), (f) => bDate(f.occurred_on), (f) => Number(f.amount));
    const outMap = agg((data?.finance ?? []).filter((f: any) => f.kind === "despesa"), (f) => bDate(f.occurred_on), (f) => Number(f.amount));
    let saldo = 0;
    return buckets.map((b) => {
      const inc = inMap[b.key] || 0, exp = outMap[b.key] || 0;
      saldo += inc - exp;
      return { label: b.label, entrada: inc, saída: exp, saldo: +saldo.toFixed(2) };
    });
  }, [data, buckets, cfg]);

  /* recovery */
  const recoverySeries = useMemo(
    () => (data?.bad ?? []).map((b: any) => ({
      name: b.name.length > 12 ? b.name.slice(0, 10) + "…" : b.name,
      dias: Math.max(0, Math.floor((Date.now() - new Date(b.started_at).getTime()) / 86400000)),
      recorde: Math.floor((b.best_streak_seconds || 0) / 86400),
    })).sort((a: any, b: any) => b.dias - a.dias),
    [data],
  );

  const relapseSeries = useMemo(() => {
    const m = agg(data?.relapses ?? [], (r) => bTs(r.relapsed_at), () => 1);
    return buckets.map((b) => ({ label: b.label, recaídas: m[b.key] || 0 }));
  }, [data, buckets, cfg]);

  /* totals */
  const totals = useMemo(() => {
    const xp = (data?.xp ?? []).reduce((s: number, r: any) => s + r.amount, 0);
    const missions = (data?.tasks ?? []).filter((t: any) => t.completed).length;
    const habits = (data?.xp ?? []).filter((r: any) => r.source === "habit").length;
    const workoutMin = (data?.workouts ?? []).reduce((s: number, w: any) => s + (w.duration_min || 0), 0);
    const cardioMin = (data?.workouts ?? []).filter((w: any) => isCardio(w.workout_type)).reduce((s: number, w: any) => s + (w.duration_min || 0), 0);
    const readMin = Math.round((data?.library ?? []).reduce((s: number, l: any) => s + (l.study_seconds || 0), 0) / 60);
    const water = (data?.health ?? []).reduce((s: number, h: any) => s + (h.water_ml || 0), 0);
    const sleepArr = (data?.health ?? []).map((h: any) => h.sleep_hours).filter((v: any) => v != null);
    const sleepAvg = sleepArr.length ? +(sleepArr.reduce((a: number, b: number) => a + Number(b), 0) / sleepArr.length).toFixed(1) : null;
    const inc = (data?.finance ?? []).filter((f: any) => f.kind === "receita").reduce((s: number, f: any) => s + Number(f.amount), 0);
    const exp = (data?.finance ?? []).filter((f: any) => f.kind === "despesa").reduce((s: number, f: any) => s + Number(f.amount), 0);
    const moodNums = [...(data?.journal ?? []), ...(data?.health ?? [])].map((r: any) => r.mood).filter((m: any) => m != null);
    const moodAvg = moodNums.length ? +(moodNums.reduce((a: number, b: number) => a + b, 0) / moodNums.length).toFixed(1) : null;
    const activeDays = new Set((data?.xp ?? []).map((r: any) => localDay(new Date(r.created_at)))).size;
    return { xp, missions, habits, workoutMin, cardioMin, readMin, water, sleepAvg, inc, exp, moodAvg, activeDays, saldo: inc - exp, relapses: (data?.relapses ?? []).length };
  }, [data]);

  return (
    <div className="px-5 pt-8 pb-6 safe-top">
      <header className="mb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Central</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Estatísticas</h1>
        <p className="text-sm text-muted-foreground mt-2">Sua evolução em tempo real — tudo calculado automaticamente.</p>
      </header>

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

      <section className="grid grid-cols-2 gap-3 mb-6">
        <Kpi icon={Zap} label="XP no período" value={totals.xp.toLocaleString("pt-BR")} tint="gold" />
        <Kpi icon={Target} label="Missões" value={String(totals.missions)} tint="electric" />
        <Kpi icon={Flame} label="Hábitos" value={String(totals.habits)} tint="orange" />
        <Kpi icon={Dumbbell} label="Min. treino" value={String(totals.workoutMin)} tint="emerald" />
        <Kpi icon={HeartPulse} label="Min. cardio" value={String(totals.cardioMin)} tint="red" />
        <Kpi icon={BookOpen} label="Min. leitura" value={String(totals.readMin)} tint="electric" />
        <Kpi icon={Droplets} label="Água (L)" value={(totals.water / 1000).toFixed(1)} tint="electric" />
        <Kpi icon={Moon} label="Sono médio" value={totals.sleepAvg == null ? "—" : `${totals.sleepAvg}h`} tint="pink" />
        <Kpi icon={Smile} label="Humor médio" value={totals.moodAvg == null ? "—" : `${totals.moodAvg}`} tint="pink" />
        <Kpi icon={Wallet} label="Saldo (R$)" value={totals.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} tint={totals.saldo >= 0 ? "emerald" : "red"} />
      </section>

      <Card title="Crescimento de XP" caption={`${cfg.label} • acumulado + por período`} icon={TrendingUp}>
        <div className="h-56">
          <ResponsiveContainer>
            <ComposedChart data={xpSeries}>
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Heatmap de atividade" caption={`XP por dia em ${heatYear}`} icon={CalendarDays}>
        <div className="flex gap-2 mb-3">
          {[heatYear - 1, heatYear, heatYear + 1].slice(0, 3).map((y) => (
            <button key={y} onClick={() => setHeatYear(y)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold ${y === heatYear ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground"}`}>
              {y}
            </button>
          ))}
        </div>
        <Heatmap year={heatYear} data={heat ?? []} />
      </Card>

      <Card title="Calendário de atividade" caption="Últimos 30 dias — intensidade de XP" icon={Activity}>
        <ActivityCalendar data={heat ?? []} />
      </Card>

      <Card title="Evolução por skill" caption="XP acumulado por área no período" icon={Award}>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={skillEvolution}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.keys(skillLabels).map((k, i) => (
                <Line key={k} type="monotone" dataKey={skillLabels[k].label} dot={false} strokeWidth={2}
                  stroke={["oklch(0.7 0.18 300)","oklch(0.72 0.15 155)","oklch(0.72 0.2 250)","oklch(0.82 0.12 88)","oklch(0.75 0.16 40)","oklch(0.78 0.14 340)"][i]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Distribuição de skills" caption="XP conquistado por área" icon={Award}>
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

      <Card title="Níveis por skill" caption="Nível atual e XP total" icon={Award}>
        {skillLevels.length === 0 ? <Empty label="Sem skills ainda." /> : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={skillLevels} layout="vertical">
                {GRID}
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={90} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="nivel" fill="oklch(0.72 0.2 250)" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Missões" caption="Concluídas vs. falhadas" icon={Target}>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={missionSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="concluídas" stackId="a" fill="oklch(0.72 0.2 250)" isAnimationActive animationDuration={800} />
              <Bar dataKey="falhadas" stackId="a" fill="oklch(0.65 0.18 25)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Hábitos" caption="Conclusões por período" icon={Flame}>
        <div className="h-48">
          <ResponsiveContainer>
            <AreaChart data={habitSeries}>
              <defs>
                <linearGradient id="habitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.75 0.16 40)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.75 0.16 40)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Area type="monotone" dataKey="hábitos" stroke="oklch(0.75 0.16 40)" strokeWidth={2.5} fill="url(#habitFill)" isAnimationActive animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Consistência de hábitos" caption="Streak atual vs. melhor" icon={Flame}>
        {habitStreaks.length === 0 ? <Empty label="Sem hábitos ainda." /> : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={habitStreaks} layout="vertical">
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

      <Card title="Treinos" caption="Minutos de força e cardio" icon={Dumbbell}>
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={workoutSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="força" stackId="w" fill="oklch(0.72 0.15 155)" isAnimationActive animationDuration={800} />
              <Bar dataKey="cardio" stackId="w" fill="oklch(0.65 0.18 25)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Cardio" caption="Minutos e calorias queimadas" icon={HeartPulse}>
        <div className="h-48">
          <ResponsiveContainer>
            <ComposedChart data={cardioSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="min" fill="oklch(0.65 0.18 25)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Line type="monotone" dataKey="kcal" stroke="oklch(0.82 0.12 88)" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Leitura & estudo" caption="Minutos estudados e itens concluídos" icon={BookOpen}>
        <div className="h-48">
          <ResponsiveContainer>
            <ComposedChart data={readingSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="minutos" fill="oklch(0.72 0.2 250)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Line type="monotone" dataKey="concluídos" stroke="oklch(0.82 0.12 88)" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Biblioteca" caption="Itens por tipo no período" icon={Library}>
        {libraryByType.length === 0 ? <Empty label="Sem itens na biblioteca." /> : (
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={libraryByType}>
                {GRID}
                <XAxis dataKey="tipo" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="itens" fill="oklch(0.7 0.18 300)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Água" caption="Consumo em ml por período" icon={Droplets}>
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={waterSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="ml" fill="oklch(0.72 0.2 230)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Sono" caption="Horas e qualidade média" icon={Moon}>
        <div className="h-44">
          <ResponsiveContainer>
            <ComposedChart data={sleepSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="horas" fill="oklch(0.6 0.14 280)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Line type="monotone" dataKey="qualidade" stroke="oklch(0.78 0.14 340)" strokeWidth={2.5} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Peso" caption="Evolução registrada" icon={Scale}>
        {weightSeries.length === 0 ? <Empty label="Sem registros de peso." /> : (
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={weightSeries}>
                <defs>
                  <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.15 155)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="oklch(0.72 0.15 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {GRID}
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={AXIS} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...TOOLTIP} />
                <Area type="monotone" dataKey="peso" stroke="oklch(0.72 0.15 155)" strokeWidth={2.5} fill="url(#weightFill)" isAnimationActive animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Humor" caption="Média por período (1–10)" icon={Smile}>
        <div className="h-44">
          <ResponsiveContainer>
            <LineChart data={moodSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={AXIS} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...TOOLTIP} />
              <Line type="monotone" dataKey="humor" stroke="oklch(0.78 0.14 340)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Finanças" caption="Entradas, saídas e saldo acumulado" icon={Wallet}>
        <div className="h-56">
          <ResponsiveContainer>
            <ComposedChart data={financeSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="entrada" fill="oklch(0.72 0.15 155)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Bar dataKey="saída" fill="oklch(0.65 0.18 25)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
              <Line type="monotone" dataKey="saldo" stroke="oklch(0.82 0.12 88)" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Recuperação" caption="Dias limpo por vício (atual vs. recorde)" icon={Shield}>
        {recoverySeries.length === 0 ? <Empty label="Nenhum vício em acompanhamento." /> : (
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={recoverySeries} layout="vertical">
                {GRID}
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={90} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="recorde" fill="oklch(0.42 0.06 260)" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800} />
                <Bar dataKey="dias" fill="oklch(0.72 0.15 155)" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Recaídas" caption="Ocorrências no período" icon={Shield}>
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={relapseSeries}>
              {GRID}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="recaídas" fill="oklch(0.65 0.18 25)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={`Resumo — ${cfg.label.toLowerCase()}`} caption="Gerado automaticamente dos seus dados" icon={TrendingUp}>
        <ul className="text-sm space-y-2">
          <ReportLine label="XP ganho" value={`${totals.xp.toLocaleString("pt-BR")} pts`} />
          <ReportLine label="Missões completas" value={String(totals.missions)} />
          <ReportLine label="Hábitos concluídos" value={String(totals.habits)} />
          <ReportLine label="Tempo de treino" value={`${totals.workoutMin} min`} />
          <ReportLine label="Tempo de cardio" value={`${totals.cardioMin} min`} />
          <ReportLine label="Tempo de leitura" value={`${totals.readMin} min`} />
          <ReportLine label="Água consumida" value={`${(totals.water / 1000).toFixed(1)} L`} />
          <ReportLine label="Sono médio" value={totals.sleepAvg == null ? "—" : `${totals.sleepAvg} h`} />
          <ReportLine label="Humor médio" value={totals.moodAvg == null ? "—" : `${totals.moodAvg}/10`} />
          <ReportLine label="Recaídas" value={String(totals.relapses)} />
          <ReportLine label="Dias ativos" value={`${totals.activeDays}`} />
          <ReportLine label="Entradas" value={`R$ ${totals.inc.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
          <ReportLine label="Saídas" value={`R$ ${totals.exp.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} />
          <ReportLine label="Saldo" value={`R$ ${totals.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} accent={totals.saldo >= 0 ? "pos" : "neg"} />
        </ul>
      </Card>
    </div>
  );
}

/* ---------------- heatmap ---------------- */

function heatColor(xp: number, max: number) {
  if (!xp) return "bg-foreground/5";
  const r = xp / Math.max(1, max);
  if (r > 0.75) return "bg-gold";
  if (r > 0.5) return "bg-gold/70";
  if (r > 0.25) return "bg-gold/45";
  return "bg-gold/25";
}

function Heatmap({ year, data }: { year: number; data: any[] }) {
  const map = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach((d: any) => { m[String(d.date).slice(0, 10)] = Number(d.xp) || 0; });
    return m;
  }, [data]);
  const max = useMemo(() => Math.max(1, ...Object.values(map)), [map]);

  const weeks = useMemo(() => {
    const start = new Date(year, 0, 1);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(year, 11, 31);
    const cols: { key: string; inYear: boolean }[][] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const col: { key: string; inYear: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        col.push({ key: localDay(cur), inYear: cur.getFullYear() === year });
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [year]);

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-[3px] min-w-max">
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((d) => (
                <div
                  key={d.key}
                  title={`${fmtDay(d.key)} • ${map[d.key] || 0} XP`}
                  className={`h-[10px] w-[10px] rounded-[3px] transition-colors ${d.inYear ? heatColor(map[d.key] || 0, max) : "bg-transparent"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
        <span>menos</span>
        {["bg-foreground/5", "bg-gold/25", "bg-gold/45", "bg-gold/70", "bg-gold"].map((c) => (
          <span key={c} className={`h-[10px] w-[10px] rounded-[3px] ${c}`} />
        ))}
        <span>mais</span>
      </div>
    </div>
  );
}

function ActivityCalendar({ data }: { data: any[] }) {
  const map = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach((d: any) => { m[String(d.date).slice(0, 10)] = Number(d.xp) || 0; });
    return m;
  }, [data]);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push(localDay(d));
    }
    return out;
  }, []);
  const max = Math.max(1, ...days.map((d) => map[d] || 0));

  return (
    <div className="grid grid-cols-6 gap-2">
      {days.map((d) => (
        <div key={d} className={`rounded-xl p-2 text-center ring-hair ${heatColor(map[d] || 0, max)}`}>
          <p className="text-[10px] font-semibold opacity-90">{fmtDay(d)}</p>
          <p className="text-[11px] font-black">{map[d] || 0}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- ui ---------------- */

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
