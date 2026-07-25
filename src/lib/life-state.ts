import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export type UserTitle = {
  id: string;
  title_key: string;
  title_name: string;
  description: string | null;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  earned_at: string;
};

export type TimelineEvent = {
  id: string;
  event_key: string;
  category: string;
  title: string;
  description: string | null;
  icon: string;
  metadata: any;
  occurred_at: string;
};

export type InventoryItem = {
  id: string;
  item_key: string;
  kind: string;
  name: string;
  description: string | null;
  icon: string;
  rarity: UserTitle["rarity"];
  earned_at: string;
};

export type WeeklyBoss = {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "completed" | "failed" | "expired";
  xp_reward: number;
  week_start: string;
  objectives: Array<{ key: string; label: string; target: number; current: number }>;
};

const RARITY_STYLE: Record<UserTitle["rarity"], { ring: string; text: string; bg: string; glow: string }> = {
  common:    { ring: "ring-slate-400/30",   text: "text-slate-200",   bg: "bg-slate-500/10",   glow: "shadow-slate-500/20" },
  rare:      { ring: "ring-sky-400/40",     text: "text-sky-200",     bg: "bg-sky-500/10",     glow: "shadow-sky-500/25" },
  epic:      { ring: "ring-violet-400/50",  text: "text-violet-200",  bg: "bg-violet-500/10",  glow: "shadow-violet-500/30" },
  legendary: { ring: "ring-amber-400/60",   text: "text-amber-200",   bg: "bg-amber-500/10",   glow: "shadow-amber-500/40" },
  mythic:    { ring: "ring-rose-400/70",    text: "text-rose-200",    bg: "bg-rose-500/10",    glow: "shadow-rose-500/50" },
};
export function rarityStyle(r: UserTitle["rarity"]) {
  return RARITY_STYLE[r] ?? RARITY_STYLE.common;
}

export function useLifeState() {
  return useQuery({
    queryKey: ["life-state"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_stats");
      if (error) throw error;
      return data as any;
    },
    staleTime: 30_000,
  });
}

export function useTitles() {
  return useQuery({
    queryKey: ["user-titles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_titles")
        .select("*")
        .order("earned_at", { ascending: false });
      return (data ?? []) as UserTitle[];
    },
  });
}

export function useTimeline(limit = 50) {
  return useQuery({
    queryKey: ["timeline", limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("timeline_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as TimelineEvent[];
    },
  });
}

export function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("*")
        .order("earned_at", { ascending: false });
      return (data ?? []) as InventoryItem[];
    },
  });
}

export function useWeeklyBoss() {
  return useQuery({
    queryKey: ["weekly-boss"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_weekly_boss_progress");
      if (error) throw error;
      return data as WeeklyBoss | null;
    },
    staleTime: 60_000,
  });
}

export function useLifeScoreHistory(days = 30) {
  return useQuery({
    queryKey: ["life-score-history", days],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - days);
      const { data } = await supabase
        .from("life_score_snapshots")
        .select("*")
        .gte("snapshot_date", start.toISOString().slice(0, 10))
        .order("snapshot_date");
      return data ?? [];
    },
  });
}

export function useHeatmap(year?: number) {
  return useQuery({
    queryKey: ["heatmap", year ?? "current"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_activity_heatmap", year != null ? { p_year: year } : {});
      return (data as { date: string; xp: number }[]) ?? [];
    },
  });
}

export function useProjection(days: number) {
  return useQuery({
    queryKey: ["projection", days],
    queryFn: async () => {
      const { data } = await supabase.rpc("project_future", { p_days: days });
      return data as {
        days: number;
        xp_gained: number;
        level: number;
        books: number;
        workouts: number;
        savings: number;
        missions: number;
        daily_xp_avg: number;
      };
    },
    staleTime: 60_000,
  });
}

/**
 * Watches for newly-unlocked titles and shows a toast when they appear.
 * Mount once at layout level.
 */
export function useTitleUnlockWatcher() {
  const { data: titles } = useTitles();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!titles) return;
    if (seen.current === null) {
      seen.current = new Set(titles.map((t) => t.title_key));
      return;
    }
    for (const t of titles) {
      if (!seen.current.has(t.title_key)) {
        seen.current.add(t.title_key);
        toast.success(`Título desbloqueado: ${t.title_name}`, {
          description: t.description ?? undefined,
          icon: t.icon,
          duration: 6000,
        });
      }
    }
  }, [titles]);
}

/** Trigger a full backend recompute (life score, titles, rank). */
export async function syncLifeState(qc: ReturnType<typeof useQueryClient>) {
  try {
    await supabase.rpc("sync_life_state");
  } catch { /* silent */ }
  await qc.invalidateQueries();
}

export const RANK_META: Record<string, { name: string; icon: string; tone: string }> = {
  beginner:  { name: "Iniciante",   icon: "🌱", tone: "from-slate-400/40 to-slate-600/10" },
  explorer:  { name: "Explorador",  icon: "🧭", tone: "from-sky-400/50 to-cyan-500/10" },
  warrior:   { name: "Guerreiro",   icon: "⚔️", tone: "from-emerald-400/50 to-teal-500/10" },
  elite:     { name: "Elite",       icon: "🛡️", tone: "from-orange-400/50 to-amber-500/10" },
  master:    { name: "Mestre",      icon: "🏆", tone: "from-yellow-400/60 to-amber-500/10" },
  legend:    { name: "Lenda",       icon: "👑", tone: "from-fuchsia-400/60 to-rose-500/10" },
  ascended:  { name: "Ascendido",   icon: "✨", tone: "from-violet-400/70 to-indigo-500/10" },
};
