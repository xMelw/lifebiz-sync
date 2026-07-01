import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { EmptyAccess, PageHeader } from "./index";

export const Route = createFileRoute("/_authenticated/casa/relatorios")({ component: RelatoriosCasaPage });

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function RelatoriosCasaPage() {
  const { membership, canAccessCasa } = useWorkspace();
  const wsId = membership?.workspace_id;

  const { data: expenses } = useQuery({
    queryKey: ["casa-expenses-report", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data } = await supabase.from("home_expenses")
        .select("date, amount, category").eq("workspace_id", wsId!);
      return data ?? [];
    },
  });

  const { data: stock } = useQuery({
    queryKey: ["casa-stock-report", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data } = await supabase.from("home_stock_items")
        .select("name, category, quantity, min_quantity, expiry_date, status")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  // Despesas por mês (6 meses)
  const byMonth: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(curYear, curMonth - i, 1);
    byMonth[d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" })] = 0;
  }
  (expenses ?? []).forEach((e) => {
    const d = new Date(e.date);
    const key = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
    if (key in byMonth) byMonth[key] += Number(e.amount);
  });
  const monthlyData = Object.entries(byMonth).map(([mes, total]) => ({ mes, total }));

  // Despesas por categoria
  const byCat: Record<string, number> = {};
  (expenses ?? []).forEach((e) => { byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount); });
  const byCatData = Object.entries(byCat).map(([name, value]) => ({ name, value }));

  // Stock baixo
  const lowStock = (stock ?? []).filter((s) => Number(s.quantity) <= Number(s.min_quantity ?? 0));

  // Validade próxima (7 dias)
  const soonExp = (stock ?? []).filter((s) => {
    if (!s.expiry_date) return false;
    const exp = new Date(s.expiry_date);
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const expThisMonth = (expenses ?? []).filter((e) => {
    const d = new Date(e.date); return d.getMonth() === curMonth && d.getFullYear() === curYear;
  }).reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" subtitle="Casa" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Despesas (mês)", value: `€${expThisMonth.toFixed(2)}`, color: "text-red-500" },
          { label: "Total despesas", value: `€${(expenses ?? []).reduce((a, e) => a + Number(e.amount), 0).toFixed(2)}`, color: "text-foreground" },
          { label: "Stock baixo", value: lowStock.length, color: lowStock.length > 0 ? "text-red-500" : "text-green-600" },
          { label: "Validade próxima", value: soonExp.length, color: soonExp.length > 0 ? "text-yellow-600" : "text-green-600" },
        ].map((k) => (
          <Card key={k.label} className="p-4 text-center">
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Gráfico despesas por mês */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold">Despesas mensais</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
            <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
            <Bar dataKey="total" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Despesas por categoria */}
      {byCatData.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-4 text-sm font-semibold">Despesas por categoria</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {byCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Stock baixo */}
      {lowStock.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-red-600">⚠ Stock abaixo do mínimo ({lowStock.length})</h3>
          <div className="space-y-1">
            {lowStock.map((s, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border pb-1">
                <span>{s.name}</span>
                <span className="font-mono text-red-500">{s.quantity} / mín {s.min_quantity ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Validade próxima */}
      {soonExp.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-yellow-600">⏱ Validade próxima ({soonExp.length})</h3>
          <div className="space-y-1">
            {soonExp.sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime()).map((s, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border pb-1">
                <span>{s.name}</span>
                <span className="font-mono text-yellow-600">{new Date(s.expiry_date!).toLocaleDateString("pt-PT")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
