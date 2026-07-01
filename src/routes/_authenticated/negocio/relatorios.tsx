import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { EmptyAccess, PageHeader } from "../casa/index";

export const Route = createFileRoute("/_authenticated/negocio/relatorios")({ component: RelatoriosNegocioPage });

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

function RelatoriosNegocioPage() {
  const { membership, canAccessNegocio } = useWorkspace();
  const wsId = membership?.workspace_id;

  const { data: sales } = useQuery({
    queryKey: ["sales-report", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("date, total, status").eq("workspace_id", wsId!)
        .not("status", "eq", "cancelada");
      return data ?? [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses-report", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("business_expenses")
        .select("date, amount, category").eq("workspace_id", wsId!);
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-report", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("status, total").eq("workspace_id", wsId!);
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["neg-stock", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("name, stock_total, stock_reserved, stock_available, min_stock")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: saleItems } = useQuery({
    queryKey: ["sale-items-report", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data } = await supabase.from("sale_items")
        .select("quantity, unit_price, products(name)");
      return data ?? [];
    },
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  // Vendas por mês (últimos 6)
  const salesByMonth: Record<string, number> = {};
  const expensesByMonth: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
    salesByMonth[key] = 0;
    expensesByMonth[key] = 0;
  }
  (sales ?? []).forEach((s) => {
    const d = new Date(s.date);
    const key = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
    if (key in salesByMonth) salesByMonth[key] += Number(s.total);
  });
  (expenses ?? []).forEach((e) => {
    const d = new Date(e.date);
    const key = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
    if (key in expensesByMonth) expensesByMonth[key] += Number(e.amount);
  });

  const monthlyData = Object.keys(salesByMonth).map((m) => ({
    mes: m,
    vendas: salesByMonth[m],
    despesas: expensesByMonth[m],
    lucro: salesByMonth[m] - expensesByMonth[m],
  }));

  // Despesas por categoria
  const expByCat: Record<string, number> = {};
  (expenses ?? []).forEach((e) => {
    expByCat[e.category] = (expByCat[e.category] ?? 0) + Number(e.amount);
  });
  const expByCatData = Object.entries(expByCat).map(([name, value]) => ({ name, value }));

  // Encomendas por estado
  const ordByStatus: Record<string, number> = {};
  (orders ?? []).forEach((o) => {
    ordByStatus[o.status] = (ordByStatus[o.status] ?? 0) + 1;
  });
  const ordByStatusData = Object.entries(ordByStatus).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Produtos mais vendidos
  const prodSales: Record<string, number> = {};
  (saleItems ?? []).forEach((si: any) => {
    const name = si.products?.name ?? "Item avulso";
    prodSales[name] = (prodSales[name] ?? 0) + Number(si.quantity) * Number(si.unit_price);
  });
  const topProducts = Object.entries(prodSales).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // Totais do mês atual
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const salesThisMonth = (sales ?? []).filter((s) => {
    const d = new Date(s.date); return d.getMonth() === curMonth && d.getFullYear() === curYear;
  }).reduce((a, s) => a + Number(s.total), 0);
  const expThisMonth = (expenses ?? []).filter((e) => {
    const d = new Date(e.date); return d.getMonth() === curMonth && d.getFullYear() === curYear;
  }).reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" subtitle="Negócio" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Vendas (mês)", value: `€${salesThisMonth.toFixed(2)}`, color: "text-green-600" },
          { label: "Despesas (mês)", value: `€${expThisMonth.toFixed(2)}`, color: "text-red-500" },
          { label: "Lucro estimado", value: `€${(salesThisMonth - expThisMonth).toFixed(2)}`, color: salesThisMonth - expThisMonth >= 0 ? "text-green-600" : "text-red-500" },
          { label: "Total encomendas", value: (orders ?? []).length, color: "text-blue-600" },
        ].map((k) => (
          <Card key={k.label} className="p-4 text-center">
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Gráfico vendas vs despesas vs lucro */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold">Vendas vs Despesas vs Lucro (6 meses)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
            <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="vendas" name="Vendas" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lucro" name="Lucro" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Despesas por categoria */}
        {expByCatData.length > 0 && (
          <Card className="p-4">
            <h3 className="mb-4 text-sm font-semibold">Despesas por categoria</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expByCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {expByCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Encomendas por estado */}
        {ordByStatusData.length > 0 && (
          <Card className="p-4">
            <h3 className="mb-4 text-sm font-semibold">Encomendas por estado</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={ordByStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {ordByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Produtos mais vendidos */}
      {topProducts.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-4 text-sm font-semibold">Produtos mais vendidos (por valor)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
              <Bar dataKey="value" name="Valor" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Stock reservado vs disponível */}
      {(products ?? []).length > 0 && (
        <Card className="p-4">
          <h3 className="mb-4 text-sm font-semibold">Stock: reservado vs disponível</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 text-left">Produto</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Reservado</th>
                  <th className="pb-2 text-right">Disponível</th>
                  <th className="pb-2 text-right">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {(products ?? []).map((p) => {
                  const low = (p.stock_available ?? 0) <= (p.min_stock ?? 0);
                  return (
                    <tr key={(p as any).id} className="border-b border-border/50">
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right font-mono">{p.stock_total}</td>
                      <td className="py-1.5 text-right font-mono text-orange-500">{p.stock_reserved}</td>
                      <td className={`py-1.5 text-right font-mono ${low ? "text-red-500 font-semibold" : "text-green-600"}`}>
                        {p.stock_available}
                      </td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">{p.min_stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
