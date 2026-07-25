import { createFileRoute } from "@tanstack/react-router";
import { useInventory, rarityStyle } from "@/lib/life-state";
import { Package } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/inventario")({
  component: InventoryPage,
});

const FILTERS = [
  { key: "all", label: "Tudo" },
  { key: "badge", label: "Badges" },
  { key: "medal", label: "Medalhas" },
  { key: "title", label: "Títulos" },
  { key: "artifact", label: "Artefatos" },
  { key: "boost", label: "Boosts" },
  { key: "book", label: "Livros" },
] as const;

function InventoryPage() {
  const [f, setF] = useState<string>("all");
  const { data: items } = useInventory();
  const filtered = (items ?? []).filter((i) => (f === "all" ? true : i.kind === f));

  return (
    <div className="relative px-5 pt-10 safe-top pb-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[100px]" />
      <header className="relative mb-6 animate-rise">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          <p className="text-[11px] uppercase tracking-[0.22em] font-medium">Coleção</p>
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Inventário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo o que você conquistou. Desbloqueios automáticos pela jornada.
        </p>
      </header>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar animate-rise delay-1">
        {FILTERS.map((x) => (
          <button
            key={x.key}
            onClick={() => setF(x.key)}
            className={`tap shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium ring-hair transition ${
              f === x.key ? "bg-electric/20 text-electric" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center animate-rise delay-2">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-sm font-semibold">Vazio</p>
          <p className="text-xs text-muted-foreground mt-1">Continue evoluindo para desbloquear itens.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {filtered.map((item, i) => {
            const st = rarityStyle(item.rarity);
            return (
              <div
                key={item.id}
                className={`glass rounded-2xl p-3 ring-1 ${st.ring} ${st.bg} animate-rise delay-${(i % 6) + 1}`}
              >
                <div className="text-2xl mb-1.5">{item.icon}</div>
                <p className={`text-[11px] font-semibold leading-tight ${st.text} line-clamp-2`}>{item.name}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">{item.rarity}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
