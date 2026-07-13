import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export function ListContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 transition-colors",
        onClick && "cursor-pointer hover:bg-muted/40",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60">
        <Icon
          className="size-8 text-muted-foreground/60"
          strokeWidth={1.5}
        />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DialogHeader2({ title }: { title: string }) {
  return (
    <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
      <DialogTitle className="font-display text-lg font-semibold">
        {title}
      </DialogTitle>
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

export function ArchiveConfirmDialog({
  onConfirm,
  children,
}: {
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar?</AlertDialogTitle>
          <AlertDialogDescription>
            O registo ficará oculto mas o histórico mantém-se. Podes restaurar a
            qualquer momento.
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

export function Money({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <span className={cn("font-mono font-semibold tabular-nums", className)}>
      €{Number(value).toFixed(2)}
    </span>
  );
}
