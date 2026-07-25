import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTitles, useLifeState, rarityStyle, type UserTitle } from "@/lib/life-state";
import { Check, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/titulos")({
  component: TitlesPage,
});

const RARITY_ORDER: UserTitle["rarity"][] = ["mythic", "legendary", "epic", "rare", "common"];

function TitlesPage() {
  const qc = useQueryClient();
  const { data: titles } = useTitles();
  const { data: life } = useLifeState();
  const equipped = life?.profile?.equipped_title as string | null | undefined;

  async function equip(key: string | null) {
    const { error } = await supabase.rpc("equip_title", { p_key: key ?? "" });
    if (error) {
      toast.error("Erro ao equipar título");
      return;
    }
    toast.success(key ? "Título equipado" : "Título removido");
    await qc.invalidateQueries();
  }

  const groups = RARITY_ORDER.map((r) => ({
    rarity: r,
    items: (titles ?? []).filter((t) => t.rarity === r),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="relative px-5 pt-10 safe-top pb-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-[100px]" />

      <header className="relative mb-6 animate-rise">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" />
          <p className="text-[11px] uppercase tracking-[0.22em] font-medium">Coleção</p>
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Títulos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Desbloqueados automaticamente pela sua jornada. Equipe um para mostrar no perfil.
        </p>
      </header>

      {(titles?.length ?? 0) === 0 && (
        <div className="glass rounded-3xl p-8 text-center animate-rise delay-1">
          <p className="text-5xl mb-3">🎖️</p>
          <p className="text-sm font-semibold">Nenhum título ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete missões, mantenha streaks, treine e leia para desbloquear.
          </p>
        </div>
      )}

      {equipped && (
        <button
          onClick={() => equip(null)}
          className="tap mb-4 w-full glass rounded-2xl p-3 text-xs text-muted-foreground hover:text-foreground transition animate-rise delay-1"
        >
          Remover título equipado
        </button>
      )}

      <div className="space-y-6">
        {groups.map((g, gi) => (
          <section key={g.rarity} className={`animate-rise delay-${Math.min(6, gi + 2)}`}>
            <h2 className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
              {g.rarity}
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {g.items.map((t) => {
                const st = rarityStyle(t.rarity);
                const isEq = equipped === t.title_key;
                return (
                  <button
                    key={t.id}
                    onClick={() => equip(t.title_key)}
                    className={`tap text-left glass rounded-3xl p-4 ring-1 ${st.ring} ${st.bg} ${isEq ? "shadow-elegant" : ""} relative overflow-hidden`}
                  >
                    {isEq && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40 flex items-center justify-center">
                        <Check className="h-3 w-3 text-emerald-300" />
                      </div>
                    )}
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <p className={`text-[13px] font-semibold leading-tight ${st.text}`}>{t.title_name}</p>
                    {t.description && (
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{t.description}</p>
                    )}
                    <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      {new Date(t.earned_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
