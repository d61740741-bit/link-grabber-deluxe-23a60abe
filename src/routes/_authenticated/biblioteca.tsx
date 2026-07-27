import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, Plus, Heart, Trash2, X, Loader2, FileText, Book, GraduationCap,
  Video, Link2, FileDown, ExternalLink, StickyNote, ChevronRight, Search,
  CheckCircle2, PauseCircle, PlayCircle, Clock, Flame, BarChart3, History,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  component: Biblioteca,
  head: () => ({
    meta: [
      { title: "Biblioteca — Livros, cursos, vídeos e artigos" },
      { name: "description", content: "Organize livros, cursos, vídeos, artigos, links e PDFs, acompanhe progresso, tempo estudado e ganhe XP ao concluir." },
      { property: "og:title", content: "Biblioteca — Conhecimento" },
      { property: "og:description", content: "Sua central de estudos: progresso, favoritos, histórico, estatísticas e XP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CATEGORIES = [
  { key: "psicologia", label: "Psicologia", emoji: "🧠", skill: "Mente", tint: "from-purple-500/30 to-purple-500/5" },
  { key: "programacao", label: "Programação", emoji: "💻", skill: "Conhecimento", tint: "from-electric/30 to-electric/5" },
  { key: "fitness", label: "Fitness", emoji: "🏋️", skill: "Corpo", tint: "from-orange-500/30 to-orange-500/5" },
  { key: "financas", label: "Finanças", emoji: "💎", skill: "Finanças", tint: "from-gold/30 to-gold/5" },
  { key: "idiomas", label: "Idiomas", emoji: "🗣️", skill: "Conhecimento", tint: "from-sky-500/30 to-sky-500/5" },
  { key: "marketing", label: "Marketing", emoji: "📣", skill: "Social", tint: "from-pink-500/30 to-pink-500/5" },
  { key: "negocios", label: "Negócios", emoji: "📈", skill: "Finanças", tint: "from-emerald-500/30 to-emerald-500/5" },
  { key: "desenvolvimento_pessoal", label: "Desenvolvimento pessoal", emoji: "🌱", skill: "Mente", tint: "from-teal-500/30 to-teal-500/5" },
  { key: "filosofia", label: "Filosofia", emoji: "🏛️", skill: "Mente", tint: "from-indigo-500/30 to-indigo-500/5" },
  { key: "saude", label: "Saúde", emoji: "🫀", skill: "Corpo", tint: "from-rose-500/30 to-rose-500/5" },
  { key: "nutricao", label: "Nutrição", emoji: "🥗", skill: "Corpo", tint: "from-lime-500/30 to-lime-500/5" },
  { key: "exercicio", label: "Exercício", emoji: "💪", skill: "Corpo", tint: "from-amber-500/30 to-amber-500/5" },
  { key: "sobrevivencia", label: "Sobrevivência", emoji: "🧭", skill: "Disciplina", tint: "from-amber-700/30 to-amber-700/5" },
  { key: "primeiros_socorros", label: "Primeiros Socorros", emoji: "⛑️", skill: "Disciplina", tint: "from-red-500/30 to-red-500/5" },
] as const;

type CatKey = (typeof CATEGORIES)[number]["key"];

const TYPES = [
  { key: "livro", label: "Livro", icon: Book, xp: 100 },
  { key: "curso", label: "Curso", icon: GraduationCap, xp: 80 },
  { key: "video", label: "Vídeo", icon: Video, xp: 20 },
  { key: "artigo", label: "Artigo", icon: FileText, xp: 15 },
  { key: "link", label: "Link", icon: Link2, xp: 10 },
  { key: "pdf", label: "PDF", icon: FileDown, xp: 30 },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];

const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "concluidos", label: "Concluídos" },
  { key: "historico", label: "Histórico" },
  { key: "stats", label: "Estatísticas" },
] as const;

const TYPE_FILTERS = [
  { key: "todos", label: "Tudo" },
  ...TYPES.map((t) => ({ key: t.key, label: t.label })),
  { key: "favoritos", label: "Favoritos" },
  { key: "pausados", label: "Pausados" },
] as const;

function typeMeta(k: string) {
  return TYPES.find((t) => t.key === k) ?? TYPES[3];
}
function catMeta(k: string) {
  return CATEGORIES.find((c) => c.key === k);
}
function fmtHours(sec: number) {
  const h = sec / 3600;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function Biblioteca() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ativos");
  const [filter, setFilter] = useState<(typeof TYPE_FILTERS)[number]["key"]>("todos");
  const [cat, setCat] = useState<CatKey | "all">("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items } = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const { data } = await supabase
        .from("library_items")
        .select("*")
        .order("favorite", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const all = items ?? [];

  const base = useMemo(() => {
    if (tab === "concluidos") return all.filter((i: any) => i.completed);
    if (tab === "ativos") return all.filter((i: any) => !i.completed);
    return all;
  }, [all, tab]);

  const filtered = useMemo(() => {
    let arr = base;
    if (cat !== "all") arr = arr.filter((i: any) => i.category === cat);
    if (filter === "favoritos") arr = arr.filter((i: any) => i.favorite);
    else if (filter === "pausados") arr = arr.filter((i: any) => i.status === "pausado");
    else if (filter !== "todos") arr = arr.filter((i: any) => i.item_type === filter);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((i: any) =>
        [i.title, i.author, i.description, i.notes].filter(Boolean).some((s: string) => s.toLowerCase().includes(t)),
      );
    }
    return arr;
  }, [base, cat, filter, q]);

  const stats = useMemo(() => {
    const done = all.filter((i: any) => i.completed);
    const seconds = all.reduce((s: number, i: any) => s + (i.study_seconds ?? 0), 0);
    const days = Array.from(
      new Set(
        all
          .filter((i: any) => (i.study_seconds ?? 0) > 0 || i.completed)
          .map((i: any) => (i.completed_at ?? i.updated_at ?? i.created_at).slice(0, 10)),
      ),
    ).sort();
    // dias consecutivos terminando hoje/ontem
    let streak = 0;
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const set = new Set(days);
    const cursor = new Date(today);
    if (!set.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (set.has(iso(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      total: all.length,
      ativos: all.length - done.length,
      concluidos: done.length,
      favoritos: all.filter((i: any) => i.favorite).length,
      livros: done.filter((i: any) => i.item_type === "livro").length,
      cursos: done.filter((i: any) => i.item_type === "curso").length,
      videos: done.filter((i: any) => i.item_type === "video").length,
      artigos: done.filter((i: any) => i.item_type === "artigo").length,
      pdfs: done.filter((i: any) => i.item_type === "pdf").length,
      links: done.filter((i: any) => i.item_type === "link").length,
      horas: seconds,
      streak,
    };
  }, [all]);

  function refresh() {
    qc.invalidateQueries();
  }

  async function toggleFav(id: string, cur: boolean) {
    await supabase.from("library_items").update({ favorite: !cur }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["library"] });
  }

  async function setStatus(item: any, status: "em_andamento" | "concluido" | "pausado") {
    const { error } = await supabase.from("library_items").update({ status }).eq("id", item.id);
    if (error) return toast.error(error.message);
    if (status === "concluido") {
      const meta = typeMeta(item.item_type);
      toast.success(`Concluído · +${meta.xp} XP em ${catMeta(item.category)?.skill ?? "Conhecimento"}`);
    } else if (status === "pausado") toast("Pausado");
    else toast("Retomado");
    refresh();
  }

  async function remove(id: string) {
    await supabase.from("library_items").delete().eq("id", id);
    toast.success("Removido da biblioteca");
    refresh();
  }

  const editing = all.find((i: any) => i.id === editingId) ?? null;

  return (
    <div className="relative px-5 pt-10 safe-top">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[380px] w-[380px] rounded-full bg-gold/10 blur-[100px]" />

      <header className="relative flex items-start justify-between mb-6 animate-rise">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <p className="text-[11px] uppercase tracking-[0.22em] font-medium">Biblioteca</p>
          </div>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Conhecimento.</h1>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="tap h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* Stats resumo */}
      <section className="grid grid-cols-4 gap-2 mb-5 animate-rise delay-1">
        <StatChip label="Ativos" value={stats.ativos} />
        <StatChip label="Feitos" value={stats.concluidos} />
        <StatChip label="Horas" value={fmtHours(stats.horas)} />
        <StatChip label="Sequência" value={`${stats.streak}d`} />
      </section>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 animate-rise delay-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-2xl py-2.5 text-[11px] font-semibold ${
              tab === t.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stats" ? (
        <StatsView stats={stats} items={all} />
      ) : (
        <>
          {/* Search */}
          <div className="relative glass rounded-2xl mb-4 flex items-center gap-2 px-4 animate-rise delay-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, autor, notas..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>

          {/* Filtros por tipo */}
          <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar animate-rise delay-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-wide ${
                  filter === f.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Categorias */}
          <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar animate-rise delay-3">
            <button
              onClick={() => setCat("all")}
              className={`shrink-0 rounded-2xl px-3 py-2 text-[11px] font-semibold ${
                cat === "all" ? "bg-white/[0.08] ring-hair text-foreground" : "glass text-muted-foreground"
              }`}
            >
              Todas
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`shrink-0 rounded-2xl px-3 py-2 text-[11px] font-semibold flex items-center gap-1.5 ${
                  cat === c.key ? "bg-white/[0.08] ring-hair text-foreground" : "glass text-muted-foreground"
                }`}
              >
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>

          {tab === "historico" ? (
            <HistoryView items={filtered} />
          ) : (
            <div className="space-y-3 pb-6">
              {filtered.length === 0 ? (
                <EmptyState onAdd={() => setAddOpen(true)} done={tab === "concluidos"} />
              ) : (
                filtered.map((it: any, idx: number) => (
                  <ItemCard
                    key={it.id}
                    it={it}
                    idx={idx}
                    onFav={() => toggleFav(it.id, it.favorite)}
                    onOpen={() => setEditingId(it.id)}
                    onStatus={(s) => setStatus(it, s)}
                    onRemove={() => remove(it.id)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {addOpen && <AddSheet onClose={() => setAddOpen(false)} onSaved={refresh} />}
      {editing && <EditSheet item={editing} onClose={() => setEditingId(null)} onSaved={refresh} />}
    </div>
  );
}

function EmptyState({ onAdd, done }: { onAdd: () => void; done: boolean }) {
  return (
    <div className="glass-strong rounded-3xl p-10 text-center animate-rise delay-3">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-white/[0.05] ring-hair flex items-center justify-center mb-3">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{done ? "Nada concluído ainda" : "Nenhum conteúdo aqui"}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {done ? "Conclua um item para vê-lo aqui." : "Salve livros, cursos, vídeos, artigos, links e PDFs."}
      </p>
      {!done && (
        <button
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      )}
    </div>
  );
}

function ItemCard({
  it, idx, onFav, onOpen, onStatus, onRemove,
}: {
  it: any; idx: number; onFav: () => void; onOpen: () => void;
  onStatus: (s: "em_andamento" | "concluido" | "pausado") => void; onRemove: () => void;
}) {
  const meta = catMeta(it.category);
  const tm = typeMeta(it.item_type);
  const TIcon = tm.icon;
  return (
    <article className={`relative glass-strong rounded-3xl p-4 overflow-hidden animate-rise delay-${(idx % 5) + 2}`}>
      <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${meta?.tint} blur-3xl opacity-70`} />

      <div className="relative flex gap-3.5">
        <div className="h-16 w-12 shrink-0 rounded-xl bg-white/[0.05] ring-hair flex items-center justify-center text-2xl overflow-hidden">
          {it.cover_url ? <img src={it.cover_url} alt={it.title} className="h-full w-full object-cover" /> : <span>{meta?.emoji}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight truncate">{it.title}</p>
              {it.author && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{it.author}</p>}
            </div>
            <button onClick={onFav} className="tap shrink-0">
              <Heart className={`h-4 w-4 ${it.favorite ? "fill-rose-400 text-rose-400" : "text-muted-foreground"}`} />
            </button>
          </div>

          {it.description && <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{it.description}</p>}

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Tag><TIcon className="h-3 w-3" /> {tm.label}</Tag>
            <Tag>{meta?.emoji} {meta?.label}</Tag>
            <Tag><Clock className="h-3 w-3" /> {fmtHours(it.study_seconds ?? 0)}</Tag>
            {it.status === "concluido" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 ring-hair">
                <CheckCircle2 className="h-3 w-3" /> Concluído
              </span>
            ) : it.status === "pausado" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 ring-hair">
                <PauseCircle className="h-3 w-3" /> Pausado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-electric/10 text-electric ring-hair">
                <PlayCircle className="h-3 w-3" /> Em andamento
              </span>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Progresso</span>
              <span className="text-[10px] text-muted-foreground">
                {it.item_type === "livro" && it.total_pages
                  ? `${it.current_page ?? 0}/${it.total_pages} pág`
                  : `${it.progress ?? 0}%`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-electric to-gold transition-[width] duration-500"
                style={{ width: `${it.progress ?? 0}%` }}
              />
            </div>
          </div>

          {it.notes && (
            <div className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
              <p className="line-clamp-2">{it.notes}</p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onOpen}
              className="tap flex-1 rounded-full bg-white/[0.06] ring-hair py-2 text-[11px] font-semibold inline-flex items-center justify-center gap-1"
            >
              Abrir <ChevronRight className="h-3 w-3" />
            </button>
            {!it.completed ? (
              <>
                <button
                  onClick={() => onStatus("concluido")}
                  className="tap rounded-full bg-emerald-500/15 text-emerald-300 ring-hair px-3 py-2 text-[11px] font-semibold inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> +{tm.xp}
                </button>
                <button
                  onClick={() => onStatus(it.status === "pausado" ? "em_andamento" : "pausado")}
                  className="tap h-8 w-8 rounded-full bg-white/[0.06] ring-hair flex items-center justify-center"
                >
                  {it.status === "pausado" ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                </button>
              </>
            ) : (
              <button
                onClick={() => onStatus("em_andamento")}
                className="tap rounded-full bg-white/[0.06] ring-hair px-3 py-2 text-[11px] font-semibold"
              >
                Reabrir
              </button>
            )}
            {it.url && (
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="tap h-8 w-8 rounded-full bg-white/[0.06] ring-hair flex items-center justify-center"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button onClick={onRemove} className="tap h-8 w-8 rounded-full bg-white/[0.04] ring-hair flex items-center justify-center">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] ring-hair text-muted-foreground">
      {children}
    </span>
  );
}

function HistoryView({ items }: { items: any[] }) {
  const ordered = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.completed_at ?? b.updated_at ?? b.created_at).getTime() -
          new Date(a.completed_at ?? a.updated_at ?? a.created_at).getTime(),
      ),
    [items],
  );
  if (ordered.length === 0)
    return (
      <div className="glass-strong rounded-3xl p-10 text-center">
        <History className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-semibold">Sem histórico ainda</p>
      </div>
    );
  return (
    <div className="space-y-2 pb-6">
      {ordered.map((it) => {
        const tm = typeMeta(it.item_type);
        const TIcon = tm.icon;
        return (
          <div key={it.id} className="glass rounded-2xl p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/[0.05] ring-hair flex items-center justify-center">
              <TIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold truncate">{it.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {catMeta(it.category)?.label} · criado {fmtDate(it.created_at)}
                {it.completed_at ? ` · concluído ${fmtDate(it.completed_at)}` : ""}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
              {it.completed ? `+${tm.xp} XP` : `${it.progress ?? 0}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatsView({ stats, items }: { stats: any; items: any[] }) {
  const byCat = useMemo(() => {
    const map = new Map<string, { done: number; sec: number }>();
    items.forEach((i) => {
      const cur = map.get(i.category) ?? { done: 0, sec: 0 };
      if (i.completed) cur.done++;
      cur.sec += i.study_seconds ?? 0;
      map.set(i.category, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].sec - a[1].sec);
  }, [items]);

  return (
    <div className="space-y-4 pb-6 animate-rise delay-2">
      <div className="grid grid-cols-3 gap-2">
        <StatChip label="Livros" value={stats.livros} />
        <StatChip label="Cursos" value={stats.cursos} />
        <StatChip label="Vídeos" value={stats.videos} />
        <StatChip label="Artigos" value={stats.artigos} />
        <StatChip label="PDFs" value={stats.pdfs} />
        <StatChip label="Links" value={stats.links} />
      </div>

      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Resumo</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Big label="Horas estudadas" value={fmtHours(stats.horas)} />
          <Big label="Dias consecutivos" value={`${stats.streak}`} icon={<Flame className="h-4 w-4 text-orange-400" />} />
          <Big label="Concluídos" value={`${stats.concluidos}`} />
          <Big label="Favoritos" value={`${stats.favoritos}`} />
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-4">Por categoria</p>
        {byCat.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <div className="space-y-3">
            {byCat.map(([key, v]) => {
              const m = catMeta(key);
              const max = Math.max(...byCat.map(([, x]) => x.sec), 1);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold">{m?.emoji} {m?.label}</span>
                    <span className="text-muted-foreground">{v.done} feitos · {fmtHours(v.sec)} · {m?.skill}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-electric to-gold" style={{ width: `${(v.sec / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Big({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight flex items-center gap-1.5">{value}{icon}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="relative glass rounded-2xl p-3 overflow-hidden">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function AddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState<CatKey>("psicologia");
  const [itemType, setItemType] = useState<TypeKey>("artigo");
  const [totalPages, setTotalPages] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setSaving(false);
    const { error } = await supabase.from("library_items").insert({
      user_id: user.id,
      title: title.trim(),
      author: author.trim() || null,
      description: description.trim() || null,
      url: url.trim() || null,
      cover_url: coverUrl.trim() || null,
      category,
      item_type: itemType,
      status: "em_andamento",
      total_pages: itemType === "livro" && totalPages ? Number(totalPages) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo na biblioteca");
    onSaved();
    onClose();
  }

  return (
    <Sheet onClose={onClose} title="Adicionar à biblioteca">
      <div className="grid grid-cols-3 gap-2 mb-4">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setItemType(t.key)}
              className={`rounded-2xl py-3 text-[11px] font-semibold flex flex-col items-center gap-1 ${
                itemType === t.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <Field label="Título">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Nome do conteúdo" />
      </Field>
      <Field label="Descrição">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls + " resize-none"} placeholder="Sobre o que é..." />
      </Field>
      <Field label="Autor">
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls} placeholder="Opcional" />
      </Field>
      <Field label="Link (URL)">
        <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://..." />
      </Field>
      <Field label="Capa (URL da imagem)">
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className={inputCls} placeholder="Opcional" />
      </Field>

      {itemType === "livro" && (
        <Field label="Total de páginas">
          <input
            type="number"
            min={0}
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value ? Number(e.target.value) : "")}
            className={inputCls}
            placeholder="Ex: 320"
          />
        </Field>
      )}

      <Field label="Categoria">
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-2xl px-3 py-2.5 text-[11px] font-semibold flex items-center gap-1.5 text-left ${
                category === c.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
              }`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </Field>

      <p className="text-[10px] text-muted-foreground mb-3">
        Ao concluir: +{typeMeta(itemType).xp} XP na skill {catMeta(category)?.skill}.
      </p>

      <button
        onClick={save}
        disabled={saving || !title.trim()}
        className="w-full mt-2 rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
      </button>
    </Sheet>
  );
}

function EditSheet({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [progress, setProgress] = useState<number>(item.progress ?? 0);
  const [currentPage, setCurrentPage] = useState<number>(item.current_page ?? 0);
  const [notes, setNotes] = useState<string>(item.notes ?? "");
  const [description, setDescription] = useState<string>(item.description ?? "");
  const [studyMin, setStudyMin] = useState<number>(Math.round((item.study_seconds ?? 0) / 60));
  const [saving, setSaving] = useState(false);

  const isBook = item.item_type === "livro" && item.total_pages;
  const tm = typeMeta(item.item_type);

  function updatePage(v: number) {
    const capped = Math.max(0, Math.min(item.total_pages, v));
    setCurrentPage(capped);
    setProgress(Math.round((capped / item.total_pages) * 100));
  }

  async function save(complete?: boolean) {
    setSaving(true);
    const patch: any = {
      progress: complete ? 100 : Math.min(progress, item.completed ? 100 : progress),
      notes: notes || null,
      description: description || null,
      study_seconds: Math.max(0, Math.round(studyMin * 60)),
    };
    if (isBook) patch.current_page = currentPage;
    if (complete) patch.status = "concluido";
    const { error } = await supabase.from("library_items").update(patch).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(complete ? `Concluído · +${tm.xp} XP` : "Atualizado");
    onSaved();
    onClose();
  }

  const meta = catMeta(item.category);

  return (
    <Sheet onClose={onClose} title={item.title}>
      <div className="flex items-center gap-2 mb-4 -mt-1 flex-wrap">
        <Tag>{meta?.emoji} {meta?.label}</Tag>
        <Tag><tm.icon className="h-3 w-3" /> {tm.label}</Tag>
        {item.author && <span className="text-[11px] text-muted-foreground truncate">{item.author}</span>}
      </div>

      <Field label="Descrição">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls + " resize-none"} />
      </Field>

      {isBook ? (
        <Field label={`Página atual (${item.total_pages} total)`}>
          <div className="flex items-center gap-2">
            <button onClick={() => updatePage(currentPage - 10)} className="glass rounded-xl px-3 py-2 text-xs font-semibold">-10</button>
            <input type="number" value={currentPage} onChange={(e) => updatePage(Number(e.target.value))} className={inputCls + " text-center"} />
            <button onClick={() => updatePage(currentPage + 10)} className="glass rounded-xl px-3 py-2 text-xs font-semibold">+10</button>
          </div>
        </Field>
      ) : (
        <Field label={`Progresso: ${progress}%`}>
          <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-electric" />
        </Field>
      )}

      <div className="mb-4">
        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-electric to-gold transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Field label={`Tempo estudado: ${fmtHours(studyMin * 60)}`}>
        <div className="flex items-center gap-2">
          {[15, 30, 60].map((m) => (
            <button key={m} onClick={() => setStudyMin((v) => v + m)} className="glass rounded-xl px-3 py-2 text-[11px] font-semibold">
              +{m}min
            </button>
          ))}
          <input
            type="number"
            min={0}
            value={studyMin}
            onChange={(e) => setStudyMin(Math.max(0, Number(e.target.value)))}
            className={inputCls + " text-center"}
          />
        </div>
      </Field>

      <Field label="Notas">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Insights, citações, aprendizados..."
          className={inputCls + " resize-none"}
        />
      </Field>

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="flex-1 rounded-full bg-white/[0.06] ring-hair px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
        {!item.completed && (
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Concluir +{tm.xp}
          </button>
        )}
      </div>
    </Sheet>
  );
}

const inputCls =
  "w-full glass rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-electric/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3" onClick={onClose}>
      <div
        className="w-full max-w-md glass-strong rounded-[28px] p-6 max-h-[92dvh] overflow-y-auto hide-scrollbar animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 gap-2">
          <h3 className="text-lg font-semibold tracking-tight truncate">{title}</h3>
          <button onClick={onClose} className="tap h-9 w-9 rounded-full bg-white/[0.06] ring-hair flex items-center justify-center shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
