import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";
import { EmptyState, DialogHeader2 } from "@/components/shared/ui-helpers";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart, Plus, Check, Trash2, RefreshCw, Download, Package,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/casa/lista-compras")({ component: ListaComprasPage });

function ListaComprasPage() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("unidade");
  const [newListName, setNewListName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: lists } = useQuery({
    queryKey: ["shopping-lists", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("*, shopping_list_items(*)")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stockItems } = useQuery({
    queryKey: ["casa-stock", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("home_stock_items")
        .select("id, name, quantity, unit, min_stock, category")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["shopping-lists", wsId] });

  const createList = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("shopping_lists")
        .insert({ workspace_id: wsId!, created_by: userId!, name }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => { invalidate(); setSelectedList(id); setCreateOpen(false); setNewListName(""); toast.success("Lista criada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setSelectedList(null); toast.success("Lista eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async (p: { listId: string; name: string; qty: number; unit: string }) => {
      const { error } = await supabase.from("shopping_list_items").insert({
        list_id: p.listId, name: p.name, quantity: p.qty, unit: p.unit,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setNewItem(""); setNewQty("1"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleItem = useMutation({
    mutationFn: async (p: { id: string; checked: boolean }) => {
      const { error } = await supabase.from("shopping_list_items").update({ checked: p.checked }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  // Add missing stock (items below min) to list
  const addLowStockToList = async (listId: string) => {
    const low = (stockItems ?? []).filter(s => Number(s.quantity) <= Number(s.min_stock ?? 0));
    if (!low.length) { toast.info("Sem produtos com stock baixo"); return; }
    const { error } = await supabase.from("shopping_list_items").insert(
      low.map(s => ({ list_id: listId, name: s.name, quantity: Math.max((s.min_stock ?? 1) - Number(s.quantity), 1), unit: s.unit ?? "unidade", stock_item_id: s.id }))
    );
    if (error) { toast.error(error.message); return; }
    invalidate();
    toast.success(`${low.length} produto${low.length !== 1 ? "s" : ""} adicionado${low.length !== 1 ? "s" : ""} à lista`);
  };

  // Move checked items to stock
  const addCheckedToStock = async (listId: string) => {
    const activeList = (lists ?? []).find(l => l.id === listId);
    const checked = ((activeList?.shopping_list_items ?? []) as any[]).filter((i: any) => i.checked);
    if (!checked.length) { toast.info("Marca itens como comprados primeiro"); return; }

    const inserts = checked.map((i: any) => ({
      workspace_id: wsId!, created_by: userId!,
      name: i.name, quantity: i.quantity ?? 1, unit: i.unit ?? "unidade",
      category: "Alimentação", location: "despensa", min_stock: 1, status: "active",
    }));
    const { error } = await supabase.from("home_stock_items").insert(inserts as any);
    if (error) { toast.error(error.message); return; }

    // Remove from list
    const { error: e2 } = await supabase.from("shopping_list_items")
      .delete().in("id", checked.map((i: any) => i.id));
    if (e2) { toast.error(e2.message); return; }

    qc.invalidateQueries({ queryKey: ["shopping-lists", wsId] });
    qc.invalidateQueries({ queryKey: ["casa-stock", wsId] });
    toast.success(`${checked.length} produto${checked.length !== 1 ? "s" : ""} adicionado${checked.length !== 1 ? "s" : ""} ao stock`);
  };

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const allLists = lists ?? [];
  const activeList = selectedList ? allLists.find(l => l.id === selectedList) : allLists[0] ?? null;
  const items = ((activeList?.shopping_list_items ?? []) as any[]).sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const checkedCount = items.filter(i => i.checked).length;
  const total = items.length;

  return (
    <div className="space-y-0">
      <PageHeader
        title="Lista de Compras"
        subtitle={activeList ? `${checkedCount}/${total} itens` : "Nenhuma lista"}
        action={canWrite && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Nova lista</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm gap-0 p-0">
              <DialogHeader2 title="Nova lista de compras" />
              <form className="px-6 py-5 space-y-4" onSubmit={e => { e.preventDefault(); createList.mutate(newListName || "Lista de compras"); }}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da lista</label>
                  <Input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Ex: Semana 15-22 Jul" className="h-9" autoFocus />
                </div>
                <div className="border-t border-border/60 -mx-6 px-6 pt-4 flex justify-end">
                  <Button type="submit" className="h-10 px-6 font-semibold">Criar lista</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      />

      {/* Tabs de listas */}
      {allLists.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {allLists.map(l => {
            const lItems = (l.shopping_list_items ?? []) as any[];
            const lChecked = lItems.filter(i => i.checked).length;
            const isActive = (activeList?.id ?? allLists[0]?.id) === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setSelectedList(l.id)}
                className={`shrink-0 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                  isActive ? "bg-primary text-primary-foreground ring-primary" : "bg-muted/60 text-muted-foreground ring-border hover:bg-muted"
                }`}
              >
                <ShoppingCart className="size-3.5" />
                {l.name}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-primary-foreground/20" : "bg-foreground/10"}`}>
                  {lChecked}/{lItems.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!activeList ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sem listas de compras"
          description="Cria a tua primeira lista ou gera uma automaticamente a partir do stock."
          action={canWrite && <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Criar lista</Button>}
        />
      ) : (
        <div className="space-y-3">
          {/* Acções da lista */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => addLowStockToList(activeList.id)}>
              <Package className="size-4" /> Adicionar stock baixo
            </Button>
            {checkedCount > 0 && (
              <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => addCheckedToStock(activeList.id)}>
                <Download className="size-4" /> Mover comprados para stock ({checkedCount})
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto text-destructive border-destructive/30 hover:bg-destructive/5">
                  <Trash2 className="size-4" /> Eliminar lista
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar lista?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteList.mutate(activeList.id)}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Progresso */}
          {total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{checkedCount} de {total} comprados</span>
                <span>{Math.round((checkedCount / total) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(checkedCount / total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Adicionar item inline */}
          {canWrite && (
            <form className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
              onSubmit={e => { e.preventDefault(); if (!newItem.trim()) return; addItem.mutate({ listId: activeList.id, name: newItem.trim(), qty: Number(newQty) || 1, unit: newUnit }); }}>
              <input
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
                placeholder="Adicionar produto…"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
              />
              <input className="w-12 bg-transparent text-sm outline-none text-center tabular-nums" type="number" step="0.001" min="0.001" value={newQty} onChange={e => setNewQty(e.target.value)} />
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger className="h-7 w-20 text-xs border-0 bg-transparent p-0 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["unidade","kg","g","L","ml","pacote","caixa"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={!newItem.trim()}>
                <Plus className="size-4 text-primary" />
              </Button>
            </form>
          )}

          {/* Lista de items */}
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Lista vazia. Adiciona produtos ou usa "Adicionar stock baixo".
            </div>
          ) : (
            <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              {items.map((item: any) => (
                <div key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20 ${item.checked ? "opacity-60" : ""}`}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem.mutate({ id: item.id, checked: !item.checked })}
                    className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${item.checked ? "border-green-500 bg-green-500 text-white" : "border-border hover:border-primary"}`}
                  >
                    {item.checked && <Check className="size-3" strokeWidth={3} />}
                  </button>
                  {/* Nome + quantidade */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${item.checked ? "line-through text-muted-foreground" : "font-medium"}`}>
                      {item.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {item.quantity ?? 1} {item.unit ?? ""}
                  </span>
                  {canWrite && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                      onClick={() => removeItem.mutate(item.id)}>
                      <Trash2 className="size-3.5 text-muted-foreground/60" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
