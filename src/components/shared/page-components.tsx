import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Package } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4 mb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
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
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string | number;
  tone?: "warning" | "destructive" | "success";
  href?: string;
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning-foreground bg-warning/15 ring-warning/30"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10 ring-destructive/20"
        : tone === "success"
          ? "text-success bg-success/10 ring-success/20"
          : "text-muted-foreground bg-muted/60 ring-border/60";
  const inner = (
    <Card className="p-5 hover:shadow-md transition-shadow duration-200 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneCls}`}
        >
          <Icon className="size-5" strokeWidth={1.75} />
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

export function EmptyAccess({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-4 grid size-20 place-items-center rounded-2xl bg-muted ring-1 ring-border/60">
        <Package
          className="size-10 text-muted-foreground/50"
          strokeWidth={1.5}
        />
      </div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}
