import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Trophy, TrendingUp, Flame, CalendarDays, Target } from "lucide-react";
import { resolveSkill, skillLevelProgress, type SkillRow } from "@/lib/skills";
import { SkillFormSheet } from "./habilidades.index";

export const Route = createFileRoute("/_authenticated/habilidades/$id")({
  component: SkillDetail,
});

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function SkillDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: skill, isLoading } = useQuery({
    queryKey: ["skill", id],
    queryFn: async () => {
      const { data } = await supabase.from("skills").select("*").eq("id", id).maybeSingle();
      return (data as SkillRow) ?? null;
    },
  });

  const { data: xpHistory } = useQuery({
    enabled: !!skill,
    queryKey: ["skill-xp-history", id, skill?.category, skill?.is_custom],
    queryFn: async () => {
      let q = supabase.from("xp_history").select("*").order("created_at", { ascending: false }).limit(500);
      if (skill?.is_custom) q = q.eq("custom_skill_id", id);
      else if (skill?.category) q = q.eq("skill_category", skill.category as any);
      else return [] as any[];
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    enabled: !!skill,
    queryKey: ["skill-tasks", id, skill?.category, skill?.is_custom],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(200);
      if (skill?.is_custom) q = q.eq("custom_skill_id", id);
      else if (skill?.category) q = q.eq("skill_category", skill.category as any);
      else return [] as any[];
      const { data } = await q;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const hist = xpHistory ?? [];
    const totalXp = hist.reduce((s: number, r: any) => s + r.amount, 0);

    // Last 14 days sparkline
    const days: { label: string; date: string; xp: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, date: key, xp: 0 });
    }
    hist.forEach((r: any) => {
      const key = String(r.created_at).slice(0, 10);
      const d = days.find((x) => x.date === key);
      if (d) d.xp += r.amount;
    });
    const maxDay = Math.max(1, ...days.map((d) => d.xp));

    // Strongest / weakest weekday (avg XP per weekday over last 60 days)
    const wdSum: number[] = Array(7).fill(0);
    const wdDays: Set<string>[] = Array.from({ length: 7 }, () => new Set());
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    hist.forEach((r: any) => {
      const d = new Date(r.created_at);
      if (d < cutoff) return;
      const w = d.getDay();
      wdSum[w] += r.amount;
      wdDays[w].add(d.toISOString().slice(0, 10));
    });
    const wdAvg = wdSum.map((s, i) => (wdDays[i].size ? s / wdDays[i].size : 0));
    let strongestDay = 0, weakestDay = 0;
    for (let i = 1; i < 7; i++) {
      if (wdAvg[i] > wdAvg[strongestDay]) strongestDay = i;
      if (wdAvg[i] < wdAvg[weakestDay]) weakestDay = i;
    }
    const hasWeeklyData = wdSum.some((s) => s > 0);

    const completed = (tasks ?? []).filter((t: any) => t.completed);
    const pending = (tasks ?? []).filter((t: any) => !t.completed);

    return {
      totalXp,
      days,
      maxDay,
      strongestDay: hasWeeklyData ? WEEKDAYS_PT[strongestDay] : "—",
      weakestDay: hasWeeklyData ? WEEKDAYS_PT[weakestDay] : "—",
      completedCount: completed.length,
      pendingCount: pending.length,
      completed,
    };
  }, [xpHistory, tasks]);

  if (isLoading) {
    return (
      <div className="px-5 pt-8 safe-top">
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }
  if (!skill) {
    return (
      <div className="px-5 pt-8 safe-top">
        <Link to="/habilidades" className="text-sm text-electric flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="glass rounded-2xl p-8 text-center text-sm">Skill não encontrada.</div>
      </div>
    );
  }

  const identity = resolveSkill(skill);
  const total = stats.totalXp || skill.total_xp;
  const prog = skillLevelProgress(total);

  async function handleDelete() {
    if (!skill!.is_custom) {
      toast.error("Skills padrão não podem ser excluídas");
      return;
    }
    const { error } = await supabase.from("skills").delete().eq("id", skill!.id);
    if (error) return toast.error(error.message);
    toast.success("Skill excluída");
    qc.invalidateQueries();
    nav({ to: "/habilidades" });
  }

  return (
    <div className="px-5 pt-6 pb-24 safe-top animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <Link to="/habilidades" className="glass h-10 w-10 rounded-xl flex items-center justify-center hover:scale-105 transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="glass h-10 w-10 rounded-xl flex items-center justify-center hover:scale-105 transition"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {skill.is_custom && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="glass h-10 w-10 rounded-xl flex items-center justify-center hover:scale-105 transition text-destructive"
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className={`relative rounded-3xl p-6 overflow-hidden bg-gradient-to-br ${identity.color} glass-strong animate-scale-in`}>
        <div className="flex items-start justify-between">
          <div>
            <span className="text-5xl">{identity.emoji}</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight">{identity.label}</h1>
            {skill.is_custom && (
              <span className="mt-1 inline-block text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground">
                Skill personalizada
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nível</p>
            <p className="text-6xl font-black gradient-text leading-none">{prog.level}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{prog.inLevel} / {prog.span} XP no nível</span>
            <span>{prog.remaining} p/ nv {prog.nextLevel}</span>
          </div>
          <div className="h-2 rounded-full bg-surface/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-electric to-gold transition-all duration-700"
              style={{ width: `${prog.pct}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <Trophy className="inline h-3 w-3 mr-1 text-gold" />
            Total acumulado: <span className="font-bold text-foreground">{total.toLocaleString("pt-BR")} XP</span>
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <StatCard icon={<Target className="h-4 w-4 text-electric" />} label="Missões concluídas" value={String(stats.completedCount)} />
        <StatCard icon={<CalendarDays className="h-4 w-4 text-gold" />} label="Missões pendentes" value={String(stats.pendingCount)} />
        <StatCard icon={<Flame className="h-4 w-4 text-orange-400" />} label="Dia mais forte" value={stats.strongestDay} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-pink-400" />} label="Dia mais fraco" value={stats.weakestDay} />
      </div>

      {/* Sparkline */}
      <section className="mt-6 glass-strong rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Evolução — últimos 14 dias</p>
        </div>
        <div className="flex items-end gap-1 h-24">
          {stats.days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${d.xp > 0 ? "bg-gradient-to-t from-electric/60 to-electric" : "bg-surface/50"}`}
                style={{ height: `${(d.xp / stats.maxDay) * 100}%`, minHeight: "3px" }}
                title={`${d.label}: ${d.xp} XP`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[9px] text-muted-foreground">{stats.days[0].label}</span>
          <span className="text-[9px] text-muted-foreground">{stats.days[stats.days.length - 1].label}</span>
        </div>
      </section>

      {/* Next rewards */}
      <section className="mt-4 glass-strong rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Próximas recompensas</p>
        <div className="space-y-2">
          {[1, 2, 3].map((offset) => {
            const nl = prog.level + offset;
            const xpNeeded = Math.pow(nl - 1, 2) * 30 - total;
            return (
              <div key={nl} className="flex items-center justify-between glass rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gold/40 to-gold/5 flex items-center justify-center">
                    <span className="text-sm font-black gradient-gold-text">{nl}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Nível {nl}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {xpNeeded > 0 ? `Faltam ${xpNeeded.toLocaleString("pt-BR")} XP` : "Conquistado"}
                    </p>
                  </div>
                </div>
                <Trophy className={`h-4 w-4 ${xpNeeded > 0 ? "text-muted-foreground" : "text-gold"}`} />
              </div>
            );
          })}
        </div>
      </section>

      {/* XP history */}
      <section className="mt-4 glass-strong rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Histórico de XP</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {(xpHistory ?? []).slice(0, 60).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <p className="font-semibold truncate">{prettySource(r.source)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <span className={`font-black ${r.amount >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                {r.amount >= 0 ? "+" : ""}{r.amount} XP
              </span>
            </div>
          ))}
          {(xpHistory ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Ainda sem eventos de XP.</p>
          )}
        </div>
      </section>

      {/* Recent missions */}
      <section className="mt-4 glass-strong rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Missões desta skill</p>
        <div className="space-y-2">
          {(tasks ?? []).slice(0, 20).map((t: any) => (
            <div key={t.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${t.completed ? "bg-emerald-400" : "bg-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t.completed ? `+${t.xp_granted ?? t.xp_reward} XP` : `${t.xp_reward} XP pendente`}
                </p>
              </div>
            </div>
          ))}
          {(tasks ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma missão ligada a esta skill ainda.</p>
          )}
        </div>
      </section>

      {editing && (
        <SkillFormSheet
          mode="edit"
          skill={skill}
          onClose={() => setEditing(false)}
          onSaved={() => {
            qc.invalidateQueries();
            setEditing(false);
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in" onClick={() => setConfirmDelete(false)}>
          <div className="glass-strong rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black">Excluir esta skill?</h3>
            <p className="text-sm text-muted-foreground">
              O XP dela sai do total, mas as missões vinculadas permanecem (ficam sem skill).
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-2xl glass px-4 py-3 text-sm font-semibold">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 rounded-2xl bg-destructive text-destructive-foreground px-4 py-3 text-sm font-semibold">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span></div>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function prettySource(s: string) {
  switch (s) {
    case "task": return "Missão concluída";
    case "habit": return "Hábito diário";
    case "perfect_day": return "Dia perfeito";
    case "refund": return "Estorno";
    default: return s;
  }
}
