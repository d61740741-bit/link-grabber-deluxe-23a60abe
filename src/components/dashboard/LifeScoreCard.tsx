import { Link } from "@tanstack/react-router";
import { useLifeState, RANK_META, rarityStyle } from "@/lib/life-state";
import { Activity, Trophy, ChevronRight } from "lucide-react";

export function LifeScoreCard() {
  const { data } = useLifeState();
  const score = Number(data?.life_score ?? 0);
  const rank = (data?.rank ?? "beginner") as string;
  const meta = RANK_META[rank] ?? RANK_META.beginner;
  const equipped = data?.profile?.equipped_title as string | null | undefined;
  const titles = (data?.titles ?? []) as any[];
  const equippedTitle = equipped ? titles.find((t) => t.title_key === equipped) : null;

  const pct = Math.max(0, Math.min(100, score));
  const stroke = 8;
  const size = 128;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const dash = (pct / 100) * c;

  return (
    <Link
      to="/perfil"
      className="tap block relative glass-strong rounded-[28px] p-5 mb-5 overflow-hidden shadow-elegant"
    >
      <div className={`absolute -top-20 -right-16 h-56 w-56 rounded-full bg-gradient-to-br ${meta.tone} blur-3xl opacity-60`} />
      <div className="relative flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius}
              stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={radius}
              stroke="url(#lifeGrad)" strokeWidth={stroke} fill="none"
              strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
              className="transition-[stroke-dasharray] duration-700 ease-out" />
            <defs>
              <linearGradient id="lifeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.75 0.18 200)" />
                <stop offset="100%" stopColor="oklch(0.7 0.22 320)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[28px] font-semibold tracking-tight leading-none">{score.toFixed(0)}</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mt-1">Life Score</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-[0.22em] font-medium">Estado atual</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-2xl">{meta.icon}</span>
            <span className="text-[17px] font-semibold tracking-tight">{meta.name}</span>
          </div>
          {equippedTitle ? (
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 ring-hair ${rarityStyle(equippedTitle.rarity).bg}`}>
              <Trophy className={`h-3 w-3 ${rarityStyle(equippedTitle.rarity).text}`} />
              <span className={`text-[10px] font-semibold ${rarityStyle(equippedTitle.rarity).text}`}>
                {equippedTitle.icon} {equippedTitle.title_name}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Sem título equipado · <span className="underline underline-offset-2">escolher</span>
            </p>
          )}
          <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            Ver perfil
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}
