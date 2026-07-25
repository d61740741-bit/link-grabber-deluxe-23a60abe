import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada");
      nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-black text-center">Nova senha</h1>
        <div className="glass rounded-2xl flex items-center gap-3 px-4">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha"
            className="flex-1 bg-transparent py-4 text-sm outline-none"
          />
        </div>
        <button disabled={loading} className="w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Atualizar
        </button>
      </form>
    </div>
  );
}
