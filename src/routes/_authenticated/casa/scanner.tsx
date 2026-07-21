import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";
import {
  Camera, Upload, Loader2, Check, X, Plus, RefreshCw,
  ScanLine, ShoppingBag, AlertTriangle, Pencil, Trash2
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/casa/scanner")({ component: ScannerPage });

type ParsedItem = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price?: number;
  selected: boolean;
};

const UNITS = ["unidade", "kg", "g", "L", "ml", "pacote", "caixa"] as const;
const CATEGORIES = ["Alimentação", "Higiene", "Limpeza", "Saúde", "Outro"] as const;

async function parseReceiptWithAI(base64: string, mimeType: string): Promise<ParsedItem[]> {
  const apiKey = import.meta.env.lifebiz_sync;
  if (!apiKey) throw new Error("Chave API Anthropic não configurada. Adiciona lifebiz_sync nas variáveis de ambiente do projeto.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          {
            type: "text",
            text: `Analisa este talão/recibo de compras e extrai todos os produtos comprados.
Responde APENAS com JSON válido (sem markdown, sem texto extra) neste formato exacto:
[
  {
    "name": "Nome do produto",
    "quantity": 1,
    "unit": "unidade",
    "category": "Alimentação",
    "price": 1.99
  }
]

Regras:
- name: nome limpo do produto (sem códigos)
- quantity: número (1 se não identificares)
- unit: uma de: unidade, kg, g, L, ml, pacote, caixa
- category: uma de: Alimentação, Higiene, Limpeza, Saúde, Outro
- price: preço unitário em euros (opcional)
- Inclui todos os produtos visíveis no talão`
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Erro API: ${response.status}`);
  }

  const data = await response.json();
  const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const items: Omit<ParsedItem, "selected">[] = JSON.parse(clean);
  return items.map(i => ({ ...i, selected: true }));
}

function ScannerPage() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "processing" | "review" | "done">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const { data: stockItems } = useQuery({
    queryKey: ["casa-stock", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("home_stock_items").select("name, category").eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const addToStock = useMutation({
    mutationFn: async (toAdd: ParsedItem[]) => {
      const existing = new Map((stockItems ?? []).map(s => [s.name.toLowerCase(), true]));
      const inserts = toAdd.map(item => ({
        workspace_id: wsId!, created_by: userId!,
        name: item.name, category: item.category,
        quantity: item.quantity, unit: item.unit, min_stock: 1,
        location: "despensa", status: "active",
      }));
      const { error } = await supabase.from("home_stock_items").insert(inserts as any);
      if (error) throw error;
    },
    onSuccess: (_, toAdd) => {
      qc.invalidateQueries({ queryKey: ["casa-stock", wsId] });
      qc.invalidateQueries({ queryKey: ["casa-stock-dash", wsId] });
      toast.success(`${toAdd.length} produto${toAdd.length !== 1 ? "s" : ""} adicionado${toAdd.length !== 1 ? "s" : ""} ao stock`);
      setStep("done");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Seleciona uma imagem"); return; }
    setError(null);
    setStep("processing");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      const base64 = result.split(",")[1];
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";

      try {
        const parsed = await parseReceiptWithAI(base64, mimeType);
        if (parsed.length === 0) throw new Error("Não foram encontrados produtos no talão.");
        setItems(parsed);
        setStep("review");
      } catch (err: any) {
        setError(err.message ?? "Erro ao processar talão");
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleItem = (idx: number) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));

  const updateItem = (idx: number, patch: Partial<ParsedItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const selected = items.filter(i => i.selected);

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  return (
    <div className="space-y-0 max-w-2xl">
      <PageHeader
        title="Scanner de Talão"
        subtitle="Fotografa um talão de compras para adicionar produtos ao stock automaticamente"
      />

      {/* STEP: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <ScanLine className="size-8 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Clica para selecionar</p>
              <p className="mt-1 text-sm text-muted-foreground">ou arrasta a foto do talão aqui</p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="default" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                <Upload className="size-4" /> Galeria / Ficheiro
              </Button>
              <Button type="button" variant="outline" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}>
                <Camera className="size-4" /> Câmara
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">JPG, PNG, WebP · Máx 10MB</p>
          </div>

          {/* Info banner sobre API key */}
          {!import.meta.env.lifebiz_sync && (
            <div className="rounded-xl border border-yellow-400/40 bg-yellow-50/60 dark:bg-yellow-900/10 px-4 py-3">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Configuração necessária</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Adiciona a variável <code className="bg-yellow-200 dark:bg-yellow-900 px-1 rounded">lifebiz_sync</code> nas definições do projeto Lovable para activar o scanner com IA.
              </p>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* STEP: Processing */}
      {step === "processing" && (
        <div className="flex flex-col items-center gap-6 py-16">
          {preview && (
            <img src={preview} alt="Talão" className="max-h-48 rounded-xl object-contain shadow-lg ring-1 ring-border/60" />
          )}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="grid size-14 place-items-center rounded-full bg-primary/10">
                <ScanLine className="size-7 text-primary animate-pulse" />
              </div>
            </div>
            <p className="font-display text-lg font-semibold">A analisar talão…</p>
            <p className="text-sm text-muted-foreground">A IA está a identificar os produtos. Aguarda um momento.</p>
          </div>
        </div>
      )}

      {/* STEP: Review */}
      {step === "review" && (
        <div className="space-y-4">
          {preview && (
            <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <img src={preview} alt="Talão" className="h-20 w-16 object-cover rounded-lg shrink-0" />
              <div>
                <p className="text-sm font-semibold">{items.length} produto{items.length !== 1 ? "s" : ""} encontrado{items.length !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">{selected.length} selecionado{selected.length !== 1 ? "s" : ""} para adicionar ao stock</p>
                <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => { setStep("upload"); setItems([]); setPreview(null); }}>
                  <RefreshCw className="size-3" /> Novo talão
                </Button>
              </div>
            </div>
          )}

          {/* Selecionar / desselecionar todos */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Produtos identificados
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems(p => p.map(i => ({ ...i, selected: true })))}>
                Selecionar tudo
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems(p => p.map(i => ({ ...i, selected: false })))}>
                Limpar
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {items.map((item, idx) => (
              <div key={idx} className={`px-4 py-3 transition-colors ${!item.selected ? "opacity-50 bg-muted/20" : ""}`}>
                {editIdx === idx ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <Input className="h-8 text-sm" value={item.name} onChange={e => updateItem(idx, { name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quantidade</Label>
                        <Input className="h-8 text-sm" type="number" step="0.001" value={item.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Unidade</Label>
                        <Select value={item.unit} onValueChange={v => updateItem(idx, { unit: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Categoria</Label>
                        <Select value={item.category} onValueChange={v => updateItem(idx, { category: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditIdx(null)}>
                      <Check className="size-3" /> Confirmar
                    </Button>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-3">
                    {/* Checkbox visual */}
                    <button
                      onClick={() => toggleItem(idx)}
                      className={`size-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${item.selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {item.selected && <Check className="size-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                        <span className="status-pill-info text-[10px]">{item.category}</span>
                        {item.price && <span className="text-xs text-muted-foreground">€{item.price.toFixed(2)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditIdx(idx)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)}>
                        <Trash2 className="size-3.5 text-destructive/70" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Adicionar manualmente */}
            <button
              className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
              onClick={() => {
                setItems(p => [...p, { name: "", quantity: 1, unit: "unidade", category: "Alimentação", selected: true }]);
                setEditIdx(items.length);
              }}
            >
              <Plus className="size-3.5" /> Adicionar produto manualmente
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setStep("upload"); setItems([]); setPreview(null); }}>
              Cancelar
            </Button>
            <Button
              className="flex-1 h-10 font-semibold"
              disabled={selected.length === 0 || addToStock.isPending}
              onClick={() => addToStock.mutate(selected)}
            >
              {addToStock.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
              Adicionar {selected.length} produto{selected.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* STEP: Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-green-100 dark:bg-green-900/30 ring-1 ring-green-200">
            <Check className="size-8 text-green-600" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-xl font-bold text-green-700 dark:text-green-400">Stock atualizado!</p>
            <p className="mt-1 text-sm text-muted-foreground">Os produtos foram adicionados ao stock com sucesso.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep("upload"); setItems([]); setPreview(null); setError(null); }}>
              <ScanLine className="size-4" /> Novo talão
            </Button>
            <Button asChild>
              <a href="/casa/stock">Ver stock</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
