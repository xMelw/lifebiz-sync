import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import { Plus, Search, Archive, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "../casa/index";

export const Route = createFileRoute("/_authenticated/negocio/stock")({ component: NegocioStockPage });

const CATEGORIES = ["Produto","Serviço","Material","Embalagem","Outro"];
const UNITS = ["unidade","kg","g","L","ml","pacote","caixa","hora"];

function NegocioStockPage() {
  const { membership, canAccessNegocio, canWrite, isManager } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterLow, setFilterLow] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["neg-stock", wsId, showArchived],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const q = supabase.from("products").select("*").eq("workspace_id", wsId!);
      if (!showArchived) q.eq("status", "active");
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["neg-stock", wsId] });

  const upsertProduct = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { error } = await supabase.from("products").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...p, workspace_id: wsId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate(); toast.success("Produto guardado");
      setOpen(false); setEditProduct(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Produto arquivado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Produto restaurado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const allProducts = products ?? [];
  const filtered = allProducts.filter((p) => {
    if (filterLow && (p.stock_available ?? 0) > (p.min_stock ?? 0)) return false;
    if (filterCat !== "all" && p.category !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const lowCount = allProducts.filter((p) => p.status === "active" && (p.stock_available ?? 0) <= (p.min_stock ?? 0)).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock"
        subtitle={`${allProducts.filter((p) => p.status === "active").length} produtos${lowCount > 0 ? ` · ${lowCount} com stock baixo` : ""}`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditProduct(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Novo produto</Button>
              </DialogTrigger>
              <ProductFormDialog product={editProduct} onSubmit={(p) => upsertProduct.mutate(p)} />
            </Dialog>
          )
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Pesquisar produto..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={filterLow ? "secondary" : "outline"} size="sm"
          onClick={() => setFilterLow(!filterLow)}>
          <AlertTriangle className="size-4" /> Stock baixo
        </Button>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm"
          onClick={() => setShowArchived(!showArchived)}>
          <Archive className="size-4" /> Arquivados
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60"><Package className="size-8 text-muted-foreground/60" strokeWidth={1.5} /></div><p className="font-display text-lg font-semibold">Sem produtos</p><p className="mt-1 text-sm text-muted-foreground">Adiciona o primeiro produto ao stock.</p></div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((p) => {
            const isLow = (p.stock_available ?? 0) <= (p.min_stock ?? 0) && p.status === "active";
            const margin = p.cost && p.price
              ? (((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100).toFixed(1)
              : null;
            return (
              <Card key={p.id} className={`p-3 card-hover ${p.status === "archived" ? "opacity-60" : ""} ${isLow ? "border-destructive/40" : "border-border/60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.name}</span>
                      {p.status === "archived" && <span className="status-pill-neutral">Arquivado</span>}
                      {isLow && <span className="status-pill-destructive"><AlertTriangle className="size-2.5" />Baixo</span>}
                      {p.category && <span className="status-pill-info">{p.category}</span>}
                    </div>
                    {p.sku && <div className="text-xs text-muted-foreground font-mono">SKU: {p.sku}</div>}
                    {p.description && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</div>}

                    {/* Stock info */}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded bg-muted/50 px-2 py-1 text-center">
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-mono font-semibold">{p.stock_total}</div>
                      </div>
                      <div className="rounded bg-orange-50 dark:bg-orange-900/20 px-2 py-1 text-center">
                        <div className="text-muted-foreground">Reservado</div>
                        <div className="font-mono font-semibold text-orange-600">{p.stock_reserved}</div>
                      </div>
                      <div className={`rounded px-2 py-1 text-center ${isLow ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                        <div className="text-muted-foreground">Disponível</div>
                        <div className={`font-mono font-semibold ${isLow ? "text-red-600" : "text-green-600"}`}>{p.stock_available}</div>
                      </div>
                    </div>

                    <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                      {p.price && <span>Venda: <span className="font-mono">€{Number(p.price).toFixed(2)}</span></span>}
                      {p.cost && <span>Custo: <span className="font-mono">€{Number(p.cost).toFixed(2)}</span></span>}
                      {margin && <span>Margem: <span className="font-mono">{margin}%</span></span>}
                      <span>Mín: <span className="font-mono">{p.min_stock}</span></span>
                    </div>
                  </div>

                  {canWrite && (
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="size-7"
                        onClick={() => { setEditProduct(p); setOpen(true); }}><Pencil className="size-3.5" /></Button>
                      {p.status === "active" ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-7">
                              <Archive className="size-4 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Arquivar produto?</AlertDialogTitle>
                              <AlertDialogDescription>O produto ficará oculto mas o histórico mantém-se.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => archiveProduct.mutate(p.id)}>Arquivar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button size="icon" variant="ghost" className="size-7"
                          onClick={() => restoreProduct.mutate(p.id)}>↩</Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductFormDialog({ product, onSubmit }: { product: any; onSubmit: (p: any) => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unidade");
  const [description, setDescription] = useState(product?.description ?? "");
  const [stockTotal, setStockTotal] = useState(String(product?.stock_total ?? "0"));
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? "0"));
  const [costPrice, setCostPrice] = useState(String(product?.cost ?? ""));
  const [price, setPrice] = useState(String(product?.price ?? ""));

  const margin = costPrice && price && Number(price) > 0
    ? (((Number(price) - Number(costPrice)) / Number(price)) * 100).toFixed(1)
    : null;

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto gap-0 p-0">
      <div className="border-b border-border/60 bg-muted/30 px-6 py-4"><DialogTitle className="font-display text-lg font-semibold">{product ? "Editar produto" : "Novo produto"}</DialogTitle></div>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: product?.id, name, sku: sku || null, category: category || null,
          unit, description: description || null,
          stock_total: Number(stockTotal), min_stock: Number(minStock),
          cost: costPrice ? Number(costPrice) : null,
          price: price ? Number(price) : null,
        });
      }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Nome *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>SKU / Código</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
            <Label>Stock total</Label>
            <Input type="number" step="0.001" value={stockTotal} onChange={(e) => setStockTotal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Stock mínimo</Label>
            <Input type="number" step="0.001" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Custo unitário (€)</Label>
            <Input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço de venda (€)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {margin && (
            <div className="col-span-2 rounded bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-center">
              Margem estimada: <span className="font-bold text-green-700 dark:text-green-400">{margin}%</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="border-t border-border/60 -mx-6 px-6 pt-4 flex justify-end"><Button type="submit" className="h-10 px-6 font-semibold">{product ? "Guardar" : "Criar produto"}</Button></div>
      </form>
    </DialogContent>
  );
}
