import { useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";
import {
  Camera, Upload, Loader2, Check, X, Plus, RefreshCw,
  ScanLine, ShoppingBag, AlertTriangle, Pencil, Trash2,
  QrCode, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/casa/scanner")({ component: ScannerPage });

type ParsedItem = {
  name: string; quantity: number; unit: string; category: string;
  price?: number; selected: boolean;
};

const UNITS = ["unidade", "kg", "g", "L", "ml", "pacote", "caixa"] as const;
const CATEGORIES = ["Alimentação", "Higiene", "Limpeza", "Saúde", "Outro"] as const;

async function parseReceiptWithAI(base64: string, mimeType: string, extraContext = ""): Promise<ParsedItem[]> {
  const apiKey = (import.meta.env as any).lifebiz_sync;
  if (!apiKey) throw new Error("Chave API não configurada. Adiciona lifebiz_sync nas variáveis de ambiente do Lovable.");

  const prompt = extraContext
    ? `Analisa estes dados de um recibo (QR Code): ${extraContext}. Extrai os produtos comprados.`
    : `Analisa este talão/recibo de compras e extrai todos os produtos.`;

  const userContent: any[] = [];
  if (base64) userContent.push({ type: "image", source: { type: "base64", media_type: mimeType, data: base64 } });
  userContent.push({
    type: "text",
    text: `${prompt}
Responde APENAS com JSON válido (sem markdown) neste formato:
[{"name":"Nome","quantity":1,"unit":"unidade","category":"Alimentação","price":1.99}]
Unidades: unidade, kg, g, L, ml, pacote, caixa
Categorias: Alimentação, Higiene, Limpeza, Saúde, Outro`
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, messages: [{ role: "user", content: userContent }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error?.message ?? `Erro ${res.status}`); }
  const data = await res.json();
  const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const items: Omit<ParsedItem, "selected">[] = JSON.parse(clean);
  return items.map(i => ({ ...i, selected: true }));
}

// ── QR Scanner using BarcodeDetector API ──────────────────────────────────────
function QrScannerTab({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualQr, setManualQr] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    // Check BarcodeDetector support
    if (!("BarcodeDetector" in window)) {
      setError("O teu browser não suporta leitura de QR Code pela câmara. Usa a opção de imagem ou introduz o código manualmente.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // @ts-ignore
      const detector = new BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8"] });

      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            stopStream();
            onResult(barcodes[0].rawValue);
            return;
          }
        } catch {}
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch (e: any) {
      setError("Não foi possível aceder à câmara: " + e.message);
    }
  }, [onResult, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  return (
    <div className="space-y-4">
      {!scanning ? (
        <div className="space-y-3">
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            onClick={startScan}
          >
            <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <QrCode className="size-8 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Ler QR Code com câmara</p>
              <p className="mt-1 text-sm text-muted-foreground">Aponta a câmara para o QR do talão</p>
            </div>
            <Button type="button" onClick={(e) => { e.stopPropagation(); startScan(); }}>
              <Camera className="size-4" /> Abrir câmara
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">ou introduz o código manualmente</span></div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Cola aqui o conteúdo do QR Code…"
              value={manualQr}
              onChange={e => setManualQr(e.target.value)}
              className="h-9 font-mono text-xs"
            />
            <Button disabled={!manualQr.trim()} onClick={() => { onResult(manualQr); setManualQr(""); }}>
              Usar
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-yellow-400/40 bg-yellow-50/60 dark:bg-yellow-900/10 px-4 py-3">
              <AlertTriangle className="size-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">{error}</p>
            </div>
          )}

          <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">ℹ️ Sobre o QR nos talões portugueses</p>
            <p>O QR Code AT (Autoridade Tributária) contém o valor total e dados fiscais — não os produtos individuais. Se o talão tiver QR, a IA vai tentar extrair o que conseguir. Para obter todos os produtos, usa a opção de <strong>foto do talão</strong>.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative size-48">
                <div className="absolute inset-0 border-2 border-white/40 rounded-xl" />
                {/* Corner markers */}
                {[["top-0 left-0","border-l-2 border-t-2"],["top-0 right-0","border-r-2 border-t-2"],["bottom-0 left-0","border-l-2 border-b-2"],["bottom-0 right-0","border-r-2 border-b-2"]].map(([pos, border]) => (
                  <div key={pos} className={`absolute size-6 border-primary ${border} ${pos}`} />
                ))}
                {/* Scan line animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-primary/80 animate-bounce top-1/2" style={{ animation: "scan 2s linear infinite" }} />
              </div>
            </div>
          </div>
          <style>{`@keyframes scan { 0%,100%{top:10%} 50%{top:90%} }`}</style>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              A procurar QR Code…
            </div>
            <Button variant="outline" size="sm" onClick={stopStream}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Scanner Page ─────────────────────────────────────────────────────────
function ScannerPage() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"photo" | "qr">("photo");
  const [step, setStep] = useState<"upload" | "processing" | "review" | "done">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [qrResult, setQrResult] = useState<string | null>(null);
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

  const processImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Seleciona uma imagem"); return; }
    setError(null); setStep("processing");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      try {
        const parsed = await parseReceiptWithAI(result.split(",")[1], file.type as any);
        if (!parsed.length) throw new Error("Não foram encontrados produtos.");
        setItems(parsed); setStep("review");
      } catch (err: any) {
        setError(err.message); setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const processQr = async (text: string) => {
    setQrResult(text); setStep("processing");
    try {
      const parsed = await parseReceiptWithAI("", "image/jpeg" as any, text);
      if (!parsed.length) throw new Error("Não foi possível extrair produtos do QR Code. Tenta a opção de foto do talão.");
      setItems(parsed); setStep("review");
    } catch (err: any) {
      setError(err.message); setStep("upload"); setQrResult(null);
    }
  };

  const toggleItem = (idx: number) =>
    setItems(p => p.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  const updateItem = (idx: number, patch: Partial<ParsedItem>) =>
    setItems(p => p.map((item, i) => i === idx ? { ...item, ...patch } : item));
  const removeItem = (idx: number) =>
    setItems(p => p.filter((_, i) => i !== idx));

  const reset = () => { setStep("upload"); setItems([]); setPreview(null); setError(null); setQrResult(null); };
  const selected = items.filter(i => i.selected);

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  return (
    <div className="max-w-2xl space-y-0">
      <PageHeader
        title="Scanner de Talão"
        subtitle="Adiciona produtos ao stock a partir de um talão ou QR Code"
      />

      {/* Tab selector */}
      {step === "upload" && (
        <div className="mb-4 flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
          <button
            onClick={() => setTab("photo")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${tab === "photo" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ImageIcon className="size-4" /> Foto do talão
          </button>
          <button
            onClick={() => setTab("qr")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${tab === "qr" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <QrCode className="size-4" /> QR Code
          </button>
        </div>
      )}

      {/* UPLOAD STEP */}
      {step === "upload" && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {tab === "photo" && (
            <>
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-14 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processImage(f); }}
              >
                <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <ScanLine className="size-8 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">Foto do talão de compras</p>
                  <p className="mt-1 text-sm text-muted-foreground">Clica ou arrasta a imagem do talão</p>
                </div>
                <div className="flex gap-3">
                  <Button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                    <Upload className="size-4" /> Galeria
                  </Button>
                  <Button type="button" variant="outline" onClick={e => { e.stopPropagation(); cameraRef.current?.click(); }}>
                    <Camera className="size-4" /> Câmara
                  </Button>
                </div>
              </div>
              {!(import.meta.env as any).lifebiz_sync && (
                <div className="rounded-xl border border-yellow-400/40 bg-yellow-50/60 dark:bg-yellow-900/10 px-4 py-3">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Configuração necessária</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                    Adiciona a variável <code className="bg-yellow-200 dark:bg-yellow-900 px-1 rounded">lifebiz_sync</code> nas definições do projeto Lovable.
                  </p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processImage(f); }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processImage(f); }} />
            </>
          )}

          {tab === "qr" && <QrScannerTab onResult={processQr} />}
        </div>
      )}

      {/* PROCESSING STEP */}
      {step === "processing" && (
        <div className="flex flex-col items-center gap-6 py-16">
          {preview && <img src={preview} alt="Talão" className="max-h-48 rounded-xl object-contain shadow-lg ring-1 ring-border/60" />}
          {qrResult && (
            <div className="w-full rounded-xl bg-muted/40 border border-border/60 px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">QR Code lido</p>
              <p className="font-mono text-xs text-muted-foreground truncate">{qrResult}</p>
            </div>
          )}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10">
              <ScanLine className="size-7 text-primary animate-pulse" />
            </div>
            <p className="font-display text-lg font-semibold">A analisar com IA…</p>
            <p className="text-sm text-muted-foreground">A extrair produtos. Aguarda um momento.</p>
          </div>
        </div>
      )}

      {/* REVIEW STEP */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            {preview && <img src={preview} alt="Talão" className="h-16 w-12 object-cover rounded-lg shrink-0" />}
            {qrResult && !preview && (
              <div className="flex items-center justify-center size-12 rounded-lg bg-muted shrink-0">
                <QrCode className="size-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{items.length} produto{items.length !== 1 ? "s" : ""} encontrado{items.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">{selected.length} selecionado{selected.length !== 1 ? "s" : ""}</p>
              <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={reset}>
                <RefreshCw className="size-3" /> Novo scan
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produtos</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems(p => p.map(i => ({ ...i, selected: true })))}>Todos</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems(p => p.map(i => ({ ...i, selected: false })))}>Nenhum</Button>
            </div>
          </div>

          <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {items.map((item, idx) => (
              <div key={idx} className={`px-4 py-3 transition-colors ${!item.selected ? "opacity-50 bg-muted/20" : ""}`}>
                {editIdx === idx ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Input className="h-8 text-sm" value={item.name} onChange={e => updateItem(idx, { name: e.target.value })} />
                      </div>
                      <Input className="h-8 text-sm" type="number" step="0.001" value={item.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} />
                      <Select value={item.unit} onValueChange={v => updateItem(idx, { unit: v })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="col-span-2">
                        <Select value={item.category} onValueChange={v => updateItem(idx, { category: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditIdx(null)}>
                      <Check className="size-3" /> OK
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
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
            <button
              className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
              onClick={() => { setItems(p => [...p, { name: "", quantity: 1, unit: "unidade", category: "Alimentação", selected: true }]); setEditIdx(items.length); }}
            >
              <Plus className="size-3.5" /> Adicionar manualmente
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>Cancelar</Button>
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

      {/* DONE STEP */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-green-100 dark:bg-green-900/30 ring-1 ring-green-200">
            <Check className="size-8 text-green-600" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-xl font-bold text-green-700 dark:text-green-400">Stock atualizado!</p>
            <p className="mt-1 text-sm text-muted-foreground">Os produtos foram adicionados com sucesso.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}><ScanLine className="size-4" /> Novo scan</Button>
            <Button asChild><a href="/casa/stock">Ver stock</a></Button>
          </div>
        </div>
      )}
    </div>
  );
}
