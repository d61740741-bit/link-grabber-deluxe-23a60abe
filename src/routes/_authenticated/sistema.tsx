import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Gem, Shield, ShoppingBag, Swords, Check, Lock } from "lucide-react";
import {
  useCharacter,
  useShop,
  useBuyItem,
  useSetClass,
  attributeProgress,
  attrTone,
  classUnlocked,
  type Attribute,
} from "@/lib/rpg";
import { rarityStyle, useInventory } from "@/lib/life-state";
import { RANKS } from "@/lib/ranks";

export const Route = createFileRoute("/_authenticated/sistema")({
  component: SistemaPage,
  head: () => ({
    meta: [
      { title: "Sistema Central · Life OS" },
      {
        name: "description",
        content:
          "Atributos, classes, fragmentos, artefatos e loja: transforme ações reais em progressão de personagem.",
      },
      { property: "og:title", content: "Sistema Central · Life OS" },
      {
        property: "og:description",
        content: "Atributos, classes, fragmentos, artefatos e loja do seu personagem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TABS = [
  { key: "sistema", label: "Sistema", icon: Sparkles },
  { key: "classes", label: "Classes", icon: Swords },
  { key: "loja", label: "Loja", icon: ShoppingBag },
  { key: "artefatos", label: "Artefatos", icon: Shield },
] as const;

function SistemaPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("sistema");
  const { data: state, isLoading } = useCharacter();

  const attrs = (state?.attributes ?? []) as Attribute[];
  const coins = state?.coins?.balance ?? 0;

  return (
    <div className="relative px-5 pt-10 safe-top pb-10">
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-[440px] w-[440px] rounded-full bg-electric/10 blur-[110px]" />

      <header className="relative mb-5 animate-rise">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <p className="text-[11px] uppercase tracking-[0.22em] font-medium">Sistema Central</p>
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Seu personagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada ação real vira progressão. Atributos, classe e recompensas são derivados automaticamente.
        </p>
      </header>

      <div className="relative glass rounded-3xl p-4 mb-4 animate-rise delay-1 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Nível</p>
          <p className="text-2xl font-semibold tracking-tight">{state?.profile?.level ?? 1}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {(state?.profile?.total_xp ?? 0).toLocaleString("pt-BR")} XP · {state?.missions ?? 0} missões
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Fragmentos</p>
          <p className="text-2xl font-semibold tracking-tight text-amber-300 flex items-center gap-1.5 justify-end">
            <Gem className="h-4 w-4" />
            {coins.toLocaleString("pt-BR")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {state?.class ? `${state.class.icon} ${state.class.name}` : "Sem classe"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar animate-rise delay-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tap shrink-0 rounded-full px-3.5 py-2 text-[11px] font-medium ring-hair transition flex items-center gap-1.5 ${
                active ? "bg-electric/20 text-electric" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Analisando sua jornada…</div>
      ) : tab === "sistema" ? (
        <SystemTab attrs={attrs} state={state} />
      ) : tab === "classes" ? (
        <ClassesTab attrs={attrs} state={state} />
      ) : tab === "loja" ? (
        <ShopTab coins={coins} level={state?.profile?.level ?? 1} owned={state?.purchases ?? []} />
      ) : (
        <ArtifactsTab />
      )}
    </div>
  );
}

function SystemTab({ attrs, state }: { attrs: Attribute[]; state: ReturnType<typeof useCharacter>["data"] }) {
  const rank = useMemo(
    () => RANKS.find((r) => r.id === (state?.profile?.current_rank ?? "beginner")) ?? RANKS[0],
    [state?.profile?.current_rank],
  );

  return (
    <div className="space-y-3">
      <div className={`glass rounded-3xl p-4 ring-1 ${rank.ring} bg-gradient-to-br ${rank.tone} animate-rise`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{rank.icon}</span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rank atual</p>
            <p className="text-lg font-semibold leading-tight">{rank.name}</p>
            <p className="text-[11px] text-muted-foreground">{rank.tagline}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {attrs.map((a, i) => {
          const p = attributeProgress(a.points);
          const tone = attrTone(a.key);
          return (
            <div
              key={a.key}
              className={`glass rounded-2xl p-3.5 bg-gradient-to-br ${tone.grad} animate-rise delay-${(i % 6) + 1}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{a.icon}</span>
                <span className={`text-[11px] font-semibold ${tone.text}`}>Lv {p.level}</span>
              </div>
              <p className="mt-2 text-[12px] font-semibold">{a.label}</p>
              <p className="text-[10px] text-muted-foreground">{a.points.toLocaleString("pt-BR")} pts</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={`h-full ${tone.bar} transition-all duration-700`} style={{ width: `${p.pct}%` }} />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground/70">faltam {p.remaining} pts</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat label="Sequência" value={`${state?.profile?.streak_days ?? 0}d`} icon="🔥" />
        <MiniStat label="Conquistas" value={String(state?.achievements ?? 0)} icon="🏅" />
        <MiniStat label="Títulos" value={String(state?.titles ?? 0)} icon="👑" />
        <MiniStat label="Life Score" value={String(state?.profile?.life_score ?? 0)} icon="💠" />
        <MiniStat label="Fragmentos ganhos" value={String(state?.coins?.earned ?? 0)} icon="💎" />
        <MiniStat label="Gastos" value={String(state?.coins?.spent ?? 0)} icon="🛒" />
      </div>

      <div className="glass rounded-3xl p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Como o Sistema calcula</p>
        <ul className="text-[12px] text-muted-foreground space-y-1.5 leading-relaxed">
          <li>⚔️ <b className="text-foreground">Força</b> — treinos e volume de exercício.</li>
          <li>❤️ <b className="text-foreground">Vitalidade</b> — água, sono e registros de saúde.</li>
          <li>🧠 <b className="text-foreground">Intelecto</b> — biblioteca, estudos e tempo de leitura.</li>
          <li>⚡ <b className="text-foreground">Disciplina</b> — missões, hábitos, foco e dias limpo.</li>
          <li>🤝 <b className="text-foreground">Carisma</b> — diário e constância de hábitos.</li>
          <li>💎 <b className="text-foreground">Riqueza</b> — registros e saldo financeiro.</li>
        </ul>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <p className="text-lg">{icon}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mt-0.5 line-clamp-1">{label}</p>
    </div>
  );
}

function ClassesTab({ attrs, state }: { attrs: Attribute[]; state: ReturnType<typeof useCharacter>["data"] }) {
  const setClass = useSetClass();
  const classes = state?.classes ?? [];
  const current = state?.profile?.class_key ?? null;

  return (
    <div className="space-y-2.5">
      {classes.map((c, i) => {
        const { unlocked, reqs } = classUnlocked(c, attrs);
        const active = current === c.key;
        return (
          <div
            key={c.key}
            className={`glass rounded-3xl p-4 animate-rise delay-${(i % 6) + 1} ${
              active ? "ring-1 ring-electric/50" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold">{c.name}</p>
                  {active && <span className="text-[9px] rounded-full bg-electric/20 text-electric px-2 py-0.5">Ativa</span>}
                  {!unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-[12px] text-muted-foreground">{c.tagline}</p>

                {reqs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reqs.map(([k, v]) => {
                      const have = attrs.find((a) => a.key === k)?.level ?? 0;
                      const ok = have >= Number(v);
                      return (
                        <span
                          key={k}
                          className={`text-[10px] rounded-full px-2 py-0.5 ring-hair ${
                            ok ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-muted-foreground"
                          }`}
                        >
                          {k} Lv {have}/{v}
                        </span>
                      );
                    })}
                  </div>
                )}

                {(c.perks ?? []).length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {c.perks.map((p) => (
                      <li key={p} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-electric" /> {p}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  disabled={!unlocked || active || setClass.isPending}
                  onClick={() => setClass.mutate(c.key)}
                  className={`tap mt-3 w-full rounded-2xl py-2 text-[12px] font-semibold ring-hair transition ${
                    active
                      ? "bg-white/[0.04] text-muted-foreground"
                      : unlocked
                        ? "bg-electric/20 text-electric hover:bg-electric/30"
                        : "bg-white/[0.03] text-muted-foreground/60"
                  }`}
                >
                  {active ? "Classe ativa" : unlocked ? "Despertar classe" : "Bloqueada"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShopTab({ coins, level, owned }: { coins: number; level: number; owned: string[] }) {
  const { data: items } = useShop();
  const buy = useBuyItem();

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {(items ?? []).map((it, i) => {
        const st = rarityStyle(it.rarity);
        const has = owned.includes(it.key);
        const canLevel = level >= it.required_level;
        const canAfford = coins >= it.price;
        const disabled = has || !canLevel || !canAfford || buy.isPending;
        return (
          <div
            key={it.key}
            className={`glass rounded-2xl p-3.5 ring-1 ${st.ring} ${st.bg} animate-rise delay-${(i % 6) + 1}`}
          >
            <div className="text-2xl">{it.icon}</div>
            <p className={`mt-1.5 text-[12px] font-semibold leading-tight ${st.text}`}>{it.name}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{it.description}</p>
            <p className="mt-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {it.rarity} · Lv {it.required_level}+
            </p>
            <button
              disabled={disabled}
              onClick={() => buy.mutate(it.key)}
              className={`tap mt-2 w-full rounded-xl py-1.5 text-[11px] font-semibold ring-hair transition flex items-center justify-center gap-1 ${
                has
                  ? "bg-emerald-500/15 text-emerald-300"
                  : disabled
                    ? "bg-white/[0.03] text-muted-foreground/60"
                    : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              }`}
            >
              {has ? (
                <>
                  <Check className="h-3 w-3" /> Adquirido
                </>
              ) : (
                <>
                  <Gem className="h-3 w-3" /> {it.price}
                </>
              )}
            </button>
            {!has && !canLevel && (
              <p className="mt-1 text-[9px] text-muted-foreground/70 text-center">Requer nível {it.required_level}</p>
            )}
            {!has && canLevel && !canAfford && (
              <p className="mt-1 text-[9px] text-muted-foreground/70 text-center">
                Faltam {it.price - coins} fragmentos
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ArtifactsTab() {
  const { data: items } = useInventory();
  const artifacts = (items ?? []).filter((i) =>
    ["artifact", "boost", "cosmetic", "medal"].includes(i.kind),
  );

  if (artifacts.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <p className="text-5xl mb-3">🗝️</p>
        <p className="text-sm font-semibold">Nenhum artefato ainda</p>
        <p className="text-xs text-muted-foreground mt-1">Derrote bosses ou compre na loja com fragmentos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {artifacts.map((item, i) => {
        const st = rarityStyle(item.rarity);
        return (
          <div
            key={item.id}
            className={`glass rounded-2xl p-3 ring-1 ${st.ring} ${st.bg} animate-rise delay-${(i % 6) + 1}`}
          >
            <div className="text-2xl mb-1.5">{item.icon}</div>
            <p className={`text-[11px] font-semibold leading-tight ${st.text} line-clamp-2`}>{item.name}</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">{item.rarity}</p>
          </div>
        );
      })}
    </div>
  );
}
