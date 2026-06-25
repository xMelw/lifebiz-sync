import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, type Role } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "./casa/index";

const ROLES: Role[] = ["admin", "gestor", "colaborador", "visualizador"];

export const Route = createFileRoute("/_authenticated/equipa")({
  component: EquipaPage,
});

function EquipaPage() {
  const { membership, isAdmin } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, access_casa, access_negocio, status")
        .eq("workspace_id", wsId!);
      if (error) throw error;
      const ids = members.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return members.map((m) => ({ ...m, profile: map.get(m.user_id) ?? null }));
    },
  });

  const update = useMutation({
    mutationFn: async (p: {
      id: string;
      role?: Role;
      access_casa?: boolean;
      access_negocio?: boolean;
    }) => {
      const { id, ...patch } = p;
      const { error } = await supabase.from("workspace_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", wsId] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", wsId] });
      toast.success("Membro removido");
    },
  });

  const invite = useMutation({
    mutationFn: async (p: {
      email: string;
      role: Role;
      access_casa: boolean;
      access_negocio: boolean;
    }) => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", p.email)
        .maybeSingle();
      if (!prof)
        throw new Error("Utilizador não encontrado. Pede para se registar primeiro com este email.");
      const { error } = await supabase.from("workspace_members").insert({
        workspace_id: wsId!,
        user_id: prof.id,
        role: p.role,
        access_casa: p.access_casa,
        access_negocio: p.access_negocio,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", wsId] });
      toast.success("Membro adicionado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin)
    return (
      <EmptyAccess
        title="Apenas Admin"
        message="Só administradores podem gerir membros e permissões."
      />
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Equipa"
        subtitle="Cargos e acessos a Casa e Negócio"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4" /> Adicionar membro
              </Button>
            </DialogTrigger>
            <InviteDialog onSubmit={(p) => invite.mutate(p)} />
          </Dialog>
        }
      />

      <div className="grid gap-2">
        {(data ?? []).map((m) => {
          const profile = m.profiles as { display_name: string; email: string } | null;
          return (
            <Card key={m.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{profile?.display_name ?? profile?.email}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {m.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{profile?.email}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={m.role}
                    onValueChange={(v) => update.mutate({ id: m.id, role: v as Role })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={m.access_casa}
                      onCheckedChange={(c) =>
                        update.mutate({ id: m.id, access_casa: !!c })
                      }
                    />
                    Casa
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={m.access_negocio}
                      onCheckedChange={(c) =>
                        update.mutate({ id: m.id, access_negocio: !!c })
                      }
                    />
                    Negócio
                  </label>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(m.id)}
                    title="Remover"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function InviteDialog({
  onSubmit,
}: {
  onSubmit: (p: {
    email: string;
    role: Role;
    access_casa: boolean;
    access_negocio: boolean;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("colaborador");
  const [casa, setCasa] = useState(true);
  const [negocio, setNegocio] = useState(true);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Adicionar membro</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ email, role, access_casa: casa, access_negocio: negocio });
        }}
      >
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <p className="text-xs text-muted-foreground">
            O utilizador precisa de ter criado conta com este email primeiro.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={casa} onCheckedChange={(c) => setCasa(!!c)} /> Acesso a Casa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={negocio} onCheckedChange={(c) => setNegocio(!!c)} /> Acesso a
            Negócio
          </label>
        </div>
        <DialogFooter>
          <Button type="submit">Adicionar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
