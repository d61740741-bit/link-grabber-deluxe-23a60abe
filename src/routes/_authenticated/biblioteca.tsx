import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, Plus, Heart, Trash2, X, Loader2, Star, FileText, Book,
  ExternalLink, StickyNote, ChevronRight, Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  component: Biblioteca,
});

const CATEGORIES = [
  { key: "psicologia", label: "Psicologia", emoji: "🧠", tint: "from-purple-500/30 to-purple-500/5" },
  { key: "filosofia", label: "Filosofia", emoji: "🏛️", tint: "from-indigo-500/30 to-indigo-500/5" },
  { key: "financas", label: "Finanças", emoji: "💎", tint: "from-gold/30 to-gold/5" },
  { key: "programacao", label: "Programação", emoji: "💻", tint: "from-electric/30 to-electric/5" },
  { key: "negocios", label: "Negócios", emoji: "📈", tint: "from-emerald-500/30 to-emerald-500/5" },
  { key: "saude", label: "Saúde", emoji: "🫀", tint: "from-rose-500/30 to-rose-500/5" },
  { key: "nutricao", label: "Nutrição", emoji: "🥗", tint: "from-lime-500/30 to-lime-500/5" },
  { key: "exercicio", label: "Exercício", emoji: "💪", tint: "from-orange-500/30 to-orange-500/5" },
  { key: "sobrevivencia", label: "Sobrevivência", emoji: "🧭", tint: "from-amber-700/30 to-amber-700/5" },
  { key: "primeiros_socorros", label: "Primeiros Socorros", emoji: "⛑️", tint: "from-red-500/30 to-red-500/5" },
] as const;

type CatKey = (typeof CATEGORIES)[number]["key"];

const FILTERS = [
  { key: "todos", label: "Tudo" },
  { key: "artigo", label: "Artigos" },
  { key: "livro", label: "Livros" },
  { key: "favoritos", label: "Favoritos" },
  { key: "lendo", label: "Lendo" },
  { key: "concluidos", label: "Concluídos" },
] as const;

function Biblioteca() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todos");
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

  const filtered = useMemo(() => {
    let arr = items ?? [];
    if (cat !== "all") arr = arr.filter((i: any) => i.category === cat);
    if (filter === "artigo") arr = arr.filter((i: any) => i.item_type === "artigo");
    if (filter === "livro") arr = arr.filter((i: any) => i.item_type === "livro");
    if (filter === "favoritos") arr = arr.filter((i: any) => i.favorite);
    if (filter === "lendo") arr = arr.filter((i: any) => !i.completed && (i.progress ?? 0) > 0);
    if (filter === "concluidos") arr = arr.filter((i: any) => i.completed);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((i: any) =>
        [i.title, i.author, i.description].filter(Boolean).some((s: string) => s.toLowerCase().includes(t)),
      );
    }
    return arr;
  }, [items, cat, filter, q]);

  const stats = useMemo(() => {
    const all = items ?? [];
    return {
      total: all.length,
      lendo: all.filter((i: any) => !i.completed && (i.progress ?? 0) > 0).length,
      concluidos: all.filter((i: any) => i.completed).length,
      favoritos: all.filter((i: any) => i.favorite).length,
    };
  }, [items]);

  async function toggleFav(id: string, cur: boolean) {
    await supabase.from("library_items").update({ favorite: !cur }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["library"] });
  }

  async function remove(id: string) {
    await supabase.from("library_items").delete().eq("id", id);
    toast.success("Removido da biblioteca");
    qc.invalidateQueries({ queryKey: ["library"] });
  }

  const editing = (items ?? []).find((i: any) => i.id === editingId) ?? null;

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

      {/* Stats */}
      <section className="grid grid-cols-4 gap-2 mb-5 animate-rise delay-1">
        <StatChip label="Itens" value={stats.total} />
        <StatChip label="Lendo" value={stats.lendo} />
        <StatChip label="Feitos" value={stats.concluidos} />
        <StatChip label="Favs" value={stats.favoritos} />
      </section>

      {/* Search */}
      <div className="relative glass rounded-2xl mb-4 flex items-center gap-2 px-4 animate-rise delay-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, autor..."
          className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar animate-rise delay-2">
        {FILTERS.map((f) => (
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

      {/* Categories */}
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

      {/* Items */}
      <div className="space-y-3 pb-6">
        {filtered.length === 0 ? (
          <div className="glass-strong rounded-3xl p-10 text-center animate-rise delay-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-white/[0.05] ring-hair flex items-center justify-center mb-3">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Sua biblioteca está vazia</p>
            <p className="text-xs text-muted-foreground mt-1">Salve artigos e livros para consultar depois.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
        ) : (
          filtered.map((it: any, idx: number) => {
            const meta = CATEGORIES.find((c) => c.key === it.category);
            return (
              <article
                key={it.id}
                className={`relative glass-strong rounded-3xl p-4 overflow-hidden animate-rise delay-${(idx % 5) + 2}`}
              >
                <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${meta?.tint} blur-3xl opacity-70`} />

                <div className="relative flex gap-3.5">
                  <div className="h-16 w-12 shrink-0 rounded-xl bg-white/[0.05] ring-hair flex items-center justify-center text-2xl overflow-hidden">
                    {it.cover_url ? (
                      <img src={it.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{meta?.emoji}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold leading-tight truncate">{it.title}</p>
                        {it.author && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{it.author}</p>
                        )}
                      </div>
                      <button onClick={() => toggleFav(it.id, it.favorite)} className="tap shrink-0">
                        <Heart
                          className={`h-4 w-4 ${it.favorite ? "fill-rose-400 text-rose-400" : "text-muted-foreground"}`}
                        />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] ring-hair text-muted-foreground">
                        {it.item_type === "livro" ? <Book className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                        {it.item_type === "livro" ? "Livro" : "Artigo"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] ring-hair text-muted-foreground">
                        {meta?.emoji} {meta?.label}
                      </span>
                      {it.completed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 ring-hair">
                          <Star className="h-3 w-3" /> Concluído
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Progresso
                        </span>
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
                        onClick={() => setEditingId(it.id)}
                        className="tap flex-1 rounded-full bg-white/[0.06] ring-hair py-2 text-[11px] font-semibold inline-flex items-center justify-center gap-1"
                      >
                        Abrir <ChevronRight className="h-3 w-3" />
                      </button>
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
                      <button
                        onClick={() => remove(it.id)}
                        className="tap h-8 w-8 rounded-full bg-white/[0.04] ring-hair flex items-center justify-center"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
      {editing && <EditSheet item={editing} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative glass rounded-2xl p-3 overflow-hidden">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<CatKey>("psicologia");
  const [itemType, setItemType] = useState<"artigo" | "livro">("artigo");
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
      url: url.trim() || null,
      category,
      item_type: itemType,
      total_pages: itemType === "livro" && totalPages ? Number(totalPages) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo na biblioteca");
    qc.invalidateQueries({ queryKey: ["library"] });
    onClose();
  }

  return (
    <Sheet onClose={onClose} title="Adicionar à biblioteca">
      <div className="flex gap-2 mb-4">
        {(["artigo", "livro"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setItemType(t)}
            className={`flex-1 rounded-2xl py-3 text-xs font-semibold flex items-center justify-center gap-2 ${
              itemType === t ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
            }`}
          >
            {t === "livro" ? <Book className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {t === "livro" ? "Livro" : "Artigo"}
          </button>
        ))}
      </div>

      <Field label="Título">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Nome do conteúdo" />
      </Field>
      <Field label="Autor">
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls} placeholder="Opcional" />
      </Field>
      <Field label="Link (URL)">
        <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://..." />
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
              className={`rounded-2xl px-3 py-2.5 text-[11px] font-semibold flex items-center gap-1.5 ${
                category === c.key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
              }`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </Field>

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

function EditSheet({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<number>(item.progress ?? 0);
  const [currentPage, setCurrentPage] = useState<number>(item.current_page ?? 0);
  const [notes, setNotes] = useState<string>(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const isBook = item.item_type === "livro" && item.total_pages;

  function updatePage(v: number) {
    const capped = Math.max(0, Math.min(item.total_pages, v));
    setCurrentPage(capped);
    setProgress(Math.round((capped / item.total_pages) * 100));
  }

  async function save() {
    setSaving(true);
    const patch: any = { progress, notes: notes || null };
    if (isBook) patch.current_page = currentPage;
    const { error } = await supabase.from("library_items").update(patch).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["library"] });
    onClose();
  }

  const meta = CATEGORIES.find((c) => c.key === item.category);

  return (
    <Sheet onClose={onClose} title={item.title}>
      <div className="flex items-center gap-2 mb-4 -mt-1">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] ring-hair text-muted-foreground">
          {meta?.emoji} {meta?.label}
        </span>
        {item.author && <span className="text-[11px] text-muted-foreground truncate">{item.author}</span>}
      </div>

      {isBook ? (
        <Field label={`Página atual (${item.total_pages} total)`}>
          <div className="flex items-center gap-2">
            <button onClick={() => updatePage(currentPage - 10)} className="glass rounded-xl px-3 py-2 text-xs font-semibold">-10</button>
            <input
              type="number"
              value={currentPage}
              onChange={(e) => updatePage(Number(e.target.value))}
              className={inputCls + " text-center"}
            />
            <button onClick={() => updatePage(currentPage + 10)} className="glass rounded-xl px-3 py-2 text-xs font-semibold">+10</button>
          </div>
        </Field>
      ) : (
        <Field label={`Progresso: ${progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-electric"
          />
        </Field>
      )}

      <div className="mb-4">
        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-electric to-gold transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[0, 25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => {
              setProgress(p);
              if (isBook) setCurrentPage(Math.round((p / 100) * item.total_pages));
            }}
            className={`flex-1 rounded-xl py-2 text-[11px] font-semibold ${
              progress === p ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
            }`}
          >
            {p}%
          </button>
        ))}
      </div>

      <Field label="Notas">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Insights, citações, aprendizados..."
          className={inputCls + " resize-none"}
        />
      </Field>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-2 rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
      </button>
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3"
      onClick={onClose}
    >
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
