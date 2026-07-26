import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { skillLabels, categoryLabels } from "@/lib/ascension";
import { detectTask } from "@/lib/xp-calc";
import {
  analyzeMission, countdown, dueDateTime, DIFFICULTIES, difficultyMeta, ensureNotificationPermission,
  filterLabels, generateRecurringMissions, getMissionStats, matchesFilter, notify, priorityMeta,
  refreshMissionStates, repeatKindLabels, repeatRuleLabels, statusMeta, suggestedPenalty, todayISO,
  WEEKDAYS, type Difficulty, type MissionFilter, type Priority, type RepeatKind, type RepeatRule, type Status,
} from "@/lib/missions";
import {
  Plus, X, CheckCircle2, Circle, Trash2, Loader2, Sparkles, Play, Ban, Repeat, Pencil,
  CalendarDays, BarChart3, ListChecks, Bell, ChevronLeft, ChevronRight, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/missoes")({
  component: Missoes,
  head: () => ({
    meta: [
      { title: "Missões — Life OS RPG" },
      { name: "description", content: "Missões únicas, diárias, semanais, mensais e automáticas com XP inteligente, prazos, penalidades e estatísticas." },
      { property: "og:title", content: "Missões — Life OS RPG" },
      { property: "og:description", content: "Sistema completo de missões com dificuldade automática, recompensas, penalidades e calendário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const CATS = ["estudo", "treino", "leitura", "meditacao", "nutricao", "financas", "habito", "outro"] as const;
const SKILLS = ["mente", "corpo", "conhecimento", "financas", "disciplina", "social"] as const;
const FILTERS: MissionFilter[] = ["hoje", "amanha", "semana", "mes", "pendentes", "concluidas", "falhadas", "todas"];

function Missoes() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"lista" | "calendario" | "stats">("lista");
  const [filter, setFilter] = useState<MissionFilter>("hoje");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const { data: missions, refetch } = useQuery({
    queryKey: ["tasks", "missions"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({ queryKey: ["mission-stats"], queryFn: getMissionStats });

  // Gera recorrências do dia + atualiza status (atrasada/falhada com penalidade) na entrada.
  useEffect(() => {
    (async () => {
      try {
        await generateRecurringMissions();
        await refreshMissionStates();
        qc.invalidateQueries();
      } catch { /* noop */ }
    })();
  }, [qc]);

  const items = (missions ?? []).filter((m: any) => !m.is_template);
  const templates = (missions ?? []).filter((m: any) => m.is_template);
  const visible = items.filter((m: any) => matchesFilter(m, filter));

  // Lembretes
  useEffect(() => {
    ensureNotificationPermission();
  }, []);
  useEffect(() => {
    for (const m of items) {
      if (m.completed || m.reminder_minutes == null) continue;
      const due = dueDateTime(m);
      if (!due) continue;
      const fireAt = due.getTime() - m.reminder_minutes * 60000;
      if (now >= fireAt && now < due.getTime() && !notified.current.has(m.id)) {
        notified.current.add(m.id);
        notify(`Lembrete: ${m.title}`, `Prazo em ${m.reminder_minutes} min`);
        toast.info(`Lembrete: ${m.title}`, { description: `Prazo em ${m.reminder_minutes} min` });
      }
    }
  }, [now, items]);

  async function setStatus(m: any, status: Status) {
    const patch: any = { status };
    if (status === "concluida") {
      patch.completed = true;
    } else {
      patch.completed = false;
    }
    const { error } = await supabase.from("tasks").update(patch).eq("id", m.id);
    if (error) return toast.error("Não foi possível atualizar a missão");
    if (status === "concluida") {
      const { data } = await supabase.from("tasks").select("xp_granted").eq("id", m.id).single();
      toast.success(`+${Number((data as any)?.xp_granted) || 0} XP`, { description: "Missão concluída" });
    }
    qc.invalidateQueries();
    refetch();
  }

  async function remove(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    toast.info("Missão removida", { description: "XP recalculado" });
    qc.invalidateQueries();
  }

  return (
    <div className="px-5 pt-8 safe-top pb-10">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Life OS</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Missões</h1>
        </div>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant hover:scale-105 transition"
          aria-label="Nova missão"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="flex gap-2 mb-5">
        {([["lista", "Missões", ListChecks], ["calendario", "Calendário", CalendarDays], ["stats", "Estatísticas", BarChart3]] as const).map(
          ([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-2xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                tab === k ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ),
        )}
      </div>

      {tab === "lista" && (
        <>
          <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  filter === f ? "bg-electric/20 text-electric border border-electric/30" : "glass text-muted-foreground"
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>

          {templates.length > 0 && (
            <div className="glass-strong rounded-3xl p-4 mb-5 border border-electric/20">
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="h-4 w-4 text-electric" />
                <p className="text-xs uppercase tracking-widest font-bold">Missões automáticas</p>
              </div>
              <div className="space-y-2">
                {templates.map((t: any) => (
                  <div key={t.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {repeatKindLabels[t.repeat_kind as RepeatKind]} · {repeatRuleLabels[(t.repeat_rule || "every_day") as RepeatRule]}
                        {["every_x_days", "every_x_weeks", "every_x_months"].includes(t.repeat_rule) ? ` (${t.repeat_interval})` : ""}
                      </p>
                    </div>
                    <button onClick={() => { setEditing(t); setOpen(true); }} className="text-muted-foreground hover:text-electric" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive" aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {visible.length === 0 && (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma missão neste filtro.</p>
              </div>
            )}
            {visible.map((m: any) => (
              <MissionCard
                key={m.id}
                m={m}
                now={now}
                onComplete={() => setStatus(m, "concluida")}
                onStart={() => setStatus(m, "em_andamento")}
                onCancel={() => setStatus(m, "cancelada")}
                onReopen={() => setStatus(m, "pendente")}
                onEdit={() => { setEditing(m); setOpen(true); }}
                onRemove={() => remove(m.id)}
              />
            ))}
          </div>
        </>
      )}

      {tab === "calendario" && <MissionCalendar items={items} />}
      {tab === "stats" && <MissionStats stats={stats} items={items} />}

      {open && <MissionSheet mission={editing} onClose={() => { setOpen(false); setEditing(null); }} />}
    </div>
  );
}

function MissionCard({ m, now, onComplete, onStart, onCancel, onReopen, onEdit, onRemove }: any) {
  const cd = countdown(dueDateTime(m), now);
  const diff = difficultyMeta[(m.difficulty || "facil") as Difficulty];
  const st = statusMeta[(m.status || "pendente") as Status];
  const pr = priorityMeta[(m.priority || "normal") as Priority];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <button onClick={() => !m.completed && onComplete()} disabled={m.completed} className="mt-0.5" aria-label="Concluir">
          {m.completed ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${m.completed ? "line-through text-muted-foreground" : ""}`}>{m.title}</p>
          {m.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${diff.className}`}>{diff.icon} {diff.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.className}`}>{st.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${pr.className}`}>{pr.label}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{categoryLabels[m.category]}</span>
            {m.skill_category && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-electric/10 text-electric font-semibold">
                {skillLabels[m.skill_category]?.label}
              </span>
            )}
            <span className="text-[10px] font-bold text-gold">
              +{m.completed ? m.xp_granted || m.xp_reward : m.xp_reward} XP
            </span>
            {m.penalty_enabled && m.penalty_xp > 0 && (
              <span className="text-[10px] font-bold text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />-{m.penalty_xp} XP</span>
            )}
            {m.estimated_min ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{m.estimated_min}min</span>
            ) : null}
            {m.reminder_minutes != null && <Bell className="h-3 w-3 text-electric" />}
          </div>
          {cd && !m.completed && m.status !== "cancelada" && (
            <p className={`text-[11px] mt-2 font-semibold ${cd.late ? "text-red-400" : "text-muted-foreground"}`}>⏳ {cd.text}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {!m.completed && m.status === "pendente" && (
            <button onClick={onStart} className="text-muted-foreground hover:text-electric" aria-label="Iniciar"><Play className="h-4 w-4" /></button>
          )}
          {!m.completed && m.status !== "cancelada" && (
            <button onClick={onCancel} className="text-muted-foreground hover:text-orange-400" aria-label="Cancelar"><Ban className="h-4 w-4" /></button>
          )}
          {(m.completed || m.status === "cancelada" || m.status === "falhada") && (
            <button onClick={onReopen} className="text-muted-foreground hover:text-electric" aria-label="Reabrir"><Circle className="h-4 w-4" /></button>
          )}
          <button onClick={onEdit} className="text-muted-foreground hover:text-electric" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function MissionCalendar({ items }: { items: any[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [sel, setSel] = useState<string | null>(todayISO());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const m of items) if (m.due_date) (map[m.due_date] ||= []).push(m);
    return map;
  }, [items]);

  const cells: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-3xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="glass rounded-full p-2" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
          <p className="text-sm font-black uppercase tracking-widest">
            {first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="glass rounded-full p-2" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => <div key={d.v} className="text-center text-[10px] text-muted-foreground uppercase">{d.label}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e${i}`} />;
            const list = byDate[iso] ?? [];
            const done = list.filter((m) => m.completed).length;
            const failed = list.some((m) => m.status === "falhada");
            return (
              <button
                key={iso}
                onClick={() => setSel(iso)}
                className={`aspect-square rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 ${
                  sel === iso ? "bg-primary text-primary-foreground" : iso === todayISO() ? "glass border border-electric/40" : "glass"
                }`}
              >
                <span>{Number(iso.slice(-2))}</span>
                {list.length > 0 && (
                  <span className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-red-400" : done === list.length ? "bg-emerald-400" : "bg-gold"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {sel && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{new Date(`${sel}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "full" })}</p>
          {(byDate[sel] ?? []).length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">Sem missões neste dia.</div>}
          {(byDate[sel] ?? []).map((m) => (
            <div key={m.id} className="glass rounded-2xl p-3 flex items-center gap-3">
              <span className="text-sm">{difficultyMeta[(m.difficulty || "facil") as Difficulty].icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${m.completed ? "line-through text-muted-foreground" : ""}`}>{m.title}</p>
                <p className="text-[10px] text-muted-foreground">{statusMeta[(m.status || "pendente") as Status].label}{m.due_time ? ` · ${String(m.due_time).slice(0, 5)}` : ""}</p>
              </div>
              <span className="text-[10px] font-bold text-gold">+{m.xp_reward} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MissionStats({ stats, items }: { stats: any; items: any[] }) {
  const history = items
    .filter((m) => m.completed || m.status === "falhada")
    .sort((a, b) => String(b.completed_at || b.failed_at || "").localeCompare(String(a.completed_at || a.failed_at || "")))
    .slice(0, 40);
  const cards = [
    { label: "Concluídas", value: stats?.completed ?? 0, tone: "text-emerald-400" },
    { label: "Falhadas", value: stats?.failed ?? 0, tone: "text-red-400" },
    { label: "Taxa de sucesso", value: `${stats?.success_rate ?? 0}%`, tone: "text-electric" },
    { label: "Maior sequência", value: `${stats?.best_streak ?? 0}d`, tone: "text-gold" },
    { label: "XP por missões", value: stats?.xp_from_missions ?? 0, tone: "text-gold" },
    { label: "Tempo gasto", value: `${Math.round((stats?.time_spent_min ?? 0) / 60)}h`, tone: "text-foreground" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-black mt-1 ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="glass-strong rounded-3xl p-4">
        <p className="text-xs uppercase tracking-widest font-bold mb-3">Histórico completo</p>
        {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
        <div className="space-y-2">
          {history.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${m.completed ? "bg-emerald-400" : "bg-red-400"}`} />
              <p className="text-sm flex-1 min-w-0 truncate">{m.title}</p>
              <span className={`text-[11px] font-bold ${m.completed ? "text-gold" : "text-red-400"}`}>
                {m.completed ? `+${m.xp_granted || m.xp_reward}` : `-${m.penalty_enabled ? m.penalty_xp : 0}`} XP
              </span>
              <span className="text-[10px] text-muted-foreground w-20 text-right">
                {(m.completed_at || m.failed_at) ? new Date(m.completed_at || m.failed_at).toLocaleDateString("pt-BR") : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MissionSheet({ mission, onClose }: { mission: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(mission?.title ?? "");
  const [description, setDescription] = useState(mission?.description ?? "");
  const [category, setCategory] = useState<string>(mission?.category ?? "estudo");
  const [catTouched, setCatTouched] = useState(!!mission);
  const [skill, setSkill] = useState<string>(mission?.skill_category ?? "conhecimento");
  const [skillTouched, setSkillTouched] = useState(!!mission);
  const [customSkillId, setCustomSkillId] = useState<string | null>(mission?.custom_skill_id ?? null);
  const [estimated, setEstimated] = useState<string>(mission?.estimated_min ? String(mission.estimated_min) : "");
  const [startDate, setStartDate] = useState<string>(mission?.start_date ?? todayISO());
  const [dueDate, setDueDate] = useState<string>(mission?.due_date ?? todayISO());
  const [dueTime, setDueTime] = useState<string>(mission?.due_time ? String(mission.due_time).slice(0, 5) : "");
  const [priority, setPriority] = useState<Priority>((mission?.priority ?? "normal") as Priority);
  const [status, setStatus] = useState<Status>((mission?.status ?? "pendente") as Status);
  const [repeatKind, setRepeatKind] = useState<RepeatKind>((mission?.repeat_kind ?? "unica") as RepeatKind);
  const [repeatRule, setRepeatRule] = useState<RepeatRule>((mission?.repeat_rule ?? "every_day") as RepeatRule);
  const [interval, setInterval] = useState<string>(String(mission?.repeat_interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(mission?.repeat_weekdays ?? []);
  const [reminder, setReminder] = useState<string>(mission?.reminder_minutes != null ? String(mission.reminder_minutes) : "");
  const [penaltyOn, setPenaltyOn] = useState<boolean>(!!mission?.penalty_enabled);
  const [penaltyXp, setPenaltyXp] = useState<string>(mission?.penalty_xp ? String(mission.penalty_xp) : "");
  const [manualDiff, setManualDiff] = useState<Difficulty | null>(mission?.difficulty_locked ? (mission.difficulty as Difficulty) : null);
  const [saving, setSaving] = useState(false);

  const { data: customSkills } = useQuery({
    queryKey: ["skills-custom-list"],
    queryFn: async () => {
      const { data } = await supabase.from("skills").select("id, display_name, icon, color").eq("is_custom", true).order("created_at");
      return data ?? [];
    },
  });

  const detected = detectTask(title);
  const effectiveCategory = catTouched ? category : detected.category;
  const effectiveSkill = skillTouched ? skill : detected.skill;
  const analysis = analyzeMission({
    title,
    description,
    estimatedMin: estimated ? Number(estimated) : null,
    category: effectiveCategory,
    difficulty: manualDiff,
  });

  useEffect(() => {
    if (penaltyOn && !penaltyXp) setPenaltyXp(String(suggestedPenalty(analysis.xp)));
  }, [penaltyOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTemplate = repeatKind !== "unica";

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload: any = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category: effectiveCategory,
        skill_category: customSkillId ? null : effectiveSkill || null,
        custom_skill_id: customSkillId,
        estimated_min: estimated ? Number(estimated) : analysis.estimatedMin || null,
        difficulty: analysis.difficulty,
        difficulty_locked: !!manualDiff,
        xp_reward: analysis.xp,
        priority,
        status: isTemplate ? "pendente" : status,
        start_date: startDate || null,
        due_date: isTemplate ? null : dueDate || null,
        due_time: dueTime || null,
        reminder_minutes: reminder ? Number(reminder) : null,
        penalty_enabled: penaltyOn,
        penalty_xp: penaltyOn ? Number(penaltyXp || suggestedPenalty(analysis.xp)) : 0,
        repeat_kind: repeatKind,
        repeat_rule: isTemplate ? repeatRule : null,
        repeat_interval: Math.max(1, Number(interval) || 1),
        repeat_weekdays: isTemplate && repeatRule === "specific_days" ? weekdays : null,
        is_template: isTemplate,
        completed: !isTemplate && status === "concluida",
      };
      if (mission) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", mission.id);
        if (error) throw error;
        toast.success("Missão atualizada");
      } else {
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) throw error;
        if (isTemplate) {
          await generateRecurringMissions();
          toast.success("Missão automática criada", { description: repeatRuleLabels[repeatRule] });
        } else {
          toast.success("Missão criada", { description: `+${analysis.xp} XP ao concluir` });
        }
      }
      if (reminder) ensureNotificationPermission();
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-elegant my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">{mission ? "Editar missão" : "Nova missão"}</h3>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da missão"
            className="w-full glass rounded-2xl px-4 py-4 text-sm outline-none placeholder:text-muted-foreground" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={2}
            className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground resize-none" />

          <Field label="Categoria" hint={title.trim() && !catTouched ? "Sugerido automaticamente" : undefined}>
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <Chip key={c} active={effectiveCategory === c} onClick={() => { setCategory(c); setCatTouched(true); }}>{categoryLabels[c]}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Skill que ganha XP" hint={title.trim() && !skillTouched && !customSkillId ? "Sugerido automaticamente" : undefined}>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <Chip key={s} active={!customSkillId && effectiveSkill === s} onClick={() => { setSkill(s); setSkillTouched(true); setCustomSkillId(null); }}>
                  {skillLabels[s].emoji} {skillLabels[s].label}
                </Chip>
              ))}
              {(customSkills ?? []).map((cs: any) => (
                <Chip key={cs.id} active={customSkillId === cs.id} onClick={() => { setCustomSkillId(cs.id); setSkillTouched(true); }}>
                  {cs.icon || "✨"} {cs.display_name || "Skill"}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Tempo estimado (min)">
              <input type="number" min={0} value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder={String(analysis.estimatedMin || 0)}
                className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
            </Field>
            <Field label="Horário">
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)}
                className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
            </Field>
            <Field label="Data de início">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
            </Field>
            {!isTemplate && (
              <Field label="Prazo">
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
              </Field>
            )}
          </div>

          <Field label="Repetição">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(repeatKindLabels) as RepeatKind[]).map((k) => (
                <Chip key={k} active={repeatKind === k} onClick={() => setRepeatKind(k)}>{repeatKindLabels[k]}</Chip>
              ))}
            </div>
          </Field>

          {isTemplate && (
            <Field label="Regra automática">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(repeatRuleLabels) as RepeatRule[]).map((r) => (
                  <Chip key={r} active={repeatRule === r} onClick={() => setRepeatRule(r)}>{repeatRuleLabels[r]}</Chip>
                ))}
              </div>
              {repeatRule === "specific_days" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {WEEKDAYS.map((d) => (
                    <Chip key={d.v} active={weekdays.includes(d.v)}
                      onClick={() => setWeekdays((w) => (w.includes(d.v) ? w.filter((x) => x !== d.v) : [...w, d.v]))}>{d.label}</Chip>
                  ))}
                </div>
              )}
              {["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatRule) && (
                <input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)}
                  className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none mt-2" placeholder="Intervalo" />
              )}
            </Field>
          )}

          <Field label="Prioridade">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(priorityMeta) as Priority[]).map((p) => (
                <Chip key={p} active={priority === p} onClick={() => setPriority(p)}>{priorityMeta[p].label}</Chip>
              ))}
            </div>
          </Field>

          {!isTemplate && (
            <Field label="Status">
              <div className="flex flex-wrap gap-2">
                {(["pendente", "em_andamento", "concluida", "falhada", "cancelada"] as Status[]).map((s) => (
                  <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{statusMeta[s].label}</Chip>
                ))}
              </div>
            </Field>
          )}

          <Field label="Dificuldade" hint={manualDiff ? "Manual" : "Calculada automaticamente"}>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <Chip key={d} active={analysis.difficulty === d} onClick={() => setManualDiff(manualDiff === d ? null : d)}>
                  {difficultyMeta[d].icon} {difficultyMeta[d].label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Lembrete (min antes)">
            <input type="number" min={0} value={reminder} onChange={(e) => setReminder(e.target.value)} placeholder="Ex: 30"
              className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
          </Field>

          <label className="flex items-center justify-between glass rounded-2xl px-4 py-3">
            <span className="text-sm font-semibold">Penalidade se expirar</span>
            <input type="checkbox" checked={penaltyOn} onChange={(e) => setPenaltyOn(e.target.checked)} className="h-5 w-5 accent-electric" />
          </label>
          {penaltyOn && (
            <input type="number" min={0} value={penaltyXp} onChange={(e) => setPenaltyXp(e.target.value)} placeholder="XP de penalidade"
              className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
          )}

          <div className="glass rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold">Recompensa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${difficultyMeta[analysis.difficulty].className}`}>
                  {difficultyMeta[analysis.difficulty].icon} {difficultyMeta[analysis.difficulty].label}
                </span>
                <span className="font-black text-gold">+{analysis.xp} XP</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              XP base {analysis.baseXp} · bônus de dificuldade {analysis.bonusXp >= 0 ? "+" : ""}{analysis.bonusXp}
            </p>
          </div>

          <button onClick={save} disabled={saving || !title.trim()}
            className="w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {mission ? "Salvar" : "Criar missão"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
        {hint && <span className="text-[10px] text-electric">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-electric/20 text-electric border border-electric/30" : "glass"}`}>
      {children}
    </button>
  );
}
