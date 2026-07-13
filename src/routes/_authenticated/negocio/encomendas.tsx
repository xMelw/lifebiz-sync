import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, CheckCircle2, XCircle, Link2, Copy, RefreshCw,
  AlertTriangle, Search, Filter, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";

export const Route = createFileRoute("/_authenticated/negocio/encomendas")({
  component: EncomendasPage,
});

type OrderStatus =
  | "rascunho" | "pendente_aprovacao" | "alteracoes_pedidas" | "aprovada_envio"
  | "enviada_cliente" | "vista_pelo_cliente" | "em_negociacao" | "confirmada"
  | "cancelada" | "convertida_venda" | "arquivada"
  | "pendente" | "em_preparacao" | "pronta" | "entregue"; // backward compat

type LineItem = { product_id: string | null; custom_name: string; quantity: number; unit_price: number };

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  pendente_aprovacao: "Pendente aprovação",
  alteracoes_pedidas: "Alterações pedidas",
  aprovada_envio: "Aprovada",
  enviada_cliente: "Enviada ao cliente",
  vista_pelo_cliente: "Vista pelo cliente",
  em_negociacao: "Em negociação",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  convertida_venda: "Convertida em venda",
  arquivada: "Arquivada",
  pendente: "Pendente",
  em_preparacao: "Em preparação",
  pronta: "Pronta",
  entregue: "Entregue",
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  pendente_aprovacao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  alteracoes_pedidas: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  aprovada_envio: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  enviada_cliente: "bg-blue-200 text-blue-900 dark:bg-blue-800/30 dark:text-blue-300",
  vista_pelo_cliente: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  em_negociacao: "bg-yellow-200 text-yellow-900 dark:bg-yellow-800/30 dark:text-yellow-300",
  confirmada: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  convertida_venda: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  arquivada: "bg-muted/50 text-muted-foreground",
};

const MANAGE_STATUSES: OrderStatus[] = [
  "rascunho", "pendente_aprovacao", "alteracoes_pedidas", "aprovada_envio",
  "enviada_cliente", "vista_pelo_cliente", "em_negociacao", "confirmada", "cancelada",
];

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function EncomendasPage() {
  const { membership, canAccessNegocio, canWrite, isManager, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [publicLinkData, setPublicLinkData] = useState<{
    token: string; pin: string; expires_at: string
  } | null>(null);

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

  const { data: clientActions } = useQuery({
    queryKey: ["order-client-actions", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_client_actions")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["clientes-list", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-list", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, price, stock_available, stock_total")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members-list", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data: mems } = await supabase.from("workspace_members")
        .select("user_id, role").eq("workspace_id", wsId!).eq("status", "active");
      const ids = (mems ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, email").in("id", ids);
      return (profs ?? []).map((p) => ({ id: p.id, name: p.display_name ?? p.email ?? p.id }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["orders", wsId] });
    qc.invalidateQueries({ queryKey: ["products-list", wsId] });
    qc.invalidateQueries({ queryKey: ["neg-stock", wsId] });
    qc.invalidateQueries({ queryKey: ["sales", wsId] });
    qc.invalidateQueries({ queryKey: ["order-client-actions", wsId] });
  };

  const createOrder = useMutation({
    mutationFn: async (p: {
      customer_id: string | null; priority: string; responsible_id: string | null;
      event_date: string | null; duration_minutes: number | null; location: string;
      signal_amount: number; discount: number; internal_notes: string; client_notes: string;
      items: LineItem[]; status: OrderStatus;
    }) => {
      const { data: row, error } = await supabase.from("orders").insert({
        workspace_id: wsId!, created_by: userId!,
        customer_id: p.customer_id, priority: p.priority,
        responsible_id: p.responsible_id,
        event_date: p.event_date, duration_minutes: p.duration_minutes || null,
        location: p.location || null, signal_amount: p.signal_amount,
        discount: p.discount, internal_notes: p.internal_notes || null,
        client_notes: p.client_notes || null, status: p.status,
      }).select("id").single();
      if (error) throw error;
      if (p.items.length) {
        const { error: e2 } = await supabase.from("order_items").insert(
          p.items.map((i) => ({
            order_id: row.id, product_id: i.product_id,
            custom_name: i.custom_name || null, quantity: i.quantity, unit_price: i.unit_price,
          })),
        );
        if (e2) throw e2;
      }
    },
    onSuccess: () => { invalidate(); toast.success("Encomenda criada"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Estado atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("convert_order_to_sale", { _order_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Convertida em venda"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateLink = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("generate_order_public_link", { _order_id: id });
      if (error) throw error;
      return data as { token: string; pin: string; expires_at: string };
    },
    onSuccess: (data) => {
      setPublicLinkData(data);
      invalidate();
      toast.success("Link público gerado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const allOrders = orders ?? [];

  // Filtros + ordenação
  let filtered = allOrders.filter((o) => {
    if (!showArchived && o.status === "arquivada") return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterPriority !== "all" && (o as any).priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = ((o.customers as any)?.name ?? "").toLowerCase();
      const num = ((o as any).order_number ?? "").toLowerCase();
      return name.includes(q) || num.includes(q);
    }
    return true;
  });

  // Urgentes primeiro
  filtered = filtered.sort((a, b) => {
    const aU = (a as any).priority === "urgente" ? 0 : 1;
    const bU = (b as any).priority === "urgente" ? 0 : 1;
    if (aU !== bU) return aU - bU;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const openCount = allOrders.filter(
    (o) => !["cancelada", "convertida_venda", "arquivada", "entregue"].includes(o.status),
  ).length;
  const urgentCount = allOrders.filter((o) => (o as any).priority === "urgente" &&
    !["cancelada", "convertida_venda", "arquivada"].includes(o.status)).length;

  const selectedOrderData = selectedOrder ? allOrders.find((o) => o.id === selectedOrder) : null;
  const selectedActions = clientActions?.filter((a) => a.order_id === selectedOrder) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Encomendas"
        subtitle={`${openCount} em aberto${urgentCount > 0 ? ` · ${urgentCount} urgentes` : ""}`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Nova encomenda</Button>
              </DialogTrigger>
              <OrderFormDialog
                customers={customers ?? []}
                products={products ?? []}
                members={members ?? []}
                onSubmit={(p) => createOrder.mutate(p)}
                isManager={isManager}
              />
            </Dialog>
          )
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {MANAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
            <SelectItem value="convertida_venda">{STATUS_LABELS.convertida_venda}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {allOrders.length === 0 ? "Sem encomendas. Cria a primeira." : "Nenhuma encomenda com estes filtros."}
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((o) => {
            const items = (o.order_items as any[]) ?? [];
            const customerName = (o.customers as any)?.name ?? "Sem cliente";
            const priority = (o as any).priority ?? "normal";
            const orderNum = (o as any).order_number;
            const eventDate = (o as any).event_date;
            const location = (o as any).location;
            const isFinal = ["cancelada", "convertida_venda", "arquivada", "entregue"].includes(o.status);

            return (
              <Card
                key={o.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-accent/30 ${priority === "urgente" ? "border-destructive/50" : ""}`}
                onClick={() => setSelectedOrder(o.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {priority === "urgente" && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          <AlertTriangle className="size-2.5 mr-0.5" /> URGENTE
                        </Badge>
                      )}
                      {orderNum && (
                        <span className="text-xs font-mono text-muted-foreground">{orderNum}</span>
                      )}
                      <span className="font-medium">{customerName}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{items.length} linha(s)</span>
                      {eventDate && <span>· {new Date(eventDate).toLocaleDateString("pt-PT")}</span>}
                      {location && <span>· {location}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-mono tabular-nums">€{Number(o.total).toFixed(2)}</span>
                    {canWrite && !isFinal && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {isManager && (
                          <>
                            <Button
                              size="sm" variant="default" className="h-7"
                              onClick={() => convert.mutate(o.id)}
                            >
                              <CheckCircle2 className="size-3.5" /> Converter
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <XCircle className="size-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar encomenda?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação irá cancelar a encomenda e libertar o stock reservado.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Não</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => setStatus.mutate({ id: o.id, status: "cancelada" })}>
                                    Cancelar encomenda
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sheet de detalhe */}
      <Sheet open={!!selectedOrder} onOpenChange={(v) => { if (!v) { setSelectedOrder(null); setPublicLinkData(null); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedOrderData && (
            <OrderDetail
              order={selectedOrderData as any}
              actions={selectedActions}
              customers={customers ?? []}
              products={products ?? []}
              members={members ?? []}
              isManager={isManager}
              publicLinkData={publicLinkData}
              onStatusChange={(s) => setStatus.mutate({ id: selectedOrderData.id, status: s })}
              onConvert={() => convert.mutate(selectedOrderData.id)}
              onGenerateLink={() => { generateLink.mutate(selectedOrderData.id); }}
              canWrite={canWrite}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrderDetail({
  order, actions, isManager, publicLinkData, canWrite,
  onStatusChange, onConvert, onGenerateLink, members,
}: {
  order: any; actions: any[]; isManager: boolean; publicLinkData: any; canWrite: boolean;
  onStatusChange: (s: OrderStatus) => void; onConvert: () => void; onGenerateLink: () => void;
  customers: any[]; products: any[]; members: any[];
}) {
  const publicUrl = order.public_token
    ? `${window.location.origin}/encomenda/${order.public_token}`
    : null;
  const tokenExpired = order.public_token_expires_at && new Date(order.public_token_expires_at) < new Date();
  const displayPin = publicLinkData?.pin;
  const isFinal = ["cancelada", "convertida_venda", "arquivada", "entregue"].includes(order.status);
  const customerName = order.customers?.name ?? "Sem cliente";
  const memberName = members.find((m) => m.id === order.responsible_id)?.name;

  return (
    <div className="space-y-5 pt-2">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 flex-wrap">
          {order.order_number && <span className="font-mono text-sm text-muted-foreground">{order.order_number}</span>}
          <StatusBadge status={order.status} />
          {(order.priority === "urgente") && (
            <Badge variant="destructive" className="text-[10px]">URGENTE</Badge>
          )}
        </SheetTitle>
      </SheetHeader>

      {/* Info geral */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Cliente</span><div className="font-medium">{customerName}</div></div>
        {memberName && <div><span className="text-muted-foreground">Responsável</span><div className="font-medium">{memberName}</div></div>}
        {order.event_date && <div><span className="text-muted-foreground">Data/Hora</span><div>{new Date(order.event_date).toLocaleString("pt-PT")}</div></div>}
        {order.duration_minutes && <div><span className="text-muted-foreground">Duração</span><div>{order.duration_minutes} min</div></div>}
        {order.location && <div className="col-span-2"><span className="text-muted-foreground">Localização</span><div>{order.location}</div></div>}
        {order.signal_amount > 0 && <div><span className="text-muted-foreground">Sinal</span><div>€{Number(order.signal_amount).toFixed(2)}</div></div>}
      </div>

      {/* Itens */}
      {(order.order_items ?? []).length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Linhas</h4>
          <div className="space-y-1">
            {(order.order_items as any[]).map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm border-b border-border pb-1">
                <span>{item.custom_name || `Produto #${item.product_id?.slice(0, 8)}`}</span>
                <span className="font-mono">{item.quantity}x €{Number(item.unit_price).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-sm pt-1">
              <span>Total</span>
              <span className="font-mono">€{Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notas */}
      {order.client_notes && (
        <div>
          <h4 className="mb-1 text-sm font-semibold">Notas para o cliente</h4>
          <p className="text-sm text-muted-foreground">{order.client_notes}</p>
        </div>
      )}
      {isManager && order.internal_notes && (
        <div>
          <h4 className="mb-1 text-sm font-semibold">Notas internas</h4>
          <p className="text-sm text-muted-foreground italic">{order.internal_notes}</p>
        </div>
      )}

      {/* Ações de estado (manager) */}
      {isManager && !isFinal && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Alterar estado</h4>
          <div className="flex flex-wrap gap-2">
            <Select value={order.status} onValueChange={(v) => onStatusChange(v as OrderStatus)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANAGE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onConvert}>
              <CheckCircle2 className="size-4" /> Converter em venda
            </Button>
            <Button size="sm" variant="outline" onClick={() => onStatusChange("arquivada")}>
              Arquivar
            </Button>
          </div>
        </div>
      )}

      {/* Link público / PIN */}
      {isManager && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="size-4" /> Link público
          </h4>
          {!order.public_token || tokenExpired ? (
            <Button size="sm" onClick={onGenerateLink}>
              <RefreshCw className="size-4" /> Gerar link e PIN
            </Button>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{`${window.location.origin}/encomenda/${order.public_token}`}</code>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/encomenda/${order.public_token}`);
                  toast.success("Link copiado");
                }}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              {displayPin ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">PIN:</span>
                  <code className="rounded bg-muted px-2 py-1 text-sm font-bold tracking-widest">{displayPin}</code>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => {
                    navigator.clipboard.writeText(displayPin);
                    toast.success("PIN copiado");
                  }}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">PIN foi gerado — regenera para ver novamente.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Expira em: {new Date(order.public_token_expires_at).toLocaleDateString("pt-PT")}
              </p>
              <Button size="sm" variant="outline" onClick={onGenerateLink}>
                <RefreshCw className="size-3.5" /> Regenerar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Ações do cliente */}
      {actions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Ações do cliente</h4>
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-PT")}</span>
                </div>
                {a.client_name && <div className="text-muted-foreground">Por: {a.client_name}</div>}
                {a.comment && <div className="mt-1">{a.comment}</div>}
                {a.proposed_date && <div className="text-muted-foreground">Proposta: {new Date(a.proposed_date).toLocaleString("pt-PT")}</div>}
                {a.proposed_location && <div className="text-muted-foreground">Local: {a.proposed_location}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderFormDialog({
  customers, products, members, onSubmit, isManager,
}: {
  customers: any[]; products: any[]; members: any[]; isManager: boolean;
  onSubmit: (p: any) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [responsibleId, setResponsibleId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [signalAmount, setSignalAmount] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("rascunho");
  const [items, setItems] = useState<LineItem[]>([
    { product_id: null, custom_name: "", quantity: 1, unit_price: 0 },
  ]);

  const subtotal = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const updateItem = (idx: number, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nova encomenda</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            customer_id: customerId || null, priority,
            responsible_id: responsibleId || null,
            event_date: eventDate || null,
            duration_minutes: durationMin ? Number(durationMin) : null,
            location, signal_amount: Number(signalAmount),
            discount: Number(discount),
            internal_notes: internalNotes, client_notes: clientNotes, status,
            items: items.filter((i) => i.quantity > 0 && (i.product_id || i.custom_name)),
          });
        }}
      >
        {/* Linha 1: Cliente + Prioridade */}
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
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgente">🔴 Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha 2: Responsável + Estado */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(isManager
                  ? ["rascunho", "pendente_aprovacao", "aprovada_envio", "confirmada"]
                  : ["rascunho", "pendente_aprovacao"]
                ).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha 3: Data/Hora + Duração + Localização */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Data/Hora</Label>
            <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duração (min)</Label>
            <Input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="60" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Localização</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Morada ou local..." />
        </div>

        {/* Linhas de items */}
        <div className="space-y-2">
          <Label>Linhas da encomenda</Label>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Select
                value={it.product_id ?? "__custom"}
                onValueChange={(v) => {
                  if (v === "__custom") { updateItem(idx, { product_id: null }); }
                  else {
                    const prod = products.find((p) => p.id === v);
                    updateItem(idx, { product_id: v, custom_name: prod?.name ?? "", unit_price: Number(prod?.price ?? 0) });
                  }
                }}
              >
                <SelectTrigger className="col-span-5"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom">Item personalizado</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.stock_available !== null ? ` (disp: ${p.stock_available})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!it.product_id && (
                <Input className="col-span-3" placeholder="Descrição" value={it.custom_name}
                  onChange={(e) => updateItem(idx, { custom_name: e.target.value })} />
              )}
              <Input
                className={it.product_id ? "col-span-2" : "col-span-2"}
                type="number" step="0.001" placeholder="Qtd" value={it.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
              <Input
                className={it.product_id ? "col-span-4" : "col-span-2"}
                type="number" step="0.01" placeholder="€" value={it.unit_price}
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

        {/* Desconto + Sinal + Total */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Desconto (€)</Label>
            <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sinal/Reserva (€)</Label>
            <Input type="number" step="0.01" value={signalAmount} onChange={(e) => setSignalAmount(e.target.value)} />
          </div>
          <div className="flex flex-col justify-end">
            <Label>Total</Label>
            <div className="font-mono text-lg tabular-nums">€{total.toFixed(2)}</div>
          </div>
        </div>

        {/* Notas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Notas para o cliente</Label>
            <Textarea rows={2} value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} placeholder="Visíveis ao cliente..." />
          </div>
          {isManager && (
            <div className="space-y-1.5">
              <Label>Notas internas</Label>
              <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Apenas visíveis internamente..." />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="submit">Criar encomenda</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
