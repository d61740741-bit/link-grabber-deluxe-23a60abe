import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Msg = { role: "user" | "assistant"; content: string };

function isMsgArray(v: unknown): v is Msg[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m as any).role &&
        ((m as any).role === "user" || (m as any).role === "assistant") &&
        typeof (m as any).content === "string",
    )
  );
}

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as { messages?: unknown };
    if (!isMsgArray(data?.messages)) throw new Error("messages inválidas");
    return { messages: data.messages.slice(-20) };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const { supabase, userId } = context as any;

    // Gather user context (RLS-scoped)
    const todayIso = new Date().toISOString().slice(0, 10);
    const [profileRes, skillsRes, tasksTodayRes, tasksDoneRes, habitsRes, xpWeekRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("skills").select("category, level, xp").order("xp", { ascending: false }),
        supabase
          .from("tasks")
          .select("title, xp_reward, skill_category, completed")
          .or(`due_date.eq.${todayIso},due_date.is.null`)
          .eq("completed", false)
          .limit(20),
        supabase
          .from("tasks")
          .select("title, xp_reward, completed_at")
          .eq("completed", true)
          .order("completed_at", { ascending: false })
          .limit(10),
        supabase.from("habits").select("name, streak, frequency").limit(20),
        supabase
          .from("xp_history")
          .select("amount, created_at")
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          ),
      ]);

    const profile = profileRes.data ?? {};
    const skills = skillsRes.data ?? [];
    const tasksToday = tasksTodayRes.data ?? [];
    const tasksDone = tasksDoneRes.data ?? [];
    const habits = habitsRes.data ?? [];
    const xpWeek = (xpWeekRes.data ?? []).reduce(
      (s: number, r: any) => s + (r.amount ?? 0),
      0,
    );

    const contextBlock = `
DADOS DO USUÁRIO (use para personalizar):
- Nome: ${profile.full_name || profile.username || "Guerreiro"}
- Nível: ${profile.level ?? 1}
- XP total: ${profile.total_xp ?? 0}
- Sequência (streak): ${profile.streak_days ?? 0} dias
- XP nos últimos 7 dias: ${xpWeek}

SKILLS:
${skills.map((s: any) => `- ${s.category}: nível ${s.level} (${s.xp} XP)`).join("\n") || "- nenhuma ainda"}

MISSÕES ABERTAS HOJE:
${tasksToday.map((t: any) => `- ${t.title} (+${t.xp_reward} XP${t.skill_category ? `, ${t.skill_category}` : ""})`).join("\n") || "- nenhuma"}

ÚLTIMAS MISSÕES CONCLUÍDAS:
${tasksDone.map((t: any) => `- ${t.title} (+${t.xp_reward} XP)`).join("\n") || "- nenhuma"}

HÁBITOS ATIVOS:
${habits.map((h: any) => `- ${h.name} (streak ${h.streak ?? 0}, ${h.frequency ?? "diário"})`).join("\n") || "- nenhum"}
`.trim();

    const system = `Você é o Coach Pessoal do app ASCENSION — um sistema de evolução pessoal gamificado. Fale em português brasileiro, tom direto, motivacional, elegante, sem clichês vazios. Seja específico usando os DADOS DO USUÁRIO abaixo. Responda em Markdown enxuto (listas curtas, negrito para pontos-chave). Nunca invente números do usuário — use apenas os que aparecem nos dados. Quando sugerir missões, dê 3 objetivas com XP recomendado (10-50). Se pedirem review semanal/mensal, analise o progresso real listado.

${contextBlock}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429)
        throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402)
        throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha do coach (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { text };
  });
