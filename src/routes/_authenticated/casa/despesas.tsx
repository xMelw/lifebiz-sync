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
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "./index";

export const Route = createFileRoute("/_authenticated/casa/despesas")({
  component: CasaDespesas,
});

function CasaDespesas() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["casa-despesas", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_expenses")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (p: { date: string; amount: number; category: string; description: string }) => {
      const { error } = await supabase.from("home_expenses").insert({
        workspace_id: wsId!,
        created_by: userId!,
        ...p,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casa-despesas", wsId] });
      toast.success("Despesa adicionada");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const total = (data ?? []).reduce((acc, d) => acc + Number(d.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Despesas — Casa"
        subtitle={`Total: €${total.toFixed(2)}`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </DialogTrigger>
              <ExpenseDialog onSubmit={(p) => create.mutate(p)} />
            </Dialog>
          )
        }
      />
      {(data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sem despesas. Adiciona a primeira.
        </Card>
      ) : (
        <div className="grid gap-2">
          {(data ?? []).map((d) => (
            <Card key={d.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{d.category}</div>
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

function ExpenseDialog({
  onSubmit,
}: {
  onSubmit: (p: { date: string; amount: number; category: string; description: string }) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
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
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="alimentação, água, luz..."
            required
          />
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
