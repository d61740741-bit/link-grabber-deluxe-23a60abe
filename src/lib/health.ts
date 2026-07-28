import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthLog = {
  id: string;
  log_date: string;
  weight_kg: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  mood: number | null;
  water_ml: number | null;
  calories: number | null;
};

export type HealthGoals = {
  user_id: string;
  water_ml_goal: number;
  sleep_hours_goal: number;
  weight_goal_kg: number | null;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function useHealthGoals() {
  return useQuery({
    queryKey: ["health-goals"],
    queryFn: async (): Promise<HealthGoals> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const { data } = await supabase
        .from("health_goals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) return data as HealthGoals;
      const { data: created } = await supabase
        .from("health_goals")
        .insert({ user_id: user.id })
        .select("*")
        .maybeSingle();
      return (created ?? {
        user_id: user.id,
        water_ml_goal: 2500,
        sleep_hours_goal: 8,
        weight_goal_kg: null,
      }) as HealthGoals;
    },
    staleTime: 60_000,
  });
}

export function useHealthLogs(days = 365) {
  return useQuery({
    queryKey: ["health-logs", days],
    queryFn: async (): Promise<HealthLog[]> => {
      const { data } = await supabase
        .from("health_logs")
        .select("*")
        .gte("log_date", daysAgoISO(days))
        .order("log_date", { ascending: true });
      return (data ?? []) as HealthLog[];
    },
    staleTime: 15_000,
  });
}

export function useTodayLog() {
  const today = todayISO();
  return useQuery({
    queryKey: ["health-log", today],
    queryFn: async (): Promise<HealthLog | null> => {
      const { data } = await supabase
        .from("health_logs")
        .select("*")
        .eq("log_date", today)
        .maybeSingle();
      return (data ?? null) as HealthLog | null;
    },
    staleTime: 5_000,
  });
}

/** Upsert on a specific day (defaults to today). Water never carries over: each day is its own row. */
export async function saveHealth(patch: Partial<HealthLog>, date = todayISO()) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase
    .from("health_logs")
    .upsert({ user_id: user.id, log_date: date, ...patch }, { onConflict: "user_id,log_date" });
  if (error) throw error;
}

export async function saveGoals(patch: Partial<HealthGoals>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase
    .from("health_goals")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Invalidate every health-derived query (and dashboard/XP views) with no page reload. */
export function useHealthRefresh() {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries();
  };
}

/** Live sync: any change to health_logs anywhere refreshes the UI instantly. */
export function useHealthRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("health-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "health_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["health-logs"] });
        qc.invalidateQueries({ queryKey: ["health-log"] });
        qc.invalidateQueries({ queryKey: ["life-state"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

/* ---------- derived stats ---------- */

export function avg(nums: number[]) {
  const v = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!v.length) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function inLastDays(logs: HealthLog[], days: number) {
  const from = daysAgoISO(days - 1);
  return logs.filter((l) => l.log_date >= from);
}

export function weightStats(logs: HealthLog[]) {
  const rows = logs.filter((l) => l.weight_kg != null) as (HealthLog & { weight_kg: number })[];
  if (!rows.length) return null;
  const first = rows[0].weight_kg;
  const current = rows[rows.length - 1].weight_kg;
  const values = rows.map((r) => r.weight_kg);
  return {
    first,
    current,
    diff: +(current - first).toFixed(1),
    max: Math.max(...values),
    min: Math.min(...values),
    count: rows.length,
    rows,
  };
}

export function moodStreak(logs: HealthLog[]) {
  const set = new Set(logs.filter((l) => l.mood != null).map((l) => l.log_date));
  let streak = 0;
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export const MOOD_FACES = ["😖", "😞", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩", "🔥"];

export function sleepQualityLabel(q: number | null | undefined) {
  switch (q) {
    case 1: return "Péssima";
    case 2: return "Ruim";
    case 3: return "Ok";
    case 4: return "Boa";
    case 5: return "Ótima";
    default: return "—";
  }
}

export function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
