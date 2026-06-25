import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Receipt, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, EmptyAccess } from "../casa/index";

export const Route = createFileRoute("/_authenticated/negocio/")({
  component: NegocioDashboard,
});

function NegocioDashboard() {
  const { membership, canAccessNegocio } = useWorkspace();
  const wsId = membership?.workspace_id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: products } = useQuery({
    queryKey: ["neg-products", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock_total, stock_reserved, stock_available, min_stock")
        .eq("workspace_id", wsId!)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["neg-sales-month", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, date, total, status")
        .eq("workspace_id", wsId!)
        .gte("date", monthStart);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["neg-exp-month", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_expenses")
        .select("amount")
        .eq("workspace_id", wsId!)
        .gte("date", monthStart);
      if (error) throw error;
      return data;
    },
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso ao Negócio" message="Pede acesso a um admin." />;

  const salesTotal = (sales ?? [])
    .filter((s) => s.status !== "cancelada")
    .reduce((a, s) => a + Number(s.total), 0);
  const expTotal = (expenses ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const profit = salesTotal - expTotal;
  const lowStock = (products ?? []).filter(
    (p) => Number(p.stock_available) <= Number(p.min_stock),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Negócio" subtitle="Visão geral do mês" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Vendas do mês" value={`€${salesTotal.toFixed(2)}`} />
        <StatCard icon={Receipt} label="Despesas do mês" value={`€${expTotal.toFixed(2)}`} />
        <StatCard
          icon={TrendingUp}
          label="Lucro estimado"
          value={`€${profit.toFixed(2)}`}
          tone={profit >= 0 ? "success" : "destructive"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Stock baixo"
          value={lowStock.length}
          tone={lowStock.length ? "warning" : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Stock baixo</h3>
            <Link to="/negocio/stock" className="text-xs text-primary hover:underline">
              Ver produtos
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo ok.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <span>{p.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="font-mono">
                      tot {Number(p.stock_total)}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      res {Number(p.stock_reserved)}
                    </Badge>
                    <Badge variant="destructive" className="font-mono">
                      disp {Number(p.stock_available)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Últimas vendas</h3>
            <Link to="/negocio/vendas" className="text-xs text-primary hover:underline">
              Ver tudo
            </Link>
          </div>
          {(sales ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas este mês.</p>
          ) : (
            <ul className="space-y-2">
              {(sales ?? []).slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <div className="text-xs text-muted-foreground">{s.date}</div>
                    <Badge variant="outline" className="capitalize">
                      {s.status}
                    </Badge>
                  </div>
                  <span className="font-mono tabular-nums">€{Number(s.total).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6 text-sm text-muted-foreground">
        <h3 className="mb-1 font-display text-base font-semibold text-foreground">
          A chegar em breve
        </h3>
        Encomendas com link público e PIN, agenda, pedidos de aprovação e relatórios.
      </Card>
    </div>
  );
}
