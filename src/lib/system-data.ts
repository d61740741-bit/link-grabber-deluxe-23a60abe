// Dados auxiliares do Sistema Central: histórico de XP, moedas, life score,
// abertura de caixas e equipar títulos. Camada só de leitura/ações — não altera
// nenhuma regra existente.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type XpRow = { id: string; amount: number; source: string; created_at: string; skill_category: string | null };
export type PurchaseRow = { id: string; item_key: string; price: number; created_at: string };

export function useXpHistory(days = 365) {
  return useQuery({
    queryKey: ["xp-history-system", days],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - days);
      const { data, error } = await supabase
        .from("xp_history")
        .select("id, amount, source, created_at, skill_category")
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as XpRow[];
    },
    staleTime: 30_000,
  });
}

export function usePurchases() {
  return useQuery({
    queryKey: ["shop-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_purchases")
        .select("id, item_key, price, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseRow[];
    },
    staleTime: 30_000,
  });
}

function startOf(kind: "day" | "week" | "month") {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (kind === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (kind === "month") d.setDate(1);
  return d;
}

export function xpBuckets(rows: XpRow[] = []) {
  const day = startOf("day").getTime();
  const week = startOf("week").getTime();
  const month = startOf("month").getTime();
  let today = 0, thisWeek = 0, thisMonth = 0, total = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    total += r.amount;
    if (t >= month) thisMonth += r.amount;
    if (t >= week) thisWeek += r.amount;
    if (t >= day) today += r.amount;
  }
  return { today, week: thisWeek, month: thisMonth, total };
}

/** Série diária dos últimos N dias, pronta para gráfico. */
export function xpSeries(rows: XpRow[] = [], days = 14) {
  const out: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = d.getTime() + 86400000;
    const value = rows.reduce((s, r) => {
      const t = new Date(r.created_at).getTime();
      return t >= d.getTime() && t < next ? s + r.amount : s;
    }, 0);
    out.push({ label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value });
  }
  return out;
}

/** Agrupa XP por origem (missões, hábitos, biblioteca…). */
export function xpBySource(rows: XpRow[] = []) {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.source, (map.get(r.source) ?? 0) + r.amount));
  return [...map.entries()].map(([source, amount]) => ({ source, amount })).sort((a, b) => b.amount - a.amount);
}

export type BoxReward = {
  key: string; name: string; description: string | null; icon: string; kind: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
};

export function useOpenBox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inventoryId: string) => {
      const { data, error } = await supabase.rpc("open_system_box" as never, { p_inventory_id: inventoryId } as never);
      if (error) throw error;
      return data as unknown as { box: string; rewards: BoxReward[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["character-state"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível abrir a caixa"),
  });
}

export function useEquipTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.rpc("equip_title" as never, { p_key: key } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Título equipado!");
      qc.invalidateQueries({ queryKey: ["character-state"] });
      qc.invalidateQueries({ queryKey: ["user-titles"] });
      qc.invalidateQueries({ queryKey: ["life-state"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível equipar"),
  });
}
