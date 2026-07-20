import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useWorkspace, type AppMode } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  ShoppingCart,
  ClipboardList,
  UserCog,
  LogOut,
  Home,
  Briefcase,
  Calendar,
  CheckSquare,
  BarChart2,
  Menu,
  X,
  MoreHorizontal,
  ScanLine,
  ChefHat,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const casaNav: NavItem[] = [
  { to: "/casa", label: "Início", icon: LayoutDashboard },
  { to: "/casa/stock", label: "Stock", icon: Package },
  { to: "/casa/receitas", label: "Receitas", icon: ChefHat },
  { to: "/casa/lista-compras", label: "Lista", icon: ListChecks },
  { to: "/casa/scanner", label: "Scanner", icon: ScanLine },
  { to: "/casa/despesas", label: "Despesas", icon: Receipt },
  { to: "/casa/relatorios", label: "Relatórios", icon: BarChart2 },
];

const negocioNav: NavItem[] = [
  { to: "/negocio", label: "Início", icon: LayoutDashboard },
  { to: "/negocio/stock", label: "Stock", icon: Package },
  { to: "/negocio/encomendas", label: "Encomendas", icon: ClipboardList },
  { to: "/negocio/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/negocio/clientes", label: "Clientes", icon: Users },
  { to: "/negocio/despesas", label: "Despesas", icon: Receipt },
  { to: "/negocio/agenda", label: "Agenda", icon: Calendar },
  { to: "/negocio/aprovacoes", label: "Aprovações", icon: CheckSquare },
  { to: "/negocio/relatorios", label: "Relatórios", icon: BarChart2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { mode, setMode, canAccessCasa, canAccessNegocio, displayName, membership, isAdmin, userId } =
    useWorkspace();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const nav = mode === "casa" ? casaNav : negocioNav;

  const { data: pendingApprovals } = useQuery({
    queryKey: ["pending-approvals-count", membership?.workspace_id],
    enabled: !!membership?.workspace_id && (membership?.role === "admin" || membership?.role === "gestor"),
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", membership!.workspace_id)
        .eq("status", "pendente");
      return count ?? 0;
    },
  });

  // Suppress unused warning while keeping the query alive for future badge use
  void userId;

  const handleModeChange = (m: AppMode) => {
    setMode(m);
    router.navigate({ to: m === "casa" ? "/casa" : "/negocio" });
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  const isActive = (to: string) =>
    pathname === to || (to !== "/negocio" && to !== "/casa" && pathname.startsWith(to));

  // Mobile bottom nav: 4 principais + "Mais"
  const bottomPrimary = nav.slice(0, 4);
  const bottomOverflow = nav.slice(4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground text-background">
              <span className="font-display text-xs font-bold">
                {(membership?.workspace_name ?? "A").charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-display text-sm font-semibold tracking-tight truncate hidden sm:inline">
              {membership?.workspace_name ?? "App"}
            </span>
          </Link>

          {/* Mode switcher — pill minimal */}
          <div className="ml-1 flex items-center rounded-full border border-border/70 bg-muted/40 p-0.5">
            <ModeButton
              active={mode === "casa"}
              disabled={!canAccessCasa}
              onClick={() => handleModeChange("casa")}
              icon={Home}
              label="Casa"
            />
            <ModeButton
              active={mode === "negocio"}
              disabled={!canAccessNegocio}
              onClick={() => handleModeChange("negocio")}
              icon={Briefcase}
              label="Negócio"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {isAdmin && (
              <Link to="/equipa" className="hidden md:block">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <UserCog className="size-4" /> Equipa
                </Button>
              </Link>
            )}

            {(pendingApprovals ?? 0) > 0 && (
              <Link to="/negocio/aprovacoes" className="hidden md:block">
                <Button variant="ghost" size="icon" className="relative">
                  <CheckSquare className="size-4" />
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
                </Button>
              </Link>
            )}

            <div className="hidden lg:flex flex-col text-right text-[11px] leading-tight px-2">
              <span className="font-medium truncate max-w-[140px]">{displayName}</span>
              <span className="text-muted-foreground capitalize">{membership?.role}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sair"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute left-0 top-14 w-72 max-w-[85vw] h-[calc(100vh-3.5rem)] border-r border-border bg-background p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 pb-4 border-b border-border/60">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-xs text-muted-foreground capitalize">{membership?.role}</div>
            </div>
            <nav className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  active={isActive(item.to)}
                  badge={item.to === "/negocio/aprovacoes" ? pendingApprovals : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
              {isAdmin && (
                <NavRow
                  item={{ to: "/equipa", label: "Equipa", icon: UserCog }}
                  active={pathname === "/equipa"}
                  onClick={() => setMobileMenuOpen(false)}
                />
              )}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-border/60 bg-sidebar/60 px-3 py-6 md:block">
          <nav className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                active={isActive(item.to)}
                badge={item.to === "/negocio/aprovacoes" ? pendingApprovals : undefined}
              />
            ))}
            {isAdmin && (
              <NavRow
                item={{ to: "/equipa", label: "Equipa", icon: UserCog }}
                active={pathname === "/equipa"}
              />
            )}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-h-[calc(100vh-3.5rem)] flex-1 px-4 pb-24 pt-5 md:px-10 md:pb-10 md:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {bottomPrimary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-[18px]", active && "stroke-[2.25]")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          {bottomOverflow.length > 0 ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="size-[18px]" />
              <span>Mais</span>
            </button>
          ) : (
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(true);
              }}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="size-[18px]" />
              <span>Mais</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

function NavRow({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-foreground/5 text-foreground"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
      <span className="truncate">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
