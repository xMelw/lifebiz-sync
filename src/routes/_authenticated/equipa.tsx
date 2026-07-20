import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, type Role } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogTitle } from "@/components/ui/dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, Shield, Users, Home, Briefcase, Crown, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";

const ROLES: Role[] = ["admin", "gestor", "colaborador", "visualizador"];

const ROLE_META: Record<Role, { label: string; desc: string; icon: typeof Shield; color: string }> = {
  admin:       { label: "Admin",       desc: "Acesso total, gere membros e configurações", icon: Crown,  color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 ring-yellow-200 dark:ring-yellow-800" },
  gestor:      { label: "Gestor",      desc: "Aprova pedidos e gere operações",            icon: Shield, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-800" },
  colaborador: { label: "Colaborador", desc: "Cria pedidos, aguarda aprovação",            icon: Users,  color: "text-green-600 bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-800" },
  visualizador:{ label: "Visualizador","desc": "Só pode ver dados",                        icon: Eye,    color: "text-muted-foreground bg-muted ring-border" },
};

export const Route = createFileRoute("/_authenticated/equipa")({ component: EquipaPage });

function EquipaPage() {
  const { membership, isAdmin, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editMember, setEditMember] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, access_casa, access_negocio, status")
        .eq("workspace_id", wsId!);
      if (error) throw error;
      const ids = members.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, email")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return members.map((m) => ({ ...m, profile: map.get(m.user_id) ?? null }));
    },
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; role?: Role; access_casa?: boolean; access_negocio?: boolean; status?: string }) => {
      const { id, ...patch } = p;
      const { error } = await supabase.from("workspace_members").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", wsId] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", wsId] }); toast.success("Membro removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const invite = useMutation({
    mutationFn: async (p: { email: string; role: Role; access_casa: boolean; access_negocio: boolean }) => {
      const { data: prof } = await supabase.from("profiles").select("id").eq("email", p.email).maybeSingle();
      if (!prof) throw new Error("Utilizador não encontrado. Pede que se registe primeiro com este email.");
      const { error } = await supabase.from("workspace_members").insert({
        workspace_id: wsId!, user_id: prof.id, role: p.role,
        access_casa: p.access_casa, access_negocio: p.access_negocio, status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", wsId] }); toast.success("Membro adicionado"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return <EmptyAccess title="Apenas Admin" message="Só administradores podem gerir membros e permissões." />;

  const members = data ?? [];
  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-0">
      <PageHeader
        title="Equipa"
        subtitle={`${activeCount} membro${activeCount !== 1 ? "s" : ""} ativo${activeCount !== 1 ? "s" : ""}`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="size-4" /> Convidar membro</Button>
            </DialogTrigger>
            <InviteDialog onSubmit={(p) => invite.mutate(p)} loading={invite.isPending} />
          </Dialog>
        }
      />

      {/* Legend de cargos */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <div key={role} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ring-1 ${meta.color}`}>
              <Icon className="size-4 mt-0.5 shrink-0" strokeWidth={2} />
              <div>
                <p className="text-xs font-semibold">{meta.label}</p>
                <p className="text-[11px] opacity-70 leading-tight mt-0.5">{meta.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60">
            <Users className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
          </div>
          <p className="font-display text-lg font-semibold">Sem membros</p>
          <p className="mt-1 text-sm text-muted-foreground">Adiciona o primeiro membro à equipa.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {members.map((m) => {
            const profile = m.profile;
            const meta = ROLE_META[m.role as Role] ?? ROLE_META.visualizador;
            const RoleIcon = meta.icon;
            const isSelf = m.user_id === userId;
            const isEditing = editMember === m.id;

            return (
              <div key={m.id} className={`px-4 py-4 transition-colors hover:bg-muted/20 ${m.status !== "active" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ${meta.color}`}>
                      <span className="text-sm font-bold">
                        {(profile?.display_name ?? profile?.email ?? "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{profile?.display_name ?? profile?.email ?? "—"}</span>
                        {isSelf && <span className="status-pill-info text-[10px]">Tu</span>}
                        {m.status !== "active" && <span className="status-pill-neutral text-[10px]">{m.status}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${meta.color}`}>
                          <RoleIcon className="size-2.5" />
                          {meta.label}
                        </div>
                        <span className={`flex items-center gap-1 text-[11px] ${m.access_casa ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          <Home className="size-3" /> Casa
                        </span>
                        <span className={`flex items-center gap-1 text-[11px] ${m.access_negocio ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          <Briefcase className="size-3" /> Negócio
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acções */}
                  {isAdmin && !isSelf && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => setEditMember(isEditing ? null : m.id)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Trash2 className="size-3.5 text-destructive/70" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {profile?.display_name ?? profile?.email} perderá acesso ao workspace.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(m.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* Painel de edição inline */}
                {isEditing && isAdmin && !isSelf && (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editar permissões</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo</Label>
                        <Select value={m.role} onValueChange={(v) => update.mutate({ id: m.id, role: v as Role })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                <div className="flex items-center gap-2">
                                  {r === "admin" && <Crown className="size-3.5 text-yellow-600" />}
                                  {r === "gestor" && <Shield className="size-3.5 text-blue-600" />}
                                  {r === "colaborador" && <Users className="size-3.5 text-green-600" />}
                                  {r === "visualizador" && <Eye className="size-3.5 text-muted-foreground" />}
                                  <span className="capitalize">{r}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 h-9">
                        <label className="flex items-center gap-2 text-sm cursor-pointer w-full">
                          <Home className="size-3.5 text-muted-foreground" />
                          <span>Casa</span>
                          <Switch
                            className="ml-auto"
                            checked={m.access_casa}
                            onCheckedChange={(c) => update.mutate({ id: m.id, access_casa: c })}
                          />
                        </label>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 h-9">
                        <label className="flex items-center gap-2 text-sm cursor-pointer w-full">
                          <Briefcase className="size-3.5 text-muted-foreground" />
                          <span>Negócio</span>
                          <Switch
                            className="ml-auto"
                            checked={m.access_negocio}
                            onCheckedChange={(c) => update.mutate({ id: m.id, access_negocio: c })}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditMember(null)}>Fechar</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InviteDialog({ onSubmit, loading }: {
  onSubmit: (p: { email: string; role: Role; access_casa: boolean; access_negocio: boolean }) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("colaborador");
  const [casa, setCasa] = useState(true);
  const [negocio, setNegocio] = useState(true);
  return (
    <DialogContent className="max-w-md gap-0 p-0">
      <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
        <DialogTitle className="font-display text-lg font-semibold">Convidar membro</DialogTitle>
        <p className="text-sm text-muted-foreground mt-0.5">O utilizador precisa de ter conta criada.</p>
      </div>
      <form className="space-y-4 px-6 py-5" onSubmit={(e) => { e.preventDefault(); onSubmit({ email, role, access_casa: casa, access_negocio: negocio }); }}>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@exemplo.com" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  <div className="flex flex-col">
                    <span className="capitalize font-medium">{r}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_META[r].desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acesso a modos</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Home className="size-4 text-muted-foreground" /> Casa
              </label>
              <Switch checked={casa} onCheckedChange={setCasa} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Briefcase className="size-4 text-muted-foreground" /> Negócio
              </label>
              <Switch checked={negocio} onCheckedChange={setNegocio} />
            </div>
          </div>
        </div>
        <div className="border-t border-border/60 -mx-6 px-6 pt-4 flex justify-end">
          <Button type="submit" className="h-10 px-6 font-semibold" disabled={loading}>
            {loading ? "A adicionar…" : "Convidar membro"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
