import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: Splash,
});

function Splash() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-electric/10 blur-3xl animate-pulse-glow" />

      <div className="relative flex min-h-dvh flex-col items-center justify-between px-6 py-12">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div
            className={`transition-all duration-1000 ${phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div className="mb-6 flex items-center justify-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-electric to-primary/80 shadow-glow flex items-center justify-center">
                  <span className="text-2xl font-black text-primary-foreground">A</span>
                </div>
                <div className="absolute inset-0 rounded-2xl bg-electric/40 blur-xl -z-10" />
              </div>
            </div>
            <h1 className="text-5xl font-black tracking-[0.3em] text-center">
              ASCENSION
            </h1>
            <p className="mt-4 text-center text-sm text-muted-foreground tracking-widest uppercase">
              Construa sua melhor versão
            </p>
          </div>
        </div>

        <div className={`w-full max-w-sm space-y-3 transition-all duration-700 ${phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <Link
            to="/onboarding"
            className="block w-full rounded-full bg-primary px-6 py-4 text-center text-sm font-semibold text-primary-foreground shadow-elegant hover:bg-primary/90 transition"
          >
            Começar minha ascensão
          </Link>
          <Link
            to="/auth"
            className="block w-full rounded-full border border-border px-6 py-4 text-center text-sm font-semibold text-foreground hover:bg-surface transition"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  );
}
