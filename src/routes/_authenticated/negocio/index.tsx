import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package, Receipt, ShoppingCart, TrendingUp, AlertTriangle,
  Calendar, CheckSquare, Clock, Link2, ArrowRight, ClipboardList,
} from "lucide-react";
import { PageHeader, StatCard, EmptyAccess } from "@/components/shared/page-components";

export const Route = createFileRoute("/_authenticated/negocio/")({ component: NegocioDashboard });


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function NegocioDashboard() {
  const { membership, canAccessNegocio, isManager, displayName } = useWorkspace();
  const wsId = membership?.workspace_id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: products } = useQuery({
    queryKey: ["neg-products", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id, name, stock_total, stock_reserved, stock_available, min_stock")
        .eq("workspace_id", wsId!).eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["neg-sales", wsId, monthStart],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("total, date, status, customers(name)")
        .eq("workspace_id", wsId!).gte("date", monthStart)
        .not("status", "eq", "cancelada")
        .order("date", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const { data: expensesData } = useQuery({
    queryKey: ["neg-expenses", wsId, monthStart],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("business_expenses")
        .select("amount").eq("workspace_id", wsId!).gte("date", monthStart);
      return data ?? [];
    },
  });

  const { data: ordersData } = useQuery({
    queryKey: ["neg-orders-dash", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, status, total, priority, order_number, customers(name), public_token_expires_at")
        .eq("workspace_id", wsId!)
        .not("status", "in", '("cancelada","convertida_venda","arquivada","entregue")')
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ["neg-approvals-dash", wsId],
    enabled: !!wsId && canAccessNegocio && isManager,
    queryFn: async () => {
      const { count } = await supabase.from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wsId!).eq("status", "pendente");
      return count ?? 0;
    },
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ["neg-events-dash", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const today = now.toISOString().slice(0, 10);
      const { data } = await supabase.from("calendar_events")
        .select("id, title, type, event_date, event_time, status")
        .eq("workspace_id", wsId!)
        .gte("event_date", today)
        .not("status", "eq", "cancelado")
        .order("event_date").order("event_time").limit(3);
      return data ?? [];
    },
  });

  const { data: expiringLinks } = useQuery({
    queryKey: ["neg-expiring-links", wsId],
    enabled: !!wsId && canAccessNegocio && isManager,
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, order_number, customers(name), public_token_expires_at")
        .eq("workspace_id", wsId!)
        .not("public_token", "is", null)
        .lte("public_token_expires_at", in24h)
        .gt("public_token_expires_at", now.toISOString());
      return data ?? [];
    },
  });

  const { data: clientActions } = useQuery({
    queryKey: ["neg-client-actions-dash", wsId],
    enabled: !!wsId && canAccessNegocio && isManager,
    queryFn: async () => {
      const { data } = await supabase.from("order_client_actions")
        .select("*, orders(order_number, workspace_id)")
        .order("created_at", { ascending: false }).limit(5);
      return (data ?? []).filter((a: any) => a.orders?.workspace_id === wsId);
    },
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const salesTotal = (salesData ?? []).reduce((a, s) => a + Number(s.total), 0);
  const expTotal = (expensesData ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const lowStockItems = (products ?? []).filter((p) => (p.stock_available ?? 0) <= (p.min_stock ?? 0));
  const allOrders = ordersData ?? [];
  const urgentOrders = allOrders.filter((o) => (o as any).priority === "urgente");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{getGreeting()}{displayName ? `, ${displayName.split(" ")[0]}` : ""}  · {new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">Negócio</h1>
      </div>

      {/* Alertas prioritários */}
      {(urgentOrders.length > 0 || (expiringLinks ?? []).length > 0) && (
        <div className="space-y-2">
          {urgentOrders.length > 0 && (
            <Link to="/negocio/encomendas">
              <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 hover:bg-destructive/10 transition-colors">
                <AlertTriangle className="size-4 text-destructive shrink-0" />
                <span className="flex-1 text-sm font-medium text-destructive">
                  {urgentOrders.length} encomenda(s) urgente(s) em aberto
                </span>
                <ArrowRight className="size-4 text-destructive/60 shrink-0" />
              </div>
            </Link>
          )}
          {(expiringLinks ?? []).length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-yellow-400/40 bg-yellow-50/60 dark:bg-yellow-900/10 px-4 py-3">
              <Link2 className="size-4 text-yellow-600 shrink-0" />
              <span className="flex-1 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                {expiringLinks!.length} link(s) público(s) a expirar em menos de 24h
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={TrendingUp} label="Vendas (mês)" value={`€${salesTotal.toFixed(2)}`} tone="success" />
        <StatCard icon={Receipt} label="Despesas (mês)" value={`€${expTotal.toFixed(2)}`} tone="destructive" />
        <StatCard icon={ShoppingCart} label="Encomendas abertas" value={allOrders.length}  />
        <StatCard icon={Package} label="Stock baixo" value={lowStockItems.length} tone={lowStockItems.length > 0 ? "warning" : undefined} />
      </div>

      {/* Stats secundárias */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Lucro estimado (mês)</div>
          <div className={`text-lg font-bold ${salesTotal - expTotal >= 0 ? "text-green-600" : "text-red-500"}`}>
            €{(salesTotal - expTotal).toFixed(2)}
          </div>
        </Card>
        {isManager && (
          <Link to="/negocio/aprovacoes">
            <Card className={`p-3 cursor-pointer hover:bg-accent/30 ${(pendingApprovals ?? 0) > 0 ? "border-yellow-400" : ""}`}>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <CheckSquare className="size-3" /> Aprovações pendentes
              </div>
              <div className={`text-lg font-bold ${(pendingApprovals ?? 0) > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                {pendingApprovals ?? 0}
              </div>
            </Card>
          </Link>
        )}
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Urgentes em aberto</div>
          <div className={`text-lg font-bold ${urgentOrders.length > 0 ? "text-destructive" : "text-green-600"}`}>
            {urgentOrders.length}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Encomendas recentes */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Encomendas em aberto</h3>
            <Link to="/negocio/encomendas">
              <Button variant="ghost" size="sm" className="h-6 text-xs">Ver tudo</Button>
            </Link>
          </div>
          {allOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem encomendas em aberto.</p>
          ) : (
            <div className="space-y-2">
              {allOrders.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {(o as any).priority === "urgente" && (
                      <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                    )}
                    <span className="truncate">{(o.customers as any)?.name ?? "Sem cliente"}</span>
                    {(o as any).order_number && (
                      <span className="font-mono text-xs text-muted-foreground">{(o as any).order_number}</span>
                    )}
                  </div>
                  <span className="font-mono shrink-0 ml-2">€{Number(o.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Próximos eventos */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="size-4" /> Próximos eventos
            </h3>
            <Link to="/negocio/agenda">
              <Button variant="ghost" size="sm" className="h-6 text-xs">Ver agenda</Button>
            </Link>
          </div>
          {(upcomingEvents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos próximos.</p>
          ) : (
            <div className="space-y-2">
              {(upcomingEvents ?? []).map((ev) => (
                <div key={ev.id} className="flex items-start gap-2 text-sm">
                  <Clock className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ev.event_date).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })}
                      {ev.event_time && ` · ${ev.event_time.slice(0, 5)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Stock baixo */}
        {lowStockItems.length > 0 && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-orange-600">
                <Package className="size-4" /> Stock baixo
              </h3>
              <Link to="/negocio/stock">
                <Button variant="ghost" size="sm" className="h-6 text-xs">Ver stock</Button>
              </Link>
            </div>
            <div className="space-y-1.5">
              {lowStockItems.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.name}</span>
                  <div className="flex gap-2 shrink-0 ml-2 text-xs">
                    <span className="text-muted-foreground">disp: <span className="text-orange-500 font-mono">{p.stock_available}</span></span>
                    <span className="text-muted-foreground">mín: <span className="font-mono">{p.min_stock}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Ações do cliente recentes */}
        {isManager && (clientActions ?? []).length > 0 && (
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Ações recentes do cliente</h3>
            <div className="space-y-2">
              {(clientActions ?? []).slice(0, 4).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <Badge variant={a.action === "confirmou" ? "default" : a.action === "cancelou" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                    {a.action}
                  </Badge>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">{a.orders?.order_number ?? "—"}</span>
                    {a.comment && <p className="text-xs text-muted-foreground truncate">{a.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Últimas vendas */}
        {(salesData ?? []).length > 0 && (
          <Card className="p-4 md:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Últimas vendas (mês)</h3>
              <Link to="/negocio/vendas">
                <Button variant="ghost" size="sm" className="h-6 text-xs">Ver todas</Button>
              </Link>
            </div>
            <div className="space-y-1.5">
              {(salesData ?? []).map((s) => (
                <div key={(s as any).id} className="flex justify-between items-center text-sm border-b border-border pb-1.5">
                  <span className="truncate">{(s.customers as any)?.name ?? "Sem cliente"}</span>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.date).toLocaleDateString("pt-PT")}
                    </span>
                    <span className="font-mono font-medium">€{Number(s.total).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Ações rápidas */}
        <Card className="overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold">Ações rápidas</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
            <Link to="/negocio/encomendas"><Button variant="outline" className="w-full justify-start gap-2 h-10"><ClipboardList className="size-4" /> Nova encomenda</Button></Link>
            <Link to="/negocio/vendas"><Button variant="outline" className="w-full justify-start gap-2 h-10"><ShoppingCart className="size-4" /> Nova venda</Button></Link>
            <Link to="/negocio/despesas"><Button variant="outline" className="w-full justify-start gap-2 h-10"><Receipt className="size-4" /> Nova despesa</Button></Link>
            <Link to="/negocio/agenda"><Button variant="outline" className="w-full justify-start gap-2 h-10"><Calendar className="size-4" /> Novo evento</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
