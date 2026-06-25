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
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "./index";

const UNITS = ["unidade", "kg", "g", "L", "ml", "pacote", "caixa"] as const;
const LOCATIONS = ["despensa", "frigorifico", "congelador", "casa_de_banho", "outro"] as const;

export const Route = createFileRoute("/_authenticated/casa/stock")({
  component: CasaStock,
});

function CasaStock() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["casa-stock", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_stock_items")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createItem = useMutation({
    mutationFn: async (payload: {
      name: string;
      category: string;
      quantity: number;
      unit: string;
      min_stock: number;
      location: string;
      expiry_date: string | null;
    }) => {
      const { error } = await supabase.from("home_stock_items").insert({
        workspace_id: wsId!,
        created_by: userId!,
        ...payload,
        unit: payload.unit as (typeof UNITS)[number],
        location: payload.location as (typeof LOCATIONS)[number],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casa-stock", wsId] });
      toast.success("Item adicionado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const item = data?.find((d) => d.id === id);
      if (!item) return;
      const next = Math.max(0, Number(item.quantity) + delta);
      const { error } = await supabase
        .from("home_stock_items")
        .update({ quantity: next })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["casa-stock", wsId] }),
  });

  if (!canAccessCasa)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const filtered = (data ?? []).filter((d) =>
    d.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock — Casa"
        subtitle="Despensa, frigorífico e mais"
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </DialogTrigger>
              <StockDialog onSubmit={(p) => createItem.mutate(p)} />
            </Dialog>
          )
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar item..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q ? "Sem resultados." : "Sem itens. Adiciona o primeiro."}
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => {
            const low = Number(item.quantity) <= Number(item.min_stock);
            return (
              <Card key={item.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    {low && <Badge variant="destructive">Stock baixo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.category ?? "—"} · {item.location}
                    {item.expiry_date && ` · validade ${item.expiry_date}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjust.mutate({ id: item.id, delta: -1 })}
                    >
                      −
                    </Button>
                  )}
                  <span className="w-20 text-right font-mono text-sm tabular-nums">
                    {Number(item.quantity)} {item.unit}
                  </span>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjust.mutate({ id: item.id, delta: 1 })}
                    >
                      +
                    </Button>
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

function StockDialog({
  onSubmit,
}: {
  onSubmit: (p: {
    name: string;
    category: string;
    quantity: number;
    unit: string;
    min_stock: number;
    location: string;
    expiry_date: string | null;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<string>("unidade");
  const [minStock, setMinStock] = useState("0");
  const [location, setLocation] = useState<string>("despensa");
  const [expiry, setExpiry] = useState("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo item de stock</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            category,
            quantity: Number(quantity),
            unit,
            min_stock: Number(minStock),
            location,
            expiry_date: expiry || null,
          });
        }}
      >
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Quantidade</Label>
            <Input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stock mín.</Label>
            <Input
              type="number"
              step="0.01"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Validade (opcional)</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
