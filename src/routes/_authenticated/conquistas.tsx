import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Lock, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { buildBadges, tierStyles, TIER_ORDER, type BadgeDef, type Tier, type AchievementStats } from "@/lib/achievements";
import { fetchAchievementStats } from "@/components/AchievementUnlockOverlay";

export const Route = createFileRoute("/_authenticated/conquistas")({
  component: Conquistas,
});

type Filter = "all" | "unlocked" | "locked" | Tier;

function Conquistas() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: stats } = useQuery<AchievementStats | null>({
    queryKey: ["achievement-stats"],
    queryFn: fetchAchievementStats,
  });

  const { data: unlockedMap } = useQuery({
    queryKey: ["achievements-unlocked"],
    queryFn: async () => {
      const { data } = await supabase.from("achievements").select("badge_key, unlocked_at");
      const m = new Map<string, string>();
      (data ?? []).forEach((r) => m.set(r.badge_key, r.unlocked_at));
      return m;
    },
  });

  const badges = useMemo(
    () => buildBadges(stats?.customSkills ?? []),
    [stats?.customSkills],
  );

  const { unlockedCount, xpEarned, byTier, list } = useMemo(() => {
    const s = stats;
    const items = badges.map((b) => ({
      badge: b,
      done: !!(s && b.check(s)),
      at: unlockedMap?.get(b.key),
    }));
    const done = items.filter((i) => i.done);
    const xp = done.reduce((acc, i) => acc + i.badge.xp, 0);
    const byTier: Record<Tier, { done: number; total: number }> = {
      bronze: { done: 0, total: 0 }, silver: { done: 0, total: 0 },
      gold: { done: 0, total: 0 }, diamond: { done: 0, total: 0 },
      legendary: { done: 0, total: 0 },
    };
    for (const i of items) {
      byTier[i.badge.tier].total += 1;
      if (i.done) byTier[i.badge.tier].done += 1;
    }
    const filtered = items.filter((i) => {
      if (filter === "all") return true;
      if (filter === "unlocked") return i.done;
      if (filter === "locked") return !i.done;
      return i.badge.tier === filter;
    });
    // Sort: unlocked first (most recent), then locked by tier importance
    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1;
      return TIER_ORDER.indexOf(b.badge.tier) - TIER_ORDER.indexOf(a.badge.tier);
    });
    return { unlockedCount: done.length, xpEarned: xp, byTier, list: filtered };
  }, [stats, unlockedMap, filter, badges]);

  const pct = badges.length ? Math.round((unlockedCount / badges.length) * 100) : 0;

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Conquistas</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Troféus</h1>

        <div className="mt-5 glass-strong rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-legendary/15 blur-3xl" />
          <div className="relative flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Desbloqueadas</p>
              <p className="text-3xl font-black mt-0.5">
                <span className="gradient-gold-text">{unlockedCount}</span>
                <span className="text-muted-foreground text-lg font-bold"> / {badges.length}</span>
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-electric font-semibold">
                <Zap className="h-3 w-3" /> {xpEarned.toLocaleString("pt-BR")} XP ganhos
              </p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-gold/40 to-gold/5 flex items-center justify-center shadow-gold">
              <Trophy className="h-6 w-6 text-gold" />
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-bronze via-gold to-legendary transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Tier progress */}
          <div className="relative mt-5 grid grid-cols-5 gap-2">
            {TIER_ORDER.map((t) => {
              const s = tierStyles[t];
              const tp = byTier[t];
              const p = tp.total ? Math.round((tp.done / tp.total) * 100) : 0;
              return (
                <div key={t} className="text-center">
                  <div className={`mx-auto h-1.5 w-full rounded-full bg-surface overflow-hidden ring-1 ring-white/5`}>
                    <div className={`h-full ${s.particle} transition-all duration-500`} style={{ width: `${p}%` }} />
                  </div>
                  <p className={`mt-1.5 text-[9px] font-bold uppercase tracking-widest ${s.text}`}>{s.label}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">{tp.done}/{tp.total}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold tap ${filter === f ? "bg-white/10 ring-1 ring-white/15" : "glass text-muted-foreground"}`}
            >
              {f === "all" ? "Todos" : f === "unlocked" ? "Obtidos" : "Bloqueados"}
            </button>
          ))}
          {TIER_ORDER.map((t) => {
            const s = tierStyles[t];
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest tap ${active ? `${s.text} bg-white/8 ring-1 ${s.ring}` : "glass text-muted-foreground"}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 pb-8">
        {list.map(({ badge, done }, i) => (
          <BadgeCard key={badge.key} badge={badge} done={done} index={i} />
        ))}
        {list.length === 0 && (
          <div className="col-span-2 glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
            Nada por aqui ainda.
          </div>
        )}
      </div>
    </div>
  );
}

function BadgeCard({ badge, done, index }: { badge: BadgeDef; done: boolean; index: number }) {
  const s = tierStyles[badge.tier];
  const Icon = badge.icon;
  return (
    <div
      className={`group relative glass-strong rounded-3xl p-5 text-center overflow-hidden animate-rise transition-all duration-300 ${done ? "hover:-translate-y-0.5" : "opacity-55"}`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {done && <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl ${s.glow}`} />}
      {done && badge.tier === "legendary" && (
        <div className="absolute inset-0 animate-shimmer opacity-30 pointer-events-none" />
      )}
      <div
        className={`relative mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-3 ring-1 transition-transform duration-300 ${done ? `bg-gradient-to-br ${s.grad} ${s.ring} shadow-elegant group-hover:scale-105` : "bg-surface ring-white/5"}`}
      >
        {done ? <Icon className={`h-7 w-7 ${s.text}`} strokeWidth={1.9} /> : <Lock className="h-6 w-6 text-muted-foreground" />}
      </div>
      <p className="relative text-sm font-black leading-tight">{badge.name}</p>
      <p className="relative text-xs text-muted-foreground mt-1 leading-tight">{badge.desc}</p>
      <div className="relative mt-3 flex items-center justify-center gap-1.5">
        <span className={`text-[9px] font-bold uppercase tracking-widest ${done ? s.text : "text-muted-foreground/60"}`}>
          {s.label}
        </span>
        <span className="text-[9px] text-muted-foreground/50">•</span>
        <span className={`text-[9px] font-bold ${done ? "text-electric" : "text-muted-foreground/60"}`}>+{badge.xp} XP</span>
      </div>
    </div>
  );
}
