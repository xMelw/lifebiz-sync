import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Plus, Search, Archive, AlertTriangle, Minus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "./index";

const UNITS = ["unidade", "kg", "g", "L", "ml", "pacote", "caixa"] as const;
const LOCATIONS = ["despensa", "frigorifico", "congelador", "casa_de_banho", "outro"] as const;
const CATEGORIES = ["Alimentação", "Higiene", "Limpeza", "Saúde", "Outro"] as const;

export const Route = createFileRoute("/_authenticated/casa/stock")({ component: CasaStock });

function CasaStock() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterLow, setFilterLow] = useState(false);
  const [filterExpiring, setFilterExpiring] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { data } = useQuery({
    queryKey: ["casa-stock", wsId, showArchived],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const query = supabase.from("home_stock_items").select("*").eq("workspace_id", wsId!);
      if (!showArchived) query.eq("status", "active");
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["casa-stock", wsId] });

  const createItem = useMutation({
    mutationFn: async (payload: {
      name: string; category: string; quantity: number; unit: string;
      min_stock: number; location: string; expiry_date: string | null;
    }) => {
      const { error } = await supabase.from("home_stock_items").insert({
        ...payload, workspace_id: wsId!, created_by: userId!, status: "active",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Item adicionado"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("home_stock_items").update(payload).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Item atualizado"); setOpen(false); setEditItem(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustQty = useMutation({
    mutationFn: async ({ id, delta, current }: { id: string; delta: number; current: number }) => {
      const newQty = Math.max(0, current + delta);
      const { error } = await supabase.from("home_stock_items").update({ quantity: newQty }).eq("id", id);
      if (error) throw error;
      return newQty;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_stock_items").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Item arquivado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_stock_items").update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Item restaurado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const now = new Date();
  const items = data ?? [];
  const filtered = items.filter((item) => {
    if (filterCat !== "all" && item.category !== filterCat) return false;
    if (filterLocation !== "all" && item.location !== filterLocation) return false;
    if (filterLow && Number(item.quantity) > Number(item.min_stock ?? 0)) return false;
    if (filterExpiring) {
      if (!item.expiry_date) return false;
      const diff = (new Date(item.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 0 || diff > 7) return false;
    }
    if (q && !item.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const lowCount = items.filter((i) => i.status === "active" && Number(i.quantity) <= Number(i.min_stock ?? 0)).length;
  const expiringCount = items.filter((i) => {
    if (!i.expiry_date || i.status !== "active") return false;
    const diff = (new Date(i.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Casa"
        subtitle={`${items.filter((i) => i.status === "active").length} itens${lowCount > 0 ? ` · ${lowCount} em falta` : ""}${expiringCount > 0 ? ` · ${expiringCount} a expirar` : ""}`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditItem(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Adicionar</Button>
              </DialogTrigger>
              <StockFormDialog item={editItem} onCreate={(p) => createItem.mutate(p)} onUpdate={(p) => updateItem.mutate(p)} />
            </Dialog>
          )
        }
      />

      {/* Alertas */}
      {(lowCount > 0 || expiringCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {lowCount > 0 && (
            <button onClick={() => setFilterLow(true)}
              className="flex items-center gap-1.5 rounded-md border border-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-400">
              <AlertTriangle className="size-3.5" /> {lowCount} item(s) com stock baixo
            </button>
          )}
          {expiringCount > 0 && (
            <button onClick={() => setFilterExpiring(true)}
              className="flex items-center gap-1.5 rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
              ⏱ {expiringCount} item(s) a expirar em 7 dias
            </button>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={filterLow ? "secondary" : "outline"} size="sm"
          onClick={() => setFilterLow(!filterLow)}>
          <AlertTriangle className="size-4" /> Baixo
        </Button>
        <Button variant={filterExpiring ? "secondary" : "outline"} size="sm"
          onClick={() => setFilterExpiring(!filterExpiring)}>
          ⏱ Validade
        </Button>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm"
          onClick={() => setShowArchived(!showArchived)}>
          <Archive className="size-4" />
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60"><Package className="size-8 text-muted-foreground/60" strokeWidth={1.5} /></div><p className="font-display text-lg font-semibold">{items.length === 0 ? "Stock vazio" : "Sem resultados"}</p><p className="mt-1 text-sm text-muted-foreground">{items.length === 0 ? "Adiciona o primeiro item." : "Tenta ajustar os filtros."}</p></div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {filtered.map((item) => {
            const isLow = Number(item.quantity) <= Number(item.min_stock ?? 0) && item.status === "active";
            const expDiff = item.expiry_date
              ? (new Date(item.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              : null;
            const isExpiring = expDiff !== null && expDiff >= 0 && expDiff <= 7;
            const isExpired = expDiff !== null && expDiff < 0;
            const archived = item.status === "archived";

            return (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ${archived ? "opacity-60" : ""} ${isLow ? "border-l-2 border-l-destructive/60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{item.name}</span>
                      {isLow && <span className="status-pill-destructive"><AlertTriangle className="size-2.5" />Baixo</span>}
                      {isExpired && <span className="status-pill-destructive">Expirado</span>}
                      {isExpiring && !isExpired && <span className="status-pill-warning">A expirar</span>}
                      {item.category && <span className="status-pill-neutral">{item.category}</span>}
                      {item.location && <span className="status-pill-info">{item.location}</span>}
                      {archived && <span className="status-pill-neutral">Arquivado</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {item.expiry_date && (
                        <span className={isExpired ? "text-destructive" : isExpiring ? "text-yellow-600" : ""}>
                          Validade: {new Date(item.expiry_date).toLocaleDateString("pt-PT")}
                        </span>
                      )}
                      <span>Mín: {item.min_stock ?? 0} {item.unit}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {/* Quantidade + botões +/- */}
                    {canWrite && !archived ? (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="size-6"
                          onClick={() => adjustQty.mutate({ id: item.id, delta: -1, current: Number(item.quantity) })}>
                          <Minus className="size-3" />
                        </Button>
                        <span className="min-w-[3rem] text-center font-mono text-sm tabular-nums">
                          {item.quantity} {item.unit}
                        </span>
                        <Button size="icon" variant="outline" className="size-6"
                          onClick={() => adjustQty.mutate({ id: item.id, delta: 1, current: Number(item.quantity) })}>
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-sm">{item.quantity} {item.unit}</span>
                    )}

                    {canWrite && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="size-6"
                          onClick={() => { setEditItem(item); setOpen(true); }}><Pencil className="size-3 " /></Button>
                        {!archived ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-6">
                                <Archive className="size-3.5 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Arquivar item?</AlertDialogTitle>
                                <AlertDialogDescription>O item ficará oculto mas o histórico mantém-se.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => archiveItem.mutate(item.id)}>Arquivar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button size="icon" variant="ghost" className="size-6"
                            onClick={() => restoreItem.mutate(item.id)}>↩</Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StockFormDialog({ item, onCreate, onUpdate }: {
  item: any;
  onCreate: (p: any) => void;
  onUpdate: (p: any) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? CATEGORIES[0]);
  const [quantity, setQuantity] = useState(String(item?.quantity ?? "1"));
  const [unit, setUnit] = useState<string>(item?.unit ?? "unidade");
  const [minQuantity, setMinQuantity] = useState(String(item?.min_stock ?? "1"));
  const [location, setLocation] = useState<string>(item?.location ?? "despensa");
  const [expiryDate, setExpiryDate] = useState(item?.expiry_date ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name, category, quantity: Number(quantity), unit,
      min_stock: Number(minQuantity), location,
      expiry_date: expiryDate || null,
    };
    if (item) onUpdate({ ...payload, id: item.id });
    else onCreate(payload);
  };

  return (
    <DialogContent className="max-w-md gap-0 p-0">
      <div className="border-b border-border/60 bg-muted/30 px-6 py-4"><DialogTitle className="font-display text-lg font-semibold">{item ? "Editar item" : "Novo item"}</DialogTitle></div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade</Label>
            <Input required type="number" step="0.001" min="0" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Stock mínimo</Label>
            <Input type="number" step="0.001" min="0" value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Local</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Validade (opcional)</Label>
          <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
        <div className="border-t border-border/60 -mx-6 px-6 pt-4 flex justify-end"><Button type="submit" className="h-10 px-6 font-semibold">{item ? "Guardar" : "Adicionar"}</Button></div>
      </form>
    </DialogContent>
  );
}
