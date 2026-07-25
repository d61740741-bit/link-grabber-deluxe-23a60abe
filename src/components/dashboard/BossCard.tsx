import { useWeeklyBoss } from "@/lib/life-state";
import { Swords, Trophy } from "lucide-react";

export function BossCard() {
  const { data: boss } = useWeeklyBoss();
  if (!boss) return null;
  const done = boss.status === "completed";

  return (
    <section className="relative glass-strong rounded-[24px] p-5 mb-5 overflow-hidden shadow-elegant animate-rise delay-2">
      <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full ${done ? "bg-emerald-500/20" : "bg-rose-500/20"} blur-3xl`} />
      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Swords className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-[0.22em] font-medium">Boss da semana</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl">{boss.icon}</span>
            <span className="text-[16px] font-semibold tracking-tight">{boss.name}</span>
          </div>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ring-hair ${done ? "text-emerald-300 bg-emerald-500/10" : "text-amber-300 bg-amber-500/10"}`}>
          {done ? <><Trophy className="inline h-3 w-3 mr-1" />Vencido</> : `+${boss.xp_reward} XP`}
        </span>
      </div>
      <div className="space-y-2 relative">
        {boss.objectives.map((o) => {
          const pct = Math.min(100, (o.current / Math.max(1, o.target)) * 100);
          const complete = o.current >= o.target;
          return (
            <div key={o.key}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className={complete ? "text-emerald-300" : "text-foreground/80"}>{o.label}</span>
                <span className="text-muted-foreground">{o.current}/{o.target}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-electric to-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
