import { createFileRoute } from "@tanstack/react-router";
import { useTimeline } from "@/lib/life-state";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/linha-do-tempo")({
  component: TimelinePage,
});

function TimelinePage() {
  const { data: events } = useTimeline(200);

  return (
    <div className="relative px-5 pt-10 safe-top pb-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-electric/10 blur-[100px]" />

      <header className="relative mb-6 animate-rise">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <p className="text-[11px] uppercase tracking-[0.22em] font-medium">Sua história</p>
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Linha do tempo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada marco importante registrado automaticamente.
        </p>
      </header>

      {(events?.length ?? 0) === 0 ? (
        <div className="glass rounded-3xl p-8 text-center animate-rise delay-1">
          <p className="text-5xl mb-3">🕰️</p>
          <p className="text-sm font-semibold">Sua linha do tempo está vazia</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete missões e suba de nível para começar sua história.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[27px] top-2 bottom-2 w-px bg-white/[0.08]" />
          <div className="space-y-3">
            {events!.map((e, i) => (
              <div key={e.id} className={`relative flex gap-4 animate-rise delay-${(i % 6) + 1}`}>
                <div className="relative shrink-0 h-[56px] w-[56px] rounded-2xl glass flex items-center justify-center text-2xl ring-hair z-10">
                  {e.icon}
                </div>
                <div className="flex-1 glass rounded-3xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-semibold leading-tight">{e.title}</p>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      {new Date(e.occurred_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  {e.description && (
                    <p className="mt-1 text-[12px] text-muted-foreground">{e.description}</p>
                  )}
                  <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
                    {e.category}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
