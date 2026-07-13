import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Archive, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components"
import { EmptyState } from "@/components/shared/ui-helpers";

export const Route = createFileRoute("/_authenticated/negocio/vendas")({ component: VendasPage });

type LineItem = { product_id: string | null; custom_name: string; quantity: number; unit_price: number };

function VendasPage() {
  const { membership, canAccessNegocio, canWrite, isManager, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { data: sales } = useQuery({
    queryKey: ["sales", wsId, showArchived],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const q = supabase.from("sales")
        .select("*, customers(name), sale_items(*)")
        .eq("workspace_id", wsId!);
      if (!showArchived) q.not("status", "eq", "cancelada");
      const { data, error } = await q.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["clientes-list", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-list", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, price")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales", wsId] });
    qc.invalidateQueries({ queryKey: ["neg-stock", wsId] });
  };

  const createSale = useMutation({
    mutationFn: async (p: {
      customer_id: string | null; date: string; discount: number; notes: string; items: LineItem[];
    }) => {
      const total = p.items.reduce((a, i) => a + i.quantity * i.unit_price, 0) - p.discount;
      const { data: row, error } = await supabase.from("sales").insert({
        workspace_id: wsId!, created_by: userId!,
        customer_id: p.customer_id, date: p.date,
        discount: p.discount, total: Math.max(total, 0),
        origin: "manual", status: "confirmada", notes: p.notes || null,
      }).select("id").single();
      if (error) throw error;
      if (p.items.length) {
        const { error: e2 } = await supabase.from("sale_items").insert(
          p.items.map((i) => ({
            sale_id: row.id, product_id: i.product_id,
            custom_name: i.custom_name || null, quantity: i.quantity, unit_price: i.unit_price,
          }))
        );
        if (e2) throw e2;
        // Reduzir stock dos produtos
        for (const i of p.items.filter((i) => i.product_id)) {
          await supabase.from("products").update({
            stock_total: supabase.rpc as any,
          });
          await supabase.rpc("decrement_product_stock" as any, {
            _product_id: i.product_id, _qty: i.quantity,
          }).then(() => {});
        }
      }
    },
    onSuccess: () => { invalidate(); toast.success("Venda criada"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Venda arquivada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Venda cancelada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const allSales = sales ?? [];
  const totalMonth = allSales
    .filter((s) => {
      const d = new Date(s.date); const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
        && !["cancelada"].includes(s.status);
    })
    .reduce((a, s) => a + Number(s.total), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendas"
        subtitle={`€${totalMonth.toFixed(2)} este mês`}
        action={
          isManager && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Nova venda</Button>
              </DialogTrigger>
              <SaleFormDialog
                customers={customers ?? []}
                products={products ?? []}
                onSubmit={(p) => createSale.mutate(p)}
              />
            </Dialog>
          )
        }
      />

      <Button variant={showArchived ? "secondary" : "outline"} size="sm"
        onClick={() => setShowArchived(!showArchived)}>
        <Archive className="size-4" /> {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
      </Button>

      {allSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60"><ShoppingCart className="size-8 text-muted-foreground/60" strokeWidth={1.5} /></div><p className="font-display text-lg font-semibold">Sem vendas</p><p className="mt-1 text-sm text-muted-foreground">As vendas aparecerão aqui.</p></div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {allSales.map((s) => {
            const customerName = (s.customers as any)?.name ?? "Sem cliente";
            const items = (s.sale_items as any[]) ?? [];
            const archived = s.status === "cancelada";
            const cancelled = s.status === "cancelada";

            return (
              <div key={s.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors ${archived || cancelled ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ShoppingCart className="size-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{customerName}</span>
                      <span className="status-pill-info">{s.origin}</span>
                      {archived && <span className="status-pill-neutral">Arquivada</span>}
                      {cancelled && <span className="status-pill-destructive">Cancelada</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.date).toLocaleDateString("pt-PT")} · {items.length} linha(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold">€{Number(s.total).toFixed(2)}</span>
                    {isManager && !archived && !cancelled && (
                      <div className="flex gap-1">
                        <ArchiveConfirmDialog onConfirm={() => archiveSale.mutate(s.id)}>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Archive className="size-3.5 text-muted-foreground" /></Button>
                  </ArchiveConfirmDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-7">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar venda?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação irá marcar a venda como cancelada.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Não</AlertDialogCancel>
                              <AlertDialogAction onClick={() => cancelSale.mutate(s.id)}>Cancelar venda</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

function SaleFormDialog({ customers, products, onSubmit }: {
  customers: any[]; products: any[];
  onSubmit: (p: { customer_id: string | null; date: string; discount: number; notes: string; items: LineItem[] }) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ product_id: null, custom_name: "", quantity: 1, unit_price: 0 }]);

  const subtotal = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const updateItem = (idx: number, patch: Partial<LineItem>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova venda</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          customer_id: customerId || null, date, discount: Number(discount), notes,
          items: items.filter((i) => i.quantity > 0 && (i.product_id || i.custom_name)),
        });
      }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Linhas</Label>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Select value={it.product_id ?? "__custom"}
                onValueChange={(v) => {
                  if (v === "__custom") updateItem(idx, { product_id: null });
                  else {
                    const prod = products.find((p) => p.id === v);
                    updateItem(idx, { product_id: v, custom_name: prod?.name ?? "", unit_price: Number(prod?.price ?? 0) });
                  }
                }}>
                <SelectTrigger className="col-span-5"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom">Item personalizado</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!it.product_id && (
                <Input className="col-span-3" placeholder="Descrição" value={it.custom_name}
                  onChange={(e) => updateItem(idx, { custom_name: e.target.value })} />
              )}
              <Input className={it.product_id ? "col-span-2" : "col-span-2"} type="number" step="0.001"
                placeholder="Qtd" value={it.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
              <Input className={it.product_id ? "col-span-4" : "col-span-2"} type="number" step="0.01"
                placeholder="€" value={it.unit_price}
                onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
              <Button type="button" variant="ghost" size="icon" className="col-span-1"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => setItems((p) => [...p, { product_id: null, custom_name: "", quantity: 1, unit_price: 0 }])}>
            <Plus className="size-3" /> Linha
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <Label>Desconto (€)</Label>
            <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-mono text-xl font-bold">€{total.toFixed(2)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit">Criar venda</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
