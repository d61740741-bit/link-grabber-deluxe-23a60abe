import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { progressToNext } from "@/lib/ascension";
import { Flame, Zap, Check, ChevronRight, Sparkles, Sunrise, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { StatsSheetsProvider, useStatsSheet } from "@/components/dashboard/StatsSheets";
import { LifeScoreCard } from "@/components/dashboard/LifeScoreCard";
import { BossCard } from "@/components/dashboard/BossCard";
import { SectionTitle } from "@/components/dashboard/ui";
import {
  DaySummaryCard, MissionsCard, HabitsCard, TrainingCards,
  HealthCards, LibraryCards, FinanceCard, RecoveryCard, SkillsCard,
} from "@/components/dashboard/DashboardSections";
import { useDashboardRealtime } from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <StatsSheetsProvider>
      <Dashboard />
    </StatsSheetsProvider>
  ),
  head: () => ({
    meta: [
      { title: "Dashboard · Sua jornada de evolução" },
      { name: "description", content: "Resumo diário de missões, hábitos, treinos, saúde, leitura, finanças e recuperação em tempo real." },
      { property: "og:title", content: "Dashboard · Sua jornada de evolução" },
      { property: "og:description", content: "Acompanhe XP, Life Score, hábitos, treinos, saúde e finanças em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

  useDashboardRealtime();

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

  const { data: xpToday } = useQuery({
    queryKey: ["xp", "today", today],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("xp_history").select("amount").gte("created_at", start.toISOString());
      return (data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    },
  });

  const { data: doneToday } = useQuery({
    queryKey: ["tasks", "done-today", today],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("tasks").select("*", { count: "exact", head: true })
        .eq("completed", true).gte("completed_at", start.toISOString());
      return count ?? 0;
    },
  });

  const { data: xpRange } = useQuery({
    queryKey: ["xp", "range"],
    queryFn: async () => {
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now); monthStart.setDate(now.getDate() - 29); monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("xp_history").select("amount, created_at").gte("created_at", monthStart.toISOString());
      const rows = data ?? [];
      return {
        week: rows.filter((r: any) => new Date(r.created_at) >= weekStart).reduce((s: number, r: any) => s + r.amount, 0),
        month: rows.reduce((s: number, r: any) => s + r.amount, 0),
      };
    },
  });

  const prog = progressToNext(profile?.total_xp ?? 0, profile?.level ?? 1);
  const first = (profile?.full_name || profile?.username || "Você").split(" ")[0];
  const { text: hello, Icon: HelloIcon } = useMemo(greeting, []);

  async function completeTask(id: string, xp: number) {
    await supabase.from("tasks").update({ completed: true }).eq("id", id);
    toast.success(`+${xp} XP`, { description: "Missão concluída." });
    qc.invalidateQueries();
  }

  return (
    <div className="relative px-5 pt-10 pb-10 safe-top">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-electric/15 blur-[100px]" />

      {/* Header */}
      <header className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-7 animate-rise">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HelloIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <p className="text-[11px] uppercase tracking-[0.22em] font-medium truncate">{hello}</p>
          </div>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight truncate">{first}.</h1>
        </div>
        <Link to="/perfil" className="tap shrink-0">
          <div className="relative h-11 w-11 rounded-2xl overflow-hidden ring-hair">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Seu avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-electric/80 to-primary/20 flex items-center justify-center text-primary-foreground font-semibold text-base">
                {(profile?.full_name || profile?.username || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </Link>
      </header>

      {/* Nível */}
      <section className="relative glass-strong rounded-[28px] p-5 mb-4 overflow-hidden shadow-elegant animate-rise delay-1">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-electric/25 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <button onClick={() => open("level")} className="tap rounded-full" aria-label="Ver progressão de nível">
            <LevelRing level={profile?.level ?? 1} pct={prog.pct} />
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={() => open("level")} className="tap block text-left w-full">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Ascensão</p>
              <p className="mt-1 text-[15px] font-semibold text-foreground/90">
                {prog.current.toLocaleString("pt-BR")} <span className="text-muted-foreground font-normal">/ {prog.needed.toLocaleString("pt-BR")} XP</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Faltam {(prog.needed - prog.current).toLocaleString("pt-BR")} XP para o nível {(profile?.level ?? 1) + 1}
              </p>
            </button>
            <button
              onClick={() => open("totalXp")}
              className="tap mt-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-white/[0.06] ring-hair hover:bg-white/[0.1] transition"
            >
              <Sparkles className="h-3 w-3 text-electric" />
              {(profile?.total_xp ?? 0).toLocaleString("pt-BR")} XP total
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 mb-4 animate-rise delay-2">
        <MetricCard onClick={() => open("streak")} label="Sequência" value={`${profile?.streak_days ?? 0}`} suffix="d" Icon={Flame} tint="text-orange-300" glow="from-orange-500/15" />
        <MetricCard onClick={() => open("xpToday")} label="XP hoje" value={`${xpToday ?? 0}`} Icon={Zap} tint="text-electric" glow="from-electric/20" />
        <MetricCard onClick={() => open("completed")} label="Concluídas" value={`${doneToday ?? 0}`} Icon={Check} tint="text-emerald-300" glow="from-emerald-500/15" />
      </section>

      <section className="grid grid-cols-2 gap-3 mb-7 animate-rise delay-2">
        <RangeCard onClick={() => open("week")} label="Esta semana" value={xpRange?.week ?? 0} glow="from-electric/15" />
        <RangeCard onClick={() => open("month")} label="Este mês" value={xpRange?.month ?? 0} glow="from-gold/15" />
      </section>

      {/* Resumo do dia */}
      <div className="mb-7">
        <SectionTitle title="Resumo do dia" caption="Tudo em tempo real" />
        <div className="space-y-4">
          <DaySummaryCard xpToday={xpToday ?? 0} streak={profile?.streak_days ?? 0} />
          <LifeScoreCard />
          <BossCard />
        </div>
      </div>

      {/* Rotina */}
      <div className="mb-7">
        <SectionTitle title="Rotina" caption="Missões e hábitos" href="/missoes" />
        <div className="space-y-4">
          <MissionsCard onComplete={completeTask} />
          <HabitsCard />
        </div>
      </div>

      {/* Corpo */}
      <div className="mb-7">
        <SectionTitle title="Corpo" caption="Treinos, cardio e saúde" href="/saude" />
        <div className="space-y-4">
          <TrainingCards />
          <HealthCards />
        </div>
      </div>

      {/* Mente */}
      <div className="mb-7">
        <SectionTitle title="Mente" caption="Leitura e biblioteca" href="/biblioteca" />
        <LibraryCards />
      </div>

      {/* Vida */}
      <div className="mb-7">
        <SectionTitle title="Vida" caption="Finanças e recuperação" />
        <div className="space-y-4">
          <FinanceCard />
          <RecoveryCard />
        </div>
      </div>

      {/* Skills */}
      <div className="mb-7">
        <SectionTitle title="Skills" caption="Evolução por área" href="/habilidades" />
        <SkillsCard skills={skills ?? []} />
      </div>

      {/* Explorar */}
      <div className="mb-10">
        <SectionTitle title="Explorar" caption="Áreas da sua jornada" />
        <div className="space-y-2">
          <ExploreRow to="/coach" emoji="✨" title="Coach IA" hint="Seu mentor pessoal, 24/7" />
          <ExploreRow to="/calendario" emoji="🗓️" title="Calendário" hint="Sua jornada, dia a dia" />
          <ExploreRow to="/aprender" emoji="📚" title="Aprender" hint="Estudos e leitura" />
          <ExploreRow to="/treinos" emoji="💪" title="Treinos" hint="Exercícios, séries, calorias" />
          <ExploreRow to="/conquistas" emoji="🏆" title="Conquistas" hint="Marcos desbloqueados" />
          <ExploreRow to="/titulos" emoji="🎖️" title="Títulos" hint="Sua identidade forjada" />
          <ExploreRow to="/inventario" emoji="🎁" title="Inventário" hint="Badges, medalhas, boosts" />
          <ExploreRow to="/linha-do-tempo" emoji="🕰️" title="Linha do tempo" hint="Marcos da sua história" />
          <ExploreRow to="/estatisticas" emoji="📊" title="Estatísticas" hint="Evolução ao longo do tempo" />
        </div>
      </div>
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
    <button onClick={onClick} className="tap relative glass rounded-2xl p-3.5 overflow-hidden text-left active:scale-[0.97] transition">
      <div className={`absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl`} />
      <div className="relative flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${tint}`} strokeWidth={2.2} />
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium truncate">{label}</span>
      </div>
      <div className="relative mt-2 flex items-baseline gap-0.5">
        <span className="text-[22px] font-semibold tracking-tight">{value}</span>
        {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </button>
  );
}

function RangeCard({ label, value, glow, onClick }: { label: string; value: number; glow: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="tap relative glass rounded-2xl p-4 overflow-hidden text-left active:scale-[0.98] transition">
      <div className={`absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl`} />
      <p className="relative text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">{label}</p>
      <p className="relative mt-1.5 text-[22px] font-semibold tracking-tight">
        {value.toLocaleString("pt-BR")} <span className="text-[11px] text-muted-foreground font-normal">XP</span>
      </p>
    </button>
  );
}

function ExploreRow({ to, emoji, title, hint }: { to: string; emoji: string; title: string; hint: string }) {
  return (
    <Link to={to} className="tap glass rounded-2xl p-4 flex items-center gap-3.5">
      <div className="h-10 w-10 rounded-xl bg-white/[0.04] ring-hair flex items-center justify-center text-lg shrink-0">{emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium tracking-tight truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
