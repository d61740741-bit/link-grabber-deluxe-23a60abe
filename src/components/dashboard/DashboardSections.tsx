import { Link } from "@tanstack/react-router";
import {
  Target, Repeat, Dumbbell, HeartPulse, Droplets, Moon, Scale, Smile,
  BookOpen, Library, Wallet, ShieldCheck, Sparkles, Flame, Clock, TrendingUp, TrendingDown,
} from "lucide-react";
import { DashCard, CardHead, Stat, Bar, Ring, Empty } from "./ui";
import {
  useMissionsSummary, useHabitsSummary, useWorkoutsSummary,
  useLibrarySummary, useFinanceSummary, useRecoverySummary,
} from "@/lib/dashboard";
import {
  useHealthGoals, useHealthLogs, useTodayLog, avg, inLastDays, weightStats,
  moodStreak, sleepQualityLabel, MOOD_FACES, type HealthLog,
} from "@/lib/health";
import { brl } from "@/lib/finance";
import { skillLabels, progressToNextSkill } from "@/lib/ascension";

/* ---------- Resumo do dia ---------- */

export function DaySummaryCard({ xpToday, streak }: { xpToday: number; streak: number }) {
  const { data: m } = useMissionsSummary();
  const { data: h } = useHabitsSummary();
  const { data: today } = useTodayLog();
  const { data: goals } = useHealthGoals();
  const { data: w } = useWorkoutsSummary();

  const waterPct = Math.min(100, Math.round(((today?.water_ml ?? 0) / Math.max(1, goals?.water_ml_goal ?? 2500)) * 100));
  const missionPct = m ? Math.round((m.doneToday / Math.max(1, m.doneToday + m.pendingToday)) * 100) : 0;
  const habitPct = h?.total ? Math.round((h.doneToday / h.total) * 100) : 0;
  const trained = (w?.weekCount ?? 0) > 0;
  const overall = Math.round((waterPct + missionPct + habitPct) / 3);

  return (
    <DashCard className="glass-strong rounded-[28px]" delay={0}>
      <div className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-electric/15 blur-3xl" />
      <CardHead Icon={Sparkles} label="Resumo do dia" />
      <div className="relative flex items-center gap-5">
        <Ring id="dayRing" pct={overall} size={84} stroke={7}>
          <span className="text-[22px] font-semibold tracking-tight leading-none">{overall}%</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Hoje</span>
        </Ring>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1 min-w-0">
          <Stat label="XP hoje" value={xpToday} tint="text-electric" />
          <Stat label="Sequência" value={streak} suffix="d" tint="text-orange-300" />
          <Stat label="Missões" value={`${m?.doneToday ?? 0}/${(m?.doneToday ?? 0) + (m?.pendingToday ?? 0)}`} />
          <Stat label="Hábitos" value={`${h?.doneToday ?? 0}/${h?.total ?? 0}`} />
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        <Chip ok={waterPct >= 100} label={`Água ${waterPct}%`} />
        <Chip ok={(today?.sleep_hours ?? 0) > 0} label={today?.sleep_hours ? `Sono ${today.sleep_hours}h` : "Sono —"} />
        <Chip ok={!!today?.mood} label={today?.mood ? `Humor ${MOOD_FACES[today.mood - 1]}` : "Humor —"} />
        <Chip ok={trained} label={trained ? `Treino ${w?.weekCount}x/sem` : "Sem treino"} />
      </div>
    </DashCard>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ring-hair ${ok ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.05] text-muted-foreground"}`}>
      {label}
    </span>
  );
}

/* ---------- Missões ---------- */

export function MissionsCard({ onComplete }: { onComplete: (id: string, xp: number) => void }) {
  const { data } = useMissionsSummary();
  const list = data?.today ?? [];
  return (
    <DashCard delay={1}>
      <CardHead Icon={Target} label="Missões" value={`${data?.pendingToday ?? 0} pendentes`} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Hoje" value={data?.doneToday ?? 0} hint="concluídas" tint="text-emerald-300" />
        <Stat label="Semana" value={data?.weekDone ?? 0} hint="concluídas" />
        <Stat label="Atrasadas" value={data?.overdue ?? 0} tint={(data?.overdue ?? 0) > 0 ? "text-rose-300" : undefined} />
      </div>
      {list.length === 0 ? (
        <Empty text="Nenhuma missão pendente para hoje." />
      ) : (
        <div className="space-y-1.5">
          {list.map((t: any) => (
            <button
              key={t.id}
              onClick={() => onComplete(t.id, t.xp_reward)}
              className="tap w-full flex items-center gap-3 rounded-2xl bg-white/[0.03] ring-hair px-3 py-2.5 text-left hover:bg-white/[0.06] transition"
            >
              <span className="h-5 w-5 shrink-0 rounded-full ring-hair flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{t.title}</span>
              <span className="shrink-0 text-[10px] font-semibold text-electric">+{t.xp_reward} XP</span>
            </button>
          ))}
        </div>
      )}
      <Link to="/missoes" className="tap mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition">
        Abrir missões
      </Link>
    </DashCard>
  );
}

/* ---------- Hábitos ---------- */

export function HabitsCard() {
  const { data } = useHabitsSummary();
  const pct = data?.total ? Math.round((data.doneToday / data.total) * 100) : 0;
  return (
    <DashCard delay={2} href="/missoes">
      <CardHead Icon={Repeat} label="Hábitos" value={`${data?.doneToday ?? 0}/${data?.total ?? 0}`} href="/missoes" />
      <Bar pct={pct} className="from-emerald-400 to-emerald-500" />
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Feitos hoje" value={data?.doneToday ?? 0} tint="text-emerald-300" />
        <Stat label="Ativos" value={data?.total ?? 0} />
        <Stat label="Melhor seq." value={data?.bestStreak ?? 0} suffix="d" tint="text-orange-300" />
      </div>
      {(data?.rows ?? []).length > 0 && (
        <div className="mt-4 space-y-1.5">
          {(data?.rows ?? []).slice(0, 3).map((h: any) => (
            <div key={h.id} className="flex items-center gap-2 text-[12px]">
              <Flame className="h-3.5 w-3.5 text-orange-300 shrink-0" />
              <span className="truncate flex-1">{h.title}</span>
              <span className="text-muted-foreground shrink-0">{h.streak}d</span>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}

/* ---------- Treinos + Cardio ---------- */

export function TrainingCards() {
  const { data } = useWorkoutsSummary();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <DashCard delay={3} href="/treinos">
        <CardHead Icon={Dumbbell} label="Treinos" value="7 dias" href="/treinos" />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sessões" value={data?.weekCount ?? 0} />
          <Stat label="Minutos" value={data?.weekMinutes ?? 0} />
          <Stat label="Kcal" value={data?.weekCalories ?? 0} tint="text-orange-300" />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground truncate">
          {data?.last ? `Último: ${data.last.workout_type} · ${data.last.duration_min} min` : "Nenhum treino registrado"}
        </p>
      </DashCard>

      <DashCard delay={3} href="/treinos">
        <CardHead Icon={HeartPulse} label="Cardio" value="7 dias" href="/treinos" />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sessões" value={data?.cardioCount ?? 0} tint="text-rose-300" />
          <Stat label="Minutos" value={data?.cardioMinutes ?? 0} />
          <Stat label="Kcal" value={data?.cardioCalories ?? 0} tint="text-orange-300" />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground truncate">
          Força: {data?.strengthCount ?? 0} sessões · {data?.strengthMinutes ?? 0} min
        </p>
      </DashCard>
    </div>
  );
}

/* ---------- Saúde: água, sono, peso, humor ---------- */

export function HealthCards() {
  const { data: goals } = useHealthGoals();
  const { data: today } = useTodayLog();
  const { data: logs = [] } = useHealthLogs(120);

  const waterGoal = goals?.water_ml_goal ?? 2500;
  const water = today?.water_ml ?? 0;
  const waterPct = Math.min(100, Math.round((water / Math.max(1, waterGoal)) * 100));

  const last7 = inLastDays(logs as HealthLog[], 7);
  const sleepAvg = avg(last7.filter((l) => l.sleep_hours != null).map((l) => Number(l.sleep_hours)));
  const sleepGoal = Number(goals?.sleep_hours_goal ?? 8);

  const ws = weightStats(logs as HealthLog[]);
  const moodAvg = avg(last7.filter((l) => l.mood != null).map((l) => Number(l.mood)));
  const streak = moodStreak(logs as HealthLog[]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <DashCard delay={4} href="/saude">
        <CardHead Icon={Droplets} label="Água" tint="text-sky-400" href="/saude" />
        <div className="flex items-center gap-3">
          <Ring id="waterRing" pct={waterPct} size={56} stroke={5} from="oklch(0.8 0.13 230)" to="oklch(0.65 0.16 250)">
            <span className="text-[13px] font-semibold">{waterPct}%</span>
          </Ring>
          <div className="min-w-0">
            <Stat label="Hoje" value={`${(water / 1000).toFixed(1)}L`} hint={`meta ${(waterGoal / 1000).toFixed(1)}L`} />
          </div>
        </div>
      </DashCard>

      <DashCard delay={4} href="/saude">
        <CardHead Icon={Moon} label="Sono" tint="text-indigo-300" href="/saude" />
        <Stat label="Média 7d" value={sleepAvg ? sleepAvg.toFixed(1) : "—"} suffix={sleepAvg ? "h" : undefined} />
        <div className="mt-2"><Bar pct={(sleepAvg / Math.max(1, sleepGoal)) * 100} className="from-indigo-400 to-violet-500" /></div>
        <p className="mt-2 text-[10px] text-muted-foreground truncate">
          Ontem/hoje: {today?.sleep_hours ?? "—"}h · {sleepQualityLabel(today?.sleep_quality)}
        </p>
      </DashCard>

      <DashCard delay={5} href="/saude">
        <CardHead Icon={Scale} label="Peso" tint="text-emerald-300" href="/saude" />
        <Stat label="Atual" value={ws ? ws.current.toFixed(1) : "—"} suffix={ws ? "kg" : undefined} />
        {ws ? (
          <p className={`mt-2 inline-flex items-center gap-1 text-[11px] ${ws.diff <= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {ws.diff <= 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {ws.diff > 0 ? "+" : ""}{ws.diff} kg desde o início
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">Sem registros</p>
        )}
      </DashCard>

      <DashCard delay={5} href="/saude">
        <CardHead Icon={Smile} label="Humor" tint="text-amber-400" href="/saude" />
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{today?.mood ? MOOD_FACES[today.mood - 1] : "—"}</span>
          <div className="min-w-0">
            <Stat label="Média 7d" value={moodAvg ? moodAvg.toFixed(1) : "—"} hint={`${streak}d de registro`} />
          </div>
        </div>
      </DashCard>
    </div>
  );
}

/* ---------- Leitura + Biblioteca ---------- */

export function LibraryCards() {
  const { data } = useLibrarySummary();
  const cur = data?.current;
  const pct = cur ? Number(cur.progress ?? 0) : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <DashCard delay={6} href="/biblioteca">
        <CardHead Icon={BookOpen} label="Leitura" tint="text-amber-300" href="/biblioteca" />
        {cur ? (
          <>
            <p className="text-[14px] font-semibold truncate">{cur.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2 truncate">
              {cur.current_page && cur.total_pages ? `pág. ${cur.current_page}/${cur.total_pages}` : `${pct}% concluído`}
            </p>
            <Bar pct={pct} className="from-amber-400 to-orange-500" />
          </>
        ) : (
          <Empty text="Nada em leitura agora." />
        )}
      </DashCard>

      <DashCard delay={6} href="/biblioteca">
        <CardHead Icon={Library} label="Biblioteca" href="/biblioteca" />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Ativos" value={data?.reading ?? 0} />
          <Stat label="Concluídos" value={data?.completed ?? 0} tint="text-emerald-300" />
          <Stat label="Estudo" value={(data?.studyHours ?? 0).toFixed(1)} suffix="h" />
        </div>
        <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {data?.paused ?? 0} pausados · {data?.books ?? 0} livros
        </p>
      </DashCard>
    </div>
  );
}

/* ---------- Finanças ---------- */

export function FinanceCard() {
  const { data } = useFinanceSummary();
  const bal = data?.balance ?? 0;
  return (
    <DashCard delay={7} href="/financas">
      <CardHead Icon={Wallet} label="Finanças" value="mês atual" tint="text-gold" href="/financas" />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Receitas" value={brl(data?.income ?? 0)} tint="text-emerald-300" />
        <Stat label="Despesas" value={brl(data?.expense ?? 0)} tint="text-rose-300" />
        <Stat label="Saldo" value={brl(bal)} tint={bal >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground truncate">
        {data?.biggest ? `Maior gasto: ${data.biggest.description || data.biggest.category || "—"} · ${brl(Number(data.biggest.amount))}` : "Sem lançamentos neste mês"}
      </p>
    </DashCard>
  );
}

/* ---------- Recuperação ---------- */

export function RecoveryCard() {
  const { data } = useRecoverySummary();
  const top = data?.top;
  return (
    <DashCard delay={8} href="/recuperacao">
      <CardHead Icon={ShieldCheck} label="Recuperação" value={`${data?.total ?? 0} vícios`} tint="text-rose-300" href="/recuperacao" />
      {top ? (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${top.color}22` }}>
            {top.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold truncate">{top.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {Math.floor(top.seconds / 86400)}d {Math.floor((top.seconds % 86400) / 3600)}h limpo · {top.relapse_count} recaídas
            </p>
          </div>
          <Stat label="Dias limpos" value={data?.cleanDays ?? 0} tint="text-emerald-300" />
        </div>
      ) : (
        <Empty text="Adicione o primeiro vício a vencer." />
      )}
    </DashCard>
  );
}

/* ---------- Skills ---------- */

export function SkillsCard({ skills }: { skills: any[] }) {
  const rows = (skills ?? []).slice(0, 6);
  return (
    <DashCard delay={9}>
      <CardHead Icon={Sparkles} label="Skills" value={`${rows.length} áreas`} />
      {rows.length === 0 ? (
        <Empty text="Ganhe XP para evoluir suas skills." />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {rows.map((s: any) => {
            const meta = skillLabels[s.category] ?? { label: s.display_name ?? "Skill", emoji: s.icon ?? "⭐" };
            const sp = progressToNextSkill(s.total_xp ?? s.xp ?? 0, s.level);
            return (
              <Link key={s.id} to="/habilidades" className="tap min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{meta.emoji}</span>
                  <span className="text-[12px] font-medium truncate flex-1">{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">Lv {s.level}</span>
                </div>
                <div className="mt-2"><Bar pct={sp.pct} /></div>
              </Link>
            );
          })}
        </div>
      )}
    </DashCard>
  );
}
