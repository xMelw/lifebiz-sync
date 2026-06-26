import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useWorkspace, type AppMode } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const casaNav: NavItem[] = [
  { to: "/casa", label: "Dashboard", icon: LayoutDashboard },
  { to: "/casa/stock", label: "Stock", icon: Package },
  { to: "/casa/despesas", label: "Despesas", icon: Receipt },
];

const negocioNav: NavItem[] = [
  { to: "/negocio", label: "Dashboard", icon: LayoutDashboard },
  { to: "/negocio/stock", label: "Stock", icon: Package },
  { to: "/negocio/encomendas", label: "Encomendas", icon: ClipboardList },
  { to: "/negocio/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/negocio/clientes", label: "Clientes", icon: Users },
  { to: "/negocio/despesas", label: "Despesas", icon: Receipt },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { mode, setMode, canAccessCasa, canAccessNegocio, displayName, membership, isAdmin } =
    useWorkspace();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = mode === "casa" ? casaNav : negocioNav;

  const handleModeChange = (m: AppMode) => {
    setMode(m);
    router.navigate({ to: m === "casa" ? "/casa" : "/negocio" });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold tracking-tight">
              {membership?.workspace_name ?? "App"}
            </span>
          </Link>

          {/* Mode switcher */}
          <div className="ml-2 flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5">
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

          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <Link to="/equipa" className="hidden md:block">
                <Button variant="ghost" size="sm">
                  <UserCog className="size-4" /> Equipa
                </Button>
              </Link>
            )}
            <div className="hidden text-right text-xs leading-tight md:block">
              <div className="font-medium">{displayName}</div>
              <div className="text-muted-foreground capitalize">{membership?.role}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-border bg-sidebar p-3 md:block">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Modo
            </div>
            <Badge variant="outline" className="mx-3 w-fit capitalize">
              {mode}
            </Badge>
          </nav>
        </aside>

        {/* Main */}
        <main className="min-h-[calc(100vh-3.5rem)] flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6">
          {children}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {nav.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
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
        "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
