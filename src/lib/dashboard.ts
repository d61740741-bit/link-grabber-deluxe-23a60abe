import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- helpers ---------------- */

export const isoDay = (d = new Date()) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

export const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const startOfWeek = () => {
  const d = startOfToday();
  d.setDate(d.getDate() - 6);
  return d;
};

const CARDIO = ["corrida", "caminhada", "bike", "ciclismo", "cardio", "natação", "natacao", "esteira", "corda", "hiit", "remo", "elíptico", "eliptico"];
export const isCardio = (type: string) => CARDIO.some((c) => (type || "").toLowerCase().includes(c));

/* ---------------- realtime ---------------- */

const LIVE_TABLES = [
  "tasks", "habits", "workouts", "health_logs", "health_goals",
  "library_items", "finance_transactions", "finance_goals",
  "bad_habits", "bad_habit_relapses", "recovery_missions",
  "skills", "profiles", "xp_history", "achievements",
  "weekly_bosses", "user_titles", "goals",
];

/** One channel for the whole dashboard: any change anywhere refreshes every view. */
export function useDashboardRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => qc.invalidateQueries(), 120);
    };
    const channel = supabase.channel("dashboard-live");
    for (const table of LIVE_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    const onFocus = () => qc.invalidateQueries();
    const onVisible = () => { if (document.visibilityState === "visible") qc.invalidateQueries(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);
}

/* ---------------- queries ---------------- */

const LIVE = { staleTime: 5_000, refetchOnWindowFocus: true as const, refetchInterval: 60_000 };

export type MissionSummary = {
  today: any[];
  pendingToday: number;
  doneToday: number;
  overdue: number;
  weekDone: number;
};

export function useMissionsSummary() {
  const today = isoDay();
  return useQuery({
    queryKey: ["dash", "missions", today],
    ...LIVE,
    queryFn: async (): Promise<MissionSummary> => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,xp_reward,skill_category,priority,difficulty,completed,completed_at,due_date,due_time,status")
        .eq("is_template", false)
        .or(`due_date.lte.${today},due_date.is.null`)
        .order("due_time", { ascending: true, nullsFirst: false })
        .limit(200);
      const rows = data ?? [];
      const weekStart = startOfWeek().toISOString();
      const dayStart = startOfToday().toISOString();
      const openToday = rows.filter((r: any) => !r.completed && (r.due_date === today || r.due_date == null));
      return {
        today: openToday.slice(0, 4),
        pendingToday: openToday.length,
        doneToday: rows.filter((r: any) => r.completed && r.completed_at && r.completed_at >= dayStart).length,
        overdue: rows.filter((r: any) => !r.completed && r.due_date && r.due_date < today).length,
        weekDone: rows.filter((r: any) => r.completed && r.completed_at && r.completed_at >= weekStart).length,
      };
    },
  });
}

export function useHabitsSummary() {
  const today = isoDay();
  return useQuery({
    queryKey: ["dash", "habits", today],
    ...LIVE,
    queryFn: async () => {
      const { data } = await supabase
        .from("habits")
        .select("id,title,streak,best_streak,xp_reward,last_completed_date,skill_category")
        .order("streak", { ascending: false });
      const rows = data ?? [];
      return {
        rows,
        doneToday: rows.filter((h: any) => h.last_completed_date === today).length,
        total: rows.length,
        bestStreak: rows.reduce((m: number, h: any) => Math.max(m, h.streak ?? 0), 0),
      };
    },
  });
}

export function useWorkoutsSummary() {
  return useQuery({
    queryKey: ["dash", "workouts"],
    ...LIVE,
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id,workout_type,duration_min,calories_burned,intensity,performed_at")
        .gte("performed_at", daysAgo(29).toISOString())
        .order("performed_at", { ascending: false });
      const rows = data ?? [];
      const weekStart = startOfWeek().toISOString();
      const week = rows.filter((w: any) => w.performed_at >= weekStart);
      const cardio = week.filter((w: any) => isCardio(w.workout_type));
      const strength = week.filter((w: any) => !isCardio(w.workout_type));
      const sum = (a: any[], k: string) => a.reduce((s, w) => s + (Number(w[k]) || 0), 0);
      return {
        last: rows[0] ?? null,
        weekCount: week.length,
        weekMinutes: sum(week, "duration_min"),
        weekCalories: sum(week, "calories_burned"),
        cardioCount: cardio.length,
        cardioMinutes: sum(cardio, "duration_min"),
        cardioCalories: sum(cardio, "calories_burned"),
        strengthCount: strength.length,
        strengthMinutes: sum(strength, "duration_min"),
        monthCount: rows.length,
      };
    },
  });
}

export function useLibrarySummary() {
  return useQuery({
    queryKey: ["dash", "library"],
    ...LIVE,
    queryFn: async () => {
      const { data } = await supabase
        .from("library_items")
        .select("id,title,item_type,category,status,progress,current_page,total_pages,study_seconds,completed,updated_at")
        .order("updated_at", { ascending: false });
      const rows = data ?? [];
      const reading = rows.filter((r: any) => r.status === "em_andamento");
      return {
        rows,
        current: reading[0] ?? null,
        reading: reading.length,
        completed: rows.filter((r: any) => r.completed).length,
        paused: rows.filter((r: any) => r.status === "pausado").length,
        books: rows.filter((r: any) => r.item_type === "livro").length,
        studyHours: rows.reduce((s: number, r: any) => s + (Number(r.study_seconds) || 0), 0) / 3600,
      };
    },
  });
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ["dash", "finance"],
    ...LIVE,
    queryFn: async () => {
      const now = new Date();
      const monthStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const { data } = await supabase
        .from("finance_transactions")
        .select("id,kind,amount,category,description,occurred_on")
        .gte("occurred_on", monthStart)
        .order("occurred_on", { ascending: false });
      const rows = data ?? [];
      const income = rows.filter((r: any) => r.kind === "receita").reduce((s: number, r: any) => s + Number(r.amount), 0);
      const expense = rows.filter((r: any) => r.kind === "despesa").reduce((s: number, r: any) => s + Number(r.amount), 0);
      const biggest = rows.filter((r: any) => r.kind === "despesa").sort((a: any, b: any) => Number(b.amount) - Number(a.amount))[0] ?? null;
      return { income, expense, balance: income - expense, biggest, count: rows.length };
    },
  });
}

export function useRecoverySummary() {
  return useQuery({
    queryKey: ["dash", "recovery"],
    ...LIVE,
    queryFn: async () => {
      const { data } = await supabase
        .from("bad_habits")
        .select("id,name,icon,color,started_at,best_streak_seconds,relapse_count")
        .is("archived_at", null);
      const rows = (data ?? []).map((h: any) => ({
        ...h,
        seconds: Math.max(0, Math.floor((Date.now() - new Date(h.started_at).getTime()) / 1000)),
      })).sort((a: any, b: any) => b.seconds - a.seconds);
      return {
        rows,
        top: rows[0] ?? null,
        total: rows.length,
        cleanDays: rows.reduce((s: number, h: any) => s + Math.floor(h.seconds / 86400), 0),
      };
    },
  });
}
