import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export function ListContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function ListRow({ children, className, onClick }: {
  children: ReactNode; className?: string; onClick?: () => void;
}) {
  return (
    <div
      className={cn("flex items-center gap-4 px-4 py-3 transition-colors", onClick && "cursor-pointer hover:bg-muted/40", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60">
        <Icon className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DialogHeader2({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
      <DialogTitle className="font-display text-lg font-semibold">{title}</DialogTitle>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function DialogFooter2({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-border/60 -mx-6 px-6 pt-4 flex justify-end gap-2">
      {children}
    </div>
  );
}

export function ArchiveConfirmDialog({ onConfirm, children, title, description }: {
  onConfirm: () => void; children: ReactNode;
  title?: string; description?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? "Arquivar?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? "O registo ficará oculto mas o histórico mantém-se. Podes restaurar a qualquer momento."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Arquivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ArchiveButton({ onConfirm, title, description }: {
  onConfirm: () => void; title?: string; description?: string;
}) {
  return (
    <ArchiveConfirmDialog onConfirm={onConfirm} title={title} description={description}>
      <Button size="icon" variant="ghost" className="h-7 w-7">
        <Archive className="size-3.5 text-muted-foreground" />
      </Button>
    </ArchiveConfirmDialog>
  );
}

export function RestoreButton({ onRestore }: { onRestore: () => void }) {
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRestore} title="Restaurar">
      ↩
    </Button>
  );
}

export function Money({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn("font-mono font-semibold tabular-nums", className)}>
      €{Number(value).toFixed(2)}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 px-1 mb-2 mt-4 first:mt-0">
      {children}
    </p>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
          <div className="size-8 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted/60" />
          </div>
          <div className="h-3.5 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function KpiCard({ label, value, sub, tone }: {
  label: string; value: string | number; sub?: string;
  tone?: "success" | "warning" | "destructive" | "neutral";
}) {
  const cls = tone === "success" ? "text-green-600"
    : tone === "warning" ? "text-yellow-600"
    : tone === "destructive" ? "text-destructive"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", cls)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
