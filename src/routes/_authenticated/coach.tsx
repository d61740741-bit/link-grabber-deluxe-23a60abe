import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { askCoach } from "@/lib/coach.functions";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles, Trash2, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "ascension.coach.messages.v1";

const QUICK: { label: string; prompt: string }[] = [
  { label: "Motivação do dia", prompt: "Me dê uma motivação curta e poderosa para hoje, com base no meu progresso." },
  { label: "Sugerir missões", prompt: "Sugira 3 missões objetivas para eu fazer hoje, com XP recomendado." },
  { label: "Review semanal", prompt: "Analise meu progresso da última semana e me diga o que ajustar." },
  { label: "Review mensal", prompt: "Faça um review mensal do meu desempenho e defina 3 prioridades." },
  { label: "Dica de produtividade", prompt: "Me dê uma dica prática de produtividade adequada ao meu nível." },
  { label: "Recomendação de saúde", prompt: "Baseado nas minhas skills e hábitos, o que devo priorizar em saúde?" },
  { label: "Recomendação de estudo", prompt: "O que devo estudar essa semana para evoluir Conhecimento?" },
  { label: "Analisar meu progresso", prompt: "Analise meu nível, XP, streak e skills. Onde estou forte e onde estou fraco?" },
];

function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askCoach);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const showEmpty = useMemo(() => messages.length === 0 && !loading, [messages, loading]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages((cur) => [...cur, { role: "assistant", content: res.text || "…" }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao consultar o coach");
      setMessages((cur) => cur.slice(0, -1));
      setInput(clean);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function clearChat() {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return (
    <div className="relative flex flex-col h-dvh safe-top">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-electric/15 blur-[100px]" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-5 pt-4 pb-3">
        <Link to="/dashboard" className="tap h-10 w-10 rounded-2xl ring-hair bg-white/[0.04] flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-2xl bg-gradient-to-br from-electric/70 to-primary/30 flex items-center justify-center ring-hair">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold tracking-tight leading-none">Coach</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Seu mentor pessoal</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="tap h-10 w-10 rounded-2xl ring-hair bg-white/[0.04] flex items-center justify-center disabled:opacity-40"
          disabled={messages.length === 0}
          aria-label="Limpar conversa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 pb-4">
        {showEmpty ? (
          <div className="animate-rise">
            <div className="glass-strong rounded-[28px] p-6 mt-4 mb-5 shadow-elegant overflow-hidden relative">
              <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-electric/20 blur-3xl" />
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Ascension Coach</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-tight leading-tight">
                Sua evolução, personalizada.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Eu conheço seu nível, XP, streak, skills e missões. Pergunte qualquer coisa — ou comece por um destes:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK.map((q, i) => (
                <button
                  key={q.label}
                  onClick={() => send(q.prompt)}
                  className={`tap glass rounded-2xl p-3.5 text-left animate-rise delay-${(i % 5) + 1}`}
                >
                  <p className="text-[13px] font-semibold tracking-tight">{q.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{q.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 px-1 py-2 animate-fade">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-electric" />
                <span className="text-xs text-muted-foreground">Coach pensando…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="relative px-4 pb-6 safe-bottom">
        <div className="glass-strong rounded-[26px] p-2 shadow-elegant ring-hair flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Pergunte ao seu coach…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] leading-snug placeholder:text-muted-foreground/60 focus:outline-none max-h-40"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="tap h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-electric to-primary flex items-center justify-center disabled:opacity-40 disabled:from-white/10 disabled:to-white/5"
            aria-label="Enviar"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
            ) : (
              <Send className="h-4 w-4 text-primary-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-rise`}>
      {isUser ? (
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-electric/90 to-primary text-primary-foreground px-4 py-2.5 text-[14px] leading-relaxed shadow-elegant">
          {content}
        </div>
      ) : (
        <div className="max-w-[92%] text-[14px] leading-relaxed text-foreground/95">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-electric/70 to-primary/30 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Coach</span>
          </div>
          <div className="coach-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
