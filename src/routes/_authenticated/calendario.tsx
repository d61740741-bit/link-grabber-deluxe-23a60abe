import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { skillLabels, categoryLabels } from "@/lib/ascension";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Check, X, Flame,
  Dumbbell, BookOpen, Heart, Zap, Sparkles, CalendarDays,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
  addMonths, addWeeks, addDays, format, isSameDay, isSameMonth, isToday,
  eachDayOfInterval, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
});

type ViewMode = "dia" | "semana" | "mes";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

/* ------------------------------------------------------------------ */
/*  Data hooks                                                          */
/* ------------------------------------------------------------------ */

function useRangeData(rangeStart: Date, rangeEnd: Date) {
  const startIso = startOfDay(rangeStart).toISOString();
  const endIso = endOfDay(rangeEnd).toISOString();
  const startDay = isoDay(rangeStart);
  const endDay = isoDay(rangeEnd);

  const xp = useQuery({
    queryKey: ["cal", "xp", startIso, endIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("xp_history")
        .select("amount, source, skill_category, created_at, task_id")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return data ?? [];
    },
  });

  const tasksDone = useQuery({
    queryKey: ["cal", "tasks-done", startIso, endIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, xp_reward, skill_category, category, completed_at")
        .eq("completed", true)
        .gte("completed_at", startIso)
        .lte("completed_at", endIso)
        .order("completed_at", { ascending: false });
      return data ?? [];
    },
  });

  const tasksMissed = useQuery({
    queryKey: ["cal", "tasks-missed", startDay, endDay],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, xp_reward, skill_category, category, due_date")
        .eq("completed", false)
        .gte("due_date", startDay)
        .lte("due_date", endDay)
        .lt("due_date", isoDay(new Date()));
      return data ?? [];
    },
  });

  const journal = useQuery({
    queryKey: ["cal", "journal", startDay, endDay],
    queryFn: async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("id, mood, thoughts, gratitude, entry_date")
        .gte("entry_date", startDay)
        .lte("entry_date", endDay)
        .order("entry_date", { ascending: false });
      return data ?? [];
    },
  });

  const workouts = useQuery({
    queryKey: ["cal", "workouts", startIso, endIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id, workout_type, duration_min, intensity, performed_at")
        .gte("performed_at", startIso)
        .lte("performed_at", endIso)
        .order("performed_at", { ascending: false });
      return data ?? [];
    },
  });

  const health = useQuery({
    queryKey: ["cal", "health", startDay, endDay],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_logs")
        .select("id, log_date, weight_kg, sleep_hours, mood, water_ml")
        .gte("log_date", startDay)
        .lte("log_date", endDay);
      return data ?? [];
    },
  });

  return { xp, tasksDone, tasksMissed, journal, workouts, health };
}

/* ------------------------------------------------------------------ */
/*  Daily aggregation                                                   */
/* ------------------------------------------------------------------ */

type DayBucket = {
  date: string; // yyyy-MM-dd
  xp: number;
  missionsDone: number;
  missionsMissed: number;
  habits: number;
  studies: number;
  workouts: number;
  hasJournal: boolean;
  hasHealth: boolean;
};

function emptyBucket(date: string): DayBucket {
  return {
    date, xp: 0, missionsDone: 0, missionsMissed: 0,
    habits: 0, studies: 0, workouts: 0,
    hasJournal: false, hasHealth: false,
  };
}

function aggregate(days: Date[], data: ReturnType<typeof useRangeData>): Record<string, DayBucket> {
  const map: Record<string, DayBucket> = {};
  days.forEach((d) => { map[isoDay(d)] = emptyBucket(isoDay(d)); });

  (data.xp.data ?? []).forEach((row: any) => {
    const key = isoDay(parseISO(row.created_at));
    if (!map[key]) map[key] = emptyBucket(key);
    map[key].xp += row.amount ?? 0;
    if (row.source === "habit") map[key].habits += 1;
    if (row.skill_category === "conhecimento") map[key].studies += 1;
  });

  (data.tasksDone.data ?? []).forEach((row: any) => {
    if (!row.completed_at) return;
    const key = isoDay(parseISO(row.completed_at));
    if (!map[key]) map[key] = emptyBucket(key);
    map[key].missionsDone += 1;
    if (row.category === "estudo" || row.skill_category === "conhecimento") {
      map[key].studies += 1;
    }
  });

  (data.tasksMissed.data ?? []).forEach((row: any) => {
    if (!row.due_date) return;
    const key = row.due_date;
    if (!map[key]) map[key] = emptyBucket(key);
    map[key].missionsMissed += 1;
  });

  (data.journal.data ?? []).forEach((row: any) => {
    const key = row.entry_date;
    if (!map[key]) map[key] = emptyBucket(key);
    map[key].hasJournal = true;
  });

  (data.workouts.data ?? []).forEach((row: any) => {
    const key = isoDay(parseISO(row.performed_at));
    if (!map[key]) map[key] = emptyBucket(key);
    map[key].workouts += 1;
  });

  (data.health.data ?? []).forEach((row: any) => {
    const key = row.log_date;
    if (!map[key]) map[key] = emptyBucket(key);
    map[key].hasHealth = true;
  });

  return map;
}

/* ------------------------------------------------------------------ */
/*  Heat intensity                                                      */
/* ------------------------------------------------------------------ */

function intensityClass(xp: number) {
  if (xp <= 0)   return "bg-white/[0.03] ring-hair";
  if (xp < 25)   return "bg-electric/15 ring-1 ring-electric/20";
  if (xp < 75)   return "bg-electric/30 ring-1 ring-electric/30";
  if (xp < 150)  return "bg-electric/55 ring-1 ring-electric/40";
  if (xp < 300)  return "bg-electric/75 ring-1 ring-electric/50";
  return "bg-electric ring-1 ring-electric/70 shadow-[0_0_18px_var(--electric-glow)]";
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

function CalendarioPage() {
  const [view, setView] = useState<ViewMode>("mes");
  const [focus, setFocus] = useState<Date>(new Date());

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (view === "dia") {
      return { rangeStart: focus, rangeEnd: focus, days: [focus] };
    }
    if (view === "semana") {
      const s = startOfWeek(focus, { weekStartsOn: 0 });
      const e = endOfWeek(focus, { weekStartsOn: 0 });
      return { rangeStart: s, rangeEnd: e, days: eachDayOfInterval({ start: s, end: e }) };
    }
    // month grid — align to weeks
    const s = startOfWeek(startOfMonth(focus), { weekStartsOn: 0 });
    const e = endOfWeek(endOfMonth(focus), { weekStartsOn: 0 });
    return { rangeStart: s, rangeEnd: e, days: eachDayOfInterval({ start: s, end: e }) };
  }, [view, focus]);

  const data = useRangeData(rangeStart, rangeEnd);
  const buckets = useMemo(() => aggregate(days, data), [days, data]);

  // 90-day trailing heatmap (always visible)
  const heatmapEnd = new Date();
  const heatmapStart = addDays(heatmapEnd, -90);
  const heatmapDays = useMemo(
    () => eachDayOfInterval({ start: heatmapStart, end: heatmapEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heatmapEnd.toDateString()],
  );
  const heatmapData = useRangeData(heatmapStart, heatmapEnd);
  const heatmapBuckets = useMemo(
    () => aggregate(heatmapDays, heatmapData),
    [heatmapDays, heatmapData],
  );

  const shift = (dir: -1 | 1) => {
    if (view === "dia") setFocus((d) => addDays(d, dir));
    else if (view === "semana") setFocus((d) => addWeeks(d, dir));
    else setFocus((d) => addMonths(d, dir));
  };

  const headerLabel =
    view === "dia"
      ? format(focus, "EEEE, d 'de' MMMM", { locale: ptBR })
      : view === "semana"
        ? `${format(startOfWeek(focus, { weekStartsOn: 0 }), "d MMM", { locale: ptBR })} — ${format(endOfWeek(focus, { weekStartsOn: 0 }), "d MMM", { locale: ptBR })}`
        : format(focus, "MMMM 'de' yyyy", { locale: ptBR });

  const totalXp = Object.values(buckets).reduce((s, b) => s + b.xp, 0);
  const totalDone = Object.values(buckets).reduce((s, b) => s + b.missionsDone, 0);
  const totalMissed = Object.values(buckets).reduce((s, b) => s + b.missionsMissed, 0);
  const activeDays = Object.values(buckets).filter((b) => b.xp > 0).length;

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-rise">
        <Link
          to="/dashboard"
          className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center tap"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Calendário</div>
          <div className="text-base font-semibold flex items-center gap-1.5 justify-center">
            <CalendarDays className="h-4 w-4 opacity-70" />
            Sua jornada
          </div>
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* View switcher */}
      <div className="glass-strong rounded-2xl p-1 flex mb-5 animate-rise delay-1">
        {(["dia", "semana", "mes"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold uppercase tracking-wider tap transition ${
              view === v
                ? "bg-white/[0.08] text-foreground ring-hair"
                : "text-muted-foreground"
            }`}
          >
            {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      {/* Range nav */}
      <div className="flex items-center justify-between mb-4 animate-rise delay-2">
        <button
          onClick={() => shift(-1)}
          className="w-9 h-9 rounded-xl glass-strong flex items-center justify-center tap"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setFocus(new Date())}
          className="text-sm font-semibold capitalize tap px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
        >
          {headerLabel}
        </button>
        <button
          onClick={() => shift(1)}
          className="w-9 h-9 rounded-xl glass-strong flex items-center justify-center tap"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-4 gap-2 mb-6 animate-rise delay-2">
        <StatChip label="XP" value={totalXp} accent="electric" />
        <StatChip label="Feitas" value={totalDone} />
        <StatChip label="Perdidas" value={totalMissed} muted />
        <StatChip label="Dias ativos" value={activeDays} />
      </div>

      {/* Main view */}
      {view === "mes" && (
        <MonthView
          focus={focus}
          days={days}
          buckets={buckets}
          onPickDay={(d) => { setFocus(d); setView("dia"); }}
        />
      )}
      {view === "semana" && (
        <WeekView
          days={days}
          buckets={buckets}
          onPickDay={(d) => { setFocus(d); setView("dia"); }}
        />
      )}
      {view === "dia" && (
        <DayView
          focus={focus}
          bucket={buckets[isoDay(focus)] ?? emptyBucket(isoDay(focus))}
          data={data}
        />
      )}

      {/* Global heatmap — last 90 days */}
      <section className="mt-10 animate-rise delay-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Atividade</div>
            <div className="text-sm font-semibold">Últimos 90 dias</div>
          </div>
          <HeatLegend />
        </div>
        <Heatmap90
          days={heatmapDays}
          buckets={heatmapBuckets}
          onPickDay={(d) => { setFocus(d); setView("dia"); }}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-views                                                           */
/* ------------------------------------------------------------------ */

function MonthView({
  focus, days, buckets, onPickDay,
}: {
  focus: Date;
  days: Date[];
  buckets: Record<string, DayBucket>;
  onPickDay: (d: Date) => void;
}) {
  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];
  return (
    <div className="glass-strong rounded-3xl p-4 animate-rise delay-3">
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {weekdays.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const b = buckets[isoDay(d)] ?? emptyBucket(isoDay(d));
          const inMonth = isSameMonth(d, focus);
          const today = isToday(d);
          return (
            <button
              key={isoDay(d)}
              onClick={() => onPickDay(d)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center tap relative overflow-hidden transition ${
                intensityClass(b.xp)
              } ${!inMonth ? "opacity-30" : ""} ${today ? "ring-2 ring-gold/70" : ""}`}
            >
              <span className="text-[11px] font-semibold leading-none">
                {format(d, "d")}
              </span>
              {(b.missionsDone > 0 || b.hasJournal || b.workouts > 0) && (
                <div className="flex gap-0.5 mt-1">
                  {b.missionsDone > 0 && <span className="w-1 h-1 rounded-full bg-foreground/80" />}
                  {b.workouts > 0 && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                  {b.hasJournal && <span className="w-1 h-1 rounded-full bg-gold" />}
                </div>
              )}
              {b.missionsMissed > 0 && b.missionsDone === 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-destructive/80" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  days, buckets, onPickDay,
}: {
  days: Date[];
  buckets: Record<string, DayBucket>;
  onPickDay: (d: Date) => void;
}) {
  return (
    <div className="space-y-2 animate-rise delay-3">
      {days.map((d) => {
        const b = buckets[isoDay(d)] ?? emptyBucket(isoDay(d));
        const today = isToday(d);
        return (
          <button
            key={isoDay(d)}
            onClick={() => onPickDay(d)}
            className={`w-full glass-strong rounded-2xl p-4 flex items-center gap-3 tap text-left ${
              today ? "ring-1 ring-gold/60" : ""
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${intensityClass(b.xp)}`}>
              <span className="text-[9px] uppercase tracking-wider opacity-80">
                {format(d, "EEE", { locale: ptBR }).slice(0, 3)}
              </span>
              <span className="text-sm font-bold leading-none">{format(d, "d")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {b.xp > 0 ? (
                  <span className="text-electric font-semibold flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {b.xp} XP
                  </span>
                ) : (
                  <span className="opacity-60">— sem atividade</span>
                )}
                {b.missionsMissed > 0 && (
                  <span className="text-destructive/80 flex items-center gap-0.5">
                    <X className="h-3 w-3" /> {b.missionsMissed}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                {b.missionsDone > 0 && <Badge icon={Check} label={`${b.missionsDone} feitas`} />}
                {b.habits > 0 && <Badge icon={Flame} label={`${b.habits} hábito${b.habits > 1 ? "s" : ""}`} />}
                {b.workouts > 0 && <Badge icon={Dumbbell} label={`${b.workouts} treino${b.workouts > 1 ? "s" : ""}`} />}
                {b.hasJournal && <Badge icon={BookOpen} label="diário" />}
                {b.hasHealth && <Badge icon={Heart} label="saúde" />}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </button>
        );
      })}
    </div>
  );
}

function DayView({
  focus, bucket, data,
}: {
  focus: Date;
  bucket: DayBucket;
  data: ReturnType<typeof useRangeData>;
}) {
  const dayIso = isoDay(focus);
  const done = (data.tasksDone.data ?? []).filter((t: any) =>
    t.completed_at && isSameDay(parseISO(t.completed_at), focus),
  );
  const missed = (data.tasksMissed.data ?? []).filter((t: any) => t.due_date === dayIso);
  const journal = (data.journal.data ?? []).find((j: any) => j.entry_date === dayIso);
  const workouts = (data.workouts.data ?? []).filter((w: any) =>
    w.performed_at && isSameDay(parseISO(w.performed_at), focus),
  );
  const health = (data.health.data ?? []).find((h: any) => h.log_date === dayIso);
  const habitXp = (data.xp.data ?? []).filter((x: any) =>
    x.source === "habit" && isSameDay(parseISO(x.created_at), focus),
  );

  const nothing = !done.length && !missed.length && !journal && !workouts.length && !health && !habitXp.length;

  return (
    <div className="space-y-4 animate-rise delay-3">
      {nothing && (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Sparkles className="h-6 w-6 mx-auto mb-3 opacity-40" />
          <div className="text-sm text-muted-foreground">
            Nenhum registro para este dia.
          </div>
        </div>
      )}

      {done.length > 0 && (
        <Section title={`Missões concluídas · ${done.length}`} icon={Check}>
          {done.map((t: any) => (
            <Row key={t.id}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40 flex items-center justify-center">
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    {t.category && <span>{categoryLabels[t.category] ?? t.category}</span>}
                    {t.skill_category && (
                      <span className="opacity-80">
                        · {skillLabels[t.skill_category]?.emoji} {skillLabels[t.skill_category]?.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold text-electric flex items-center gap-0.5">
                <Zap className="h-3 w-3" /> +{t.xp_reward}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {missed.length > 0 && (
        <Section title={`Perdidas · ${missed.length}`} icon={X}>
          {missed.map((t: any) => (
            <Row key={t.id}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-destructive/15 ring-1 ring-destructive/30 flex items-center justify-center">
                  <X className="h-3 w-3 text-destructive" />
                </div>
                <div>
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Prazo: {format(parseISO(t.due_date), "d MMM", { locale: ptBR })}
                  </div>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                -{t.xp_reward} perdidos
              </span>
            </Row>
          ))}
        </Section>
      )}

      {habitXp.length > 0 && (
        <Section title={`Hábitos · ${habitXp.length}`} icon={Flame}>
          {habitXp.map((h: any, i: number) => (
            <Row key={i}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 ring-1 ring-orange-500/40 flex items-center justify-center">
                  <Flame className="h-3 w-3 text-orange-400" />
                </div>
                <div className="text-sm">
                  Hábito concluído
                  {h.skill_category && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      · {skillLabels[h.skill_category]?.label}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold text-electric flex items-center gap-0.5">
                <Zap className="h-3 w-3" /> +{h.amount}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {workouts.length > 0 && (
        <Section title={`Treinos · ${workouts.length}`} icon={Dumbbell}>
          {workouts.map((w: any) => (
            <Row key={w.id}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40 flex items-center justify-center">
                  <Dumbbell className="h-3 w-3 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium">{w.workout_type ?? "Treino"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {w.duration_min ? `${w.duration_min} min` : ""}
                    {w.intensity ? ` · ${w.intensity}` : ""}
                  </div>
                </div>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {journal && (
        <Section title="Diário" icon={BookOpen}>
          <div className="p-4 space-y-2">
            {typeof journal.mood === "number" && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Humor: {"★".repeat(journal.mood)}<span className="opacity-30">{"★".repeat(Math.max(0, 5 - journal.mood))}</span>
              </div>
            )}
            {journal.thoughts && (
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4">
                {journal.thoughts}
              </p>
            )}
            {journal.gratitude && (
              <p className="text-xs text-gold/90 italic">
                "{journal.gratitude}"
              </p>
            )}
          </div>
        </Section>
      )}

      {health && (
        <Section title="Saúde" icon={Heart}>
          <div className="p-4 grid grid-cols-2 gap-3 text-xs">
            {health.weight_kg != null && <HealthCell label="Peso" value={`${health.weight_kg} kg`} />}
            {health.sleep_hours != null && <HealthCell label="Sono" value={`${health.sleep_hours} h`} />}
            {health.water_ml != null && <HealthCell label="Água" value={`${health.water_ml} ml`} />}
            {typeof health.mood === "number" && <HealthCell label="Humor" value={`${health.mood}/5`} />}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Heatmap (90d, GitHub-like)                                          */
/* ------------------------------------------------------------------ */

function Heatmap90({
  days, buckets, onPickDay,
}: {
  days: Date[];
  buckets: Record<string, DayBucket>;
  onPickDay: (d: Date) => void;
}) {
  // Group into columns (weeks). Column 0 starts at the first Sunday <= days[0].
  const first = days[0];
  const pad = first.getDay(); // 0..6
  const cells: (Date | null)[] = [...Array(pad).fill(null), ...days];
  const cols: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));

  return (
    <div className="glass-strong rounded-2xl p-3 overflow-x-auto">
      <div className="flex gap-[3px] min-w-max">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, ri) => {
              const d = col[ri] ?? null;
              if (!d) return <div key={ri} className="w-3 h-3" />;
              const b = buckets[isoDay(d)] ?? emptyBucket(isoDay(d));
              return (
                <button
                  key={ri}
                  onClick={() => onPickDay(d)}
                  title={`${format(d, "d MMM", { locale: ptBR })} · ${b.xp} XP`}
                  className={`w-3 h-3 rounded-[3px] tap ${intensityClass(b.xp)} ${
                    isToday(d) ? "ring-2 ring-gold/70" : ""
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span>—</span>
      {[0, 20, 80, 200, 400].map((v, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-[3px] ${intensityClass(v)}`} />
      ))}
      <span>+</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Primitives                                                          */
/* ------------------------------------------------------------------ */

function StatChip({
  label, value, accent, muted,
}: { label: string; value: number; accent?: "electric"; muted?: boolean }) {
  return (
    <div className="glass-strong rounded-2xl px-2.5 py-2.5 text-center">
      <div className={`text-lg font-bold leading-none ${
        accent === "electric" ? "text-electric" : muted ? "text-muted-foreground" : "text-foreground"
      }`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}

function Badge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 opacity-80">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="glass-strong rounded-3xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border/40">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {children}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      {children}
    </div>
  );
}

function HealthCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] ring-hair p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
