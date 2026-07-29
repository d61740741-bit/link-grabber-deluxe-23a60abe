import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Plus, X, Loader2, Trash2, Pencil, Search,
  ArrowLeftRight, Repeat, Target, BarChart3, Wallet, PiggyBank, Calendar,
} from "lucide-react";
import {
  brl, byCategory, byMonth, biggest, createTransaction, deleteGoal, deleteGroup,
  deleteRecurrence, deleteTransaction, EXPENSE_CATEGORIES, fmtDate, FinanceGoal,
  INCOME_CATEGORIES, monthKey, monthLabel, Recurrence, runRecurrences, saveGoal,
  saveRecurrence, summarize, todayISO, Tx, TxKind, updateTransaction, useFinanceGoals,
  useFinanceRealtime, useFinanceRefresh, useRecurrences, useTransactions, yearKey,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/financas")({
  component: Financas,
  head: () => ({
    meta: [
      { title: "Finanças · Controle de receitas, despesas e metas" },
      { name: "description", content: "Acompanhe receitas, despesas, transferências, parcelamentos, recorrências, saldo mensal e metas financeiras." },
      { property: "og:title", content: "Finanças · Controle de receitas, despesas e metas" },
      { property: "og:description", content: "Saldo mensal e anual, gráficos, categorias, parcelamentos e metas financeiras em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "lancamentos" | "graficos" | "recorrencias" | "metas";
type PeriodFilter = "mes" | "ano" | "tudo";

function Financas() {
  const qc = useQueryClient();
  useFinanceRealtime();
  const refresh = useFinanceRefresh();

  const { data: txs = [], isLoading } = useTransactions();
  const [tab, setTab] = useState<Tab>("lancamentos");
  const [sheet, setSheet] = useState<{ open: boolean; tx?: Tx } | null>(null);

  const [period, setPeriod] = useState<PeriodFilter>("mes");
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [kindFilter, setKindFilter] = useState<"todos" | TxKind>("todos");
  const [category, setCategory] = useState("todas");
  const [q, setQ] = useState("");

  // gera lançamentos recorrentes pendentes ao abrir o módulo
  useEffect(() => {
    runRecurrences()
      .then((n) => { if (n > 0) { toast.success(`${n} lançamento(s) recorrente(s) gerado(s)`); refresh(); } })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inPeriod = useMemo(() => {
    if (period === "tudo") return txs;
    if (period === "ano") return txs.filter((t) => yearKey(t.occurred_on) === month.slice(0, 4));
    return txs.filter((t) => monthKey(t.occurred_on) === month);
  }, [txs, period, month]);

  const categories = useMemo(
    () => [...new Set(txs.map((t) => t.category).filter(Boolean) as string[])].sort(),
    [txs],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inPeriod.filter((t) => {
      if (kindFilter !== "todos" && t.kind !== kindFilter) return false;
      if (category !== "todas" && (t.category || "") !== category) return false;
      if (!term) return true;
      return [t.description, t.category, t.account, t.to_account, t.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [inPeriod, kindFilter, category, q]);

  const totals = summarize(inPeriod);
  const totalsAll = summarize(txs);
  const yearTotals = summarize(txs.filter((t) => yearKey(t.occurred_on) === month.slice(0, 4)));
  const maiorGasto = biggest(inPeriod, "despesa");
  const maiorReceita = biggest(inPeriod, "receita");

  async function remove(t: Tx) {
    try {
      if (t.group_id && confirm("Excluir todas as parcelas deste lançamento?")) await deleteGroup(t.group_id);
      else await deleteTransaction(t.id);
      toast.success("Lançamento excluído · XP recalculado");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    }
  }

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Área</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Finanças</h1>
        </div>
        <button
          onClick={() => setSheet({ open: true })}
          aria-label="Novo lançamento"
          className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant tap"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* saldo */}
      <section className="glass-strong rounded-3xl p-6 mb-3 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {period === "mes" ? `Saldo · ${monthLabel(month)}` : period === "ano" ? `Saldo · ${month.slice(0, 4)}` : "Saldo total"}
          </p>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className={`mt-2 text-4xl font-black ${totals.saldo >= 0 ? "gradient-gold-text" : "text-destructive"}`}>
          {brl(totals.saldo)}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <span>Ano: <b className="text-foreground">{brl(yearTotals.saldo)}</b></span>
          <span>Geral: <b className="text-foreground">{brl(totalsAll.saldo)}</b></span>
          <span>Economia: <b className="text-foreground">{totals.economiaPct}%</b></span>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat icon={<TrendingUp className="h-4 w-4 text-emerald-400" />} label="Receitas" value={brl(totals.receita)} />
        <MiniStat icon={<TrendingDown className="h-4 w-4 text-destructive" />} label="Despesas" value={brl(totals.despesa)} />
        <MiniStat icon={<ArrowLeftRight className="h-4 w-4 text-sky-400" />} label="Transfer." value={brl(totals.transferencia)} />
      </div>

      {/* período */}
      <div className="flex items-center gap-2 mb-3">
        <div className="glass rounded-full p-1 grid grid-cols-3 flex-1 text-[11px] font-semibold">
          {(["mes", "ano", "tudo"] as PeriodFilter[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-full py-1.5 ${period === p ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>
              {p === "mes" ? "Mês" : p === "ano" ? "Ano" : "Tudo"}
            </button>
          ))}
        </div>
        {period !== "tudo" && (
          <input
            type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKey(todayISO()))}
            className="glass rounded-full px-3 py-2 text-xs outline-none"
            aria-label="Selecionar período"
          />
        )}
      </div>

      {/* tabs */}
      <div className="glass rounded-full p-1 grid grid-cols-4 mb-4 text-[11px] font-semibold">
        {([
          ["lancamentos", "Lançamentos"], ["graficos", "Gráficos"],
          ["recorrencias", "Recorrências"], ["metas", "Metas"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full py-2 ${tab === k ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "lancamentos" && (
        <>
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar lançamentos"
              className="bg-transparent outline-none text-sm flex-1" />
            {q && <button onClick={() => setQ("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {(["todos", "receita", "despesa", "transferencia"] as const).map((k) => (
              <button key={k} onClick={() => setKindFilter(k)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${kindFilter === k ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
                {k === "todos" ? "Todos" : k === "receita" ? "Receitas" : k === "despesa" ? "Despesas" : "Transferências"}
              </button>
            ))}
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              aria-label="Filtrar por categoria"
              className="shrink-0 glass rounded-full px-3 py-1.5 text-[11px] outline-none">
              <option value="todas">Todas categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2 pb-6">
            {isLoading && <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Carregando…</div>}
            {!isLoading && filtered.length === 0 && (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Nenhum lançamento neste filtro.</div>
            )}
            {filtered.map((t) => (
              <div key={t.id} className="glass rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t.description || t.category || "Sem descrição"}
                    {t.installment_total ? <span className="ml-1 text-[10px] text-muted-foreground">({t.installment_no}/{t.installment_total})</span> : null}
                    {t.recurrence_id ? <Repeat className="inline h-3 w-3 ml-1 text-sky-400" /> : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {fmtDate(t.occurred_on)} · {t.category || "—"}
                    {t.kind === "transferencia" && (t.account || t.to_account) ? ` · ${t.account || "?"} → ${t.to_account || "?"}` : t.account ? ` · ${t.account}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm font-black ${t.kind === "receita" ? "text-emerald-400" : t.kind === "despesa" ? "text-destructive" : "text-sky-400"}`}>
                    {t.kind === "receita" ? "+" : t.kind === "despesa" ? "-" : "↔"} {brl(t.amount)}
                  </span>
                  <button onClick={() => setSheet({ open: true, tx: t })} aria-label="Editar">
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button onClick={() => remove(t)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "graficos" && (
        <Graficos txs={txs} inPeriod={inPeriod} maiorGasto={maiorGasto} maiorReceita={maiorReceita} />
      )}

      {tab === "recorrencias" && <Recorrencias onChanged={refresh} />}

      {tab === "metas" && <Metas saldo={totalsAll.saldo} onChanged={refresh} />}

      {sheet?.open && (
        <TxSheet
          tx={sheet.tx}
          onClose={() => setSheet(null)}
          onSaved={async () => { setSheet(null); await refresh(); qc.invalidateQueries(); }}
        />
      )}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-1">{icon}
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-black truncate">{value}</p>
    </div>
  );
}

/* ---------------- gráficos ---------------- */

function Graficos({ txs, inPeriod, maiorGasto, maiorReceita }: {
  txs: Tx[]; inPeriod: Tx[]; maiorGasto: Tx | null; maiorReceita: Tx | null;
}) {
  const months = byMonth(txs).slice(-12);
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.receita, m.despesa)));
  const despesasCat = byCategory(inPeriod, "despesa").slice(0, 8);
  const receitasCat = byCategory(inPeriod, "receita").slice(0, 6);
  const maxCat = Math.max(1, ...despesasCat.map((c) => c.total));
  const maxRec = Math.max(1, ...receitasCat.map((c) => c.total));

  return (
    <div className="space-y-3 pb-6">
      <section className="glass rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-black">Receitas x Despesas (12 meses)</h2>
        </div>
        {months.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {months.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-emerald-400/70" style={{ height: `${(m.receita / maxBar) * 100}%` }} title={`Receita ${brl(m.receita)}`} />
                  <div className="w-1/2 rounded-t bg-destructive/70" style={{ height: `${(m.despesa / maxBar) * 100}%` }} title={`Despesa ${brl(m.despesa)}`} />
                </div>
                <span className="text-[9px] text-muted-foreground">{monthLabel(m.key)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Maior gasto</p>
          <p className="text-lg font-black text-destructive">{maiorGasto ? brl(maiorGasto.amount) : "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{maiorGasto?.description || maiorGasto?.category || "Sem registros"}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Maior receita</p>
          <p className="text-lg font-black text-emerald-400">{maiorReceita ? brl(maiorReceita.amount) : "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{maiorReceita?.description || maiorReceita?.category || "Sem registros"}</p>
        </div>
      </div>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-black mb-3">Despesas por categoria</h2>
        {despesasCat.length === 0 && <p className="text-xs text-muted-foreground">Sem despesas no período.</p>}
        <div className="space-y-2">
          {despesasCat.map((c) => (
            <div key={c.category}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">{c.category}</span>
                <span className="font-semibold">{brl(c.total)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-destructive/70" style={{ width: `${(c.total / maxCat) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-black mb-3">Receitas por categoria</h2>
        {receitasCat.length === 0 && <p className="text-xs text-muted-foreground">Sem receitas no período.</p>}
        <div className="space-y-2">
          {receitasCat.map((c) => (
            <div key={c.category}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">{c.category}</span>
                <span className="font-semibold">{brl(c.total)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${(c.total / maxRec) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-black">Histórico mensal</h2>
        </div>
        <div className="space-y-1.5">
          {[...months].reverse().map((m) => (
            <div key={m.key} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{monthLabel(m.key)}</span>
              <span className="flex gap-3">
                <span className="text-emerald-400">{brl(m.receita)}</span>
                <span className="text-destructive">{brl(m.despesa)}</span>
                <b className={m.saldo >= 0 ? "text-foreground" : "text-destructive"}>{brl(m.saldo)}</b>
              </span>
            </div>
          ))}
          {months.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico.</p>}
        </div>
      </section>
    </div>
  );
}

/* ---------------- recorrências ---------------- */

function Recorrencias({ onChanged }: { onChanged: () => Promise<void> }) {
  const { data: recs = [] } = useRecurrences();
  const [open, setOpen] = useState<{ rec?: Recurrence } | null>(null);

  return (
    <div className="space-y-2 pb-6">
      <button onClick={() => setOpen({})} className="w-full glass rounded-2xl p-4 text-sm font-semibold flex items-center justify-center gap-2 tap">
        <Plus className="h-4 w-4" /> Nova recorrência
      </button>
      {recs.length === 0 && <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Nenhuma recorrência configurada.</div>}
      {recs.map((r) => (
        <div key={r.id} className="glass rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{r.description || r.category || "Recorrência"}</p>
            <p className="text-xs text-muted-foreground">
              {r.kind} · {r.frequency} (a cada {r.interval_n}) · desde {fmtDate(r.start_date)}
              {r.active ? "" : " · pausada"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-sm font-black ${r.kind === "receita" ? "text-emerald-400" : r.kind === "despesa" ? "text-destructive" : "text-sky-400"}`}>{brl(r.amount)}</span>
            <button onClick={() => setOpen({ rec: r })} aria-label="Editar recorrência"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
            <button aria-label="Excluir recorrência"
              onClick={async () => { await deleteRecurrence(r.id); toast.success("Recorrência removida"); await onChanged(); }}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      ))}
      {open && <RecSheet rec={open.rec} onClose={() => setOpen(null)} onSaved={async () => { setOpen(null); await onChanged(); }} />}
    </div>
  );
}

function RecSheet({ rec, onClose, onSaved }: { rec?: Recurrence; onClose: () => void; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<TxKind>(rec?.kind ?? "despesa");
  const [amount, setAmount] = useState(rec ? String(rec.amount) : "");
  const [category, setCategory] = useState(rec?.category ?? "");
  const [description, setDescription] = useState(rec?.description ?? "");
  const [frequency, setFrequency] = useState<Recurrence["frequency"]>(rec?.frequency ?? "mensal");
  const [interval_n, setInterval] = useState(String(rec?.interval_n ?? 1));
  const [start_date, setStart] = useState(rec?.start_date ?? todayISO());
  const [until_date, setUntil] = useState(rec?.until_date ?? "");
  const [active, setActive] = useState(rec?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount) return;
    setSaving(true);
    try {
      await saveRecurrence({
        id: rec?.id, kind, amount: Number(amount), category: category || null,
        description: description || null, frequency, interval_n: Math.max(1, Number(interval_n) || 1),
        start_date, until_date: until_date || null, active,
      });
      await runRecurrences();
      toast.success(rec ? "Recorrência atualizada" : "Recorrência criada");
      await onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Sheet title={rec ? "Editar recorrência" : "Nova recorrência"} onClose={onClose}>
      <KindPicker kind={kind} setKind={setKind} />
      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor (R$)" className="w-full glass rounded-2xl px-4 py-4 text-lg font-black outline-none" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
      <div className="grid grid-cols-2 gap-2">
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} aria-label="Frequência" className="glass rounded-2xl px-4 py-3 text-sm outline-none">
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
        </select>
        <input type="number" min={1} value={interval_n} onChange={(e) => setInterval(e.target.value)} aria-label="A cada" className="glass rounded-2xl px-4 py-3 text-sm outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">Início
          <input type="date" value={start_date} onChange={(e) => setStart(e.target.value)} className="w-full glass rounded-2xl px-3 py-3 text-sm outline-none mt-1" />
        </label>
        <label className="text-[11px] text-muted-foreground">Até (opcional)
          <input type="date" value={until_date} onChange={(e) => setUntil(e.target.value)} className="w-full glass rounded-2xl px-3 py-3 text-sm outline-none mt-1" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativa
      </label>
      <SaveButton saving={saving} disabled={!amount} onClick={save} />
    </Sheet>
  );
}

/* ---------------- metas ---------------- */

function Metas({ saldo, onChanged }: { saldo: number; onChanged: () => Promise<void> }) {
  const { data: goals = [] } = useFinanceGoals();
  const [open, setOpen] = useState<{ goal?: FinanceGoal } | null>(null);

  return (
    <div className="space-y-2 pb-6">
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <PiggyBank className="h-5 w-5 text-gold" />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Economia acumulada</p>
          <p className="text-lg font-black">{brl(saldo)}</p>
        </div>
      </div>
      <button onClick={() => setOpen({})} className="w-full glass rounded-2xl p-4 text-sm font-semibold flex items-center justify-center gap-2 tap">
        <Plus className="h-4 w-4" /> Nova meta financeira
      </button>
      {goals.length === 0 && <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Nenhuma meta ainda.</div>}
      {goals.map((g) => {
        const pct = Math.min(100, Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100));
        return (
          <div key={g.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-xl">{g.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{brl(g.current_amount)} de {brl(g.target_amount)}{g.deadline ? ` · até ${fmtDate(g.deadline)}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-black">{pct}%</span>
                <button onClick={() => setOpen({ goal: g })} aria-label="Editar meta"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                <button aria-label="Excluir meta"
                  onClick={async () => { await deleteGoal(g.id); toast.success("Meta removida"); await onChanged(); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gold/80" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {open && <GoalSheet goal={open.goal} onClose={() => setOpen(null)} onSaved={async () => { setOpen(null); await onChanged(); }} />}
    </div>
  );
}

function GoalSheet({ goal, onClose, onSaved }: { goal?: FinanceGoal; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : "");
  const [current, setCurrent] = useState(goal ? String(goal.current_amount) : "0");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "🎯");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || !target) return;
    setSaving(true);
    try {
      await saveGoal({
        id: goal?.id, name, target_amount: Number(target), current_amount: Number(current) || 0,
        deadline: deadline || null, icon,
        completed: Number(current) >= Number(target),
      });
      toast.success(goal ? "Meta atualizada" : "Meta criada");
      await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <Sheet title={goal ? "Editar meta" : "Nova meta"} onClose={onClose}>
      <div className="flex gap-2">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="Ícone" className="w-16 glass rounded-2xl px-3 py-3 text-center text-xl outline-none" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da meta" className="flex-1 glass rounded-2xl px-4 py-3 text-sm outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Valor alvo" className="glass rounded-2xl px-4 py-3 text-sm outline-none" />
        <input type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Já guardado" className="glass rounded-2xl px-4 py-3 text-sm outline-none" />
      </div>
      <label className="text-[11px] text-muted-foreground">Prazo (opcional)
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full glass rounded-2xl px-3 py-3 text-sm outline-none mt-1" />
      </label>
      <SaveButton saving={saving} disabled={!name || !target} onClick={save} />
    </Sheet>
  );
}

/* ---------------- transação ---------------- */

function TxSheet({ tx, onClose, onSaved }: { tx?: Tx; onClose: () => void; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<TxKind>(tx?.kind ?? "despesa");
  const [amount, setAmount] = useState(tx ? String(tx.amount) : "");
  const [category, setCategory] = useState(tx?.category ?? "");
  const [description, setDescription] = useState(tx?.description ?? "");
  const [occurred_on, setDate] = useState(tx?.occurred_on ?? todayISO());
  const [account, setAccount] = useState(tx?.account ?? "");
  const [to_account, setToAccount] = useState(tx?.to_account ?? "");
  const [notes, setNotes] = useState(tx?.notes ?? "");
  const [installments, setInstallments] = useState("1");
  const [saving, setSaving] = useState(false);

  const suggestions = kind === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function save() {
    if (!amount) return;
    setSaving(true);
    try {
      const payload = {
        kind, amount: Number(amount), category: category || null,
        description: description || null, occurred_on,
        account: account || null, to_account: kind === "transferencia" ? to_account || null : null,
        notes: notes || null,
      };
      if (tx) {
        await updateTransaction(tx.id, payload);
        toast.success("Lançamento atualizado · XP recalculado");
      } else {
        await createTransaction({ ...payload, installments: Math.max(1, Number(installments) || 1) });
        toast.success("Lançamento registrado · XP recalculado");
      }
      await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <Sheet title={tx ? "Editar lançamento" : "Novo lançamento"} onClose={onClose}>
      <KindPicker kind={kind} setKind={setKind} />
      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor (R$)" className="w-full glass rounded-2xl px-4 py-4 text-lg font-black outline-none" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />

      <div>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none" />
        <div className="flex gap-1.5 overflow-x-auto pt-2 pb-1">
          {suggestions.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${category === c ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">Data
          <input type="date" value={occurred_on} onChange={(e) => setDate(e.target.value)} className="w-full glass rounded-2xl px-3 py-3 text-sm outline-none mt-1" />
        </label>
        {!tx && kind !== "transferencia" ? (
          <label className="text-[11px] text-muted-foreground">Parcelas
            <input type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full glass rounded-2xl px-3 py-3 text-sm outline-none mt-1" />
          </label>
        ) : <div />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={kind === "transferencia" ? "De (conta)" : "Conta / carteira"} className="glass rounded-2xl px-4 py-3 text-sm outline-none" />
        {kind === "transferencia" && (
          <input value={to_account} onChange={(e) => setToAccount(e.target.value)} placeholder="Para (conta)" className="glass rounded-2xl px-4 py-3 text-sm outline-none" />
        )}
      </div>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} className="w-full glass rounded-2xl px-4 py-3 text-sm outline-none resize-none" />

      {Number(installments) > 1 && !tx && (
        <p className="text-[11px] text-muted-foreground">
          {installments}x de {brl((Number(amount) || 0) / Math.max(1, Number(installments)))} — uma parcela por mês.
        </p>
      )}
      {kind === "transferencia" && (
        <p className="text-[11px] text-muted-foreground">Transferências não alteram o saldo total, apenas movem entre contas.</p>
      )}

      <SaveButton saving={saving} disabled={!amount} onClick={save} />
    </Sheet>
  );
}

/* ---------------- UI helpers ---------------- */

function KindPicker({ kind, setKind }: { kind: TxKind; setKind: (k: TxKind) => void }) {
  return (
    <div className="glass rounded-full p-1 grid grid-cols-3 text-xs font-semibold">
      <button onClick={() => setKind("despesa")} className={`rounded-full py-2 ${kind === "despesa" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"}`}>Despesa</button>
      <button onClick={() => setKind("receita")} className={`rounded-full py-2 ${kind === "receita" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"}`}>Receita</button>
      <button onClick={() => setKind("transferencia")} className={`rounded-full py-2 ${kind === "transferencia" ? "bg-sky-500/20 text-sky-400" : "text-muted-foreground"}`}>Transfer.</button>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">{title}</h3>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaveButton({ saving, disabled, onClick }: { saving: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving || disabled}
      className="w-full rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
      {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
    </button>
  );
}
