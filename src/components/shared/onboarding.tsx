import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Milk, Apple, ShoppingBasket, Beef, Droplets,
  Waves, Sparkles, ChevronRight, ChevronLeft, Check,
} from "lucide-react";

const CATEGORIES = [
  {
    key: "laticinios",
    label: "Lacticínios",
    emoji: "🥛",
    icon: Milk,
    examples: ["Leite", "Iogurte", "Queijo", "Manteiga"],
    unit: "L",
    unitLabel: "litros/semana",
    default: 2,
  },
  {
    key: "frutas_legumes",
    label: "Frutas & Legumes",
    emoji: "🥦",
    icon: Apple,
    examples: ["Tomate", "Cenoura", "Alface", "Maçã"],
    unit: "kg",
    unitLabel: "kg/semana",
    default: 2,
  },
  {
    key: "carnes_proteinas",
    label: "Carnes & Proteínas",
    emoji: "🥩",
    icon: Beef,
    examples: ["Frango", "Carne picada", "Peixe", "Ovos"],
    unit: "kg",
    unitLabel: "kg/semana",
    default: 1,
  },
  {
    key: "massas_cereais",
    label: "Massas & Cereais",
    emoji: "🍝",
    icon: ShoppingBasket,
    examples: ["Arroz", "Esparguete", "Pão", "Aveia"],
    unit: "kg",
    unitLabel: "kg/semana",
    default: 0.5,
  },
  {
    key: "bebidas",
    label: "Bebidas",
    emoji: "🧃",
    icon: Droplets,
    examples: ["Sumos", "Água", "Café", "Chá"],
    unit: "L",
    unitLabel: "litros/semana",
    default: 3,
  },
  {
    key: "higiene_limpeza",
    label: "Higiene & Limpeza",
    emoji: "🧼",
    icon: Waves,
    examples: ["Champô", "Detergente", "Papel higiénico"],
    unit: "unidade",
    unitLabel: "unid./semana",
    default: 0,
  },
] as const;

type OnboardingData = Record<string, { qty: number; unit: string; enabled: boolean }>;

interface Props {
  onComplete: () => void;
}

export function CasaOnboarding({ onComplete }: Props) {
  const { membership, userId, firstName, updateDisplayName } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();

  const [step, setStep] = useState(0); // 0=nome, 1=consumo, 2=done
  const [nameInput, setNameInput] = useState(firstName ?? "");
  const [data, setData] = useState<OnboardingData>(() =>
    Object.fromEntries(CATEGORIES.map(c => [c.key, { qty: c.default, unit: c.unit, enabled: c.default > 0 }]))
  );
  const [saving, setSaving] = useState(false);

  const toggleCat = (key: string) =>
    setData(d => ({ ...d, [key]: { ...d[key], enabled: !d[key].enabled } }));

  const setQty = (key: string, qty: number) =>
    setData(d => ({ ...d, [key]: { ...d[key], qty } }));

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      // Save display name if changed
      if (nameInput.trim() && nameInput.trim() !== firstName) {
        await updateDisplayName(nameInput.trim());
      }

      // Create stock items with weekly consumption for enabled categories
      const enabled = CATEGORIES.filter(c => data[c.key].enabled && data[c.key].qty > 0);
      if (enabled.length > 0) {
        // Create representative stock items
        const inserts = enabled.flatMap(cat => {
          // Pick the first example as a stock item
          return cat.examples.slice(0, 2).map((name, i) => ({
            workspace_id: wsId!,
            created_by: userId!,
            name,
            category: cat.label,
            quantity: i === 0 ? data[cat.key].qty * 2 : 0, // start with 2 weeks stock for first item
            unit: cat.unit === "L" ? "L" : cat.unit === "kg" ? "kg" : "unidade",
            min_stock: Math.ceil(data[cat.key].qty),
            location: "despensa",
            status: "active",
            weekly_consumption: i === 0 ? data[cat.key].qty : 0,
            auto_deduct: i === 0,
          }));
        });

        await supabase.from("home_stock_items").insert(inserts);
      }

      // Mark onboarding complete in localStorage
      localStorage.setItem(`onboarding.casa.${wsId}`, "done");
      qc.invalidateQueries({ queryKey: ["casa-stock", wsId] });
      qc.invalidateQueries({ queryKey: ["casa-stock-dash", wsId] });
      toast.success("Perfil configurado! O teu stock está pronto.");
      onComplete();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-lg overflow-hidden">
      {/* Progress */}
      <div className="flex gap-0">
        {[0, 1].map(i => (
          <div key={i} className={`h-1 flex-1 transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      <div className="px-5 py-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Bem-vindo{firstName ? `, ${firstName}` : ""}! 👋</h2>
                <p className="text-sm text-muted-foreground">Vamos configurar a tua experiência em 2 minutos.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Como te chamas?
              </label>
              <Input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && nameInput.trim()) setStep(1); }}
                placeholder="O teu primeiro nome"
                className="h-10 text-base"
              />
              <p className="text-xs text-muted-foreground">Usamos apenas para a saudação — podes alterar depois no perfil.</p>
            </div>

            <div className="flex justify-end">
              <Button className="h-10 px-5 font-semibold" onClick={() => setStep(1)} disabled={!nameInput.trim()}>
                Continuar <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold">O que costumas consumir?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Indica o consumo semanal típico da tua casa. A app vai deduzir automaticamente do stock. Podes alterar a qualquer momento.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map(cat => {
                const d = data[cat.key];
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.key}
                    onClick={() => toggleCat(cat.key)}
                    className={`group relative rounded-xl border p-3 cursor-pointer transition-all ${
                      d.enabled
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl shrink-0">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{cat.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{cat.examples.join(", ")}</p>
                      </div>
                      <div className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center ${d.enabled ? "border-primary bg-primary" : "border-border"}`}>
                        {d.enabled && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                      </div>
                    </div>

                    {d.enabled && (
                      <div className="mt-2.5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="range" min="0.5" max="10" step="0.5"
                          value={d.qty}
                          onChange={e => setQty(cat.key, Number(e.target.value))}
                          className="flex-1 accent-primary h-1.5 rounded"
                        />
                        <span className="text-xs font-mono tabular-nums w-16 text-right text-muted-foreground">
                          {d.qty} {cat.unitLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ChevronLeft className="size-4" /> Voltar
              </Button>
              <Button className="h-10 px-5 font-semibold" onClick={saveAndFinish} disabled={saving}>
                {saving ? "A configurar…" : <><Check className="size-4" /> Começar</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Negócio Onboarding ────────────────────────────────────────────────────────
const NEGOCIO_CATEGORIES = [
  { key: "materias_primas", label: "Matérias-primas", emoji: "📦", examples: ["Tecido", "Madeira", "Metal", "Plástico"], unit: "kg" },
  { key: "embalagens", label: "Embalagens", emoji: "📫", examples: ["Caixas", "Sacos", "Filme", "Etiquetas"], unit: "unidade" },
  { key: "consumiveis", label: "Consumíveis", emoji: "🖊️", examples: ["Papel", "Canetas", "Tinteiros", "Fita"], unit: "unidade" },
  { key: "limpeza", label: "Limpeza", emoji: "🧹", examples: ["Detergente", "Panos", "Luvas"], unit: "unidade" },
  { key: "alimentar", label: "Alimentar (café/snacks)", emoji: "☕", examples: ["Café", "Água", "Açúcar"], unit: "unidade" },
  { key: "outro", label: "Outro", emoji: "🔧", examples: ["Ferramentas", "Acessórios", "Peças"], unit: "unidade" },
] as const;

export function NegocioOnboarding({ onComplete }: { onComplete: () => void }) {
  const { membership, userId, firstName, updateDisplayName } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [nameInput, setNameInput] = useState(firstName ?? "");
  const [businessName, setBusinessName] = useState(membership?.workspace_name ?? "");
  const [sector, setSector] = useState("");
  const [data, setData] = useState<Record<string, { qty: number; unit: string; enabled: boolean }>>(() =>
    Object.fromEntries(NEGOCIO_CATEGORIES.map(c => [c.key, { qty: 0, unit: c.unit, enabled: false }]))
  );
  const [saving, setSaving] = useState(false);

  const toggleCat = (key: string) =>
    setData(d => ({ ...d, [key]: { ...d[key], enabled: !d[key].enabled, qty: d[key].enabled ? 0 : 5 } }));

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      if (nameInput.trim() && nameInput.trim() !== firstName) {
        await updateDisplayName(nameInput.trim());
      }
      localStorage.setItem(`onboarding.negocio.${wsId}`, "done");
      qc.invalidateQueries({ queryKey: ["current-membership"] });
      toast.success("Perfil configurado!");
      onComplete();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = ["Perfil", "Negócio"];

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-lg overflow-hidden">
      {/* Progress */}
      <div className="flex gap-0">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      <div className="px-5 py-6 space-y-5">
        {step === 0 && (
          <>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Bem-vindo ao modo Negócio!</h2>
                <p className="text-sm text-muted-foreground">Vamos personalizar a tua experiência.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Como te chamas?</label>
              <Input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && nameInput.trim()) setStep(1); }}
                placeholder="O teu primeiro nome" className="h-10 text-base" />
            </div>
            <div className="flex justify-end">
              <Button className="h-10 px-5 font-semibold" onClick={() => setStep(1)} disabled={!nameInput.trim()}>
                Continuar <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <h2 className="font-display text-lg font-bold">O teu negócio</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Que tipo de produtos ou materiais usas habitualmente?</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {NEGOCIO_CATEGORIES.map(cat => {
                const d = data[cat.key];
                return (
                  <div
                    key={cat.key}
                    onClick={() => toggleCat(cat.key)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${d.enabled ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border/60 hover:border-border"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{cat.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{cat.examples.join(", ")}</p>
                      </div>
                      <div className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center ${d.enabled ? "border-primary bg-primary" : "border-border"}`}>
                        {d.enabled && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-1">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ChevronLeft className="size-4" /> Voltar
              </Button>
              <Button className="h-10 px-5 font-semibold" onClick={saveAndFinish} disabled={saving}>
                {saving ? "A configurar…" : <><Check className="size-4" /> Começar</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
