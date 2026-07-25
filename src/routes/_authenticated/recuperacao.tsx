import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Flame, Trophy, RotateCcw, Archive, ArchiveRestore, Trash2, X,
  Sparkles, ChevronLeft, Target, CheckCircle2, Circle, Pencil,
} from "lucide-react";
import {
  cleanTimeFrom, formatFull, recoveryScore, scoreColor, DIFFICULTY_LABEL,
  PRIORITY_LABEL, HABIT_PRESETS, COLOR_CHOICES, ICON_CHOICES,
  RECOVERY_MISSION_TEMPLATES,
  type Difficulty, type Priority,
} from "@/lib/recovery";

export const Route = createFileRoute("/_authenticated/recuperacao")({
  component: RecoveryPage,
  head: () => ({
    meta: [
      { title: "Recuperação · Ascension" },
      { name: "description", content: "Vença seus vícios com contadores em tempo real, XP automático e conquistas de recuperação." },
      { property: "og:title", content: "Recuperação · Ascension" },
      { property: "og:description", content: "Módulo de recuperação de vícios integrado ao Ascension." },
    ],
  }),
});

type BadHabit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  difficulty: Difficulty;
  priority: Priority;
  motivation: string | null;
  goal_date: string | null;
  started_at: string;
  best_streak_seconds: number;
  total_clean_seconds: number;
  relapse_count: number;
  archived_at: string | null;
  created_at: string;
};

type Relapse = {
  id: string;
  bad_habit_id: string;
  relapsed_at: string;
  streak_seconds: number;
  note: string | null;
};

type Mission = {
  id: string;
  bad_habit_id: string | null;
  title: string;
  xp_reward: number;
  completed: boolean;
  completed_at: string | null;
  mission_date: string;
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function RecoveryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<BadHabit | null>(null);
  const [relapseFor, setRelapseFor] = useState<BadHabit | null>(null);
  const [detail, setDetail] = useState<BadHabit | null>(null);

  // Sync XP + achievements on mount
  useEffect(() => {
    supabase.rpc("bad_habit_sync_awards").then(({ error }) => {
      if (!error) qc.invalidateQueries();
    });
  }, [qc]);

  const { data: habits } = useQuery({
    queryKey: ["bad_habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bad_habits").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BadHabit[];
    },
  });

  const { data: relapses } = useQuery({
    queryKey: ["bad_habit_relapses"],
    queryFn: async () => {
      const { data } = await supabase.from("bad_habit_relapses").select("*").order("relapsed_at", { ascending: false }).limit(500);
      return (data ?? []) as Relapse[];
    },
  });

  const { data: missions } = useQuery({
    queryKey: ["recovery_missions", "today"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("recovery_missions").select("*").eq("mission_date", today).order("created_at");
      return (data ?? []) as Mission[];
    },
  });

  const active = (habits ?? []).filter((h) => !h.archived_at);
  const archived = (habits ?? []).filter((h) => h.archived_at);
  const list = tab === "active" ? active : archived;

  // Aggregate score for header
  const now = useNow(1000);
  const global = useMemo(() => {
    if (!active.length) return { score: 0, currentSec: 0, bestSec: 0, totalRelapses: 0 };
    let curSum = 0, best = 0, relapses = 0, totalClean = 0, ageDays = 0;
    for (const h of active) {
      const t = cleanTimeFrom(h.started_at, now);
      curSum += t.totalSeconds;
      best = Math.max(best, h.best_streak_seconds, t.totalSeconds);
      relapses += h.relapse_count;
      totalClean += h.total_clean_seconds + t.totalSeconds;
      ageDays += Math.max(1, (now.getTime() - new Date(h.created_at).getTime()) / 86400000);
    }
    const score = recoveryScore({
      currentStreakSec: curSum / active.length,
      bestStreakSec: best,
      relapseCount: relapses,
      totalCleanSec: totalClean,
      ageDays,
    });
    return { score, currentSec: curSum, bestSec: best, totalRelapses: relapses };
  }, [active, now]);

  const scoreColorInfo = scoreColor(global.score);

  async function generateMissions() {
    const today = new Date().toISOString().slice(0, 10);
    const existing = missions ?? [];
    if (existing.length >= 5) {
      toast.info("Missões de hoje já geradas");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const shuffled = [...RECOVERY_MISSION_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 5);
    await supabase.from("recovery_missions").insert(
      shuffled.map((m) => ({
        user_id: user.id, title: m.title, xp_reward: m.xp, mission_date: today,
      })),
    );
    qc.invalidateQueries({ queryKey: ["recovery_missions", "today"] });
    toast.success("Missões diárias geradas ✨");
  }

  async function toggleMission(m: Mission) {
    if (m.completed) return;
    await supabase.from("recovery_missions").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", m.id);
    await supabase.rpc("award_xp", { p_amount: m.xp_reward, p_source: "recovery_mission", p_skill: "disciplina" as any });
    toast.success(`+${m.xp_reward} XP`, { description: m.title });
    qc.invalidateQueries();
  }

  async function toggleArchive(h: BadHabit) {
    await supabase.from("bad_habits").update({ archived_at: h.archived_at ? null : new Date().toISOString() }).eq("id", h.id);
    qc.invalidateQueries({ queryKey: ["bad_habits"] });
    toast.success(h.archived_at ? "Restaurado" : "Arquivado");
  }

  async function remove(h: BadHabit) {
    if (!confirm(`Excluir "${h.name}"? Esta ação não afeta XP, missões ou outras conquistas.`)) return;
    await supabase.from("bad_habits").delete().eq("id", h.id);
    qc.invalidateQueries();
    toast.info("Vício removido");
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-4">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Início
        </Link>
        <button onClick={() => { setEditing(null); setOpenNew(true); }} className="glass-strong rounded-full p-2.5 shadow-elegant">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Recuperação</h1>
        <p className="text-sm text-muted-foreground">Vença cada vício, um dia de cada vez.</p>
      </div>

      {/* Recovery Score */}
      <div className="glass-strong rounded-3xl shadow-elegant p-5 mt-4 flex items-center gap-4">
        <ScoreRing score={global.score} color={scoreColorInfo.hex} />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Recovery Score</div>
          <div className={`text-2xl font-bold ${scoreColorInfo.className}`}>{global.score}/100</div>
          <div className="text-xs text-muted-foreground">{scoreColorInfo.name}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
            <Stat label="Vícios" value={active.length} />
            <Stat label="Recaídas" value={global.totalRelapses} />
            <Stat label="Melhor" value={`${Math.floor(global.bestSec / 86400)}d`} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 p-1 glass rounded-2xl">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm rounded-xl transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t === "active" ? `Ativos (${active.length})` : `Arquivados (${archived.length})`}
          </button>
        ))}
      </div>

      {/* Habits list */}
      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            {tab === "active" ? "Adicione o primeiro vício que quer vencer." : "Nenhum arquivado."}
          </div>
        )}
        {list.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            now={now}
            onRelapse={() => setRelapseFor(h)}
            onEdit={() => { setEditing(h); setOpenNew(true); }}
            onArchive={() => toggleArchive(h)}
            onDelete={() => remove(h)}
            onOpen={() => setDetail(h)}
          />
        ))}
      </div>

      {/* Daily missions */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Missões de recuperação</h2>
          <button onClick={generateMissions} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Gerar
          </button>
        </div>
        <div className="space-y-2">
          {(missions ?? []).length === 0 && (
            <div className="glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
              Toque em Gerar para receber missões de hoje.
            </div>
          )}
          {(missions ?? []).map((m) => (
            <button
              key={m.id}
              onClick={() => toggleMission(m)}
              className="w-full glass rounded-2xl p-3 flex items-center gap-3 text-left"
            >
              {m.completed
                ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
              <div className={`flex-1 text-sm ${m.completed ? "line-through text-muted-foreground" : ""}`}>{m.title}</div>
              <div className="text-xs font-semibold text-electric">+{m.xp_reward}</div>
            </button>
          ))}
        </div>
      </div>

      {openNew && (
        <HabitForm
          initial={editing}
          onClose={() => { setOpenNew(false); setEditing(null); }}
          onSaved={() => { setOpenNew(false); setEditing(null); qc.invalidateQueries({ queryKey: ["bad_habits"] }); }}
        />
      )}
      {relapseFor && (
        <RelapseSheet
          habit={relapseFor}
          onClose={() => setRelapseFor(null)}
          onDone={() => { setRelapseFor(null); qc.invalidateQueries(); }}
        />
      )}
      {detail && (
        <HabitDetail
          habit={detail}
          relapses={(relapses ?? []).filter((r) => r.bad_habit_id === detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="glass rounded-xl px-2 py-1.5 text-center">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dasharray 500ms ease" }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20" fontWeight="700">{score}</text>
    </svg>
  );
}

function HabitCard({
  habit, now, onRelapse, onEdit, onArchive, onDelete, onOpen,
}: {
  habit: BadHabit; now: Date;
  onRelapse: () => void; onEdit: () => void; onArchive: () => void; onDelete: () => void; onOpen: () => void;
}) {
  const t = cleanTimeFrom(habit.started_at, now);
  const bestDays = Math.floor(habit.best_streak_seconds / 86400);
  const isNewBest = t.totalSeconds > habit.best_streak_seconds;
  return (
    <div className="glass-strong rounded-3xl shadow-elegant overflow-hidden">
      <button onClick={onOpen} className="w-full text-left p-4 flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: `${habit.color}22`, boxShadow: `0 0 24px ${habit.color}33` }}
        >
          {habit.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{habit.name}</h3>
            {isNewBest && t.totalSeconds > 60 && <Trophy className="h-3.5 w-3.5 text-gold" />}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-2">
            <span>{DIFFICULTY_LABEL[habit.difficulty]}</span>
            <span>·</span>
            <span>Melhor: {bestDays}d</span>
            <span>·</span>
            <span>Recaídas: {habit.relapse_count}</span>
          </div>
          <div className="mt-3 font-mono text-lg tabular-nums" style={{ color: habit.color }}>
            {formatFull(t)}
          </div>
          {habit.motivation && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 italic">"{habit.motivation}"</p>
          )}
        </div>
      </button>
      <div className="px-3 pb-3 flex items-center gap-2">
        <button
          onClick={onRelapse}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-medium text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20"
        >
          <RotateCcw className="h-4 w-4" /> Recaí
        </button>
        <button onClick={onEdit} className="p-2.5 rounded-2xl glass" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
        <button onClick={onArchive} className="p-2.5 rounded-2xl glass" aria-label="Arquivar">
          {habit.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
        <button onClick={onDelete} className="p-2.5 rounded-2xl glass text-red-300" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-background border-t sm:border sm:rounded-3xl rounded-t-3xl shadow-elegant max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
      >
        <button onClick={onClose} className="absolute right-3 top-3 p-1.5 rounded-full glass"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}

function HabitForm({ initial, onClose, onSaved }: { initial: BadHabit | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🚫");
  const [color, setColor] = useState(initial?.color ?? "#ef4444");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "medium");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [motivation, setMotivation] = useState(initial?.motivation ?? "");
  const [goalDate, setGoalDate] = useState(initial?.goal_date ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error("Dê um nome"); return; }
    setSaving(true);
    const payload = {
      name: name.trim(), icon, color, difficulty, priority,
      motivation: motivation.trim() || null,
      goal_date: goalDate || null,
    };
    if (initial) {
      const { error } = await supabase.from("bad_habits").update(payload).eq("id", initial.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("bad_habits").insert({ ...payload, user_id: user.id });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Contador iniciado 🚀");
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-5 pt-6">
        <h2 className="text-lg font-semibold">{initial ? "Editar vício" : "Novo vício"}</h2>
        <p className="text-xs text-muted-foreground mb-4">O contador inicia automaticamente.</p>

        {!initial && (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-1.5">Sugestões</div>
            <div className="flex flex-wrap gap-1.5">
              {HABIT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setName(p.name); setIcon(p.icon); setColor(p.color); }}
                  className="glass rounded-full px-3 py-1 text-xs flex items-center gap-1"
                >
                  <span>{p.icon}</span>{p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="text-xs text-muted-foreground">Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Cigarro"
          className="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-background border border-input outline-none focus:ring-2 focus:ring-primary/40"
        />

        <label className="text-xs text-muted-foreground">Ícone</label>
        <div className="mt-1 mb-3 flex flex-wrap gap-1.5">
          {ICON_CHOICES.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={`h-9 w-9 rounded-xl text-lg flex items-center justify-center ${icon === i ? "ring-2 ring-primary" : "glass"}`}
            >{i}</button>
          ))}
        </div>

        <label className="text-xs text-muted-foreground">Cor</label>
        <div className="mt-1 mb-3 flex flex-wrap gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full ${color === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">Dificuldade</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-input">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prioridade</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-input">
              {(["low", "medium", "high"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
        </div>

        <label className="text-xs text-muted-foreground">Motivação pessoal</label>
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="Por que você quer largar?"
          rows={3}
          className="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-background border border-input outline-none focus:ring-2 focus:ring-primary/40"
        />

        <label className="text-xs text-muted-foreground">Data-meta (opcional)</label>
        <input
          type="date"
          value={goalDate ?? ""}
          onChange={(e) => setGoalDate(e.target.value)}
          className="w-full mt-1 mb-4 px-3 py-2.5 rounded-xl bg-background border border-input"
        />

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-medium shadow-elegant disabled:opacity-50"
        >
          {saving ? "Salvando..." : initial ? "Salvar" : "Iniciar contador"}
        </button>
      </div>
    </Modal>
  );
}

function RelapseSheet({ habit, onClose, onDone }: { habit: BadHabit; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const t = cleanTimeFrom(habit.started_at);
  async function submit() {
    setSaving(true);
    const { error } = await supabase.rpc("bad_habit_relapse", { p_id: habit.id, p_note: note });
    if (error) { toast.error(error.message); setSaving(false); return; }
    // re-sync awards after reset
    await supabase.rpc("bad_habit_sync_awards");
    toast("Registrado. Recomeço agora.", { description: `Você durou ${Math.floor(t.totalSeconds / 86400)}d ${t.hours}h — isso já é sua nova base.` });
    onDone();
  }
  return (
    <Modal onClose={onClose}>
      <div className="p-5 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold">Registrar recaída</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{habit.name} · {formatFull(t)}</p>
        <label className="text-xs text-muted-foreground">O que aconteceu? (opcional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Anote gatilho, sentimento, contexto..."
          className="w-full mt-1 mb-4 px-3 py-2.5 rounded-xl bg-background border border-input outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl glass">Cancelar</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-medium disabled:opacity-50">
            {saving ? "..." : "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function HabitDetail({ habit, relapses, onClose }: { habit: BadHabit; relapses: Relapse[]; onClose: () => void }) {
  const now = useNow(1000);
  const t = cleanTimeFrom(habit.started_at, now);
  const totalDays = Math.floor((habit.total_clean_seconds + t.totalSeconds) / 86400);
  const avg = relapses.length ? Math.floor(relapses.reduce((s, r) => s + r.streak_seconds, 0) / relapses.length / 86400) : totalDays;
  const score = recoveryScore({
    currentStreakSec: t.totalSeconds,
    bestStreakSec: Math.max(habit.best_streak_seconds, t.totalSeconds),
    relapseCount: habit.relapse_count,
    totalCleanSec: habit.total_clean_seconds,
    ageDays: Math.max(1, (now.getTime() - new Date(habit.created_at).getTime()) / 86400000),
  });
  const info = scoreColor(score);
  return (
    <Modal onClose={onClose}>
      <div className="p-5 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${habit.color}22` }}>{habit.icon}</div>
          <div>
            <h2 className="text-lg font-semibold">{habit.name}</h2>
            <div className="text-xs text-muted-foreground">{DIFFICULTY_LABEL[habit.difficulty]} · {PRIORITY_LABEL[habit.priority]}</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center gap-4 mb-3">
          <ScoreRing score={score} color={info.hex} />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Score</div>
            <div className={`text-xl font-bold ${info.className}`}>{score}/100</div>
            <div className="font-mono text-sm mt-1" style={{ color: habit.color }}>{formatFull(t)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Stat label="Melhor" value={`${Math.floor(Math.max(habit.best_streak_seconds, t.totalSeconds) / 86400)}d`} />
          <Stat label="Média" value={`${avg}d`} />
          <Stat label="Recaídas" value={habit.relapse_count} />
          <Stat label="Total limpo" value={`${totalDays}d`} />
        </div>

        {habit.motivation && (
          <div className="glass rounded-2xl p-3 text-sm italic text-muted-foreground mb-3">"{habit.motivation}"</div>
        )}

        <h3 className="text-sm font-semibold mb-2">Histórico de recaídas</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {relapses.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma recaída registrada. 💪</div>}
          {relapses.map((r) => (
            <div key={r.id} className="glass rounded-xl p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{new Date(r.relapsed_at).toLocaleString()}</div>
                <div className="text-xs">{Math.floor(r.streak_seconds / 86400)}d</div>
              </div>
              {r.note && <div className="mt-1 text-xs text-muted-foreground">{r.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
