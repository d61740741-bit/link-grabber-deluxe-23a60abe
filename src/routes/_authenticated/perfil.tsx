import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { progressToNext } from "@/lib/ascension";
import { skillLabels, categoryLabels } from "@/lib/ascension";
import { computeRank, type PlayerStats } from "@/lib/ranks";
import {
  LogOut, Edit3, Loader2, X, Trophy, Flame, Calendar, Shield, Sparkles,
  Bell, BellOff, Moon, Sun, User, Image as ImageIcon, Target, Feather,
  Palette, ChevronRight, Star, Zap, TrendingUp, Award, Check, Lock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

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

function dayKey(d: Date | string) {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}
function fmtDay(k: string) {
  const [, m, d] = k.split("-");
  return `${d}/${m}`;
}

/* ---------- Root ---------- */
function Perfil() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return { ...(data as any), email: user.email };
    },
  });

  const { data: agg } = useQuery({
    queryKey: ["profile-agg"],
    enabled: !!profile?.id,
    queryFn: async () => {
      const uid = profile!.id;
      const since30 = new Date(); since30.setDate(since30.getDate() - 29);
      const sinceIso = since30.toISOString();

      const [tasks, habits, skills, achievements, xp] = await Promise.all([
        supabase.from("tasks").select("id, completed, completed_at, category, skill_category, custom_skill_id, xp_granted", { count: "exact" }).eq("user_id", uid),
        supabase.from("habits").select("id, best_streak, streak").eq("user_id", uid),
        supabase.from("skills").select("id, category, custom_slug, display_name, icon, color, level, total_xp, is_custom").eq("user_id", uid),
        supabase.from("achievements").select("id, name, icon, unlocked_at", { count: "exact" }).eq("user_id", uid).order("unlocked_at", { ascending: false }),
        supabase.from("xp_history").select("amount, created_at, skill_category, custom_skill_id").eq("user_id", uid).gte("created_at", sinceIso).order("created_at", { ascending: true }),
      ]);

      return {
        tasks: tasks.data ?? [],
        tasksCount: tasks.count ?? 0,
        habits: habits.data ?? [],
        skills: skills.data ?? [],
        achievements: achievements.data ?? [],
        achievementsCount: achievements.count ?? 0,
        xp: xp.data ?? [],
      };
    },
  });

  // Realtime auto-refresh is handled globally in __root.tsx; no per-page channel.

  // Theme sync
  useEffect(() => {
    const t = profile?.theme ?? localStorage.getItem("theme") ?? "dark";
    document.documentElement.classList.toggle("dark", t !== "light");
  }, [profile?.theme]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  const level = profile?.level ?? 1;
  const totalXp = profile?.total_xp ?? 0;
  const prog = progressToNext(totalXp, level);

  const completedTasks = useMemo(() => (agg?.tasks ?? []).filter((t: any) => t.completed).length, [agg]);
  const longestHabitStreak = useMemo(() => (agg?.habits ?? []).reduce((m: number, h: any) => Math.max(m, h.best_streak ?? 0), 0), [agg]);

  const rankInfo = useMemo(() => {
    const stats: PlayerStats = {
      level,
      xp: totalXp,
      skills: (agg?.skills ?? []).map((s: any) => ({ level: s.level ?? 1 })),
      achievements: agg?.achievementsCount ?? 0,
      streak: profile?.streak_days ?? 0,
      missions: completedTasks,
    };
    return computeRank(stats);
  }, [level, totalXp, agg, profile?.streak_days, completedTasks]);
  const rank = rankInfo.current;
  const accountAge = useMemo(() => {
    if (!profile?.created_at) return "—";
    const d = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
    if (d < 30) return `${d} ${d === 1 ? "dia" : "dias"}`;
    if (d < 365) return `${Math.floor(d / 30)} meses`;
    return `${(d / 365).toFixed(1)} anos`;
  }, [profile?.created_at]);

  const favoriteCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    (agg?.tasks ?? []).filter((t: any) => t.completed && t.category).forEach((t: any) => {
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    });
    const entry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!entry) return null;
    return { key: entry[0], label: categoryLabels[entry[0]] ?? entry[0], count: entry[1] };
  }, [agg]);

  const topSkill = useMemo(() => {
    const list = agg?.skills ?? [];
    if (!list.length) return null;
    const s = [...list].sort((a: any, b: any) => (b.total_xp ?? 0) - (a.total_xp ?? 0))[0];
    const meta = s?.category ? skillLabels[s.category] : null;
    return {
      label: s?.display_name ?? meta?.label ?? s?.custom_slug ?? "—",
      emoji: s?.icon ?? meta?.emoji ?? "✨",
      level: s?.level ?? 1,
      total_xp: s?.total_xp ?? 0,
      tone: meta?.color ?? "from-electric/40 to-electric/5",
    };
  }, [agg]);

  const weekly = useMemo(() => buildBuckets(agg?.xp ?? [], 7), [agg]);
  const monthly = useMemo(() => buildBuckets(agg?.xp ?? [], 30), [agg]);
  const weekTotal = weekly.reduce((s, b) => s + b.xp, 0);
  const monthTotal = monthly.reduce((s, b) => s + b.xp, 0);

  const displayName = profile?.full_name || profile?.username || "Aventureiro";
  const initials = displayName.split(" ").map((p: string) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <div className="px-5 pt-8 pb-24 safe-top max-w-2xl mx-auto">
      {/* Hero */}
      <header className="relative mb-6">
        <div className="glass-strong rounded-3xl p-6 relative overflow-hidden">
          <div className={`absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br ${rank.tone} blur-3xl opacity-70`} />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-electric/10 blur-3xl" />

          <div className="relative flex items-start gap-5">
            <div className="relative">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-electric to-primary/60 flex items-center justify-center text-primary-foreground text-3xl font-black shadow-glow ring-2 ring-white/10 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                aria-label="Editar avatar"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full glass-strong flex items-center justify-center border border-white/10"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r ${rank.tone} border border-white/10 mb-2`}>
                <span>{rank.icon}</span>
                <span>{rank.name}</span>
              </div>
              <h1 className="text-2xl font-black truncate">{displayName}</h1>
              {profile?.username && profile?.full_name && (
                <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">{profile?.email}</p>
            </div>
          </div>

          {profile?.bio && (
            <p className="relative text-sm text-muted-foreground mt-4 leading-relaxed">
              {profile.bio}
            </p>
          )}

          {profile?.goals && (
            <div className="relative mt-4 rounded-2xl bg-surface/60 border border-white/5 p-3 flex gap-2 items-start">
              <Target className="h-4 w-4 text-electric mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{profile.goals}</p>
            </div>
          )}

          <button
            onClick={() => setEditing(true)}
            className="relative mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full glass px-4 py-2.5 text-xs font-bold hover:bg-white/5 transition"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar perfil
          </button>
        </div>
      </header>

      {/* Level */}
      <section className="glass-strong rounded-3xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-electric/20 blur-3xl" />
        <div className="relative flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nível atual</p>
            <p className="text-5xl font-black gradient-text leading-none mt-1">{level}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">XP Total</p>
            <p className="text-2xl font-black">{totalXp.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Próximo: Lv {prog.nextLevel}</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-surface overflow-hidden">
          <div className="h-full bg-gradient-to-r from-electric to-primary rounded-full transition-all" style={{ width: `${prog.pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {prog.remaining.toLocaleString("pt-BR")} XP para o próximo nível
        </p>
      </section>

      {/* Rank */}
      <RankSection rank={rank} next={rankInfo.next} progress={rankInfo.progress} index={rankInfo.currentIndex} />

      {/* Vital stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatBox icon={<Flame className="h-4 w-4 text-orange-400" />} label="Sequência" value={`${profile?.streak_days ?? 0}`} suffix="dias" />
        <StatBox icon={<TrendingUp className="h-4 w-4 text-electric" />} label="Maior seq. hábito" value={`${longestHabitStreak}`} suffix="dias" />
        <StatBox icon={<Shield className="h-4 w-4 text-gold" />} label="Rank" value={rank.name} />
        <StatBox icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Conta" value={accountAge} />
      </div>

      {/* Progress totals */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <ProgressTile icon="🎯" label="Missões" value={completedTasks} sub={`de ${agg?.tasksCount ?? 0}`} />
        <ProgressTile icon="⚡" label="Hábitos" value={agg?.habits.length ?? 0} sub="ativos" />
        <ProgressTile icon="🌱" label="Skills" value={agg?.skills.length ?? 0} sub="cultivadas" />
        <ProgressTile icon="🏅" label="Conquistas" value={agg?.achievementsCount ?? 0} sub="desbloqueadas" />
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <HighlightCard
          title="Categoria favorita"
          icon={<Star className="h-4 w-4 text-gold" />}
          tone="from-gold/25 to-gold/0"
          empty="Complete missões para descobrir"
          data={favoriteCategory && {
            headline: favoriteCategory.label,
            sub: `${favoriteCategory.count} missões concluídas`,
            emoji: "🏆",
          }}
        />
        <HighlightCard
          title="Skill mais evoluída"
          icon={<Sparkles className="h-4 w-4 text-electric" />}
          tone="from-electric/25 to-electric/0"
          empty="Nenhuma skill ainda"
          data={topSkill && {
            headline: topSkill.label,
            sub: `Lv ${topSkill.level} · ${topSkill.total_xp.toLocaleString("pt-BR")} XP`,
            emoji: topSkill.emoji,
          }}
        />
      </div>

      {/* Weekly activity */}
      <ChartCard
        title="Atividade semanal"
        total={weekTotal}
      >
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={weekly}>
            <defs>
              <linearGradient id="wkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.2 250)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="oklch(0.72 0.2 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="xp" stroke="oklch(0.72 0.2 250)" strokeWidth={2} fill="url(#wkFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly activity */}
      <ChartCard
        title="Atividade mensal"
        total={monthTotal}
      >
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="xp" fill="oklch(0.82 0.12 88)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Recent achievements */}
      {(agg?.achievements ?? []).length > 0 && (
        <section className="glass-strong rounded-3xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-black">Conquistas recentes</h3>
            </div>
            <span className="text-xs text-muted-foreground">{agg?.achievementsCount}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hidden">
            {(agg?.achievements ?? []).slice(0, 8).map((a: any) => (
              <div key={a.id} className="shrink-0 w-24 rounded-2xl bg-surface/60 border border-white/5 p-3 text-center">
                <div className="text-2xl">{a.icon ?? "🏅"}</div>
                <p className="text-[10px] font-bold mt-1 line-clamp-2">{a.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick prefs */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <QuickToggle
          icon={profile?.theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          label="Tema"
          value={profile?.theme === "light" ? "Claro" : "Escuro"}
          onClick={async () => {
            const next = profile?.theme === "light" ? "dark" : "light";
            await supabase.from("profiles").update({ theme: next }).eq("id", profile!.id);
            qc.invalidateQueries({ queryKey: ["profile"] });
          }}
        />
        <QuickToggle
          icon={profile?.notifications_enabled === false ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          label="Notificações"
          value={profile?.notifications_enabled === false ? "Off" : "On"}
          onClick={async () => {
            const next = !(profile?.notifications_enabled ?? true);
            await supabase.from("profiles").update({ notifications_enabled: next }).eq("id", profile!.id);
            qc.invalidateQueries({ queryKey: ["profile"] });
            toast.success(next ? "Notificações ativadas" : "Notificações silenciadas");
          }}
        />
      </div>

      <button
        onClick={signOut}
        className="w-full glass rounded-2xl px-6 py-4 text-sm font-bold text-destructive flex items-center justify-center gap-2 hover:bg-destructive/5 transition"
      >
        <LogOut className="h-4 w-4" /> Sair
      </button>

      {editing && profile && <EditSheet profile={profile} onClose={() => setEditing(false)} />}
    </div>
  );
}

/* ---------- Helpers ---------- */
function buildBuckets(xp: { amount: number; created_at: string }[], days: number) {
  const map = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    map.set(dayKey(d), 0);
  }
  for (const row of xp) {
    const k = row.created_at.slice(0, 10);
    if (map.has(k) && row.amount > 0) map.set(k, (map.get(k) ?? 0) + row.amount);
  }
  return Array.from(map.entries()).map(([k, v]) => ({ label: fmtDay(k), xp: v }));
}

/* ---------- Small components ---------- */
function StatBox({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string | number; suffix?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon} <span>{label}</span>
      </div>
      <p className="text-xl font-black mt-1 leading-tight">
        {value}
        {suffix && <span className="text-xs text-muted-foreground font-semibold ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function ProgressTile({ icon, label, value, sub }: { icon: string; label: string; value: number; sub: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="h-11 w-11 rounded-2xl bg-surface/60 border border-white/5 flex items-center justify-center text-xl">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-black leading-tight">{value.toLocaleString("pt-BR")}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function HighlightCard({
  title, icon, tone, data, empty,
}: {
  title: string; icon: React.ReactNode; tone: string;
  data: { headline: string; sub: string; emoji: string } | null | false;
  empty: string;
}) {
  return (
    <div className={`relative glass-strong rounded-3xl p-4 overflow-hidden`}>
      <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone} blur-2xl`} />
      <div className="relative flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
      </div>
      {data ? (
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">{data.emoji}</div>
          <div className="min-w-0">
            <p className="text-lg font-black truncate">{data.headline}</p>
            <p className="text-[11px] text-muted-foreground truncate">{data.sub}</p>
          </div>
        </div>
      ) : (
        <p className="relative text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function ChartCard({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <section className="glass-strong rounded-3xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-electric" />
          <h3 className="text-sm font-black">{title}</h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-sm font-black">+{total.toLocaleString("pt-BR")} XP</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ---------- Rank section ---------- */
import type { Rank } from "@/lib/ranks";
import { RANKS } from "@/lib/ranks";

function RankBadge({
  rank,
  size = "lg",
  locked = false,
  animated = true,
}: {
  rank: Rank;
  size?: "sm" | "md" | "lg";
  locked?: boolean;
  animated?: boolean;
}) {
  const dims =
    size === "lg" ? "h-28 w-28 text-5xl"
    : size === "md" ? "h-16 w-16 text-2xl"
    : "h-10 w-10 text-base";
  return (
    <div className={`relative ${dims} shrink-0`}>
      {/* aura */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${rank.tone} blur-2xl ${animated && !locked ? "rank-badge-glow" : "opacity-40"}`}
      />
      {/* rotating ring */}
      {animated && !locked && size === "lg" && (
        <div className="absolute -inset-2 rounded-full border border-dashed border-white/25 rank-badge-spin" />
      )}
      {/* badge core */}
      <div
        className={`relative ${dims} rounded-full bg-gradient-to-br ${rank.tone} ring-2 ${rank.ring} ${!locked ? rank.glow : ""} flex items-center justify-center overflow-hidden ${animated && !locked ? "rank-badge-float" : ""}`}
      >
        <span className={`relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${locked ? "grayscale opacity-40" : ""}`}>
          {rank.icon}
        </span>
        {animated && !locked && (
          <span className="absolute inset-0 rank-shimmer opacity-60 mix-blend-overlay" />
        )}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      {/* sparkles */}
      {animated && !locked && size === "lg" && (
        <>
          <span className="absolute -top-1 -right-1 text-[10px] rank-sparkle" style={{ animationDelay: "0s" }}>✨</span>
          <span className="absolute -bottom-1 -left-2 text-[10px] rank-sparkle" style={{ animationDelay: "0.8s" }}>✦</span>
          <span className="absolute top-1/2 -right-3 text-[10px] rank-sparkle" style={{ animationDelay: "1.6s" }}>✧</span>
        </>
      )}
    </div>
  );
}

function RankSection({
  rank,
  next,
  progress,
  index,
}: {
  rank: Rank;
  next: Rank | null;
  progress: { items: { key: string; label: string; icon: string; have: number; need: number; done: boolean }[]; overallPct: number } | null;
  index: number;
}) {
  const isMax = !next;
  return (
    <section className="glass-strong rounded-3xl p-6 mb-6 relative overflow-hidden">
      <div className={`absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br ${rank.tone} blur-3xl opacity-80`} />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-electric/10 blur-3xl" />

      <div className="relative flex items-center gap-5">
        <RankBadge rank={rank} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rank atual</p>
          <h2 className="text-3xl font-black leading-tight truncate">{rank.name}</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{rank.tagline}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Shield className="h-3 w-3" /> Tier {index + 1} / {RANKS.length}
          </div>
        </div>
      </div>

      {/* Track of all ranks */}
      <div className="relative mt-5 flex items-center justify-between gap-1">
        {RANKS.map((r, i) => (
          <div key={r.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <RankBadge rank={r} size="sm" locked={i > index} animated={i === index} />
            <span
              className={`text-[9px] font-bold truncate w-full text-center ${
                i === index ? "text-foreground" : i < index ? "text-muted-foreground" : "text-muted-foreground/40"
              }`}
            >
              {r.name}
            </span>
          </div>
        ))}
      </div>

      {/* Next-rank progress */}
      {!isMax && progress ? (
        <div className="relative mt-6 rounded-2xl bg-surface/60 border border-white/5 p-4">
          <div className="flex items-center gap-3 mb-3">
            <RankBadge rank={next} size="md" locked animated={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Próximo rank</p>
              <p className="text-lg font-black leading-tight truncate">{next.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{next.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Progresso</p>
              <p className="text-lg font-black gradient-text leading-none">{progress.overallPct}%</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-surface overflow-hidden mb-4">
            <div
              className={`h-full bg-gradient-to-r ${next.tone} rounded-full transition-all`}
              style={{ width: `${progress.overallPct}%` }}
            />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Requisitos</p>
          <ul className="grid grid-cols-1 gap-2">
            {progress.items.map((r) => {
              const pct = Math.min(100, Math.round((r.have / Math.max(1, r.need)) * 100));
              return (
                <li key={r.key} className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-sm border ${
                      r.done
                        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                        : "bg-surface/70 border-white/5"
                    }`}
                  >
                    {r.done ? <Check className="h-4 w-4" /> : <span>{r.icon}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">{r.label}</span>
                      <span
                        className={`text-[10px] font-black tabular-nums ${
                          r.done ? "text-emerald-300" : "text-muted-foreground"
                        }`}
                      >
                        {r.have.toLocaleString("pt-BR")} / {r.need.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.done
                            ? "bg-emerald-400"
                            : "bg-gradient-to-r from-electric to-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="relative mt-6 rounded-2xl bg-gradient-to-r from-cyan-300/10 via-fuchsia-400/10 to-amber-400/10 border border-white/10 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Rank máximo alcançado</p>
          <p className="text-base font-black mt-1">Você é uma Lenda Ascendida ✨</p>
        </div>
      )}
    </section>
  );
}

function QuickToggle({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass rounded-2xl p-4 flex items-center justify-between hover:bg-white/5 transition text-left">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-surface/60 border border-white/5 flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-sm font-black">{value}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/* ---------- Edit sheet ---------- */
const PRESET_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Ash",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Luna",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Rex",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Sky",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Nova",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Zen",
  "https://api.dicebear.com/9.x/bottts/svg?seed=Bit",
  "https://api.dicebear.com/9.x/bottts/svg?seed=Nyx",
];

function EditSheet({ profile, onClose }: { profile: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [full_name, setFullName] = useState(profile.full_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [goals, setGoals] = useState(profile.goals ?? "");
  const [avatar_url, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [theme, setTheme] = useState<string>(profile.theme ?? "dark");
  const [notifications_enabled, setNotifications] = useState<boolean>(profile.notifications_enabled ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name, username, bio, goals, avatar_url, theme, notifications_enabled,
        updated_at: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) throw error;
      localStorage.setItem("theme", theme);
      document.documentElement.classList.toggle("dark", theme !== "light");
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black">Editar perfil</h3>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        {/* Avatar picker */}
        <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Avatar">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-electric to-primary/60 flex items-center justify-center text-primary-foreground font-black overflow-hidden ring-2 ring-white/10">
              {avatar_url
                ? <img src={avatar_url} alt="" className="h-full w-full object-cover" />
                : (full_name || username || "U").charAt(0).toUpperCase()}
            </div>
            <input
              value={avatar_url}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="URL da imagem"
              className="flex-1 glass rounded-2xl px-3 py-3 text-xs outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AVATARS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setAvatarUrl(url)}
                className={`aspect-square rounded-2xl bg-surface/60 border overflow-hidden transition ${avatar_url === url ? "border-electric ring-2 ring-electric/40" : "border-white/5 hover:border-white/20"}`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </Field>

        <Field icon={<User className="h-3.5 w-3.5" />} label="Nome">
          <input value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
        </Field>
        <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Usuário">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nome de usuário" className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
        </Field>
        <Field icon={<Feather className="h-3.5 w-3.5" />} label="Biografia">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte um pouco sobre você" rows={3} className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none resize-none" />
        </Field>
        <Field icon={<Target className="h-3.5 w-3.5" />} label="Metas atuais">
          <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="O que você quer conquistar?" rows={3} className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none resize-none" />
        </Field>

        <Field icon={<Palette className="h-3.5 w-3.5" />} label="Tema">
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "dark",  label: "Escuro", icon: <Moon className="h-4 w-4" /> },
              { key: "light", label: "Claro",  icon: <Sun className="h-4 w-4" /> },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTheme(t.key)}
                className={`rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold border transition ${
                  theme === t.key ? "bg-electric/15 border-electric text-foreground" : "glass border-transparent text-muted-foreground"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </Field>

        <Field icon={<Bell className="h-3.5 w-3.5" />} label="Notificações">
          <button
            type="button"
            onClick={() => setNotifications(!notifications_enabled)}
            className="w-full glass rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span className="text-sm font-semibold">{notifications_enabled ? "Ativadas" : "Silenciadas"}</span>
            <span className={`relative h-6 w-11 rounded-full transition ${notifications_enabled ? "bg-electric" : "bg-surface-2"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-primary-foreground transition-all ${notifications_enabled ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>
        </Field>

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 w-full rounded-full bg-gradient-to-r from-electric to-primary text-primary-foreground px-6 py-4 text-sm font-black flex items-center justify-center gap-2 shadow-glow disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      {children}
    </div>
  );
}
