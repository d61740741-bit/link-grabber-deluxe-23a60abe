import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O caminho que você procura não existe.
        </p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          Voltar ao início
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente ou volte ao início.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a href="/" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#080808" },
      { title: "ASCENSION — Seu sistema operacional pessoal" },
      { name: "description", content: "Torne-se sua melhor versão. Disciplina, conhecimento, saúde e evolução — em um só sistema." },
      { name: "author", content: "ASCENSION" },
      { property: "og:title", content: "ASCENSION — Seu sistema operacional pessoal" },
      { property: "og:description", content: "Torne-se sua melhor versão. Disciplina, conhecimento, saúde e evolução — em um só sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ASCENSION — Seu sistema operacional pessoal" },
      { name: "twitter:description", content: "Torne-se sua melhor versão. Disciplina, conhecimento, saúde e evolução — em um só sistema." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aa990fc0-7f87-49b3-98c5-762bbe9d2b1e/id-preview-1cbd7747--71f8f1e1-fb36-4ced-b0cb-67d552485e1a.lovable.app-1784739231940.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aa990fc0-7f87-49b3-98c5-762bbe9d2b1e/id-preview-1cbd7747--71f8f1e1-fb36-4ced-b0cb-67d552485e1a.lovable.app-1784739231940.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUserId(session?.user?.id ?? null);
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [router, queryClient]);

  // Live sync: any change to gamified data invalidates all queries so every
  // dashboard number (XP, level, streak, stats, calendar, heatmap...) refreshes
  // instantly — no manual reload, always fetched from the database.
  useEffect(() => {
    if (!userId) return;

    const invalidate = () => queryClient.invalidateQueries();
    const tables = [
      "tasks", "xp_history", "profiles", "skills", "habits", "achievements",
      "journal_entries", "workouts", "workout_exercises", "health_logs",
      "finance_transactions", "goals", "library_items",
      "bad_habits", "bad_habit_relapses", "recovery_missions",
      "focus_sessions", "user_titles", "timeline_events",
      "inventory_items", "life_score_snapshots", "weekly_bosses",
    ] as const;

    let ch = supabase.channel(`live-${userId}`);
    for (const table of tables) {
      const filter = table === "profiles" ? `id=eq.${userId}` : `user_id=eq.${userId}`;
      ch = ch.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter },
        invalidate,
      );
    }
    const channel = ch.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" theme="dark" />
    </QueryClientProvider>
  );
}
