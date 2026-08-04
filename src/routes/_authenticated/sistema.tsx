import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Gem, Shield, ShoppingBag, Swords, Check, Lock, Crown,
  Activity, Zap, Trophy, Boxes, History, Coins, Star, Eye, ChevronRight,
} from "lucide-react";
import {
  useCharacter, useShop, useBuyItem, useSetClass,
  attributeProgress, classUnlocked, type Attribute, type CharacterState,
} from "@/lib/rpg";
import {
  rarityStyle, useInventory, useTimeline, useTitles, useWeeklyBoss,
} from "@/lib/life-state";
import { RANKS, computeRank } from "@/lib/ranks";
import {
  attrMeta, computeSync, computePassives, useAchievementsList, useBossHistory,
  monthlyBoss, achievementTier, TIER_STYLE, INV_CATEGORIES, inventoryCategory, isRelic,
  type AchvTier,
} from "@/lib/system";

export const Route = createFileRoute("/_authenticated/sistema")({
  component: SistemaPage,
  head: () => ({
    meta: [
      { title: "Sistema Central · Life OS" },
      { name: "description", content: "Sincronia, atributos, classes, ranks, passivas, relíquias, bosses e histórico de evolução do seu personagem." },
      { property: "og:title", content: "Sistema Central · Life OS" },
      { property: "og:description", content: "O centro de evolução do Life OS: atributos, classes, passivas, relíquias e bosses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SECTIONS = [
  { key: "visao", label: "Visão Geral", icon: Sparkles },
  { key: "status", label: "Status", icon: Activity },
  { key: "atributos", label: "Atributos", icon: Zap },
  { key: "classe", label: "Classe", icon: Swords },
  { key: "titulo", label: "Título", icon: Crown },
  { key: "rank", label: "Rank", icon: Star },
  { key: "passivas", label: "Passivas", icon: Eye },
  { key: "inventario", label: "Inventário", icon: Boxes },
  { key: "reliquias", label: "Relíquias", icon: Gem },
  { key: "loja", label: "Loja", icon: ShoppingBag },
  { key: "bosses", label: "Bosses", icon: Shield },
  { key: "conquistas", label: "Conquistas", icon: Trophy },
  { key: "historico", label: "Evolução", icon: History },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

/* ───────── primitives ───────── */

function Panel({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div className={`glass rounded-3xl p-4 animate-rise ${className}`} style={{ animationDelay: `${delay * 60}ms` }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{icon} {title}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ pct, className = "bg-electric" }: { pct: number; className?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full ${className} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Hidden({ label = "?????" }: { label?: string }) {
  return <span className="text-muted-foreground/50 tracking-[0.3em] text-[11px]">{label}</span>;
}

function Particles() {
  const dots = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      left: (i * 37) % 100,
      top: (i * 53) % 100,
      delay: (i % 9) * 0.7,
      size: 1 + (i % 3),
    })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/40 animate-pulse"
          style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s`, animationDuration: "3.5s" }}
        />
      ))}
    </div>
  );
}

function levelXp(totalXp: number, level: number) {
  const cur = 50 * (level - 1) * (level - 1);
  const next = 50 * level * level;
  const span = Math.max(1, next - cur);
  const done = Math.max(0, Math.min(span, totalXp - cur));
  return { cur, next, span, done, pct: Math.round((done / span) * 100), remaining: span - done };
}

/* ───────── page ───────── */

function SistemaPage() {
  const [section, setSection] = useState<SectionKey>("visao");
  const { data: state, isLoading } = useCharacter();
  const sync = computeSync(state);

  return (
    <div className="relative px-5 pt-10 safe-top pb-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[460px] w-[460px] rounded-full bg-electric/10 blur-[120px]" />

      <header className="relative mb-4 animate-rise">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <p className="text-[11px] uppercase tracking-[0.24em] font-medium">Sistema Central</p>
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">
          {state?.profile?.full_name?.split(" ")[0] ?? "Jogador"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você está sendo <span className={sync.aura}>{sync.stage.toLowerCase()}</span>. Cada ação real altera sua sincronia.
        </p>
      </header>

      <nav className="flex gap-2 mb-4 overflow-x-auto no-scrollbar animate-rise delay-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`tap shrink-0 rounded-full px-3.5 py-2 text-[11px] font-medium ring-hair transition-all flex items-center gap-1.5 ${
                active ? "bg-electric/20 text-electric scale-[1.02]" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </nav>

      {isLoading ? (
        <Panel className="p-8 text-center text-sm text-muted-foreground">Sincronizando com o Sistema…</Panel>
      ) : (
        <div key={section} className="animate-fade-in">
          {section === "visao" && <Overview state={state} />}
          {section === "status" && <StatusSection state={state} />}
          {section === "atributos" && <AttributesSection state={state} />}
          {section === "classe" && <ClassSection state={state} />}
          {section === "titulo" && <TitleSection state={state} />}
          {section === "rank" && <RankSection state={state} />}
          {section === "passivas" && <PassivesSection state={state} />}
          {section === "inventario" && <InventorySection />}
          {section === "reliquias" && <RelicsSection />}
          {section === "loja" && <ShopSection state={state} />}
          {section === "bosses" && <BossesSection />}
          {section === "conquistas" && <AchievementsSection />}
          {section === "historico" && <EvolutionSection />}
        </div>
      )}
    </div>
  );
}

type S = CharacterState | undefined;

/* ───────── 1. Visão Geral ───────── */

function Overview({ state }: { state: S }) {
  const p = state?.profile;
  const level = p?.level ?? 1;
  const xp = p?.total_xp ?? 0;
  const lv = levelXp(xp, level);
  const { data: boss } = useWeeklyBoss();
  const { data: timeline } = useTimeline(1);
  const rank = RANKS.find((r) => r.id === (p?.current_rank ?? "beginner")) ?? RANKS[0];
  const coins = state?.coins?.balance ?? 0;

  return (
    <div className="space-y-3">
      <Panel className={`relative overflow-hidden ring-1 ${rank.ring} bg-gradient-to-br ${rank.tone}`}>
        <Particles />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Nível</p>
            <p className="text-4xl font-semibold tracking-tight leading-none">{level}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{xp.toLocaleString("pt-BR")} XP acumulado</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Moedas do Sistema</p>
            <p className="text-2xl font-semibold text-amber-300 flex items-center gap-1.5 justify-end">
              <Coins className="h-4 w-4" /> {coins.toLocaleString("pt-BR")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
              <Gem className="h-3 w-3" /> {(state?.coins?.earned ?? 0).toLocaleString("pt-BR")} fragmentos
            </p>
          </div>
        </div>
        <div className="relative mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progresso do nível</span>
            <span>faltam {lv.remaining.toLocaleString("pt-BR")} XP</span>
          </div>
          <Bar pct={lv.pct} className="bg-gradient-to-r from-electric to-primary" />
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile icon={rank.icon} label="Rank" value={rank.name} />
        <Tile icon={state?.class?.icon ?? "❔"} label="Classe" value={state?.class?.name ?? "Sem classe"} />
        <Tile icon="👑" label="Título" value={p?.equipped_title ? p.equipped_title.replace(/_/g, " ") : "—"} />
        <Tile icon="💠" label="Life Score" value={String(p?.life_score ?? 0)} />
        <Tile icon="🔥" label="Sequência" value={`${p?.streak_days ?? 0} dias`} />
        <Tile icon="🏅" label="Conquistas" value={String(state?.achievements ?? 0)} />
      </div>

      <Panel>
        <SectionTitle icon="👹" title="Boss ativo" />
        {boss ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">{boss.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold">{boss.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {boss.objectives.filter((o) => o.current >= o.target).length}/{boss.objectives.length} objetivos · +{boss.xp_reward} XP
              </p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full ring-hair ${boss.status === "completed" ? "text-emerald-300 bg-emerald-500/10" : "text-amber-300 bg-amber-500/10"}`}>
              {boss.status === "completed" ? "Vencido" : "Ativo"}
            </span>
          </div>
        ) : (
          <Hidden />
        )}
      </Panel>

      <Panel>
        <SectionTitle icon="🎁" title="Última recompensa" />
        {timeline?.[0] ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">{timeline[0].icon}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate">{timeline[0].title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{timeline[0].description}</p>
            </div>
          </div>
        ) : (
          <Hidden label="nenhuma recompensa registrada" />
        )}
      </Panel>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <p className="text-xl">{icon}</p>
      <p className="text-[13px] font-semibold mt-1 truncate">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 mt-0.5">{label}</p>
    </div>
  );
}

/* ───────── 2. Status do Sistema ───────── */

function StatusSection({ state }: { state: S }) {
  const sync = computeSync(state);
  const prev = useRef(sync.pct);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (sync.pct > prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2200);
      prev.current = sync.pct;
      return () => clearTimeout(t);
    }
    prev.current = sync.pct;
  }, [sync.pct]);

  return (
    <div className="space-y-3">
      <Panel className={`relative overflow-hidden text-center ${pulse ? "ring-1 ring-electric/60" : ""}`}>
        <Particles />
        <div className="relative py-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Status do Sistema</p>
          <p className={`mt-3 text-6xl font-semibold tracking-tight ${sync.aura} ${pulse ? "animate-scale-in" : ""}`}>{sync.pct}%</p>
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground mt-1">Sincronia</p>
          <p className={`mt-3 inline-block rounded-full px-3 py-1 text-[11px] ring-hair bg-white/[0.04] ${sync.aura}`}>{sync.stage}</p>
          <div className="mt-4 px-6">
            <Bar pct={sync.pct} className="bg-gradient-to-r from-electric via-primary to-amber-400" />
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Próxima evolução em {sync.nextAt}%: {sync.nextStage ? <span className="tracking-[0.2em] text-muted-foreground/60">?????</span> : "máximo atingido"}
          </p>
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon="🧬" title="Leitura do Sistema" sub="Fatores que alteram sua sincronia" />
        <ul className="text-[12px] text-muted-foreground space-y-1.5">
          <li>⭐ Nível do personagem — até 30%</li>
          <li>🔥 Sequência de dias ativos — até 20%</li>
          <li>⚡ Média dos atributos — até 20%</li>
          <li>🏅 Conquistas desbloqueadas — até 15%</li>
          <li>👑 Títulos obtidos — até 10%</li>
          <li>💠 Life Score — até 5%</li>
        </ul>
      </Panel>

      <Panel className="text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Registros ocultos</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] ring-hair py-4">
              <Hidden />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ───────── 3. Atributos ───────── */

function AttributesSection({ state }: { state: S }) {
  const attrs = (state?.attributes ?? []) as Attribute[];
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      {attrs.map((a, i) => {
        const p = attributeProgress(a.points);
        const meta = attrMeta(a.key);
        const expanded = open === a.key;
        return (
          <div key={a.key} className={`glass rounded-3xl p-4 bg-gradient-to-br ${meta.tone} animate-rise`} style={{ animationDelay: `${i * 40}ms` }}>
            <button className="w-full text-left tap" onClick={() => setOpen(expanded ? null : a.key)}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold">{a.label}</p>
                    <span className={`text-[11px] font-semibold ${meta.text}`}>Lv {p.level}</span>
                  </div>
                  <div className="mt-1.5"><Bar pct={p.pct} className={meta.bar} /></div>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    {a.points.toLocaleString("pt-BR")} pts · faltam {p.remaining} para Lv {p.level + 1}
                  </p>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
              </div>
            </button>
            {expanded && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] animate-fade-in">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">O que aumenta</p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.sources.map((s) => (
                    <span key={s} className="text-[10px] rounded-full px-2 py-0.5 ring-hair bg-white/[0.04] text-muted-foreground">{s}</span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniBox label="Nível" value={String(p.level)} />
                  <MiniBox label="Progresso" value={`${p.pct}%`} />
                  <MiniBox label="Próx. marco" value={`${p.next} pts`} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] ring-hair py-2">
      <p className="text-[12px] font-semibold">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
    </div>
  );
}

/* ───────── 4. Classe ───────── */

const CLASS_LORE: Record<string, string> = {};

function ClassSection({ state }: { state: S }) {
  const setClass = useSetClass();
  const attrs = (state?.attributes ?? []) as Attribute[];
  const classes = state?.classes ?? [];
  const current = state?.profile?.class_key ?? null;
  const [flash, setFlash] = useState<string | null>(null);

  const ordered = useMemo(() => {
    return [...classes].sort((a, b) => {
      const ua = classUnlocked(a, attrs).unlocked ? 0 : 1;
      const ub = classUnlocked(b, attrs).unlocked ? 0 : 1;
      return ua - ub || a.sort_order - b.sort_order;
    });
  }, [classes, attrs]);

  const active = classes.find((c) => c.key === current) ?? null;
  const next = ordered.find((c) => !classUnlocked(c, attrs).unlocked) ?? null;

  return (
    <div className="space-y-3">
      <Panel className="relative overflow-hidden text-center">
        <Particles />
        <div className="relative py-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Classe atual</p>
          <p className="text-5xl mt-2">{active?.icon ?? "❔"}</p>
          <p className="text-lg font-semibold mt-1">{active?.name ?? "Nenhuma classe desperta"}</p>
          <p className="text-[12px] text-muted-foreground">{active?.tagline ?? "Evolua seus atributos para despertar uma classe."}</p>
          {next && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Próxima classe: <span className="tracking-[0.2em] text-muted-foreground/60">?????</span>
            </p>
          )}
        </div>
      </Panel>

      {ordered.map((c, i) => {
        const { unlocked, reqs } = classUnlocked(c, attrs);
        const isActive = current === c.key;
        return (
          <div
            key={c.key}
            className={`relative glass rounded-3xl p-4 overflow-hidden animate-rise ${isActive ? "ring-1 ring-electric/60" : unlocked ? "" : "opacity-70"} ${flash === c.key ? "animate-scale-in ring-1 ring-amber-300/70" : ""}`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {unlocked && <div className="pointer-events-none absolute -top-14 -right-10 h-32 w-32 rounded-full bg-electric/15 blur-3xl" />}
            <div className="relative flex items-start gap-3">
              <span className={`text-3xl ${unlocked ? "" : "grayscale opacity-60"}`}>{unlocked ? c.icon : "🔒"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold">{unlocked ? c.name : "?????"}</p>
                  {isActive && <span className="text-[9px] rounded-full bg-electric/20 text-electric px-2 py-0.5">Ativa</span>}
                  {!unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-[12px] text-muted-foreground">{unlocked ? c.tagline : "Requisitos de atributo não cumpridos."}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground/80 italic">
                  {unlocked ? (CLASS_LORE[c.key] ?? `Uma linhagem forjada em ${c.primary_attr}.`) : "História selada pelo Sistema."}
                </p>

                {reqs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reqs.map(([k, v]) => {
                      const have = attrs.find((a) => a.key === k)?.level ?? 0;
                      const ok = have >= Number(v);
                      return (
                        <span key={k} className={`text-[10px] rounded-full px-2 py-0.5 ring-hair ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-muted-foreground"}`}>
                          {k} Lv {have}/{v}
                        </span>
                      );
                    })}
                  </div>
                )}

                {(c.perks ?? []).length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {c.perks.map((pk) => (
                      <li key={pk} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-electric" /> {unlocked ? pk : "?????"}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  disabled={!unlocked || isActive || setClass.isPending}
                  onClick={() => { setFlash(c.key); setTimeout(() => setFlash(null), 1200); setClass.mutate(c.key); }}
                  className={`tap mt-3 w-full rounded-2xl py-2 text-[12px] font-semibold ring-hair transition ${
                    isActive ? "bg-white/[0.04] text-muted-foreground"
                      : unlocked ? "bg-electric/20 text-electric hover:bg-electric/30"
                      : "bg-white/[0.03] text-muted-foreground/60"
                  }`}
                >
                  {isActive ? "Classe ativa" : unlocked ? "Despertar classe" : "Bloqueada"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── 5. Título ───────── */

function TitleSection({ state }: { state: S }) {
  const { data: titles } = useTitles();
  const equipped = state?.profile?.equipped_title;
  const current = (titles ?? []).find((t) => t.title_key === equipped) ?? null;

  return (
    <div className="space-y-3">
      <Panel className="relative overflow-hidden text-center">
        <Particles />
        <div className="relative py-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Título atual</p>
          <p className="text-5xl mt-2 animate-scale-in">{current?.icon ?? "❔"}</p>
          <p className={`text-lg font-semibold mt-1 ${current ? rarityStyle(current.rarity).text : ""}`}>
            {current?.title_name ?? "Sem título equipado"}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">{current?.description ?? "Conquiste títulos evoluindo em qualquer área."}</p>
          {current && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mt-2">
              conquistado em {new Date(current.earned_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon="📜" title="Histórico de títulos" />
        {(titles ?? []).length === 0 ? (
          <Hidden label="nenhum título ainda" />
        ) : (
          <div className="space-y-2">
            {(titles ?? []).map((t) => {
              const st = rarityStyle(t.rarity);
              return (
                <div key={t.id} className={`rounded-2xl p-3 ring-1 ${st.ring} ${st.bg} flex items-center gap-3`}>
                  <span className="text-xl">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-semibold ${st.text}`}>{t.title_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                    {new Date(t.earned_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ───────── 6. Rank ───────── */

function RankSection({ state }: { state: S }) {
  const p = state?.profile;
  const stats = {
    level: p?.level ?? 1,
    xp: p?.total_xp ?? 0,
    skills: (state?.skills ?? []).map((s) => ({ level: s.level })),
    achievements: state?.achievements ?? 0,
    streak: p?.streak_days ?? 0,
    missions: state?.missions ?? 0,
  };
  const { current, next, currentIndex, progress } = computeRank(stats);

  return (
    <div className="space-y-3">
      <Panel className={`relative overflow-hidden text-center ring-1 ${current.ring} bg-gradient-to-br ${current.tone}`}>
        <Particles />
        <div className="relative py-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Rank atual</p>
          <p className="text-5xl mt-2">{current.icon}</p>
          <p className="text-xl font-semibold mt-1">{current.name}</p>
          <p className="text-[12px] text-muted-foreground">{current.tagline}</p>
          {next && progress && (
            <div className="mt-4 px-4">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Próximo: {next.name}</span>
                <span>{progress.overallPct}%</span>
              </div>
              <Bar pct={progress.overallPct} className="bg-gradient-to-r from-electric to-amber-300" />
            </div>
          )}
        </div>
      </Panel>

      {next && progress && (
        <Panel>
          <SectionTitle icon="🎯" title={`Requisitos · ${next.name}`} />
          <div className="space-y-2">
            {progress.items.map((r) => (
              <div key={r.key}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className={r.done ? "text-emerald-300" : "text-foreground/80"}>{r.icon} {r.label}</span>
                  <span className="text-muted-foreground">{Math.min(r.have, r.need).toLocaleString("pt-BR")}/{r.need.toLocaleString("pt-BR")}</span>
                </div>
                <Bar pct={(r.have / Math.max(1, r.need)) * 100} className={r.done ? "bg-emerald-400" : "bg-electric"} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <SectionTitle icon="🗺️" title="Trilha de ranks" sub="Recompensas liberadas por rank" />
        <div className="space-y-2">
          {RANKS.map((r, i) => {
            const reached = i <= currentIndex;
            const locked = i > currentIndex + 1;
            return (
              <div key={r.id} className={`rounded-2xl p-3 ring-hair flex items-center gap-3 ${reached ? `bg-gradient-to-r ${r.tone}` : "bg-white/[0.03]"} ${locked ? "opacity-60" : ""}`}>
                <span className={`text-xl ${reached ? "" : "grayscale"}`}>{locked ? "🔒" : r.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold">{locked ? "?????" : r.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {locked ? "Registro selado" : `Recompensa: +${(i + 1) * 150} fragmentos · molduras e títulos exclusivos`}
                  </p>
                </div>
                {reached && <Check className="h-4 w-4 text-emerald-300" />}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ───────── 7. Passivas ───────── */

function PassivesSection({ state }: { state: S }) {
  const passives = computePassives(state);
  const unlocked = passives.filter((p) => p.unlocked);
  const locked = passives.filter((p) => !p.unlocked);

  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle icon="✦" title="Passivas ativas" sub={`${unlocked.length} de ${passives.length} reveladas`} />
        {unlocked.length === 0 ? (
          <Hidden label="nenhuma passiva desperta" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {unlocked.map((p) => (
              <div key={p.key} className="relative overflow-hidden rounded-2xl p-3 ring-1 ring-electric/30 bg-electric/[0.07]">
                <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-electric/20 blur-2xl" />
                <p className="text-xl">{p.icon}</p>
                <p className="text-[12px] font-semibold mt-1">{p.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle icon="🔒" title="Selos não revelados" />
        <div className="grid grid-cols-2 gap-2.5">
          {locked.map((p) => (
            <div key={p.key} className="rounded-2xl p-3 ring-hair bg-white/[0.03]">
              <p className="text-xl opacity-50">{p.secret ? "❔" : p.icon}</p>
              <p className="text-[12px] font-semibold mt-1 text-muted-foreground">{p.secret ? "?????" : p.name}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{p.hint}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ───────── 8. Inventário ───────── */

function InventorySection() {
  const { data: items } = useInventory();
  const all = items ?? [];
  const [cat, setCat] = useState<string>("all");

  const grouped = useMemo(() => {
    const map: Record<string, typeof all> = {};
    all.forEach((it) => {
      const k = inventoryCategory(it);
      (map[k] ??= []).push(it);
    });
    return map;
  }, [all]);

  const visible = cat === "all" ? all : (grouped[cat] ?? []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>Tudo ({all.length})</Chip>
        {INV_CATEGORIES.map((c) => (
          <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
            {c.icon} {c.label} ({grouped[c.key]?.length ?? 0})
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <Panel className="text-center py-8">
          <p className="text-4xl mb-2">🎒</p>
          <p className="text-sm font-semibold">Inventário vazio nesta categoria</p>
          <p className="text-xs text-muted-foreground mt-1">Derrote bosses, conquiste títulos ou compre na Loja do Sistema.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {visible.map((item, i) => {
            const st = rarityStyle(item.rarity);
            return (
              <div key={item.id} className={`glass rounded-2xl p-3 ring-1 ${st.ring} ${st.bg} animate-rise`} style={{ animationDelay: `${i * 25}ms` }}>
                <div className="text-2xl mb-1.5">{item.icon}</div>
                <p className={`text-[11px] font-semibold leading-tight ${st.text} line-clamp-2`}>{item.name}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">{item.rarity}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`tap shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium ring-hair transition ${
        active ? "bg-electric/20 text-electric" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ───────── 9. Relíquias ───────── */

function RelicsSection() {
  const { data: items } = useInventory();
  const { data: shop } = useShop();
  const owned = (items ?? []).filter((i) => isRelic(i.item_key));
  const catalog = (shop ?? []).filter((s) => isRelic(s.key));

  return (
    <div className="space-y-3">
      <Panel className="relative overflow-hidden">
        <Particles />
        <div className="relative">
          <SectionTitle icon="🔮" title="Relíquias" sub="Itens extremamente raros com poder passivo permanente" />
          <p className="text-[12px] text-muted-foreground">
            Relíquias só aparecem para quem sustenta a evolução por muito tempo. Cada uma concede uma passiva única.
          </p>
        </div>
      </Panel>

      {owned.length > 0 && (
        <Panel>
          <SectionTitle icon="✨" title="Suas relíquias" />
          <div className="space-y-2">
            {owned.map((it) => {
              const st = rarityStyle(it.rarity);
              return (
                <div key={it.id} className={`relative overflow-hidden rounded-2xl p-3.5 ring-1 ${st.ring} ${st.bg} flex items-center gap-3`}>
                  <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                  <span className="text-3xl">{it.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold ${st.text}`}>{it.name}</p>
                    <p className="text-[11px] text-muted-foreground">{it.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel>
        <SectionTitle icon="📖" title="Códice de relíquias" />
        <div className="space-y-2">
          {catalog.map((r) => {
            const has = owned.some((o) => o.item_key.includes(r.key));
            const st = rarityStyle(r.rarity);
            return (
              <div key={r.key} className={`rounded-2xl p-3.5 ring-1 ${has ? st.ring : "ring-white/10"} ${has ? st.bg : "bg-white/[0.03]"} flex items-center gap-3`}>
                <span className={`text-2xl ${has ? "" : "grayscale opacity-50"}`}>{has ? r.icon : "❔"}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[12px] font-semibold ${has ? st.text : "text-muted-foreground"}`}>{has ? r.name : "?????"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{has ? r.description : `Selada · requer nível ${r.required_level}`}</p>
                </div>
                <span className="text-[10px] text-amber-300 flex items-center gap-1"><Gem className="h-3 w-3" />{r.price}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ───────── 10. Loja ───────── */

function ShopSection({ state }: { state: S }) {
  const { data: items } = useShop();
  const buy = useBuyItem();
  const coins = state?.coins?.balance ?? 0;
  const level = state?.profile?.level ?? 1;
  const owned = state?.purchases ?? [];

  const visible = (items ?? []).filter((it) => it.required_level <= level + 5);
  const sealed = (items ?? []).length - visible.length;

  return (
    <div className="space-y-3">
      <Panel className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Saldo</p>
          <p className="text-2xl font-semibold text-amber-300 flex items-center gap-1.5">
            <Coins className="h-4 w-4" /> {coins.toLocaleString("pt-BR")}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground text-right max-w-[55%]">
          O estoque do Sistema muda conforme seu nível. {sealed > 0 ? `${sealed} itens permanecem selados.` : "Todo o estoque foi revelado."}
        </p>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5">
        {visible.map((it, i) => {
          const st = rarityStyle(it.rarity);
          const has = owned.includes(it.key);
          const canLevel = level >= it.required_level;
          const canAfford = coins >= it.price;
          const disabled = has || !canLevel || !canAfford || buy.isPending;
          return (
            <div key={it.key} className={`relative overflow-hidden glass rounded-2xl p-3.5 ring-1 ${st.ring} ${st.bg} animate-rise`} style={{ animationDelay: `${i * 30}ms` }}>
              {it.rarity === "mythic" && <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-rose-500/25 blur-2xl" />}
              <div className="text-2xl">{canLevel ? it.icon : "🔒"}</div>
              <p className={`mt-1.5 text-[12px] font-semibold leading-tight ${st.text}`}>{canLevel ? it.name : "?????"}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{canLevel ? it.description : "Item selado pelo Sistema."}</p>
              <p className="mt-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/60">{it.rarity} · Lv {it.required_level}+</p>
              <button
                disabled={disabled}
                onClick={() => buy.mutate(it.key)}
                className={`tap mt-2 w-full rounded-xl py-1.5 text-[11px] font-semibold ring-hair transition flex items-center justify-center gap-1 ${
                  has ? "bg-emerald-500/15 text-emerald-300"
                    : disabled ? "bg-white/[0.03] text-muted-foreground/60"
                    : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                }`}
              >
                {has ? <><Check className="h-3 w-3" /> Adquirido</> : <><Gem className="h-3 w-3" /> {it.price}</>}
              </button>
              {!has && !canLevel && <p className="mt-1 text-[9px] text-muted-foreground/70 text-center">Requer nível {it.required_level}</p>}
              {!has && canLevel && !canAfford && <p className="mt-1 text-[9px] text-muted-foreground/70 text-center">Faltam {it.price - coins}</p>}
            </div>
          );
        })}
        {sealed > 0 && (
          <div className="rounded-2xl p-3.5 ring-hair bg-white/[0.03] flex flex-col items-center justify-center text-center">
            <p className="text-2xl opacity-50">❔</p>
            <p className="text-[11px] font-semibold mt-1 text-muted-foreground">{sealed} itens selados</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Suba de nível para revelar</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── 11. Bosses ───────── */

function BossesSection() {
  const { data: boss } = useWeeklyBoss();
  const { data: history } = useBossHistory();
  const monthly = monthlyBoss(history ?? []);
  const defeated = (history ?? []).filter((b) => b.status === "completed");

  return (
    <div className="space-y-3">
      <Panel className="relative overflow-hidden">
        <Particles />
        <div className="relative">
          <SectionTitle icon="👹" title="Boss da semana" />
          {boss ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{boss.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold">{boss.name}</p>
                  <p className="text-[11px] text-muted-foreground">{boss.description}</p>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full ring-hair ${boss.status === "completed" ? "text-emerald-300 bg-emerald-500/10" : "text-amber-300 bg-amber-500/10"}`}>
                  {boss.status === "completed" ? "Derrotado" : `+${boss.xp_reward} XP`}
                </span>
              </div>
              <div className="space-y-2">
                {boss.objectives.map((o) => {
                  const done = o.current >= o.target;
                  return (
                    <div key={o.key}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className={done ? "text-emerald-300" : "text-foreground/80"}>{o.label}</span>
                        <span className="text-muted-foreground">{o.current}/{o.target}</span>
                      </div>
                      <Bar pct={(o.current / Math.max(1, o.target)) * 100} className={done ? "bg-emerald-400" : "bg-gradient-to-r from-electric to-primary"} />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <Hidden label="nenhum boss ativo" />
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon="🌑" title="Boss mensal" sub="Derrote os bosses semanais do mês" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold">{monthly.defeated ? "Colosso derrotado" : "Colosso do Mês"}</span>
          <span className="text-[11px] text-muted-foreground">{monthly.done}/{monthly.target}</span>
        </div>
        <Bar pct={monthly.pct} className={monthly.defeated ? "bg-emerald-400" : "bg-gradient-to-r from-rose-400 to-amber-400"} />
        <p className="mt-2 text-[10px] text-muted-foreground/70">Recompensa acumulada: {monthly.reward.toLocaleString("pt-BR")} XP</p>
      </Panel>

      <Panel>
        <SectionTitle icon="🏆" title={`Bosses derrotados (${defeated.length})`} />
        {defeated.length === 0 ? (
          <Hidden label="nenhum boss derrotado ainda" />
        ) : (
          <div className="space-y-2">
            {defeated.map((b) => (
              <div key={b.id} className="rounded-2xl p-3 ring-hair bg-emerald-500/[0.07] flex items-center gap-3">
                <span className="text-xl">{b.icon ?? "👹"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">semana de {new Date(b.week_start).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="text-[10px] text-emerald-300">+{b.xp_reward} XP</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="text-center">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Próximo boss</p>
        <p className="text-3xl mt-2 opacity-60">❔</p>
        <p className="mt-1"><Hidden /></p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Revelado no início da próxima semana</p>
      </Panel>
    </div>
  );
}

/* ───────── 12. Conquistas ───────── */

function AchievementsSection() {
  const { data: achievements } = useAchievementsList();
  const list = achievements ?? [];
  const byTier = useMemo(() => {
    const map: Record<AchvTier, typeof list> = { comum: [], rara: [], epica: [], lendaria: [], secreta: [] };
    list.forEach((a) => map[achievementTier(a.badge_key)].push(a));
    return map;
  }, [list]);

  const estimatedTotal = 80;
  const pct = Math.min(100, Math.round((list.length / estimatedTotal) * 100));

  return (
    <div className="space-y-3">
      <Panel className="relative overflow-hidden text-center">
        <Particles />
        <div className="relative py-3">
          <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Coleção de conquistas</p>
          <p className="text-4xl font-semibold mt-2">{pct}%</p>
          <p className="text-[11px] text-muted-foreground">{list.length} de ~{estimatedTotal} registradas</p>
          <div className="mt-3 px-6"><Bar pct={pct} className="bg-gradient-to-r from-electric to-amber-300" /></div>
        </div>
      </Panel>

      {(Object.keys(TIER_STYLE) as AchvTier[]).map((tier) => {
        const st = TIER_STYLE[tier];
        const rows = byTier[tier];
        return (
          <Panel key={tier}>
            <SectionTitle icon="🏅" title={`${st.label} (${rows.length})`} />
            {rows.length === 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-2xl p-3 ring-hair bg-white/[0.03] text-center">
                    <p className="text-xl opacity-40">❔</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">?????</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {rows.map((a) => (
                  <div key={a.id} className={`rounded-2xl p-3 ring-1 ${st.ring} ${st.bg} text-center`}>
                    <p className="text-xl">{a.icon ?? "🏅"}</p>
                    <p className={`text-[10px] font-semibold mt-1 line-clamp-2 ${st.text}`}>{a.name}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

/* ───────── 13. Histórico de Evolução ───────── */

const CATEGORY_TONE: Record<string, string> = {
  level: "bg-electric",
  class: "bg-fuchsia-400",
  boss: "bg-rose-400",
  title: "bg-amber-300",
  rank: "bg-sky-400",
  achievement: "bg-emerald-400",
  shop: "bg-violet-400",
};

function EvolutionSection() {
  const { data: events } = useTimeline(80);
  const list = events ?? [];

  return (
    <div className="space-y-3">
      <Panel className="relative overflow-hidden">
        <Particles />
        <div className="relative">
          <SectionTitle icon="🧭" title="Histórico de evolução" sub="Tudo que o Sistema registrou sobre você" />
          <p className="text-[12px] text-muted-foreground">{list.length} marcos permanentes registrados.</p>
        </div>
      </Panel>

      {list.length === 0 ? (
        <Panel className="text-center py-8">
          <p className="text-4xl mb-2">🕰️</p>
          <p className="text-sm font-semibold">A linha do tempo está vazia</p>
          <p className="text-xs text-muted-foreground mt-1">Complete missões, conquiste títulos e derrote bosses.</p>
        </Panel>
      ) : (
        <Panel>
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gradient-to-b from-electric/50 via-white/10 to-transparent" />
            <div className="space-y-4">
              {list.map((e, i) => (
                <div key={e.id} className="relative animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                  <span className={`absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${CATEGORY_TONE[e.category] ?? "bg-slate-400"}`} />
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none">{e.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold leading-snug">{e.title}</p>
                      {e.description && <p className="text-[11px] text-muted-foreground leading-snug">{e.description}</p>}
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-0.5">
                        {new Date(e.occurred_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
