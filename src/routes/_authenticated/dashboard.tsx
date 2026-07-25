import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { progressToNext, progressToNextSkill, skillLabels } from "@/lib/ascension";
import {
  Flame, Zap, ChevronRight, Check, Sparkles, ArrowUpRight, Sunrise, Moon, Sun,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { StatsSheetsProvider, useStatsSheet } from "@/components/dashboard/StatsSheets";
import { LifeScoreCard } from "@/components/dashboard/LifeScoreCard";
import { BossCard } from "@/components/dashboard/BossCard";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <StatsSheetsProvider>
      <Dashboard />
    </StatsSheetsProvider>
  ),
});


function greeting() {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", Icon: Moon };
  if (h < 12) return { text: "Bom dia", Icon: Sunrise };
  if (h < 18) return { text: "Boa tarde", Icon: Sun };
  return { text: "Boa noite", Icon: Moon };
}

function Dashboard() {
  const qc = useQueryClient();
  const { open } = useStatsSheet();
  const today = new Date().toISOString().slice(0, 10);


  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const { data } = await supabase.from("skills").select("*").order("category");
      return data ?? [];
    },
  });

  const { data: todayTasks } = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .or(`due_date.eq.${today},due_date.is.null`)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: xpToday } = useQuery({
    queryKey: ["xp", "today", today],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("xp_history")
        .select("amount")
        .gte("created_at", start.toISOString());
      return (data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    },
  });

  const { data: doneToday } = useQuery({
    queryKey: ["tasks", "done-today", today],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("completed", true)
        .gte("completed_at", start.toISOString());
      return count ?? 0;
    },
  });

  const { data: xpRange } = useQuery({
    queryKey: ["xp", "range"],
    queryFn: async () => {
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now); monthStart.setDate(now.getDate() - 29); monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("xp_history")
        .select("amount, created_at")
        .gte("created_at", monthStart.toISOString());
      const rows = data ?? [];
      const week = rows.filter((r: any) => new Date(r.created_at) >= weekStart).reduce((s: number, r: any) => s + r.amount, 0);
      const month = rows.reduce((s: number, r: any) => s + r.amount, 0);
      return { week, month };
    },
  });


  const prog = progressToNext(profile?.total_xp ?? 0, profile?.level ?? 1);
  const first = (profile?.full_name || profile?.username || "Você").split(" ")[0];
  const { text: hello, Icon: HelloIcon } = useMemo(greeting, []);

  async function completeTask(id: string, xp: number, _skill: string | null) {
    await supabase.from("tasks").update({ completed: true }).eq("id", id);
    toast.success(`+${xp} XP`, { description: "Missão concluída." });
    qc.invalidateQueries();
  }


  const topSkills = (skills ?? []).slice(0, 4);

  return (
    <div className="relative px-5 pt-10 safe-top">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-electric/15 blur-[100px]" />

      {/* Header */}
      <header className="relative flex items-center justify-between mb-8 animate-rise">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HelloIcon className="h-3.5 w-3.5" strokeWidth={2} />
            <p className="text-[11px] uppercase tracking-[0.22em] font-medium">{hello}</p>
          </div>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight truncate">{first}.</h1>
        </div>
        <Link to="/perfil" className="tap shrink-0">
          <div className="relative h-11 w-11 rounded-2xl overflow-hidden ring-hair">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-electric/80 to-primary/20 flex items-center justify-center text-primary-foreground font-semibold text-base">
                {(profile?.full_name || profile?.username || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </Link>
      </header>

      {/* Hero: Level ring */}
      <section className="relative glass-strong rounded-[28px] p-6 mb-5 overflow-hidden shadow-elegant animate-rise delay-1">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-electric/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative flex items-center gap-5">
          <button onClick={() => open("level")} className="tap rounded-full" aria-label="Ver progressão de nível">
            <LevelRing level={profile?.level ?? 1} pct={prog.pct} />
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={() => open("level")} className="tap block text-left w-full">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Ascensão</p>
              <p className="mt-1 text-[15px] font-semibold text-foreground/90">
                {prog.current.toLocaleString("pt-BR")} <span className="text-muted-foreground font-normal">/ {prog.needed.toLocaleString("pt-BR")} XP</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Faltam {(prog.needed - prog.current).toLocaleString("pt-BR")} XP para o nível {(profile?.level ?? 1) + 1}
              </p>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => open("totalXp")}
                className="tap inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-white/[0.06] ring-hair hover:bg-white/[0.1] transition"
              >
                <Sparkles className="h-3 w-3 text-electric" />
                {(profile?.total_xp ?? 0).toLocaleString("pt-BR")} XP total
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Streak & XP today */}
      <section className="grid grid-cols-3 gap-2.5 mb-8 animate-rise delay-2">
        <MetricCard onClick={() => open("streak")} label="Sequência" value={`${profile?.streak_days ?? 0}`} suffix="d" Icon={Flame} tint="text-orange-300" glow="from-orange-500/15" />
        <MetricCard onClick={() => open("xpToday")} label="XP hoje" value={`${xpToday ?? 0}`} Icon={Zap} tint="text-electric" glow="from-electric/20" />
        <MetricCard onClick={() => open("completed")} label="Concluídas" value={`${doneToday ?? 0}`} Icon={Check} tint="text-emerald-300" glow="from-emerald-500/15" />
      </section>

      {/* Weekly / monthly XP */}
      <section className="grid grid-cols-2 gap-2.5 mb-8 animate-rise delay-2">
        <RangeCard onClick={() => open("week")} label="Esta semana" value={xpRange?.week ?? 0} glow="from-electric/15" />
        <RangeCard onClick={() => open("month")} label="Este mês" value={xpRange?.month ?? 0} glow="from-gold/15" />
      </section>

      <LifeScoreCard />
      <BossCard />
      <RecoveryCard />

      {/* Today missions */}
      <section className="mb-8 animate-rise delay-3">
        <SectionHeader title="Hoje" caption="Suas missões" href="/missoes" />
        <div className="glass rounded-3xl overflow-hidden shadow-elegant">
          {(todayTasks ?? []).length === 0 ? (
            <Link to="/missoes" className="tap flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-semibold">Comece sua primeira missão</p>
                <p className="text-xs text-muted-foreground mt-1">Ganhe XP e evolua suas skills</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-white/[0.06] ring-hair flex items-center justify-center">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ) : (
            (todayTasks ?? []).map((t: any, idx: number) => (
              <div key={t.id}>
                {idx > 0 && <div className="divider-hair mx-5" />}
                <button
                  onClick={() => completeTask(t.id, t.xp_reward, t.skill_category)}
                  className="w-full flex items-center gap-3.5 p-4 tap text-left"
                >
                  <span className="relative h-6 w-6 shrink-0 rounded-full ring-hair flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] transition">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-tight truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t.skill_category ? skillLabels[t.skill_category]?.label : "Missão"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-electric bg-electric/10 rounded-full px-2 py-1 ring-hair">
                    +{t.xp_reward} XP
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Skills */}
      <section className="mb-8 animate-rise delay-4">
        <SectionHeader title="Skills" caption="Evolução por área" href="/habilidades" />
        <div className="grid grid-cols-2 gap-3">
          {topSkills.map((s: any, i: number) => {
            const meta = skillLabels[s.category];
            const sp = progressToNextSkill(s.total_xp ?? s.xp ?? 0, s.level);
            const pct = sp.pct;
            return (
              <Link
                key={s.id}
                to="/habilidades"
                className={`tap relative glass rounded-3xl p-4 overflow-hidden animate-rise delay-${(i % 4) + 3}`}
              >
                <div className={`absolute -top-10 -right-10 h-24 w-24 rounded-full bg-gradient-to-br ${meta?.color} blur-2xl opacity-70`} />
                <div className="relative flex items-center justify-between">
                  <span className="text-xl leading-none">{meta?.emoji}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lv {s.level}</span>
                </div>
                <p className="relative mt-4 text-[13px] font-semibold tracking-tight">{meta?.label}</p>
                <div className="relative mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-electric to-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="relative mt-1.5 text-[10px] text-muted-foreground">{s.xp ?? 0} XP</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Explore */}
      <section className="mb-10 animate-rise delay-5">
        <SectionHeader title="Explorar" caption="Áreas da sua jornada" />
        <div className="space-y-2">
          <ExploreRow to="/coach" emoji="✨" title="Coach IA" hint="Seu mentor pessoal, 24/7" />
          <ExploreRow to="/calendario" emoji="🗓️" title="Calendário" hint="Sua jornada, dia a dia" />
          <ExploreRow to="/biblioteca" emoji="📖" title="Biblioteca" hint="Artigos, livros e notas" />
          <ExploreRow to="/aprender" emoji="📚" title="Aprender" hint="Estudos e leitura" />
          <ExploreRow to="/saude" emoji="🫀" title="Saúde" hint="Treinos, sono, peso" />
          <ExploreRow to="/treinos" emoji="💪" title="Treinos" hint="Exercícios, séries, calorias" />
          <ExploreRow to="/financas" emoji="💎" title="Finanças" hint="Receitas e gastos" />
          <ExploreRow to="/conquistas" emoji="🏆" title="Conquistas" hint="Marcos desbloqueados" />
          <ExploreRow to="/titulos" emoji="🎖️" title="Títulos" hint="Sua identidade forjada" />
          <ExploreRow to="/inventario" emoji="🎁" title="Inventário" hint="Badges, medalhas, boosts" />
          <ExploreRow to="/linha-do-tempo" emoji="🕰️" title="Linha do tempo" hint="Marcos da sua história" />
          <ExploreRow to="/estatisticas" emoji="📊" title="Estatísticas" hint="Evolução ao longo do tempo" />
        </div>
      </section>
    </div>
  );
}

/* --- pieces --- */

function LevelRing({ level, pct }: { level: number; pct: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const off = C - (pct / 100) * C;
  return (
    <div className="relative h-[92px] w-[92px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.14 88)" />
            <stop offset="100%" stopColor="oklch(0.72 0.2 250)" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={R} strokeWidth="6" stroke="oklch(1 0 0 / 0.06)" fill="none" />
        <circle
          cx="40" cy="40" r={R}
          strokeWidth="6" stroke="url(#ringGrad)" fill="none" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
          className="animate-ring"
          style={{ ["--dash-len" as any]: C, ["--dash-off" as any]: off }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground -mb-0.5">Nível</span>
        <span className="text-[26px] font-semibold tracking-tight leading-none">{level}</span>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, suffix, Icon, tint, glow, onClick,
}: {
  label: string; value: string; suffix?: string; Icon: any; tint: string; glow: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tap relative glass rounded-2xl p-3.5 overflow-hidden text-left active:scale-[0.97] transition"
    >
      <div className={`absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl`} />
      <div className="relative flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${tint}`} strokeWidth={2.4} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="relative mt-2 flex items-baseline gap-0.5">
        <span className="text-[22px] font-semibold tracking-tight">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </button>
  );
}

function RangeCard({ label, value, glow, onClick }: { label: string; value: number; glow: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap relative glass rounded-2xl p-4 overflow-hidden text-left active:scale-[0.98] transition"
    >
      <div className={`absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl`} />
      <p className="relative text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="relative mt-1.5 text-[22px] font-semibold tracking-tight">
        {value.toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground font-normal">XP</span>
      </p>
    </button>
  );
}


function SectionHeader({ title, caption, href }: { title: string; caption?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-3 px-0.5">
      <div>
        <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
        {caption && <p className="text-[11px] text-muted-foreground mt-0.5">{caption}</p>}
      </div>
      {href && (
        <Link to={href} className="tap inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
          Ver tudo <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function ExploreRow({ to, emoji, title, hint }: { to: string; emoji: string; title: string; hint: string }) {
  return (
    <Link to={to} className="tap glass rounded-2xl p-4 flex items-center gap-3.5">
      <div className="h-10 w-10 rounded-xl bg-white/[0.04] ring-hair flex items-center justify-center text-lg">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium tracking-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function RecoveryCard() {
  const { data: habits } = useQuery({
    queryKey: ["bad_habits", "dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("bad_habits").select("id,name,icon,color,started_at,best_streak_seconds").is("archived_at", null);
      return data ?? [];
    },
  });
  const now = Date.now();
  const list = habits ?? [];
  const top = list
    .map((h: any) => ({ ...h, sec: Math.max(0, Math.floor((now - new Date(h.started_at).getTime()) / 1000)) }))
    .sort((a: any, b: any) => b.sec - a.sec)[0];
  return (
    <section className="mb-8 animate-rise delay-2">
      <Link to="/recuperacao" className="tap block glass-strong rounded-3xl p-4 shadow-elegant overflow-hidden relative">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-2xl" />
        <div className="flex items-center gap-3 relative">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: top ? `${top.color}22` : "rgba(239,68,68,0.15)" }}>
            {top?.icon ?? "🛡️"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Recuperação</p>
            {top ? (
              <>
                <p className="text-sm font-semibold truncate">{top.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.floor(top.sec / 86400)}d {Math.floor((top.sec % 86400) / 3600)}h limpo · {list.length} vício{list.length > 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Comece a se libertar</p>
                <p className="text-xs text-muted-foreground">Adicione o primeiro vício a vencer</p>
              </>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    </section>
  );
}
