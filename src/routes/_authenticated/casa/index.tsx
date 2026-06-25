import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Receipt, AlertTriangle, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/casa/")({
  component: CasaDashboard,
});

function CasaDashboard() {
  const { membership, canAccessCasa } = useWorkspace();
  const wsId = membership?.workspace_id;

  const { data: stock } = useQuery({
    queryKey: ["casa-stock-summary", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_stock_items")
        .select("id, name, quantity, min_stock, expiry_date, status")
        .eq("workspace_id", wsId!)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const in14 = new Date();
  in14.setDate(now.getDate() + 14);

  const { data: expenses } = useQuery({
    queryKey: ["casa-expenses-month", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("home_expenses")
        .select("id, date, amount, category, description")
        .eq("workspace_id", wsId!)
        .gte("date", start)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!canAccessCasa) {
    return (
      <EmptyAccess
        title="Sem acesso ao modo Casa"
        message="Pede a um admin do workspace para te dar acesso."
      />
    );
  }

  const lowStock = (stock ?? []).filter((s) => Number(s.quantity) <= Number(s.min_stock));
  const nearExpiry = (stock ?? []).filter(
    (s) => s.expiry_date && new Date(s.expiry_date) <= in14,
  );
  const monthTotal = (expenses ?? []).reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Casa" subtitle="Visão geral de stock e despesas" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Package} label="Itens em stock" value={(stock ?? []).length} />
        <StatCard
          icon={AlertTriangle}
          label="Stock baixo"
          value={lowStock.length}
          tone={lowStock.length ? "warning" : undefined}
        />
        <StatCard
          icon={CalendarClock}
          label="Perto da validade"
          value={nearExpiry.length}
          tone={nearExpiry.length ? "destructive" : undefined}
        />
        <StatCard icon={Receipt} label="Despesas do mês" value={`€${monthTotal.toFixed(2)}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Stock baixo</h3>
            <Link to="/casa/stock" className="text-xs text-primary hover:underline">
              Ver tudo
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo bem, sem alertas.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <span>{s.name}</span>
                  <Badge variant="destructive">
                    {Number(s.quantity)} / {Number(s.min_stock)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Últimas despesas</h3>
            <Link to="/casa/despesas" className="text-xs text-primary hover:underline">
              Ver tudo
            </Link>
          </div>
          {(expenses ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas este mês.</p>
          ) : (
            <ul className="space-y-2">
              {(expenses ?? []).slice(0, 5).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{e.category}</div>
                    <div className="text-xs text-muted-foreground">{e.date}</div>
                  </div>
                  <span className="font-mono">€{Number(e.amount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "warning" | "destructive" | "success";
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning-foreground bg-warning/30"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10"
        : tone === "success"
          ? "text-success bg-success/10"
          : "text-muted-foreground bg-muted";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={`flex size-7 items-center justify-center rounded-md ${toneCls}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

export function EmptyAccess({ title, message }: { title: string; message: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md p-6 text-center">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}
