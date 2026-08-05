// Camada de interação do Sistema: modais, painéis de detalhe, fluxo de compra
// com quantidade e a cinemática de abertura de caixas.
// Mantém a identidade visual atual (glass, ring-hair, electric).

import { useEffect, useMemo, useState } from "react";
import { X, Gem, Check, Coins } from "lucide-react";
import { rarityStyle, type InventoryItem } from "@/lib/life-state";
import { useOpenBox, type BoxReward } from "@/lib/system-data";

/* ───────── modal / drawer ───────── */

export function SysModal({
  open, onClose, title, sub, icon, children, tone = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full sm:max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar glass rounded-t-3xl sm:rounded-3xl p-5 ring-hair animate-rise ${tone}`}
      >
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-electric/15 blur-3xl" />
        <div className="relative flex items-start gap-3 mb-4">
          {icon && <span className="text-3xl leading-none">{icon}</span>}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight">{title}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="tap rounded-full p-1.5 ring-hair bg-white/[0.04] text-muted-foreground hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative space-y-3">{children}</div>
      </div>
    </div>
  );
}

/** Card clicável com hover/scale/ripple discretos. */
export function Clickable({
  onClick, className = "", children, disabled,
}: { onClick?: () => void; className?: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`tap text-left w-full transition-all duration-200 hover:brightness-110 hover:-translate-y-[1px] active:scale-[0.985] ${className}`}
    >
      {children}
    </button>
  );
}

export function ModalRow({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] ring-hair px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-semibold text-right ${tone}`}>{value}</span>
    </div>
  );
}

export function ModalBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5">{title}</p>
      {children}
    </div>
  );
}

/** Mini gráfico de barras sem dependências. */
export function Spark({ data, className = "bg-electric" }: { data: { label: string; value: number }[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-[3px] h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 group relative flex flex-col justify-end h-full" title={`${d.label}: ${d.value}`}>
          <div
            className={`w-full rounded-t-[3px] ${className} transition-all duration-700`}
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ───────── fluxo de compra ───────── */

const QTYS = [1, 5, 10, 25, 50, 100];
const PHASES = ["COMPRA CONFIRMADA", "SINCRONIZANDO SISTEMA", "MATERIALIZANDO ITEM", "AQUISIÇÃO CONCLUÍDA"];

export function PurchaseFlow({
  open, onClose, item, balance, onConfirm, pending, allowQty = true, onOpenNow,
}: {
  open: boolean;
  onClose: () => void;
  item: { key: string; name: string; icon: string; price: number; rarity: string; description: string | null } | null;
  balance: number;
  onConfirm: (qty: number) => Promise<void> | void;
  pending?: boolean;
  allowQty?: boolean;
  onOpenNow?: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [phase, setPhase] = useState(-1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) { setQty(1); setPhase(-1); setDone(false); }
  }, [open, item?.key]);

  useEffect(() => {
    if (phase < 0 || phase >= PHASES.length) return;
    const t = setTimeout(() => {
      if (phase === PHASES.length - 1) setDone(true);
      else setPhase((p) => p + 1);
    }, 750);
    return () => clearTimeout(t);
  }, [phase]);

  if (!item) return null;
  const total = item.price * qty;
  const rest = balance - total;
  const st = rarityStyle(item.rarity as never);

  const run = async () => {
    try {
      await onConfirm(qty);
      setPhase(0);
    } catch { /* erro já tratado pela mutation */ }
  };

  return (
    <SysModal open={open} onClose={onClose} title={item.name} sub={`${item.rarity} · ${item.description ?? ""}`} icon={item.icon}>
      {phase < 0 ? (
        <>
          {allowQty && (
            <ModalBlock title="Quantidade">
              <div className="flex flex-wrap gap-2">
                {QTYS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQty(q)}
                    className={`tap rounded-full px-3 py-1.5 text-[11px] font-semibold ring-hair transition ${
                      qty === q ? "bg-electric/20 text-electric scale-105" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {q}x
                  </button>
                ))}
              </div>
            </ModalBlock>
          )}
          <ModalRow label="Preço unitário" value={<span className="text-amber-300">{item.price.toLocaleString("pt-BR")}</span>} />
          <ModalRow label="Preço total" value={<span className="text-amber-300">{total.toLocaleString("pt-BR")}</span>} />
          <ModalRow label="Saldo atual" value={balance.toLocaleString("pt-BR")} />
          <ModalRow label="Saldo restante" value={rest.toLocaleString("pt-BR")} tone={rest < 0 ? "text-rose-300" : "text-emerald-300"} />
          <button
            disabled={rest < 0 || pending}
            onClick={run}
            className={`tap w-full rounded-2xl py-3 text-[13px] font-semibold ring-hair transition flex items-center justify-center gap-2 ${
              rest < 0 ? "bg-white/[0.03] text-muted-foreground/60" : "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
            }`}
          >
            <Gem className="h-4 w-4" /> {rest < 0 ? "Fragmentos insuficientes" : "Confirmar aquisição"}
          </button>
        </>
      ) : (
        <div className={`relative overflow-hidden rounded-3xl ring-1 ${st.ring} ${st.bg} py-10 text-center`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent animate-pulse" />
          <p className="text-5xl animate-scale-in">{item.icon}</p>
          <div className="mt-5 space-y-1.5 px-6">
            {PHASES.map((p, i) => (
              <p
                key={p}
                className={`text-[11px] uppercase tracking-[0.24em] transition-all duration-500 ${
                  i <= phase ? "text-electric opacity-100" : "opacity-20"
                }`}
              >
                {i < phase || done ? "▸ " : i === phase ? "▹ " : "· "}{p}
              </p>
            ))}
          </div>
          {done && (
            <div className="mt-6 px-6 space-y-2 animate-rise">
              {onOpenNow && (
                <button onClick={onOpenNow} className="tap w-full rounded-2xl py-2.5 text-[12px] font-semibold bg-electric/20 text-electric ring-hair hover:bg-electric/30 transition">
                  ABRIR AGORA
                </button>
              )}
              <button onClick={onClose} className="tap w-full rounded-2xl py-2.5 text-[12px] font-semibold bg-white/[0.05] text-muted-foreground ring-hair hover:text-foreground transition">
                GUARDAR NO INVENTÁRIO
              </button>
            </div>
          )}
        </div>
      )}
    </SysModal>
  );
}

/* ───────── cinemática de abertura de caixa ───────── */

const BOX_LINES = [
  "RECOMPENSA EXTRA DETECTADA",
  "ANALISANDO...",
  "COMPATIBILIDADE CONFIRMADA",
  "MATERIALIZANDO RECOMPENSA",
];

export function BoxOpening({ box, onClose }: { box: InventoryItem | null; onClose: () => void }) {
  const openBox = useOpenBox();
  const [line, setLine] = useState(0);
  const [burst, setBurst] = useState(false);
  const [rewards, setRewards] = useState<BoxReward[] | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!box) return;
    setLine(0); setBurst(false); setRewards(null); setShown(0);
    openBox.mutateAsync(box.id).then((r) => setRewards(r?.rewards ?? [])).catch(() => onClose());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box?.id]);

  useEffect(() => {
    if (!box) return;
    if (line < BOX_LINES.length - 1) {
      const t = setTimeout(() => setLine((l) => l + 1), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBurst(true), 900);
    return () => clearTimeout(t);
  }, [line, box]);

  useEffect(() => {
    if (!burst || !rewards) return;
    if (shown >= rewards.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [burst, rewards, shown]);

  const sparks = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ left: (i * 41) % 100, top: (i * 67) % 100, d: (i % 10) * 0.35, s: 1 + (i % 3) })),
    [],
  );

  if (!box) return null;
  const allShown = !!rewards && shown >= rewards.length;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/92 backdrop-blur-xl animate-fade-in">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {sparks.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-electric/70 animate-pulse"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.s, height: p.s, animationDelay: `${p.d}s`, animationDuration: "2.6s" }}
          />
        ))}
      </div>
      <div className="relative w-full max-w-md px-6 text-center">
        {!burst ? (
          <>
            <div className="relative mx-auto h-40 w-40 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-electric/25 blur-3xl animate-pulse" />
              <span className="relative text-[86px] animate-scale-in" style={{ animationDuration: "1.2s" }}>{box.icon}</span>
            </div>
            <p className="mt-6 text-[13px] font-semibold">{box.name}</p>
            <div className="mt-5 space-y-1.5">
              {BOX_LINES.map((l, i) => (
                <p key={l} className={`text-[11px] uppercase tracking-[0.26em] transition-all duration-500 ${i <= line ? "text-electric" : "opacity-15"}`}>
                  {l}
                </p>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="relative mx-auto h-24 w-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-white/40 blur-3xl animate-pulse" />
              <span className="relative text-5xl">✨</span>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-electric">Recompensas materializadas</p>
            <div className="mt-5 space-y-2 max-h-[46vh] overflow-y-auto no-scrollbar">
              {(rewards ?? []).slice(0, shown).map((r, i) => {
                const st = rarityStyle(r.rarity);
                return (
                  <div key={i} className={`animate-rise glass rounded-2xl p-3.5 ring-1 ${st.ring} ${st.bg} flex items-center gap-3 text-left`}>
                    <span className="text-3xl">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold ${st.text}`}>{r.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-0.5">1x · {r.rarity} · {r.kind}</p>
                    </div>
                    <Check className="h-4 w-4 text-emerald-300" />
                  </div>
                );
              })}
              {rewards === null && <p className="text-[11px] text-muted-foreground">Sincronizando…</p>}
            </div>
            {allShown && (
              <button onClick={onClose} className="tap mt-5 w-full rounded-2xl py-3 text-[12px] font-semibold bg-electric/20 text-electric ring-hair hover:bg-electric/30 transition animate-rise">
                GUARDAR NO INVENTÁRIO
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function CoinLine({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-amber-300"><Coins className="h-3 w-3" />{value.toLocaleString("pt-BR")}</span>
  );
}
