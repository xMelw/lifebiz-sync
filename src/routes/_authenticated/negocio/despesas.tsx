import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "../casa/index";

const CATS = ["materiais", "transporte", "embalagem", "marketing", "taxas", "outros"];

export const Route = createFileRoute("/_authenticated/negocio/despesas")({
  component: NegocioDespesas,
});

function NegocioDespesas() {
  const { membership, canAccessNegocio, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["neg-despesas", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_expenses")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("status", "active")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (p: {
      date: string;
      amount: number;
      category: string;
      description: string;
    }) => {
      const { error } = await supabase.from("business_expenses").insert({
        workspace_id: wsId!,
        created_by: userId!,
        ...p,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neg-despesas", wsId] });
      toast.success("Despesa adicionada");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const total = (data ?? []).reduce((a, d) => a + Number(d.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Despesas — Negócio"
        subtitle={`Total: €${total.toFixed(2)}`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </DialogTrigger>
              <ExpDialog onSubmit={(p) => create.mutate(p)} />
            </Dialog>
          )
        }
      />

      {(data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sem despesas registadas.
        </Card>
      ) : (
        <div className="grid gap-2">
          {(data ?? []).map((d) => (
            <Card key={d.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium capitalize">{d.category}</div>
                <div className="text-xs text-muted-foreground">
                  {d.date} {d.description && `· ${d.description}`}
                </div>
              </div>
              <span className="font-mono tabular-nums">€{Number(d.amount).toFixed(2)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpDialog({
  onSubmit,
}: {
  onSubmit: (p: { date: string; amount: number; category: string; description: string }) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("materiais");
  const [description, setDescription] = useState("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova despesa</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ date, amount: Number(amount), category, description });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATS.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
