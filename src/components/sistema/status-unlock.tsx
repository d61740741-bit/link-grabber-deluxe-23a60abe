// Sequência de desbloqueio do STATUS DO SISTEMA:
// "ANALISANDO..." → "STATUS DESBLOQUEADO."
import { useEffect, useRef, useState } from "react";
import type { StatusTier } from "@/lib/system";

const KEY = "los_status_seen";

function readSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Detecta a subida de status e devolve o tier recém-desbloqueado. */
export function useStatusUnlock(tier: StatusTier | undefined, index: number) {
  const [unlocked, setUnlocked] = useState<StatusTier | null>(null);
  const boot = useRef(false);

  useEffect(() => {
    if (!tier) return;
    const seen = readSeen();
    if (!boot.current) {
      boot.current = true;
      if (seen === null) {
        try { window.localStorage.setItem(KEY, tier.key); } catch { /* ignore */ }
        return;
      }
    }
    if (seen === tier.key) return;
    const seenIdx = seen;
    if (seenIdx !== tier.key && index >= 0) {
      try { window.localStorage.setItem(KEY, tier.key); } catch { /* ignore */ }
      setUnlocked(tier);
    }
  }, [tier, index]);

  return { unlocked, dismiss: () => setUnlocked(null) };
}

export function StatusUnlockOverlay({ tier, onDone }: { tier: StatusTier; onDone: () => void }) {
  const [phase, setPhase] = useState<"analyzing" | "revealed">("analyzing");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("revealed"), 2200);
    const t2 = setTimeout(onDone, 6200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90 backdrop-blur-xl animate-fade-in"
      onClick={onDone}
      role="dialog"
      aria-live="assertive"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-electric/60 animate-pulse"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${i * 120}ms`,
            }}
          />
        ))}
      </div>

      <div className="relative text-center px-8">
        {phase === "analyzing" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.5em] text-muted-foreground animate-pulse">
              Analisando…
            </p>
            <div className="mt-6 mx-auto h-px w-56 overflow-hidden bg-white/10">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-electric to-transparent animate-[slide-in-right_1.1s_ease-in-out_infinite]" />
            </div>
            <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
              lendo padrões de comportamento
            </p>
          </>
        ) : (
          <div className="animate-scale-in">
            <p className="text-[11px] uppercase tracking-[0.45em] text-electric">Status desbloqueado.</p>
            <p className="mt-6 text-6xl">{tier.icon}</p>
            <p className={`mt-3 text-3xl font-semibold tracking-tight ${tier.aura}`}>{tier.name}</p>
            <p className="mt-3 max-w-xs mx-auto text-[12px] text-muted-foreground">{tier.desc}</p>
            <p className="mt-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">toque para continuar</p>
          </div>
        )}
      </div>
    </div>
  );
}
