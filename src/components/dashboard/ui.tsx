import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Standardised dashboard primitives: one card shape, one type scale, one icon size. */

export function DashCard({
  children, className, delay = 0, href, onClick,
}: {
  children: React.ReactNode; className?: string; delay?: number; href?: string; onClick?: () => void;
}) {
  const base = cn(
    "relative block w-full text-left glass rounded-[24px] p-5 overflow-hidden shadow-elegant",
    "animate-rise transition-transform duration-300 active:scale-[0.985]",
    className,
  );
  const style = { animationDelay: `${delay * 60}ms` } as React.CSSProperties;
  if (href) return <Link to={href} style={style} className={cn(base, "tap")}>{children}</Link>;
  if (onClick) return <button onClick={onClick} style={style} className={cn(base, "tap")}>{children}</button>;
  return <section style={style} className={base}>{children}</section>;
}

export function CardHead({
  Icon, label, value, tint = "text-electric", href,
}: {
  Icon: LucideIcon; label: string; value?: string; tint?: string; href?: string;
}) {
  return (
    <div className="relative flex items-center gap-2 mb-4">
      <Icon className={cn("h-4 w-4 shrink-0", tint)} strokeWidth={2.2} />
      <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground truncate">
        {label}
      </span>
      <span className="ml-auto flex items-center gap-1 shrink-0">
        {value && <span className="text-[11px] font-semibold text-foreground/80">{value}</span>}
        {href !== undefined && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </span>
    </div>
  );
}

export function Stat({
  label, value, suffix, hint, tint,
}: { label: string; value: string | number; suffix?: string; hint?: string; tint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium truncate">{label}</p>
      <p className={cn("mt-1 text-[20px] font-semibold tracking-tight leading-none truncate", tint)}>
        {value}
        {suffix && <span className="text-[11px] text-muted-foreground font-normal ml-0.5">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}

export function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r from-electric to-primary transition-[width] duration-700 ease-out", className)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Ring({
  pct, size = 56, stroke = 5, children, from = "oklch(0.82 0.14 88)", to = "oklch(0.72 0.2 250)", id,
}: {
  pct: number; size?: number; stroke?: number; children?: React.ReactNode; from?: string; to?: string; id: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function SectionTitle({ title, caption, href }: { title: string; caption?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-3 px-0.5">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight truncate">{title}</h2>
        {caption && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{caption}</p>}
      </div>
      {href && (
        <Link to={href} className="tap shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition">
          Ver tudo <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="text-[12px] text-muted-foreground">{text}</p>;
}
