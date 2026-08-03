import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Target, TrendingUp, Sparkles, User } from "lucide-react";
import { AchievementUnlockOverlay } from "@/components/AchievementUnlockOverlay";
import { useTitleUnlockWatcher } from "@/lib/life-state";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const tabs = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/missoes", label: "Missões", icon: Target },
  { to: "/habilidades", label: "Evolução", icon: TrendingUp },
  { to: "/sistema", label: "Sistema", icon: Sparkles },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useTitleUnlockWatcher();


  return (
    <div className="relative min-h-dvh bg-background pb-28">
      <Outlet />
      <AchievementUnlockOverlay />


      <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom pointer-events-none">
        <div className="mx-auto max-w-md px-4 pointer-events-auto">
          <div className="glass-strong rounded-[28px] shadow-elegant px-1.5 py-1.5 flex items-center justify-between">
            {tabs.map((t) => {
              const active = path === t.to || path.startsWith(t.to + "/");
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`relative flex flex-col items-center justify-center gap-0.5 rounded-[22px] px-2 py-2 flex-1 tap ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/[0.09] to-white/[0.02] ring-hair animate-fade" />
                  )}
                  <Icon className="relative h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 1.8} />
                  <span className={`relative text-[10px] font-semibold tracking-wide ${active ? "opacity-100" : "opacity-80"}`}>
                    {t.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
