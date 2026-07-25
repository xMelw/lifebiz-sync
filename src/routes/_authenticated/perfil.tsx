import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-components";
import { User, Check, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({ component: PerfilPage });

function PerfilPage() {
  const { displayName, firstName, email, updateDisplayName, userId } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateDisplayName(name.trim());
      toast.success("Nome atualizado");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="O meu perfil" subtitle="Personaliza o teu nome e preferências" />

      <Card className="overflow-hidden">
        <div className="card-header flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <span className="font-display text-lg font-bold text-primary">
              {(firstName ?? email ?? "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold">{displayName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nome de exibição
            </Label>
            {editing ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                  placeholder="O teu nome"
                  className="h-9"
                />
                <Button size="sm" className="h-9 px-4 font-semibold" onClick={save} disabled={saving}>
                  {saving ? "…" : <><Check className="size-4" /> Guardar</>}
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={() => { setEditing(false); setName(displayName ?? ""); }}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                  {displayName ?? <span className="text-muted-foreground">Não definido</span>}
                </div>
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => { setEditing(true); setName(displayName ?? ""); }}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Este é o nome que aparece nas saudações e na equipa. Podes usar o teu primeiro nome.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {email}
            </div>
            <p className="text-xs text-muted-foreground">O email não pode ser alterado aqui.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
