import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildBadges, tierStyles, type BadgeDef, type AchievementStats } from "@/lib/achievements";
import { Sparkles, X } from "lucide-react";

export async function fetchAchievementStats(): Promise<AchievementStats | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: p }, { data: skillRows }, tasks, workouts, journals, finances, readings] = await Promise.all([
    supabase.from("profiles").select("total_xp,level,streak_days").eq("id", user.id).maybeSingle(),
    supabase.from("skills").select("id,level,display_name,category,is_custom").eq("user_id", user.id),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("completed", true),
    supabase.from("workouts").select("*", { count: "exact", head: true }),
    supabase.from("journal_entries").select("*", { count: "exact", head: true }),
    supabase.from("finance_transactions").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("category", "leitura"),
  ]);
  const skills = skillRows ?? [];
  const maxSkillLevel = skills.reduce((m, s: any) => Math.max(m, s.level ?? 1), 1);
  const customSkills = skills
    .filter((s: any) => s.is_custom)
    .map((s: any) => ({ id: s.id as string, name: (s.display_name as string) || "Habilidade", level: s.level ?? 1 }));
  return {
    totalXp: p?.total_xp ?? 0,
    level: p?.level ?? 1,
    streak: p?.streak_days ?? 0,
    tasksCompleted: tasks.count ?? 0,
    workouts: workouts.count ?? 0,
    journals: journals.count ?? 0,
    finances: finances.count ?? 0,
    readings: readings.count ?? 0,
    maxSkillLevel,
    customSkills,
  };
}

export function useAchievementSync() {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<BadgeDef[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const bootRef = useRef(false);

  const { data: stats } = useQuery({ queryKey: ["achievement-stats"], queryFn: fetchAchievementStats, refetchInterval: 45_000 });
  const badges = useMemo(() => buildBadges(stats?.customSkills ?? []), [stats?.customSkills]);

  useEffect(() => {
    if (!stats) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      if (!seenRef.current) {
        const { data: existing } = await supabase.from("achievements").select("badge_key").eq("user_id", user.id);
        seenRef.current = new Set((existing ?? []).map((r) => r.badge_key));
      }
      const seen = seenRef.current!;
      const newly: BadgeDef[] = [];
      for (const b of badges) {
        if (b.check(stats) && !seen.has(b.key)) {
          newly.push(b);
          seen.add(b.key);
        }
      }
      if (newly.length) {
        await supabase.from("achievements").insert(
          newly.map((b) => ({ user_id: user.id, badge_key: b.key, name: b.name, description: b.desc, icon: b.key }))
        );
        await supabase.rpc("recalc_xp");
        qc.invalidateQueries({ queryKey: ["achievements-unlocked"] });
        // Skip celebration on first-ever sync (initial load) — only celebrate future unlocks
        if (bootRef.current) setQueue((q) => [...q, ...newly]);
      }
      bootRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [stats, qc, badges]);

  const current = queue[0] ?? null;
  const dismiss = () => setQueue((q) => q.slice(1));
  return { current, dismiss };
}

export function AchievementUnlockOverlay() {
  const { current, dismiss } = useAchievementSync();
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  const style = tierStyles[current.tier];
  const Icon = current.icon;

  const particles = Array.from({ length: 18 });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6 pointer-events-none">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade pointer-events-auto" onClick={dismiss} />
      <div className="relative w-full max-w-sm glass-strong rounded-[32px] p-8 text-center shadow-elegant animate-rise pointer-events-auto overflow-hidden">
        <button onClick={dismiss} className="absolute top-4 right-4 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full blur-3xl ${style.glow}`} />
        <div className="absolute inset-0 animate-shimmer opacity-40 pointer-events-none" />

        {/* Rotating rays behind the badge for a premium unlock feel */}
        <div className="pointer-events-none absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`h-64 w-64 rounded-full opacity-60 animate-ray-spin ${style.text}`}
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, currentColor 8deg, transparent 20deg, transparent 60deg, currentColor 68deg, transparent 80deg, transparent 140deg, currentColor 148deg, transparent 160deg, transparent 220deg, currentColor 228deg, transparent 240deg, transparent 300deg, currentColor 308deg, transparent 320deg)",
              maskImage: "radial-gradient(circle, transparent 30%, black 60%, transparent 85%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 30%, black 60%, transparent 85%)",
            }}
          />
        </div>

        {/* Confetti burst */}
        <div className="pointer-events-none absolute top-[38%] left-1/2 h-0 w-0">
          {particles.map((_, i) => {
            const angle = (i / particles.length) * Math.PI * 2;
            const dist = 120 + (i % 3) * 22;
            const tx = `${Math.cos(angle) * dist}px`;
            const ty = `${Math.sin(angle) * dist}px`;
            return (
              <span
                key={i}
                className={`absolute h-1.5 w-1.5 rounded-full ${style.particle}`}
                style={{
                  left: 0,
                  top: 0,
                  ["--tx" as any]: tx,
                  ["--ty" as any]: ty,
                  animation: `burst-out ${900 + (i % 4) * 120}ms cubic-bezier(0.22,1,0.36,1) both`,
                  animationDelay: `${(i % 6) * 40}ms`,
                }}
              />
            );
          })}
        </div>

        <p className="relative text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Conquista desbloqueada
        </p>

        <div className={`relative mx-auto mt-6 h-28 w-28 rounded-[28px] bg-gradient-to-br ${style.grad} ring-2 ${style.ring} flex items-center justify-center animate-trophy-pop shadow-elegant`}>
          <Icon className={`h-14 w-14 ${style.text}`} strokeWidth={1.8} />
        </div>

        <h3 className="relative mt-6 text-2xl font-black tracking-tight">{current.name}</h3>
        <p className="relative mt-2 text-sm text-muted-foreground">{current.desc}</p>

        <div className="relative mt-5 flex items-center justify-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${style.text} bg-white/5 ring-1 ${style.ring}`}>
            {style.label}
          </span>
          {current.xp > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/5 ring-1 ring-white/10 text-electric">
              + {current.xp} XP
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
