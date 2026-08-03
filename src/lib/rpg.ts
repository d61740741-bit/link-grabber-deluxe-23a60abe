// Sistema Central — camada RPG do Life OS.
// Atributos, classes, fragmentos (moeda), loja e artefatos.
// Modular por design: novos módulos só precisam expor dados; os atributos e
// recompensas são derivados no banco (get_character_attributes / get_coin_balance).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Attribute = {
  key: string;
  label: string;
  icon: string;
  points: number;
  level: number;
};

export type CharacterClass = {
  key: string;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  primary_attr: string;
  secondary_attr: string | null;
  requirements: Record<string, number>;
  perks: string[];
  sort_order: number;
};

export type ShopItem = {
  key: string;
  name: string;
  description: string | null;
  icon: string;
  kind: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  price: number;
  required_level: number;
  metadata: Record<string, unknown>;
  sort_order: number;
};

export type CharacterState = {
  profile: {
    id: string;
    level: number;
    total_xp: number;
    streak_days: number;
    current_rank: string | null;
    life_score: number | null;
    equipped_title: string | null;
    class_key: string | null;
    full_name: string | null;
    username: string | null;
  } | null;
  attributes: Attribute[];
  coins: { balance: number; earned: number; spent: number };
  class: CharacterClass | null;
  classes: CharacterClass[];
  purchases: string[];
  achievements: number;
  titles: number;
  missions: number;
  skills: { id: string; level: number; total_xp: number }[];
};

export const ATTRIBUTE_TONE: Record<string, { grad: string; text: string; bar: string }> = {
  forca: { grad: "from-orange-500/35 to-orange-500/5", text: "text-orange-300", bar: "bg-orange-400" },
  vitalidade: { grad: "from-rose-500/35 to-rose-500/5", text: "text-rose-300", bar: "bg-rose-400" },
  intelecto: { grad: "from-sky-500/35 to-sky-500/5", text: "text-sky-300", bar: "bg-sky-400" },
  disciplina: { grad: "from-violet-500/35 to-violet-500/5", text: "text-violet-300", bar: "bg-violet-400" },
  carisma: { grad: "from-pink-500/35 to-pink-500/5", text: "text-pink-300", bar: "bg-pink-400" },
  riqueza: { grad: "from-amber-500/35 to-amber-500/5", text: "text-amber-300", bar: "bg-amber-400" },
};

export function attrTone(key: string) {
  return ATTRIBUTE_TONE[key] ?? ATTRIBUTE_TONE.disciplina;
}

/** points -> level usa a mesma curva do banco: level = floor(sqrt(p/20)) + 1 */
export function attributeProgress(points: number) {
  const p = Math.max(0, Math.floor(points || 0));
  const level = Math.max(1, Math.floor(Math.sqrt(p / 20)) + 1);
  const cur = 20 * (level - 1) * (level - 1);
  const next = 20 * level * level;
  const span = Math.max(1, next - cur);
  const done = Math.max(0, Math.min(span, p - cur));
  return { level, pct: Math.round((done / span) * 100), done, span, remaining: span - done, next };
}

export function useCharacter() {
  return useQuery({
    queryKey: ["character-state"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_character_state" as never);
      if (error) throw error;
      return data as unknown as CharacterState;
    },
    staleTime: 20_000,
  });
}

export function useShop() {
  return useQuery({
    queryKey: ["shop-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_items" as never)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as ShopItem[];
    },
    staleTime: 300_000,
  });
}

export function useBuyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data, error } = await supabase.rpc("buy_shop_item" as never, { p_item_key: key } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Artefato adquirido!", { description: "Adicionado ao seu inventário." });
      qc.invalidateQueries({ queryKey: ["character-state"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Não foi possível comprar";
      toast.error(msg);
    },
  });
}

export function useSetClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.rpc("set_character_class" as never, { p_key: key } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classe despertada!");
      qc.invalidateQueries({ queryKey: ["character-state"] });
      qc.invalidateQueries({ queryKey: ["life-state"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Requisitos não cumpridos";
      toast.error(msg);
    },
  });
}

export function classUnlocked(cls: CharacterClass, attrs: Attribute[]) {
  const reqs = Object.entries(cls.requirements ?? {});
  const missing = reqs.filter(([k, v]) => {
    const a = attrs.find((x) => x.key === k);
    return (a?.level ?? 0) < Number(v);
  });
  return { unlocked: missing.length === 0, reqs, missing };
}
