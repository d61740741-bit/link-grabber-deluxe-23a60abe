import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { progressToNext, skillLabels, categoryLabels } from "@/lib/ascension";
import { computeRank, type PlayerStats, type Rank, RANKS } from "@/lib/ranks";
import { useTitles, useTimeline, useLifeState, rarityStyle } from "@/lib/life-state";
import { skillLevelProgress, resolveSkill, type SkillRow } from "@/lib/skills";
import { FRAMES, frameById, type FrameStats } from "@/lib/frames";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import { uploadAvatar } from "@/lib/avatar";
import {
  LogOut, Edit3, Loader2, X, Flame, Calendar, Shield, Sparkles,
  Bell, BellOff, Moon, Sun, User, Target, Feather, Camera,
  Palette, ChevronRight, Star, Zap, TrendingUp, Award, Check, Lock,
  Trophy, Activity, History, BarChart3, Upload, Frame as FrameIcon,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
  head: () => ({
    meta: [
      { title: "Perfil · Sua jornada de evolução" },
      { name: "description", content: "Veja rank, XP, skills, conquistas, sequência, Life Score, molduras e títulos da sua jornada." },
      { property: "og:title", content: "Perfil · Sua jornada de evolução" },
      { property: "og:description", content: "Rank, XP, skills, conquistas, Life Score, molduras e títulos em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

type Tab = "visao" | "colecao" | "stats" | "historico";

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
  const [tab, setTab] = useState<Tab>("visao");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return { ...(data as any), email: user.email };
    },
  });

  const { data: titles } = useTitles();
  const { data: life } = useLifeState();
  const { data: timeline } = useTimeline(40);

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
        supabase.from("skills").select("*").eq("user_id", uid),
        supabase.from("achievements").select("id, name, description, icon, unlocked_at", { count: "exact" }).eq("user_id", uid).order("unlocked_at", { ascending: false }),
        supabase.from("xp_history").select("amount, created_at, skill_category, custom_skill_id").eq("user_id", uid).gte("created_at", sinceIso).order("created_at", { ascending: true }),
      ]);

      return {
        tasks: tasks.data ?? [],
        tasksCount: tasks.count ?? 0,
        habits: habits.data ?? [],
        skills: (skills.data ?? []) as SkillRow[],
        achievements: achievements.data ?? [],
        achievementsCount: achievements.count ?? 0,
        xp: xp.data ?? [],
      };
    },
  });

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
  const lifeScore = Number(life?.life_score ?? profile?.life_score ?? 0);

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

  const frameStats: FrameStats = useMemo(() => ({
    level,
    totalXp,
    streak: profile?.streak_days ?? 0,
    achievements: agg?.achievementsCount ?? 0,
    missions: completedTasks,
    titles: titles?.length ?? 0,
    lifeScore,
  }), [level, totalXp, profile?.streak_days, agg, completedTasks, titles, lifeScore]);

  const unlockedFrames = useMemo(() => FRAMES.filter((f) => f.requirement(frameStats)).length, [frameStats]);

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
    const s = [...list].sort((a, b) => (b.total_xp ?? 0) - (a.total_xp ?? 0))[0];
    const id = resolveSkill(s);
    return { ...id, level: s.level ?? 1, total_xp: s.total_xp ?? 0 };
  }, [agg]);

  const weekly = useMemo(() => buildBuckets(agg?.xp ?? [], 7), [agg]);
  const monthly = useMemo(() => buildBuckets(agg?.xp ?? [], 30), [agg]);
  const weekTotal = weekly.reduce((s, b) => s + b.xp, 0);
  const monthTotal = monthly.reduce((s, b) => s + b.xp, 0);

  const displayName = profile?.full_name || profile?.username || "Aventureiro";
  const equippedKey = profile?.equipped_title as string | null | undefined;
  const equippedTitle = equippedKey ? (titles ?? []).find((t) => t.title_key === equippedKey) : null;

  async function patchProfile(patch: Record<string, any>, msg?: string) {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    if (msg) toast.success(msg);
  }

  return (
    <div className="px-5 pt-8 pb-28 safe-top max-w-2xl mx-auto">
      {/* Hero */}
      <header className="relative mb-5">
        <div className="glass-strong rounded-[28px] p-6 relative overflow-hidden">
          <div className={`absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br ${rank.tone} blur-3xl opacity-70`} />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-electric/10 blur-3xl" />

          <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <AvatarUploader
              profile={profile}
              displayName={displayName}
              onSaved={(url) => patchProfile({ avatar_url: url }, "Foto atualizada")}
            />

            <div className="min-w-0">
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r ${rank.tone} border border-white/10 mb-2`}>
                <span>{rank.icon}</span>
                <span className="truncate">{rank.name}</span>
              </div>
              <h1 className="text-2xl font-black truncate">{displayName}</h1>
              {profile?.username && profile?.full_name && (
                <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
              )}
              {equippedTitle ? (
                <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 ring-1 ${rarityStyle(equippedTitle.rarity).ring} ${rarityStyle(equippedTitle.rarity).bg}`}>
                  <Trophy className={`h-3 w-3 ${rarityStyle(equippedTitle.rarity).text}`} />
                  <span className={`text-[10px] font-bold ${rarityStyle(equippedTitle.rarity).text}`}>
                    {equippedTitle.icon} {equippedTitle.title_name}
                  </span>
                </div>
              ) : (
                <button onClick={() => setTab("colecao")} className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2">
                  Escolher um título
                </button>
              )}
            </div>
          </div>

          {profile?.bio && (
            <p className="relative text-sm text-muted-foreground mt-4 leading-relaxed">{profile.bio}</p>
          )}

          {profile?.goals && (
            <div className="relative mt-4 rounded-2xl bg-surface/60 border border-white/5 p-3 flex gap-2 items-start">
              <Target className="h-4 w-4 text-electric mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{profile.goals}</p>
            </div>
          )}

          {/* Quick metrics strip */}
          <div className="relative mt-5 grid grid-cols-4 gap-2">
            <MiniMetric label="Nível" value={level} tone="text-electric" />
            <MiniMetric label="XP" value={totalXp.toLocaleString("pt-BR")} tone="text-gold" />
            <MiniMetric label="Sequência" value={`${profile?.streak_days ?? 0}d`} tone="text-orange-400" />
            <MiniMetric label="Life" value={lifeScore.toFixed(0)} tone="text-emerald-300" />
          </div>

          <button
            onClick={() => setEditing(true)}
            className="relative mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full glass px-4 py-2.5 text-xs font-bold hover:bg-white/5 transition"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar perfil
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-2 z-20 mb-5 grid grid-cols-4 gap-1 rounded-2xl glass-strong p-1">
        {([
          { k: "visao", label: "Visão", icon: <Activity className="h-3.5 w-3.5" /> },
          { k: "colecao", label: "Coleção", icon: <Trophy className="h-3.5 w-3.5" /> },
          { k: "stats", label: "Stats", icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { k: "historico", label: "Histórico", icon: <History className="h-3.5 w-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold transition ${
              tab === t.k ? "bg-gradient-to-r from-electric to-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "visao" && (
        <>
          {/* Level + Life Score */}
          <section className="glass-strong rounded-[28px] p-6 mb-5 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-electric/20 blur-3xl" />
            <div className="relative flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nível atual</p>
                <p className="text-5xl font-black gradient-text leading-none mt-1">{level}</p>
              </div>
              <LifeRing score={lifeScore} />
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

          <RankSection rank={rank} next={rankInfo.next} progress={rankInfo.progress} index={rankInfo.currentIndex} />

          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatBox icon={<Flame className="h-4 w-4 text-orange-400" />} label="Sequência" value={`${profile?.streak_days ?? 0}`} suffix="dias" />
            <StatBox icon={<TrendingUp className="h-4 w-4 text-electric" />} label="Maior seq. hábito" value={`${longestHabitStreak}`} suffix="dias" />
            <StatBox icon={<Shield className="h-4 w-4 text-gold" />} label="Rank" value={rank.name} />
            <StatBox icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Conta" value={accountAge} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <ProgressTile icon="🎯" label="Missões" value={completedTasks} sub={`de ${agg?.tasksCount ?? 0}`} />
            <ProgressTile icon="⚡" label="Hábitos" value={agg?.habits.length ?? 0} sub="ativos" />
            <ProgressTile icon="🏅" label="Conquistas" value={agg?.achievementsCount ?? 0} sub="desbloqueadas" />
            <ProgressTile icon="🖼️" label="Molduras" value={unlockedFrames} sub={`de ${FRAMES.length}`} />
          </div>

          {/* Skills */}
          <section className="glass-strong rounded-[28px] p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-electric" />
                <h3 className="text-sm font-black">Skills</h3>
              </div>
              <Link to="/habilidades" className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                Ver todas <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {(agg?.skills.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma skill cultivada ainda.</p>
            ) : (
              <ul className="space-y-2.5">
                {[...(agg?.skills ?? [])]
                  .sort((a, b) => (b.total_xp ?? 0) - (a.total_xp ?? 0))
                  .slice(0, 6)
                  .map((s) => {
                    const id = resolveSkill(s);
                    const p = skillLevelProgress(s.total_xp ?? 0);
                    return (
                      <li key={s.id} className="flex items-center gap-3">
                        <div className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${id.color} flex items-center justify-center text-base`}>
                          {id.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold truncate">{id.label}</span>
                            <span className="text-[10px] font-black text-muted-foreground tabular-nums">Lv {p.level}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${id.color}`} style={{ width: `${p.pct}%` }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
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
        </>
      )}

      {tab === "colecao" && (
        <>
          <FramesSection
            current={profile?.avatar_frame ?? "none"}
            stats={frameStats}
            avatarUrl={profile?.avatar_url}
            displayName={displayName}
            onPick={(id) => patchProfile({ avatar_frame: id }, "Moldura equipada")}
          />

          <TitlesSection
            titles={titles ?? []}
            equipped={equippedKey ?? null}
            onEquip={async (key) => {
              const { error } = await supabase.rpc("equip_title", { p_key: key ?? "" });
              if (error) return toast.error("Erro ao equipar título");
              toast.success(key ? "Título equipado" : "Título removido");
              await qc.invalidateQueries();
            }}
          />

          <section className="glass-strong rounded-[28px] p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-black">Conquistas</h3>
              </div>
              <span className="text-xs text-muted-foreground">{agg?.achievementsCount ?? 0}</span>
            </div>
            {(agg?.achievements ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conquista desbloqueada ainda.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {(agg?.achievements ?? []).map((a: any) => (
                  <div key={a.id} className="rounded-2xl bg-surface/60 border border-white/5 p-3 text-center">
                    <div className="text-2xl">{a.icon ?? "🏅"}</div>
                    <p className="text-[10px] font-bold mt-1 line-clamp-2">{a.name}</p>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      {new Date(a.unlocked_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "stats" && (
        <>
          <ChartCard title="Atividade semanal" total={weekTotal}>
            <ResponsiveContainer width="100%" height={150}>
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

          <ChartCard title="Atividade mensal" total={monthTotal}>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="xp" fill="oklch(0.82 0.12 88)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatBox icon={<Zap className="h-4 w-4 text-electric" />} label="XP / dia (30d)" value={(monthTotal / 30).toFixed(1)} />
            <StatBox icon={<Trophy className="h-4 w-4 text-gold" />} label="Títulos" value={titles?.length ?? 0} />
            <StatBox icon={<Activity className="h-4 w-4 text-emerald-300" />} label="Life Score" value={lifeScore.toFixed(0)} suffix="/100" />
            <StatBox icon={<Target className="h-4 w-4 text-rose-300" />} label="Conclusão" value={`${agg?.tasksCount ? Math.round((completedTasks / agg.tasksCount) * 100) : 0}%`} />
          </div>
        </>
      )}

      {tab === "historico" && (
        <section className="glass-strong rounded-[28px] p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-electric" />
            <h3 className="text-sm font-black">Linha do tempo</h3>
          </div>
          {(timeline ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada registrado ainda. Sua jornada aparecerá aqui.</p>
          ) : (
            <ul className="relative space-y-4 pl-5">
              <span className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10" />
              {(timeline ?? []).map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[15px] top-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-electric to-primary ring-2 ring-background" />
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">{e.icon ?? "•"}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{e.title}</p>
                      {e.description && <p className="text-[11px] text-muted-foreground">{e.description}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {new Date(e.occurred_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Quick prefs */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <QuickToggle
          icon={profile?.theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          label="Tema"
          value={profile?.theme === "light" ? "Claro" : "Escuro"}
          onClick={() => {
            const next = profile?.theme === "light" ? "dark" : "light";
            localStorage.setItem("theme", next);
            document.documentElement.classList.toggle("dark", next !== "light");
            patchProfile({ theme: next });
          }}
        />
        <QuickToggle
          icon={profile?.notifications_enabled === false ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          label="Notificações"
          value={profile?.notifications_enabled === false ? "Off" : "On"}
          onClick={() => {
            const next = !(profile?.notifications_enabled ?? true);
            patchProfile({ notifications_enabled: next }, next ? "Notificações ativadas" : "Notificações silenciadas");
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

/* ---------- Avatar uploader ---------- */
function AvatarUploader({
  profile,
  displayName,
  onSaved,
}: {
  profile: any;
  displayName: string;
  onSaved: (url: string) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File | null) {
    if (!file || !profile?.id) return;
    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy(true);
    try {
      const url = await uploadAvatar(profile.id, file);
      await onSaved(url);
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
      setPreview(null);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(local);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <FramedAvatar
        url={preview ?? profile?.avatar_url}
        name={displayName}
        frameId={profile?.avatar_frame}
        size={96}
      />
      {busy && (
        <div className="absolute inset-0 grid place-items-center rounded-full bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        aria-label="Trocar foto"
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full glass-strong flex items-center justify-center border border-white/10 hover:bg-white/10 transition"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}

/* ---------- Frames ---------- */
function FramesSection({
  current, stats, avatarUrl, displayName, onPick,
}: {
  current: string;
  stats: FrameStats;
  avatarUrl?: string | null;
  displayName: string;
  onPick: (id: string) => void;
}) {
  return (
    <section className="glass-strong rounded-[28px] p-5 mb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FrameIcon className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-black">Molduras</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {FRAMES.filter((f) => f.requirement(stats)).length}/{FRAMES.length}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Desbloqueadas pela sua evolução. Toque para equipar — salva automaticamente.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {FRAMES.map((f) => {
          const unlocked = f.requirement(stats);
          const active = current === f.id;
          return (
            <button
              key={f.id}
              disabled={!unlocked}
              onClick={() => unlocked && onPick(f.id)}
              className={`relative rounded-2xl p-3 text-center border transition ${
                active ? "border-electric bg-electric/10" : "border-white/5 bg-surface/50"
              } ${unlocked ? "hover:border-white/20" : "opacity-50"}`}
            >
              <div className="flex justify-center">
                <FramedAvatar url={avatarUrl} name={displayName} frameId={f.id} size={54} />
              </div>
              <p className="text-[10px] font-bold mt-2 truncate">{f.name}</p>
              <p className="text-[9px] text-muted-foreground truncate">{f.requirementLabel}</p>
              {!unlocked && (
                <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-background/70 grid place-items-center">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </span>
              )}
              {active && (
                <span className="absolute top-2 left-2 h-5 w-5 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40 grid place-items-center">
                  <Check className="h-3 w-3 text-emerald-300" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Titles ---------- */
function TitlesSection({
  titles, equipped, onEquip,
}: {
  titles: ReturnType<typeof useTitles>["data"] extends (infer T)[] | undefined ? T[] : any[];
  equipped: string | null;
  onEquip: (key: string | null) => void;
}) {
  return (
    <section className="glass-strong rounded-[28px] p-5 mb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-black">Títulos</h3>
        </div>
        <Link to="/titulos" className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
          Coleção <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Desbloqueados pela sua jornada. Toque para equipar.</p>

      {titles.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum título ainda. Complete missões e mantenha streaks.</p>
      ) : (
        <>
          {equipped && (
            <button onClick={() => onEquip(null)} className="mb-3 w-full glass rounded-2xl p-2.5 text-[11px] text-muted-foreground hover:text-foreground transition">
              Remover título equipado
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {titles.map((t: any) => {
              const st = rarityStyle(t.rarity);
              const isEq = equipped === t.title_key;
              return (
                <button
                  key={t.id}
                  onClick={() => onEquip(t.title_key)}
                  className={`relative text-left rounded-2xl p-3 ring-1 ${st.ring} ${st.bg} ${isEq ? "shadow-elegant" : ""}`}
                >
                  {isEq && (
                    <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40 grid place-items-center">
                      <Check className="h-3 w-3 text-emerald-300" />
                    </span>
                  )}
                  <div className="text-xl">{t.icon}</div>
                  <p className={`text-[12px] font-bold leading-tight mt-1 ${st.text}`}>{t.title_name}</p>
                  {t.description && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
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

function MiniMetric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl bg-surface/60 border border-white/5 px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-sm font-black truncate ${tone}`}>{value}</p>
    </div>
  );
}

function LifeRing({ score }: { score: number }) {
  const size = 84, stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#pfLife)" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`} className="transition-[stroke-dasharray] duration-700" />
        <defs>
          <linearGradient id="pfLife" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.75 0.18 200)" />
            <stop offset="100%" stopColor="oklch(0.7 0.22 320)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black leading-none">{score.toFixed(0)}</span>
        <span className="text-[8px] uppercase tracking-widest text-muted-foreground mt-0.5">Life</span>
      </div>
    </div>
  );
}

/* ---------- Small components ---------- */
function StatBox({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string | number; suffix?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon} <span className="truncate">{label}</span>
      </div>
      <p className="text-xl font-black mt-1 leading-tight truncate">
        {value}
        {suffix && <span className="text-xs text-muted-foreground font-semibold ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function ProgressTile({ icon, label, value, sub }: { icon: string; label: string; value: number; sub: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="h-11 w-11 shrink-0 rounded-2xl bg-surface/60 border border-white/5 flex items-center justify-center text-xl">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-black leading-tight">{value.toLocaleString("pt-BR")}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
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
    <div className="relative glass-strong rounded-[28px] p-4 overflow-hidden">
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
    <section className="glass-strong rounded-[28px] p-5 mb-5">
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
function RankBadge({
  rank, size = "lg", locked = false, animated = true,
}: {
  rank: Rank; size?: "sm" | "md" | "lg"; locked?: boolean; animated?: boolean;
}) {
  const dims =
    size === "lg" ? "h-28 w-28 text-5xl"
    : size === "md" ? "h-16 w-16 text-2xl"
    : "h-10 w-10 text-base";
  return (
    <div className={`relative ${dims} shrink-0`}>
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${rank.tone} blur-2xl ${animated && !locked ? "rank-badge-glow" : "opacity-40"}`} />
      {animated && !locked && size === "lg" && (
        <div className="absolute -inset-2 rounded-full border border-dashed border-white/25 rank-badge-spin" />
      )}
      <div className={`relative ${dims} rounded-full bg-gradient-to-br ${rank.tone} ring-2 ${rank.ring} ${!locked ? rank.glow : ""} flex items-center justify-center overflow-hidden ${animated && !locked ? "rank-badge-float" : ""}`}>
        <span className={`relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${locked ? "grayscale opacity-40" : ""}`}>
          {rank.icon}
        </span>
        {animated && !locked && <span className="absolute inset-0 rank-shimmer opacity-60 mix-blend-overlay" />}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
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
  rank, next, progress, index,
}: {
  rank: Rank;
  next: Rank | null;
  progress: { items: { key: string; label: string; icon: string; have: number; need: number; done: boolean }[]; overallPct: number } | null;
  index: number;
}) {
  const isMax = !next;
  return (
    <section className="glass-strong rounded-[28px] p-6 mb-5 relative overflow-hidden">
      <div className={`absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br ${rank.tone} blur-3xl opacity-80`} />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-electric/10 blur-3xl" />

      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5">
        <RankBadge rank={rank} size="lg" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rank atual</p>
          <h2 className="text-3xl font-black leading-tight truncate">{rank.name}</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{rank.tagline}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Shield className="h-3 w-3" /> Tier {index + 1} / {RANKS.length}
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-1">
        {RANKS.map((r, i) => (
          <div key={r.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <RankBadge rank={r} size="sm" locked={i > index} animated={i === index} />
            <span className={`text-[9px] font-bold truncate w-full text-center ${
              i === index ? "text-foreground" : i < index ? "text-muted-foreground" : "text-muted-foreground/40"
            }`}>
              {r.name}
            </span>
          </div>
        ))}
      </div>

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
            <div className={`h-full bg-gradient-to-r ${next.tone} rounded-full transition-all`} style={{ width: `${progress.overallPct}%` }} />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Requisitos</p>
          <ul className="grid grid-cols-1 gap-2">
            {progress.items.map((r) => {
              const pct = Math.min(100, Math.round((r.have / Math.max(1, r.need)) * 100));
              return (
                <li key={r.key} className="flex items-center gap-3">
                  <div className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-sm border ${
                    r.done ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300" : "bg-surface/70 border-white/5"
                  }`}>
                    {r.done ? <Check className="h-4 w-4" /> : <span>{r.icon}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">{r.label}</span>
                      <span className={`text-[10px] font-black tabular-nums ${r.done ? "text-emerald-300" : "text-muted-foreground"}`}>
                        {r.have.toLocaleString("pt-BR")} / {r.need.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${r.done ? "bg-emerald-400" : "bg-gradient-to-r from-electric to-primary"}`} style={{ width: `${pct}%` }} />
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
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 shrink-0 rounded-2xl bg-surface/60 border border-white/5 flex items-center justify-center">{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{label}</p>
          <p className="text-sm font-black truncate">{value}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [full_name, setFullName] = useState(profile.full_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [goals, setGoals] = useState(profile.goals ?? "");
  const [avatar_url, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [theme, setTheme] = useState<string>(profile.theme ?? "dark");
  const [notifications_enabled, setNotifications] = useState<boolean>(profile.notifications_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function autoSaveAvatar(url: string) {
    setAvatarUrl(url);
    await supabase.from("profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", profile.id);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Foto atualizada");
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(profile.id, file);
      await autoSaveAvatar(url);
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
      <div className="w-full max-w-md glass-strong rounded-[28px] p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black">Editar perfil</h3>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        {/* Avatar */}
        <Field icon={<Camera className="h-3.5 w-3.5" />} label="Foto de perfil">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <FramedAvatar url={avatar_url} name={full_name || username} frameId={profile.avatar_frame} size={72} />
              {uploading && (
                <div className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl bg-gradient-to-r from-electric to-primary text-primary-foreground px-4 py-2.5 text-xs font-black inline-flex items-center justify-center gap-2"
              >
                <Upload className="h-3.5 w-3.5" /> Enviar da galeria
              </button>
              {avatar_url && (
                <button
                  type="button"
                  onClick={() => autoSaveAvatar("")}
                  className="w-full glass rounded-2xl px-4 py-2 text-[11px] text-muted-foreground"
                >
                  Remover foto
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Avatares padrão</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AVATARS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => autoSaveAvatar(url)}
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
              { key: "dark", label: "Escuro", icon: <Moon className="h-4 w-4" /> },
              { key: "light", label: "Claro", icon: <Sun className="h-4 w-4" /> },
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
