import { useState } from "react";
import { ArchiveConfirmDialog } from "@/components/shared/ui-helpers";
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
import { Plus, Archive, Receipt, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "./index";
import { EmptyState, LoadingSkeleton } from "@/components/shared/ui-helpers";

export const Route = createFileRoute("/_authenticated/casa/despesas")({ component: CasaDespesas });

const CATEGORIES = ["Alimentação","Habitação","Transporte","Saúde","Lazer","Roupa","Tecnologia","Outro"];

function CasaDespesas() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const { data } = useQuery({
    queryKey: ["casa-despesas", wsId, showArchived],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const query = supabase.from("home_expenses").select("*").eq("workspace_id", wsId!);
      if (!showArchived) query.not("status", "eq", "arquivada");
      const { data, error } = await query.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["casa-despesas", wsId] });

  const upsertExpense = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { error } = await supabase.from("home_expenses").update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("home_expenses").insert({
          ...payload, workspace_id: wsId!, created_by: userId!,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate(); toast.success("Despesa guardada");
      setOpen(false); setEditItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_expenses").update({ status: "arquivada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Despesa arquivada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_expenses").update({ status: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Despesa restaurada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const items = data ?? [];
  const filtered = filterCat === "all" ? items : items.filter((e) => e.category === filterCat);
  const now = new Date();
  const totalMonth = items.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && (e as any).status !== "arquivada";
  }).reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Despesas Casa"
        subtitle={`€${totalMonth.toFixed(2)} este mês`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditItem(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Nova despesa</Button>
              </DialogTrigger>
              <ExpenseFormDialog expense={editItem} onSubmit={(p) => upsertExpense.mutate(p)} />
            </Dialog>
          )
        }
      />

      <div className="flex gap-2 flex-wrap">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm"
          onClick={() => setShowArchived(!showArchived)}>
          <Archive className="size-4" /> {showArchived ? "Ocultar arquivadas" : "Arquivadas"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60"><Receipt className="size-8 text-muted-foreground/60" strokeWidth={1.5} /></div><p className="font-display text-lg font-semibold">Sem despesas</p><p className="mt-1 text-sm text-muted-foreground">As despesas aparecerão aqui.</p></div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {filtered.map((e) => {
            const archived = (e as any).status === "arquivada";
            return (
              <div key={e.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors ${archived ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Receipt className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{e.description || e.category}</span>
                        <span className="status-pill-info">{e.category}</span>
                        {archived && <span className="status-pill-neutral">Arquivada</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("pt-PT")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold">€{Number(e.amount).toFixed(2)}</span>
                    {canWrite && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="size-7"
                          onClick={() => { setEditItem(e); setOpen(true); }}><Pencil className="size-3.5" /></Button>
                        {!archived ? (
                          <ArchiveConfirmDialog onConfirm={() => archiveExpense.mutate(e.id)}>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Archive className="size-3.5 text-muted-foreground" /></Button>
                  </ArchiveConfirmDialog>
                        ) : (
                          <Button size="icon" variant="ghost" className="size-7"
                            onClick={() => restoreExpense.mutate(e.id)}>↩</Button>
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

function ExpenseFormDialog({ expense, onSubmit }: { expense: any; onSubmit: (p: any) => void }) {
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [category, setCategory] = useState(expense?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(expense?.description ?? "");

  return (
    <DialogContent className="max-w-sm gap-0 p-0">
      <div className="border-b border-border/60 bg-muted/30 px-6 py-4"><DialogTitle className="font-display text-lg font-semibold">{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle></div>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id: expense?.id, date, amount: Number(amount), category, description: description || null });
      }}>
        <div className="space-y-1.5">
          <Label>Data *</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Valor (€) *</Label>
          <Input required type="number" step="0.01" min="0" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label>Categoria *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional..." />
        </div>
        <div className="border-t border-border/60 -mx-6 px-6 pt-4 flex justify-end"><Button type="submit" className="h-10 px-6 font-semibold">{expense ? "Guardar" : "Criar despesa"}</Button></div>
      </form>
    </DialogContent>
  );
}
