import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { xpForLevel, levelFromXp, progressToNext, skillLabels } from "@/lib/ascension";
import {
  Flame, Zap, Check, Trophy, Calendar as CalIcon, TrendingUp, Sparkles,
  Star, Target, Clock, Award, ChevronRight, Crown, Gift,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line,
  AreaChart, Area, CartesianGrid,
} from "recharts";

export type StatKey =
  | "streak" | "xpToday" | "completed" | "week" | "month" | "level" | "totalXp";

type Ctx = { open: (k: StatKey) => void };
const StatCtx = createContext<Ctx>({ open: () => {} });
export const useStatsSheet = () => useContext(StatCtx);

export function StatsSheetsProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<StatKey | null>(null);
  return (
    <StatCtx.Provider value={{ open: (k) => setKey(k) }}>
      {children}
      <Sheet open={key !== null} onOpenChange={(o) => !o && setKey(null)}>
        <SheetContent
          side="bottom"
          className="p-0 border-0 bg-transparent shadow-none max-h-[92dvh] overflow-hidden [&>button]:hidden"
        >
          <div className="relative mx-auto max-w-md h-[92dvh] rounded-t-[32px] overflow-hidden glass-strong shadow-elegant ring-hair">
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[360px] w-[360px] rounded-full bg-electric/15 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
            <div className="relative h-full overflow-y-auto overscroll-contain">
              <div className="sticky top-0 z-10 pt-3 pb-2 backdrop-blur-xl bg-background/40">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              </div>
              <div className="px-5 pb-10 pt-2 animate-rise">
                {key === "streak" && <StreakPanel />}
                {key === "xpToday" && <XpTodayPanel />}
                {key === "completed" && <CompletedPanel />}
                {key === "week" && <WeekPanel />}
                {key === "month" && <MonthPanel />}
                {key === "level" && <LevelPanel />}
                {key === "totalXp" && <TotalXpPanel />}
              </div>
            </div>
          </div>
          <SheetHeader className="sr-only">
            <SheetTitle>{key ?? ""}</SheetTitle>
            <SheetDescription>Detalhes da estatística</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </StatCtx.Provider>
  );
}

/* -------------------- shared helpers -------------------- */

function Header({ icon: Icon, title, subtitle, tint = "text-electric" }: any) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className={`h-11 w-11 rounded-2xl bg-white/[0.05] ring-hair flex items-center justify-center ${tint}`}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{subtitle}</p>
        <h2 className="text-[22px] font-semibold tracking-tight leading-tight mt-0.5">{title}</h2>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint, tint }: { label: string; value: ReactNode; hint?: string; tint?: string }) {
  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`mt-1.5 text-[22px] font-semibold tracking-tight ${tint ?? ""}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function EmptyLine({ text = "Sem dados ainda" }: { text?: string }) {
  return <p className="text-xs text-muted-foreground text-center py-6">{text}</p>;
}

const chartAxis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" } as any;

function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });
}

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }
function ptDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function ptTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* -------------------- STREAK -------------------- */

function StreakPanel() {
  const { data: profile } = useProfile();
  const { data: xp } = useQuery({
    queryKey: ["xp", "streak-history"],
    queryFn: async () => {
      const start = new Date(); start.setDate(start.getDate() - 89); start.setHours(0,0,0,0);
      const { data } = await supabase.from("xp_history").select("created_at,amount").gte("created_at", start.toISOString());
      return data ?? [];
    },
  });

  const daysWithXp = useMemo(() => {
    const s = new Set<string>();
    (xp ?? []).forEach((r: any) => s.add(dayKey(new Date(r.created_at))));
    return s;
  }, [xp]);

  const longest = useMemo(() => {
    if (!xp || xp.length === 0) return 0;
    const sorted = Array.from(daysWithXp).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curD = new Date(sorted[i]);
      const diff = (curD.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) { cur++; best = Math.max(best, cur); }
      else cur = 1;
    }
    return best;
  }, [xp, daysWithXp]);

  const avg = daysWithXp.size > 0 ? Math.round((daysWithXp.size / 90) * 30) : 0;
  const streak = profile?.streak_days ?? 0;
  const nextMilestone = [3, 7, 14, 30, 60, 100, 180, 365].find((m) => m > streak) ?? streak + 30;
  const rewardXp = nextMilestone * 10;

  // 5x7 grid = 35 days
  const gridDays: { key: string; active: boolean; today: boolean }[] = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const k = dayKey(d);
    gridDays.push({ key: k, active: daysWithXp.has(k), today: i === 0 });
  }

  return (
    <>
      <Header icon={Flame} title="Sua sequência" subtitle="Streak" tint="text-orange-300" />

      <div className="glass-strong rounded-3xl p-6 mb-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/15 via-transparent to-transparent" />
        <div className="relative">
          <div className="text-6xl">🔥</div>
          <p className="text-[52px] leading-none font-semibold tracking-tight mt-2">{streak}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.28em] mt-1">
            {streak === 1 ? "dia" : "dias seguidos"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatTile label="Maior sequência" value={<span className="inline-flex items-baseline gap-1"><Trophy className="h-4 w-4 text-gold" />{longest}</span>} hint="dias consecutivos" />
        <StatTile label="Média mensal" value={`${avg}d`} hint="últimos 90 dias" />
        <StatTile label="Último dia ativo" value={profile?.last_active_date ? ptDate(profile.last_active_date) : "—"} />
        <StatTile label="Total ativo" value={`${daysWithXp.size}d`} hint="em 90 dias" />
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Calendário — 35 dias</p>
          <CalIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {gridDays.map((d) => (
            <div
              key={d.key}
              title={d.key}
              className={[
                "aspect-square rounded-md ring-hair transition",
                d.active ? "bg-gradient-to-br from-orange-400/80 to-orange-600/40" : "bg-white/[0.03]",
                d.today ? "ring-2 ring-electric/60" : "",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gold/15 ring-hair flex items-center justify-center">
            <Gift className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Próxima recompensa</p>
            <p className="text-sm font-semibold mt-0.5">{nextMilestone} dias — +{rewardXp} XP bônus</p>
          </div>
          <span className="text-xs font-semibold text-gold">{nextMilestone - streak}d</span>
        </div>
        <div className="relative mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 to-gold" style={{ width: `${Math.min(100, (streak / nextMilestone) * 100)}%` }} />
        </div>
      </div>
    </>
  );
}

/* -------------------- XP TODAY -------------------- */

function XpTodayPanel() {
  const { data } = useQuery({
    queryKey: ["xp", "today-timeline"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0,0,0,0);
      const { data } = await supabase
        .from("xp_history")
        .select("id,amount,source,skill_category,created_at")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });
  const total = (data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);

  return (
    <>
      <Header icon={Zap} title="XP de hoje" subtitle="Timeline" />

      <div className="glass-strong rounded-3xl p-6 mb-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-electric/15 via-transparent to-transparent" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Total do dia</p>
          <p className="text-[56px] leading-none font-semibold tracking-tight mt-2">
            {total}<span className="text-xl text-muted-foreground font-normal ml-1">XP</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {data?.length ?? 0} {(data?.length ?? 0) === 1 ? "conquista" : "conquistas"} hoje
          </p>
        </div>
      </div>

      <div className="glass rounded-3xl p-2">
        {(data ?? []).length === 0 ? <EmptyLine text="Nenhum XP ganho hoje ainda" /> : (
          <div className="relative">
            <div className="absolute left-[26px] top-3 bottom-3 w-px bg-white/10" />
            {(data ?? []).map((r: any, i: number) => {
              const meta = r.skill_category ? skillLabels[r.skill_category] : null;
              return (
                <div key={r.id} className="relative flex items-center gap-3 p-3">
                  <div className="relative z-10 h-[22px] w-[22px] rounded-full bg-background ring-2 ring-electric/50 flex items-center justify-center text-[11px]">
                    {meta?.emoji ?? "✨"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground tabular-nums">{ptTime(r.created_at)}</p>
                    <p className="text-sm font-medium truncate">{r.source || "Atividade"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-electric bg-electric/10 rounded-full px-2 py-1 ring-hair">
                    +{r.amount} XP
                  </span>
                  {i < (data!.length - 1) && <div className="absolute left-5 right-5 bottom-0 h-px bg-white/[0.04]" />}
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 mt-1 border-t border-white/[0.06]">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-semibold text-electric">{total} XP</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* -------------------- COMPLETED -------------------- */

function CompletedPanel() {
  const today = new Date(); today.setHours(0,0,0,0);
  const iso = today.toISOString();
  const { data: done } = useQuery({
    queryKey: ["tasks", "done-today-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks").select("*")
        .eq("completed", true)
        .gte("completed_at", iso)
        .order("completed_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: pending } = useQuery({
    queryKey: ["tasks", "pending-today"],
    queryFn: async () => {
      const dstr = today.toISOString().slice(0,10);
      const { count } = await supabase
        .from("tasks").select("*", { count: "exact", head: true })
        .eq("completed", false).eq("due_date", dstr);
      return count ?? 0;
    },
  });
  const total = (done?.length ?? 0) + (pending ?? 0);
  const pct = total ? Math.round(((done?.length ?? 0) / total) * 100) : 0;
  const xpSum = (done ?? []).reduce((s: number, t: any) => s + (t.xp_granted ?? t.xp_reward ?? 0), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    (done ?? []).forEach((t: any) => {
      const k = t.skill_category || t.category || "outro";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries());
  }, [done]);

  return (
    <>
      <Header icon={Check} title="Concluídas hoje" subtitle="Missões" tint="text-emerald-300" />

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <StatTile label="Feitas" value={done?.length ?? 0} tint="text-emerald-300" />
        <StatTile label="XP ganho" value={xpSum} tint="text-electric" />
        <StatTile label="Taxa" value={`${pct}%`} tint="text-gold" />
      </div>

      <div className="glass rounded-3xl p-5 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Progresso do dia</p>
        <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-electric transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{done?.length ?? 0} de {total} missões</p>
      </div>

      {byCategory.length > 0 && (
        <div className="glass rounded-3xl p-4 mb-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Por categoria</p>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([k, v]) => {
              const meta = skillLabels[k];
              return (
                <span key={k} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.05] ring-hair">
                  <span>{meta?.emoji ?? "•"}</span>
                  <span className="font-medium">{meta?.label ?? k}</span>
                  <span className="text-muted-foreground">×{v}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass rounded-3xl overflow-hidden">
        {(done ?? []).length === 0 ? <EmptyLine text="Nenhuma missão concluída hoje" /> : (
          (done ?? []).map((t: any, i: number) => (
            <div key={t.id}>
              {i > 0 && <div className="divider-hair mx-5" />}
              <div className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-400/20 ring-hair flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {t.completed_at ? ptTime(t.completed_at) : "—"}
                    {t.skill_category && <>· {skillLabels[t.skill_category]?.label}</>}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-electric bg-electric/10 rounded-full px-2 py-1 ring-hair">
                  +{t.xp_granted ?? t.xp_reward} XP
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* -------------------- WEEK / MONTH shared -------------------- */

function useRangeData(days: number) {
  return useQuery({
    queryKey: ["stats-range", days],
    queryFn: async () => {
      const start = new Date(); start.setDate(start.getDate() - (days - 1)); start.setHours(0,0,0,0);
      const [xp, tasks] = await Promise.all([
        supabase.from("xp_history").select("amount,skill_category,source,created_at").gte("created_at", start.toISOString()),
        supabase.from("tasks").select("id,completed,completed_at,due_date,skill_category,category,xp_reward,xp_granted").or(`completed_at.gte.${start.toISOString()},due_date.gte.${start.toISOString().slice(0,10)}`),
      ]);
      return { xp: xp.data ?? [], tasks: tasks.data ?? [], start };
    },
  });
}

function buildDayBuckets(rows: any[], days: number) {
  const start = new Date(); start.setDate(start.getDate() - (days - 1)); start.setHours(0,0,0,0);
  const buckets: { key: string; label: string; xp: number; date: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    buckets.push({
      key: dayKey(d),
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      xp: 0,
      date: d,
    });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  rows.forEach((r) => {
    const k = dayKey(new Date(r.created_at));
    const b = map.get(k);
    if (b) b.xp += r.amount ?? 0;
  });
  return buckets;
}

function topBy<T>(rows: T[], keyFn: (r: T) => string | null, valFn: (r: T) => number = () => 1) {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!k) return;
    m.set(k, (m.get(k) ?? 0) + valFn(r));
  });
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

/* -------------------- WEEK -------------------- */

function WeekPanel() {
  const { data } = useRangeData(7);
  const buckets = useMemo(() => buildDayBuckets(data?.xp ?? [], 7), [data]);
  const totalXp = buckets.reduce((s, b) => s + b.xp, 0);
  const tasks = data?.tasks ?? [];
  const doneWeek = tasks.filter((t: any) => t.completed && t.completed_at && new Date(t.completed_at) >= (data?.start ?? new Date(0)));
  const failedWeek = tasks.filter((t: any) => !t.completed && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString()));
  const topSkill = topBy(data?.xp ?? [], (r: any) => r.skill_category)[0];
  const sorted = [...buckets].sort((a, b) => b.xp - a.xp);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <>
      <Header icon={TrendingUp} title="Esta semana" subtitle="7 dias" />

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <StatTile label="XP" value={totalXp} tint="text-electric" />
        <StatTile label="Feitas" value={doneWeek.length} tint="text-emerald-300" />
        <StatTile label="Falhadas" value={failedWeek.length} tint="text-rose-300" />
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">XP por dia</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets}>
              <defs>
                <linearGradient id="barW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.2 250)" stopOpacity={1} />
                  <stop offset="100%" stopColor="oklch(0.72 0.2 250)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={chartAxis} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "rgba(15,15,20,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="xp" fill="url(#barW)" radius={[8, 8, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Melhor dia</p>
          <p className="mt-1 text-sm font-semibold">{best?.date.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
          <p className="text-xs text-electric mt-0.5">+{best?.xp ?? 0} XP</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pior dia</p>
          <p className="mt-1 text-sm font-semibold">{worst?.date.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
          <p className="text-xs text-rose-300 mt-0.5">+{worst?.xp ?? 0} XP</p>
        </div>
      </div>

      {topSkill && (
        <div className="glass rounded-3xl p-5 flex items-center gap-3">
          <div className="text-2xl">{skillLabels[topSkill[0]]?.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Skill mais treinada</p>
            <p className="text-sm font-semibold mt-0.5">{skillLabels[topSkill[0]]?.label ?? topSkill[0]}</p>
          </div>
          <span className="text-xs font-semibold text-electric">{topSkill[1]} XP</span>
        </div>
      )}
    </>
  );
}

/* -------------------- MONTH -------------------- */

function MonthPanel() {
  const { data } = useRangeData(30);
  const buckets = useMemo(() => buildDayBuckets(data?.xp ?? [], 30), [data]);
  const totalXp = buckets.reduce((s, b) => s + b.xp, 0);
  const tasks = data?.tasks ?? [];
  const doneMonth = tasks.filter((t: any) => t.completed && t.completed_at);
  const activeDays = buckets.filter((b) => b.xp > 0).length;
  const consistency = Math.round((activeDays / 30) * 100);
  const topSkill = topBy(data?.xp ?? [], (r: any) => r.skill_category)[0];
  const topCat = topBy(data?.xp ?? [], (r: any) => r.source)[0];
  const best = [...buckets].sort((a, b) => b.xp - a.xp)[0];

  // heatmap colors
  const max = Math.max(1, ...buckets.map((b) => b.xp));

  return (
    <>
      <Header icon={CalIcon} title="Este mês" subtitle="30 dias" tint="text-gold" />

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <StatTile label="XP" value={totalXp} tint="text-electric" />
        <StatTile label="Missões" value={doneMonth.length} tint="text-emerald-300" />
        <StatTile label="Consistência" value={`${consistency}%`} tint="text-gold" />
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Heatmap</p>
        <div className="grid grid-cols-10 gap-1.5">
          {buckets.map((b) => {
            const ratio = b.xp / max;
            return (
              <div
                key={b.key}
                title={`${b.key}: ${b.xp} XP`}
                className="aspect-square rounded-md ring-hair"
                style={{
                  background: b.xp === 0
                    ? "rgba(255,255,255,0.03)"
                    : `linear-gradient(135deg, oklch(0.72 0.2 250 / ${0.2 + ratio * 0.8}), oklch(0.82 0.14 88 / ${0.15 + ratio * 0.6}))`,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Evolução</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buckets}>
              <defs>
                <linearGradient id="areaM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.14 88)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="oklch(0.72 0.2 250)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={chartAxis} interval={4} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "rgba(15,15,20,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="xp" stroke="oklch(0.82 0.14 88)" strokeWidth={2} fill="url(#areaM)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {topSkill && (
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Top skill</p>
            <p className="mt-1 text-sm font-semibold">{skillLabels[topSkill[0]]?.emoji} {skillLabels[topSkill[0]]?.label}</p>
            <p className="text-xs text-electric mt-0.5">{topSkill[1]} XP</p>
          </div>
        )}
        {topCat && (
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fonte principal</p>
            <p className="mt-1 text-sm font-semibold truncate">{topCat[0]}</p>
            <p className="text-xs text-electric mt-0.5">{topCat[1]} XP</p>
          </div>
        )}
        {best && (
          <div className="glass rounded-2xl p-4 col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dia mais produtivo</p>
            <p className="mt-1 text-sm font-semibold">{best.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</p>
            <p className="text-xs text-gold mt-0.5">+{best.xp} XP</p>
          </div>
        )}
      </div>
    </>
  );
}

/* -------------------- LEVEL -------------------- */

function LevelPanel() {
  const { data: profile } = useProfile();
  const totalXp = profile?.total_xp ?? 0;
  const level = profile?.level ?? levelFromXp(totalXp);
  const prog = progressToNext(totalXp, level);

  const levels = Array.from({ length: 10 }, (_, i) => level - 3 + i).filter((l) => l >= 1);

  const rewards: Record<number, string> = {
    3: "Tema Bronze",
    5: "Avatar Dourado",
    10: "Tema Elétrico",
    15: "Ícone raro",
    20: "Coach IA Pro",
    30: "Aura Mítica",
    50: "Título Lenda",
  };

  const nextReward = Object.keys(rewards).map(Number).sort((a,b)=>a-b).find((l) => l > level);

  return (
    <>
      <Header icon={Crown} title={`Nível ${level}`} subtitle="Progressão" tint="text-gold" />

      <div className="glass-strong rounded-3xl p-6 mb-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/15 via-electric/5 to-transparent" />
        <div className="relative">
          <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-gold to-electric text-4xl font-semibold text-background shadow-elegant">
            {level}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {prog.current.toLocaleString("pt-BR")} / {prog.needed.toLocaleString("pt-BR")} XP
          </p>
          <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-gradient-to-r from-gold to-electric" style={{ width: `${prog.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Faltam {prog.remaining.toLocaleString("pt-BR")} XP para o nível {level + 1}</p>
        </div>
      </div>

      {nextReward && (
        <div className="glass rounded-3xl p-5 mb-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gold/15 ring-hair flex items-center justify-center">
            <Gift className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Próxima recompensa</p>
            <p className="text-sm font-semibold mt-0.5">Nível {nextReward} · {rewards[nextReward]}</p>
          </div>
          <span className="text-xs font-semibold text-gold">{nextReward - level} lv</span>
        </div>
      )}

      <div className="glass rounded-3xl p-2">
        <p className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Trilha de níveis</p>
        {levels.map((l) => {
          const passed = l < level;
          const current = l === level;
          const need = xpForLevel(l);
          const reward = rewards[l];
          return (
            <div key={l} className="flex items-center gap-3 p-3">
              <div className={[
                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold ring-hair shrink-0",
                current ? "bg-gradient-to-br from-gold to-electric text-background" :
                passed ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.04] text-muted-foreground",
              ].join(" ")}>
                {passed ? <Check className="h-4 w-4" /> : l}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Nível {l}{current && " · atual"}</p>
                <p className="text-[11px] text-muted-foreground">{need.toLocaleString("pt-BR")} XP total{reward ? ` · ${reward}` : ""}</p>
              </div>
              {reward && <Star className={`h-4 w-4 ${passed || current ? "text-gold" : "text-muted-foreground/40"}`} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* -------------------- TOTAL XP -------------------- */

function TotalXpPanel() {
  const { data: profile } = useProfile();
  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: async () => (await supabase.from("skills").select("*")).data ?? [],
  });
  const { data: hist } = useQuery({
    queryKey: ["xp", "all-year"],
    queryFn: async () => {
      const start = new Date(); start.setMonth(start.getMonth() - 11); start.setDate(1); start.setHours(0,0,0,0);
      const { data } = await supabase
        .from("xp_history").select("amount,skill_category,source,created_at")
        .gte("created_at", start.toISOString());
      return data ?? [];
    },
  });

  const total = profile?.total_xp ?? 0;

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7);
      map.set(k, 0);
    }
    (hist ?? []).forEach((r: any) => {
      const k = r.created_at.slice(0, 7);
      if (map.has(k)) map.set(k, map.get(k)! + r.amount);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      label: new Date(k + "-01").toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      xp: v,
    }));
  }, [hist]);

  const bySource = useMemo(() => topBy(hist ?? [], (r: any) => r.source).slice(0, 6), [hist]);
  const totalHist = (hist ?? []).reduce((s: number, r: any) => s + r.amount, 0) || 1;

  return (
    <>
      <Header icon={Sparkles} title="XP total" subtitle="Vida inteira" />

      <div className="glass-strong rounded-3xl p-6 mb-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-electric/15 via-gold/5 to-transparent" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Acumulado</p>
          <p className="text-[56px] leading-none font-semibold tracking-tight mt-2">
            <AnimatedCounter value={total} />
            <span className="text-xl text-muted-foreground font-normal ml-1">XP</span>
          </p>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Últimos 12 meses</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byMonth}>
              <defs>
                <linearGradient id="lineT" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.72 0.2 250)" />
                  <stop offset="100%" stopColor="oklch(0.82 0.14 88)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={chartAxis} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "rgba(15,15,20,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="xp" stroke="url(#lineT)" strokeWidth={2.5} dot={{ r: 3, fill: "oklch(0.82 0.14 88)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">XP por skill</p>
        {(skills ?? []).length === 0 ? <EmptyLine /> : (
          <div className="space-y-3">
            {(skills ?? []).sort((a: any, b: any) => (b.total_xp ?? b.xp) - (a.total_xp ?? a.xp)).map((s: any) => {
              const meta = skillLabels[s.category];
              const val = s.total_xp ?? s.xp ?? 0;
              const maxV = Math.max(1, ...(skills ?? []).map((x: any) => x.total_xp ?? x.xp ?? 0));
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-medium">{meta?.emoji} {meta?.label ?? s.category}</span>
                    <span className="text-muted-foreground">{val.toLocaleString("pt-BR")} XP · Lv {s.level}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${meta?.color ?? "from-electric to-primary"}`} style={{ width: `${(val / maxV) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bySource.length > 0 && (
        <div className="glass rounded-3xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Principais fontes</p>
          <div className="space-y-2">
            {bySource.map(([src, v]) => (
              <div key={src} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-white/[0.05] ring-hair flex items-center justify-center">
                  <Award className="h-3.5 w-3.5 text-gold" />
                </div>
                <span className="text-sm font-medium truncate flex-1">{src}</span>
                <span className="text-xs text-electric font-semibold">{v} XP</span>
                <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                  {Math.round((v / totalHist) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AnimatedCounter({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useMemo(() => {
    const start = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{n.toLocaleString("pt-BR")}</>;
}
