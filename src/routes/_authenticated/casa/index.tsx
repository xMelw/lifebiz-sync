import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Receipt, AlertTriangle, CalendarClock, Plus, ArrowRight, ScanLine, ChefHat, ListChecks, Zap } from "lucide-react";
import { PageHeader, StatCard, EmptyAccess } from "@/components/shared/page-components";

export { PageHeader, StatCard, EmptyAccess } from "@/components/shared/page-components";

export const Route = createFileRoute("/_authenticated/casa/")({ component: CasaDashboard });

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function CasaDashboard() {
  const { membership, canAccessCasa, displayName } = useWorkspace();
  const wsId = membership?.workspace_id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: stock } = useQuery({
    queryKey: ["casa-stock-dash", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data } = await supabase.from("home_stock_items").select("id, name, quantity, min_stock, expiry_date").eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["casa-expenses-dash", wsId, monthStart],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data } = await supabase.from("home_expenses").select("amount, date, category, description").eq("workspace_id", wsId!).gte("date", monthStart).order("date", { ascending: false });
      return data ?? [];
    },
  });

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede ao administrador acesso ao modo Casa." />;

  const totalItems = (stock ?? []).length;
  const lowStock = (stock ?? []).filter((s) => Number(s.quantity) <= Number(s.min_stock ?? 0));
  const expiringSoon = (stock ?? []).filter((s) => {
    if (!s.expiry_date) return false;
    const diff = (new Date(s.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });
  const monthTotal = (expenses ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const firstName = displayName?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <p className="text-sm text-muted-foreground">{getGreeting()}{firstName ? `, ${firstName}` : ""}  · {now.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">Casa</h1>
      </div>

      {/* Alertas */}
      {(lowStock.length > 0 || expiringSoon.length > 0) && (
        <div className="space-y-2">
          {lowStock.length > 0 && (
            <Link to="/casa/stock">
              <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 hover:bg-destructive/10 transition-colors cursor-pointer">
                <AlertTriangle className="size-4 text-destructive shrink-0" />
                <span className="flex-1 text-sm font-medium text-destructive">{lowStock.length} item{lowStock.length > 1 ? "s" : ""} com stock baixo</span>
                <ArrowRight className="size-4 text-destructive/60" />
              </div>
            </Link>
          )}
          {expiringSoon.length > 0 && (
            <Link to="/casa/stock">
              <div className="flex items-center gap-3 rounded-xl border border-yellow-400/40 bg-yellow-50/60 dark:bg-yellow-900/10 px-4 py-3 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors cursor-pointer">
                <CalendarClock className="size-4 text-yellow-600 shrink-0" />
                <span className="flex-1 text-sm font-medium text-yellow-700 dark:text-yellow-400">{expiringSoon.length} item{expiringSoon.length > 1 ? "s" : ""} a expirar em 7 dias</span>
                <ArrowRight className="size-4 text-yellow-600/60" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Package} label="Total em stock" value={totalItems} href="/casa/stock" />
        <StatCard icon={AlertTriangle} label="Stock baixo" value={lowStock.length} tone={lowStock.length > 0 ? "destructive" : undefined} href="/casa/stock" />
        <StatCard icon={CalendarClock} label="A expirar (7d)" value={expiringSoon.length} tone={expiringSoon.length > 0 ? "warning" : undefined} href="/casa/stock" />
        <StatCard icon={Receipt} label="Despesas (mês)" value={`€${monthTotal.toFixed(2)}`} href="/casa/despesas" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Últimas despesas */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold text-sm">Últimas despesas</h3>
            <Link to="/casa/despesas"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">Ver tudo <ArrowRight className="size-3" /></Button></Link>
          </div>
          {(expenses ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">Sem despesas este mês.</p>
              <Link to="/casa/despesas"><Button variant="outline" size="sm" className="mt-3"><Plus className="size-3.5" /> Adicionar</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {(expenses ?? []).slice(0, 5).map((e, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{e.description || e.category}</p>
                    <p className="text-xs text-muted-foreground">{e.category} · {new Date(e.date).toLocaleDateString("pt-PT")}</p>
                  </div>
                  <span className="money text-sm">€{Number(e.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Itens próximos de expirar */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold text-sm">Validades próximas</h3>
            <Link to="/casa/stock"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">Stock <ArrowRight className="size-3" /></Button></Link>
          </div>
          {expiringSoon.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">Tudo em ordem por agora.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {expiringSoon.slice(0, 5).map((s) => {
                const diff = Math.ceil((new Date(s.expiry_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-medium">{s.name}</p>
                    <span className={`text-xs font-medium ${diff <= 2 ? "text-destructive" : "text-yellow-600"}`}>
                      {diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : `${diff} dias`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Ações rápidas */}
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-3">Ações rápidas</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/casa/scanner"><Button variant="outline" className="w-full justify-start gap-2 h-10"><ScanLine className="size-4" /> Scanner talão</Button></Link>
            <Link to="/casa/lista-compras"><Button variant="outline" className="w-full justify-start gap-2 h-10"><ListChecks className="size-4" /> Lista compras</Button></Link>
            <Link to="/casa/receitas"><Button variant="outline" className="w-full justify-start gap-2 h-10"><ChefHat className="size-4" /> Receitas</Button></Link>
            <Link to="/casa/despesas"><Button variant="outline" className="w-full justify-start gap-2 h-10"><Receipt className="size-4" /> Nova despesa</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
