import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TxKind = "receita" | "despesa" | "transferencia";

export type Tx = {
  id: string;
  user_id: string;
  kind: TxKind;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_on: string;
  account: string | null;
  to_account: string | null;
  notes: string | null;
  installment_no: number | null;
  installment_total: number | null;
  group_id: string | null;
  recurrence_id: string | null;
  created_at: string;
};

export type Recurrence = {
  id: string;
  kind: TxKind;
  amount: number;
  category: string | null;
  description: string | null;
  account: string | null;
  to_account: string | null;
  frequency: "diaria" | "semanal" | "mensal" | "anual";
  interval_n: number;
  start_date: string;
  until_date: string | null;
  last_generated_date: string | null;
  active: boolean;
};

export type FinanceGoal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  color: string;
  completed: boolean;
};

export const EXPENSE_CATEGORIES = [
  "Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer",
  "Assinaturas", "Compras", "Investimento", "Dívidas", "Outros",
];
export const INCOME_CATEGORIES = [
  "Salário", "Freelance", "Vendas", "Rendimentos", "Presente", "Reembolso", "Outros",
];

export const brl = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthKey = (iso: string) => iso.slice(0, 7);
export const yearKey = (iso: string) => iso.slice(0, 4);

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function addMonthsISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1 + n, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* ---------------- queries ---------------- */

export function useTransactions() {
  return useQuery({
    queryKey: ["finance", "tx"],
    queryFn: async (): Promise<Tx[]> => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
    staleTime: 5_000,
  });
}

export function useRecurrences() {
  return useQuery({
    queryKey: ["finance", "recurrences"],
    queryFn: async (): Promise<Recurrence[]> => {
      const { data } = await (supabase as any)
        .from("finance_recurrences")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as Recurrence[];
    },
    staleTime: 15_000,
  });
}

export function useFinanceGoals() {
  return useQuery({
    queryKey: ["finance", "goals"],
    queryFn: async (): Promise<FinanceGoal[]> => {
      const { data } = await (supabase as any)
        .from("finance_goals")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []).map((g: any) => ({
        ...g,
        target_amount: Number(g.target_amount),
        current_amount: Number(g.current_amount),
      })) as FinanceGoal[];
    },
    staleTime: 15_000,
  });
}

/* ---------------- mutations ---------------- */

async function uid() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export type TxInput = {
  kind: TxKind;
  amount: number;
  category?: string | null;
  description?: string | null;
  occurred_on: string;
  account?: string | null;
  to_account?: string | null;
  notes?: string | null;
  installments?: number;
};

/** Creates one transaction, or N linked installments (parcelamento). */
export async function createTransaction(input: TxInput) {
  const user_id = await uid();
  const n = Math.max(1, Math.floor(input.installments || 1));
  const group_id = n > 1 ? crypto.randomUUID() : null;
  const per = n > 1 ? Math.round((input.amount / n) * 100) / 100 : input.amount;

  const rows = Array.from({ length: n }, (_, i) => ({
    user_id,
    kind: input.kind,
    amount: per,
    category: input.category || null,
    description: input.description || null,
    occurred_on: i === 0 ? input.occurred_on : addMonthsISO(input.occurred_on, i),
    account: input.account || null,
    to_account: input.kind === "transferencia" ? input.to_account || null : null,
    notes: input.notes || null,
    installment_no: n > 1 ? i + 1 : null,
    installment_total: n > 1 ? n : null,
    group_id,
  }));

  const { error } = await (supabase as any).from("finance_transactions").insert(rows);
  if (error) throw error;
}

export async function updateTransaction(id: string, patch: Partial<TxInput>) {
  const { installments: _drop, ...rest } = patch as any;
  const { error } = await (supabase as any)
    .from("finance_transactions")
    .update(rest)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
  if (error) throw error;
}

/** Deletes every installment of the same purchase. */
export async function deleteGroup(groupId: string) {
  const { error } = await (supabase as any)
    .from("finance_transactions")
    .delete()
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function saveRecurrence(input: Partial<Recurrence> & { id?: string }) {
  const user_id = await uid();
  const payload = { ...input, user_id };
  const { error } = input.id
    ? await (supabase as any).from("finance_recurrences").update(input).eq("id", input.id)
    : await (supabase as any).from("finance_recurrences").insert(payload);
  if (error) throw error;
}

export async function deleteRecurrence(id: string) {
  const { error } = await (supabase as any).from("finance_recurrences").delete().eq("id", id);
  if (error) throw error;
}

export async function runRecurrences() {
  const { data, error } = await (supabase as any).rpc("generate_recurring_finance");
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function saveGoal(input: Partial<FinanceGoal> & { id?: string }) {
  const user_id = await uid();
  const { error } = input.id
    ? await (supabase as any).from("finance_goals").update(input).eq("id", input.id)
    : await (supabase as any).from("finance_goals").insert({ ...input, user_id });
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  const { error } = await (supabase as any).from("finance_goals").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- realtime + refresh ---------------- */

export function useFinanceRefresh() {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries();
  };
}

export function useFinanceRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("finance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, () => {
        qc.invalidateQueries({ queryKey: ["finance"] });
        qc.invalidateQueries({ queryKey: ["life-state"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

/* ---------------- analytics ---------------- */

/** Transfers never change the balance: money only moves between accounts. */
export function signedAmount(t: Tx) {
  if (t.kind === "receita") return t.amount;
  if (t.kind === "despesa") return -t.amount;
  return 0;
}

export function summarize(txs: Tx[]) {
  let receita = 0, despesa = 0, transferencia = 0;
  for (const t of txs) {
    if (t.kind === "receita") receita += t.amount;
    else if (t.kind === "despesa") despesa += t.amount;
    else transferencia += t.amount;
  }
  const saldo = receita - despesa;
  return {
    receita,
    despesa,
    transferencia,
    saldo,
    economiaPct: receita > 0 ? Math.max(0, Math.round((saldo / receita) * 100)) : 0,
  };
}

export function byMonth(txs: Tx[]) {
  const map = new Map<string, { key: string; receita: number; despesa: number; saldo: number }>();
  for (const t of txs) {
    const k = monthKey(t.occurred_on);
    const row = map.get(k) ?? { key: k, receita: 0, despesa: 0, saldo: 0 };
    if (t.kind === "receita") row.receita += t.amount;
    else if (t.kind === "despesa") row.despesa += t.amount;
    row.saldo = row.receita - row.despesa;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function byCategory(txs: Tx[], kind: TxKind) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.kind !== kind) continue;
    const k = t.category || "Sem categoria";
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function biggest(txs: Tx[], kind: TxKind) {
  return txs.filter((t) => t.kind === kind).sort((a, b) => b.amount - a.amount)[0] ?? null;
}
