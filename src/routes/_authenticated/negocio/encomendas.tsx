import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "../casa/index";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/negocio/encomendas")({
  component: EncomendasPage,
});

type OrderStatus = Database["public"]["Enums"]["order_status"];
type LineItem = { product_id: string | null; custom_name: string; quantity: number; unit_price: number };

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "confirmada", label: "Confirmada" },
  { value: "em_preparacao", label: "Em preparação" },
  { value: "pronta", label: "Pronta" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelada", label: "Cancelada" },
];

const statusVariant = (s: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "cancelada") return "destructive";
  if (s === "entregue") return "default";
  if (s === "pronta") return "secondary";
  return "outline";
};

function EncomendasPage() {
  const { membership, canAccessNegocio, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["orders", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(name), order_items(*)")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
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
        .select("id, name, price, stock_available, stock_total")
        .eq("workspace_id", wsId!)
        .eq("status", "active");
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["orders", wsId] });
    qc.invalidateQueries({ queryKey: ["products-list", wsId] });
    qc.invalidateQueries({ queryKey: ["neg-stock", wsId] });
    qc.invalidateQueries({ queryKey: ["sales", wsId] });
  };

  const createOrder = useMutation({
    mutationFn: async (p: {
      customer_id: string | null;
      channel: string;
      delivery_date: string | null;
      discount: number;
      notes: string;
      items: LineItem[];
      status: OrderStatus;
    }) => {
      const { data: row, error } = await supabase
        .from("orders")
        .insert({
          workspace_id: wsId!,
          created_by: userId!,
          customer_id: p.customer_id,
          channel: p.channel || null,
          delivery_date: p.delivery_date,
          discount: p.discount,
          notes: p.notes || null,
          status: p.status,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (p.items.length) {
        const { error: e2 } = await supabase.from("order_items").insert(
          p.items.map((i) => ({
            order_id: row.id,
            product_id: i.product_id,
            custom_name: i.custom_name || null,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        );
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Encomenda criada · stock reservado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Estado atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("convert_order_to_sale", { _order_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Encomenda convertida em venda");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const open_count = (orders ?? []).filter(
    (o) => o.status !== "cancelada" && o.status !== "entregue",
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Encomendas"
        subtitle={`${open_count} em aberto`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Nova encomenda
                </Button>
              </DialogTrigger>
              <OrderDialog
                customers={customers ?? []}
                products={products ?? []}
                onSubmit={(p) => createOrder.mutate(p)}
              />
            </Dialog>
          )
        }
      />

      {(orders ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sem encomendas. Cria a primeira.
        </Card>
      ) : (
        <div className="grid gap-2">
          {(orders ?? []).map((o) => {
            const items = (o.order_items as { id: string; quantity: number }[]) ?? [];
            const customerName = (o.customers as { name: string } | null)?.name ?? "Sem cliente";
            const isFinal = o.status === "entregue" || o.status === "cancelada";
            return (
              <Card key={o.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{customerName}</span>
                      <Badge variant={statusVariant(o.status)} className="capitalize">
                        {o.status.replace("_", " ")}
                      </Badge>
                      {o.channel && (
                        <Badge variant="outline" className="text-xs">
                          {o.channel}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {items.length} linha(s)
                      {o.delivery_date ? ` · Entrega: ${o.delivery_date}` : ""}
                    </div>
                    {o.notes && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {o.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-mono tabular-nums">€{Number(o.total).toFixed(2)}</span>
                    {canWrite && !isFinal && (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Select
                          value={o.status}
                          onValueChange={(v) =>
                            setStatus.mutate({ id: o.id, status: v as OrderStatus })
                          }
                        >
                          <SelectTrigger className="h-7 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter((s) => s.value !== "entregue").map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7"
                          onClick={() => convert.mutate(o.id)}
                          title="Converter em venda"
                        >
                          <CheckCircle2 className="size-3.5" /> Converter
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() =>
                            setStatus.mutate({ id: o.id, status: "cancelada" })
                          }
                          title="Cancelar"
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    )}
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

function OrderDialog({
  customers,
  products,
  onSubmit,
}: {
  customers: { id: string; name: string }[];
  products: { id: string; name: string; price: number; stock_available: number | null }[];
  onSubmit: (p: {
    customer_id: string | null;
    channel: string;
    delivery_date: string | null;
    discount: number;
    notes: string;
    items: LineItem[];
    status: OrderStatus;
  }) => void;
}) {
  const [customerId, setCustomerId] = useState<string>("");
  const [channel, setChannel] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("pendente");
  const [items, setItems] = useState<LineItem[]>([
    { product_id: null, custom_name: "", quantity: 1, unit_price: 0 },
  ]);

  const subtotal = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Nova encomenda</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            customer_id: customerId || null,
            channel,
            delivery_date: deliveryDate || null,
            discount: Number(discount),
            notes,
            status,
            items: items.filter((i) => i.quantity > 0 && (i.product_id || i.custom_name)),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-1.5">
            <Label>Canal</Label>
            <Input
              placeholder="WhatsApp, Instagram…"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de entrega</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Estado inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter((s) => s.value !== "entregue" && s.value !== "cancelada").map(
                  (s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ),
                )}
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
                      {p.stock_available !== null ? ` · disp ${p.stock_available}` : ""}
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

        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes da encomenda…"
          />
        </div>

        <DialogFooter>
          <Button type="submit">Criar encomenda</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
