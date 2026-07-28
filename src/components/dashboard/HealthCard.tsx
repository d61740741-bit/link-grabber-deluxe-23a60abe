import { Link } from "@tanstack/react-router";
import { Droplets, Moon, Smile, ChevronRight } from "lucide-react";
import { useHealthGoals, useHealthLogs, useTodayLog, useHealthRealtime, avg, inLastDays, MOOD_FACES, type HealthLog } from "@/lib/health";

export function HealthCard() {
  useHealthRealtime();
  const { data: goals } = useHealthGoals();
  const { data: today } = useTodayLog();
  const { data: logs = [] } = useHealthLogs(30);

  const goal = goals?.water_ml_goal ?? 2500;
  const water = today?.water_ml ?? 0;
  const pct = Math.min(100, Math.round((water / Math.max(1, goal)) * 100));
  const sleepAvg = avg(inLastDays(logs, 7).filter((l: HealthLog) => l.sleep_hours != null).map((l: HealthLog) => Number(l.sleep_hours)));

  return (
    <Link to="/saude" className="tap block glass-strong rounded-3xl p-4 mb-4 shadow-elegant">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-bold">Saúde de hoje</p>
        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[10px] uppercase tracking-wider">Água</span>
          </div>
          <p className="text-lg font-black mt-0.5">{pct}%</p>
          <div className="h-1.5 rounded-full bg-muted/40 mt-1 overflow-hidden">
            <div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Moon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] uppercase tracking-wider">Sono 7d</span>
          </div>
          <p className="text-lg font-black mt-0.5">{sleepAvg ? `${sleepAvg.toFixed(1)}h` : "—"}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Smile className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider">Humor</span>
          </div>
          <p className="text-lg font-black mt-0.5">{today?.mood ? MOOD_FACES[today.mood - 1] : "—"}</p>
        </div>
      </div>
    </Link>
  );
}
