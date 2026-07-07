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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "warning" | "destructive" | "success" | "info";
  href?: string;
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning-foreground bg-warning/15 ring-warning/30"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10 ring-destructive/25"
        : tone === "success"
          ? "text-success bg-success/10 ring-success/25"
          : tone === "info"
            ? "text-primary bg-primary/10 ring-primary/25"
            : "text-muted-foreground bg-muted ring-border";

  const inner = (
    <Card className="group relative overflow-hidden p-4 transition-all duration-150 hover:shadow-md hover:border-border md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${toneCls}`}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );

  return href ? (
    <Link to={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function EmptyAccess({ title, message }: { title: string; message: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-muted ring-1 ring-border/60">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-7 text-muted-foreground/70"
        >
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}
