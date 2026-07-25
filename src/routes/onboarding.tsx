import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Dumbbell, BookOpen, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: Onboarding,
});

const slides = [
  {
    icon: Sparkles,
    tag: "Disciplina",
    title: "Construa consistência inabalável",
    text: "Missões diárias, hábitos rastreados e uma sequência que você não quer perder.",
    color: "from-electric/40 to-electric/5",
  },
  {
    icon: BookOpen,
    tag: "Conhecimento",
    title: "Aprenda como um mestre",
    text: "Biblioteca de estudos, livros, cursos e notas. Cada minuto se torna XP.",
    color: "from-gold/40 to-gold/5",
  },
  {
    icon: Dumbbell,
    tag: "Saúde",
    title: "Corpo que carrega o propósito",
    text: "Treinos, sono, humor e nutrição em um só painel elegante.",
    color: "from-emerald-500/40 to-emerald-500/5",
  },
  {
    icon: Brain,
    tag: "Evolução",
    title: "Você, versão character-select",
    text: "Nível, XP, skills. Você vê sua evolução real como se fosse um personagem.",
    color: "from-purple-500/40 to-purple-500/5",
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const s = slides[i];
  const last = i === slides.length - 1;
  const Icon = s.icon;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background flex flex-col">
      <div className={`absolute inset-0 bg-gradient-to-b ${s.color} transition-all duration-700 pointer-events-none`} />

      <div className="relative flex items-center justify-between px-6 pt-6 safe-top">
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-4 bg-primary/20"}`}
            />
          ))}
        </div>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Pular</Link>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-10 relative">
          <div className="h-32 w-32 rounded-3xl glass-strong flex items-center justify-center shadow-elegant animate-float">
            <Icon className="h-14 w-14 text-primary" strokeWidth={1.5} />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-electric/20 blur-2xl -z-10" />
        </div>

        <p className="text-xs uppercase tracking-[0.3em] text-electric font-semibold mb-4">{s.tag}</p>
        <h2 className="text-3xl font-black tracking-tight mb-4 max-w-sm">{s.title}</h2>
        <p className="text-base text-muted-foreground max-w-sm leading-relaxed">{s.text}</p>
      </div>

      <div className="relative px-6 pb-10 safe-bottom">
        {last ? (
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground shadow-elegant"
          >
            Criar minha conta
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            onClick={() => setI(i + 1)}
            className="flex items-center justify-center gap-2 w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground shadow-elegant"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
