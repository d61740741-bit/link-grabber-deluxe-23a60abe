import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { awardXp } from "@/lib/ascension";
import { TrendingUp, TrendingDown, Plus, X, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financas")({
  component: Financas,
});

function Financas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: txs } = useQuery({
    queryKey: ["finance"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_transactions").select("*").order("occurred_on", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const totals = (txs ?? []).reduce(
    (acc: any, t: any) => {
      if (t.kind === "receita") acc.receita += Number(t.amount);
      else acc.despesa += Number(t.amount);
      return acc;
    },
    { receita: 0, despesa: 0 }
  );
  const saldo = totals.receita - totals.despesa;

  return (
    <div className="px-5 pt-8 safe-top">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Área</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Finanças</h1>
        </div>
        <button onClick={() => setOpen(true)} className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-elegant">
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <section className="glass-strong rounded-3xl p-6 mb-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Saldo do período</p>
        <p className={`mt-2 text-4xl font-black ${saldo >= 0 ? "gradient-gold-text" : "text-destructive"}`}>
          {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Receitas</span>
          </div>
          <p className="text-xl font-black">{totals.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Despesas</span>
          </div>
          <p className="text-xl font-black">{totals.despesa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(txs ?? []).length === 0 && <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Sem transações ainda.</div>}
        {(txs ?? []).map((t: any) => (
          <div key={t.id} className="glass rounded-2xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{t.description || t.category || "Sem descrição"}</p>
              <p className="text-xs text-muted-foreground">{new Date(t.occurred_on).toLocaleDateString("pt-BR")} · {t.category || "—"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-black ${t.kind === "receita" ? "text-emerald-400" : "text-destructive"}`}>
                {t.kind === "receita" ? "+" : "-"} {Number(t.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              <button onClick={async () => { await supabase.from("finance_transactions").delete().eq("id", t.id); qc.invalidateQueries({ queryKey: ["finance"] }); }}>
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && <TxSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function TxSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"receita" | "despesa">("despesa");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("finance_transactions").insert({
      user_id: user.id, kind, amount: Number(amount), category, description,
    });
    await awardXp(10, "finance", "financas");
    toast.success("Transação registrada · +10 XP");
    qc.invalidateQueries({ queryKey: ["finance"] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Nova transação</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="glass rounded-full p-1 grid grid-cols-2 mb-4">
          <button onClick={() => setKind("despesa")} className={`rounded-full py-2 text-xs font-semibold ${kind === "despesa" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"}`}>Despesa</button>
          <button onClick={() => setKind("receita")} className={`rounded-full py-2 text-xs font-semibold ${kind === "receita" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"}`}>Receita</button>
        </div>

        <div className="space-y-3">
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor (R$)" className="w-full glass rounded-2xl px-4 py-4 text-lg font-black outline-none" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria (ex: Alimentação)" className="w-full glass rounded-2xl px-4 py-4 text-sm outline-none" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" className="w-full glass rounded-2xl px-4 py-4 text-sm outline-none" />
          <button onClick={save} disabled={saving || !amount} className="w-full rounded-full bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
