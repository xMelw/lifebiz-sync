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
import { PageHeader, EmptyAccess } from "../casa/index";

const UNITS = ["unidade", "kg", "g", "L", "ml", "pacote", "caixa"] as const;

export const Route = createFileRoute("/_authenticated/negocio/stock")({
  component: NegocioStock,
});

function NegocioStock() {
  const { membership, canAccessNegocio, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["neg-stock", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (p: {
      name: string;
      sku: string;
      category: string;
      unit: string;
      stock_total: number;
      min_stock: number;
      cost: number;
      price: number;
    }) => {
      const { error } = await supabase.from("products").insert({
        workspace_id: wsId!,
        created_by: userId!,
        ...p,
        unit: p.unit as (typeof UNITS)[number],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neg-stock", wsId] });
      toast.success("Produto criado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const filtered = (data ?? []).filter((d) =>
    d.name.toLowerCase().includes(q.toLowerCase()) ||
    (d.sku ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock — Negócio"
        subtitle="Produtos: total, reservado e disponível"
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Novo produto
                </Button>
              </DialogTrigger>
              <ProductDialog onSubmit={(p) => create.mutate(p)} />
            </Dialog>
          )
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar nome ou SKU..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q ? "Sem resultados." : "Sem produtos. Cria o primeiro."}
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => {
            const low = Number(p.stock_available) <= Number(p.min_stock);
            const margin = Number(p.price) - Number(p.cost);
            return (
              <Card key={p.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.sku && (
                        <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                      )}
                      {low && <Badge variant="destructive">Stock baixo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.category ?? "—"} · custo €{Number(p.cost).toFixed(2)} · preço €
                      {Number(p.price).toFixed(2)} · margem €{margin.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Stat label="Total" value={`${Number(p.stock_total)} ${p.unit}`} />
                    <Stat label="Reserv." value={`${Number(p.stock_reserved)}`} />
                    <Stat
                      label="Disp."
                      value={`${Number(p.stock_available)}`}
                      tone={low ? "destructive" : "success"}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "destructive";
}) {
  const cls =
    tone === "destructive"
      ? "border-destructive/40 text-destructive"
      : tone === "success"
        ? "border-success/40 text-success"
        : "border-border text-foreground";
  return (
    <div className={`rounded-md border ${cls} px-2 py-1 text-center`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function ProductDialog({
  onSubmit,
}: {
  onSubmit: (p: {
    name: string;
    sku: string;
    category: string;
    unit: string;
    stock_total: number;
    min_stock: number;
    cost: number;
    price: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<string>("unidade");
  const [stockTotal, setStockTotal] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo produto</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            sku,
            category,
            unit,
            stock_total: Number(stockTotal),
            min_stock: Number(minStock),
            cost: Number(cost),
            price: Number(price),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Stock total</Label>
            <Input
              type="number"
              step="0.01"
              value={stockTotal}
              onChange={(e) => setStockTotal(e.target.value)}
            />
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Custo (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Preço (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
