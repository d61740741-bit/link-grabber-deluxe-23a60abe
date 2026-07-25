import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

type Mode = "login" | "register" | "forgot";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta");
        nav({ to: "/dashboard" });
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name, username: name?.split(" ")[0] || null },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Vamos começar.");
        nav({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link para o seu e-mail");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível continuar");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao entrar com Google");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background px-6 py-8 safe-top safe-bottom">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-electric/15 blur-3xl" />

      <div className="relative">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mt-10 mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-electric to-primary/80 shadow-glow flex items-center justify-center">
            <span className="text-xl font-black text-primary-foreground">A</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            {mode === "login" && "Bem-vindo de volta"}
            {mode === "register" && "Crie sua conta"}
            {mode === "forgot" && "Recuperar acesso"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" && "Continue sua evolução"}
            {mode === "register" && "Começa aqui a sua ascensão"}
            {mode === "forgot" && "Enviaremos um link seguro"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div className="glass rounded-2xl flex items-center gap-3 px-4">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="glass rounded-2xl flex items-center gap-3 px-4">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {mode !== "forgot" && (
            <div className="glass rounded-2xl flex items-center gap-3 px-4">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          {mode === "login" && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-foreground">
                Esqueci minha senha
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground shadow-elegant hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" && "Entrar"}
            {mode === "register" && "Criar conta"}
            {mode === "forgot" && "Enviar link"}
          </button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full rounded-full glass px-6 py-4 text-sm font-semibold text-foreground hover:bg-surface transition flex items-center justify-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3.1.6 4.3 1.6l3.2-3.2C17.5 1.4 14.9 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.7 2.9C6 6.7 8.8 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.6z"/><path fill="#FBBC05" d="M5 14.5c-.2-.7-.4-1.4-.4-2.5s.1-1.8.4-2.5L1.3 6.6C.5 8.3 0 10.1 0 12s.5 3.7 1.3 5.4L5 14.5z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.6-2.8c-1 .7-2.3 1.1-4.2 1.1-3.2 0-5.9-2.2-6.9-5.1L1.3 17.4C3.3 21.3 7.3 24 12 24z"/></svg>
              Continuar com Google
            </button>
          </>
        )}

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {mode === "login" && (
            <>Ainda não tem conta? <button onClick={() => setMode("register")} className="text-electric font-semibold">Cadastre-se</button></>
          )}
          {mode === "register" && (
            <>Já tem conta? <button onClick={() => setMode("login")} className="text-electric font-semibold">Entrar</button></>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("login")} className="text-electric font-semibold">Voltar ao login</button>
          )}
        </div>
      </div>
    </div>
  );
}
