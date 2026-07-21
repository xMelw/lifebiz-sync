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
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 mb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
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
    <Card className="p-3.5 sm:p-5 hover:shadow-md transition-shadow duration-200 h-full">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          <p className="mt-1 sm:mt-1.5 text-lg sm:text-2xl font-bold tabular-nums tracking-tight truncate">
            {value}
          </p>
        </div>
        <div
          className={`grid size-8 sm:size-10 shrink-0 place-items-center rounded-lg sm:rounded-xl ring-1 ${toneCls}`}
        >
          <Icon className="size-4 sm:size-5" strokeWidth={1.75} />
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
