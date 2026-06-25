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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "../casa/index";

export const Route = createFileRoute("/_authenticated/negocio/vendas")({
  component: VendasPage,
});

type LineItem = { product_id: string | null; custom_name: string; quantity: number; unit_price: number };

function VendasPage() {
  const { membership, canAccessNegocio, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: sales } = useQuery({
    queryKey: ["sales", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name), sale_items(*)")
        .eq("workspace_id", wsId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["clientes-list", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .eq("status", "active");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-list", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, stock_total")
        .eq("workspace_id", wsId!)
        .eq("status", "active");
      return data ?? [];
    },
  });

  const createSale = useMutation({
    mutationFn: async (p: {
      date: string;
      customer_id: string | null;
      discount: number;
      items: LineItem[];
    }) => {
      const total = p.items.reduce((a, i) => a + i.quantity * i.unit_price, 0) - p.discount;
      const { data: saleRow, error } = await supabase
        .from("sales")
        .insert({
          workspace_id: wsId!,
          created_by: userId!,
          date: p.date,
          customer_id: p.customer_id,
          discount: p.discount,
          total,
          status: "confirmada",
          origin: "manual",
        })
        .select("id")
        .single();
      if (error) throw error;

      if (p.items.length) {
        const { error: itemsErr } = await supabase.from("sale_items").insert(
          p.items.map((i) => ({
            sale_id: saleRow.id,
            product_id: i.product_id,
            custom_name: i.custom_name || null,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        );
        if (itemsErr) throw itemsErr;

        // Reduce stock for product lines
        for (const i of p.items) {
          if (i.product_id) {
            const product = products?.find((pr) => pr.id === i.product_id);
            if (product) {
              await supabase
                .from("products")
                .update({ stock_total: Number(product.stock_total) - i.quantity })
                .eq("id", i.product_id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", wsId] });
      qc.invalidateQueries({ queryKey: ["neg-stock", wsId] });
      qc.invalidateQueries({ queryKey: ["products-list", wsId] });
      toast.success("Venda registada");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const total = (sales ?? [])
    .filter((s) => s.status !== "cancelada")
    .reduce((a, s) => a + Number(s.total), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendas"
        subtitle={`Total: €${total.toFixed(2)}`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Nova venda
                </Button>
              </DialogTrigger>
              <SaleDialog
                customers={customers ?? []}
                products={products ?? []}
                onSubmit={(p) => createSale.mutate(p)}
              />
            </Dialog>
          )
        }
      />

      {(sales ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sem vendas. Regista a primeira.
        </Card>
      ) : (
        <div className="grid gap-2">
          {(sales ?? []).map((s) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {(s.customers as { name: string } | null)?.name ?? "Cliente não associado"}
                    </span>
                    <Badge
                      variant={s.status === "cancelada" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.date} · {(s.sale_items as unknown as { id: string }[])?.length ?? 0} linha(s)
                  </div>
                </div>
                <span className="font-mono tabular-nums">€{Number(s.total).toFixed(2)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SaleDialog({
  customers,
  products,
  onSubmit,
}: {
  customers: { id: string; name: string }[];
  products: { id: string; name: string; price: number }[];
  onSubmit: (p: {
    date: string;
    customer_id: string | null;
    discount: number;
    items: LineItem[];
  }) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [items, setItems] = useState<LineItem[]>([
    { product_id: null, custom_name: "", quantity: 1, unit_price: 0 },
  ]);

  const subtotal = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = subtotal - Number(discount || 0);

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Nova venda</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            date,
            customer_id: customerId || null,
            discount: Number(discount),
            items: items.filter((i) => i.quantity > 0 && (i.product_id || i.custom_name)),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Linhas</Label>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Select
                value={it.product_id ?? "__custom"}
                onValueChange={(v) => {
                  if (v === "__custom") {
                    updateItem(idx, { product_id: null });
                  } else {
                    const prod = products.find((p) => p.id === v);
                    updateItem(idx, {
                      product_id: v,
                      custom_name: prod?.name ?? "",
                      unit_price: Number(prod?.price ?? 0),
                    });
                  }
                }}
              >
                <SelectTrigger className="col-span-5">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom">Item personalizado</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!it.product_id && (
                <Input
                  className="col-span-5"
                  placeholder="Descrição"
                  value={it.custom_name}
                  onChange={(e) => updateItem(idx, { custom_name: e.target.value })}
                />
              )}
              <Input
                className={it.product_id ? "col-span-3" : "col-span-2 hidden md:block"}
                type="number"
                step="0.01"
                value={it.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
              />
              <Input
                className={it.product_id ? "col-span-3" : "col-span-5 md:col-span-2"}
                type="number"
                step="0.01"
                value={it.unit_price}
                onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((p) => [
                ...p,
                { product_id: null, custom_name: "", quantity: 1, unit_price: 0 },
              ])
            }
          >
            <Plus className="size-3" /> Adicionar linha
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Desconto (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end">
            <Label>Total</Label>
            <div className="font-mono text-lg tabular-nums">€{total.toFixed(2)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit">Registar venda</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
