import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Plus, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components"
import { EmptyState } from "@/components/shared/ui-helpers";

export const Route = createFileRoute("/_authenticated/negocio/aprovacoes")({ component: AprovacoesPage });

const TYPE_LABELS: Record<string, string> = {
  criar_venda: "Criar venda",
  editar_venda: "Editar venda",
  criar_despesa: "Criar despesa",
  editar_despesa: "Editar despesa",
  criar_encomenda: "Criar encomenda",
  editar_encomenda: "Editar encomenda",
  editar_stock: "Editar stock",
  arquivar_registo: "Arquivar registo",
};
const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  aprovado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  recusado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  precisa_alteracoes: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  cancelado: "bg-muted text-muted-foreground",
};

function AprovacoesPage() {
  const { membership, canAccessNegocio, isManager, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState("pendente");
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const { data: requests } = useQuery({
    queryKey: ["approval-requests", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const q = supabase
        .from("approval_requests")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: profilesMap } = useQuery({
    queryKey: ["profiles-map", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data: mems } = await supabase.from("workspace_members")
        .select("user_id").eq("workspace_id", wsId!);
      const ids = (mems ?? []).map((m) => m.user_id);
      if (!ids.length) return {};
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p.display_name ?? p.email ?? p.id; });
      return map;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["approval-requests", wsId] });

  const createRequest = useMutation({
    mutationFn: async (p: { type: string; description: string; priority: string }) => {
      const { error } = await supabase.from("approval_requests").insert({
        workspace_id: wsId!, created_by: userId!, ...p,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Pedido enviado"); setNewRequestOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async (p: { id: string; status: string; comment: string }) => {
      if (p.status === "aprovado" && reviewTarget?.created_by === userId) {
        throw new Error("Não podes aprovar os teus próprios pedidos.");
      }
      const { error } = await supabase.from("approval_requests").update({
        status: p.status, reviewed_by: userId!, reviewer_comment: p.comment || null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(); toast.success("Pedido revisto");
      setReviewTarget(null); setReviewComment(""); setReviewAction("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approval_requests")
        .update({ status: "cancelado" }).eq("id", id).eq("created_by", userId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Pedido cancelado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const allRequests = requests ?? [];
  const filtered = filterStatus === "all"
    ? allRequests
    : allRequests.filter((r) => r.status === filterStatus);
  const pendingCount = allRequests.filter((r) => r.status === "pendente").length;
  const urgentCount = allRequests.filter((r) => r.priority === "urgente" && r.status === "pendente").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aprovações"
        subtitle={`${pendingCount} pendente(s)${urgentCount > 0 ? ` · ${urgentCount} urgentes` : ""}`}
        action={
          <Button onClick={() => setNewRequestOpen(true)}>
            <Plus className="size-4" /> Novo pedido
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Pendentes", value: pendingCount, color: "text-yellow-600" },
          { label: "Urgentes", value: urgentCount, color: "text-red-600" },
          { label: "Aprovados", value: allRequests.filter((r) => r.status === "aprovado").length, color: "text-green-600" },
          { label: "Recusados", value: allRequests.filter((r) => r.status === "recusado").length, color: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Filtro */}
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pendente">Pendentes</SelectItem>
          <SelectItem value="aprovado">Aprovados</SelectItem>
          <SelectItem value="recusado">Recusados</SelectItem>
          <SelectItem value="precisa_alteracoes">Precisa alterações</SelectItem>
          <SelectItem value="cancelado">Cancelados</SelectItem>
        </SelectContent>
      </Select>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted ring-1 ring-border/60"><CheckSquare className="size-8 text-muted-foreground/60" strokeWidth={1.5} /></div><p className="font-display text-lg font-semibold">Sem pedidos</p><p className="mt-1 text-sm text-muted-foreground">Os pedidos de aprovação aparecerão aqui.</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a, b) => {
            const aU = a.priority === "urgente" && a.status === "pendente" ? 0 : 1;
            const bU = b.priority === "urgente" && b.status === "pendente" ? 0 : 1;
            if (aU !== bU) return aU - bU;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }).map((req) => {
            const statusCls = STATUS_COLORS[req.status] ?? "";
            const isOwner = req.created_by === userId;
            return (
              <div key={req.id} className={`px-4 py-4 hover:bg-muted/40 transition-colors ${req.priority === "urgente" && req.status === "pendente" ? "border-l-2 border-l-destructive" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {req.priority === "urgente" && req.status === "pendente" && (
                        <Badge variant="destructive" className="text-[10px] px-1.5">
                          <AlertTriangle className="size-2.5 mr-0.5" /> URGENTE
                        </Badge>
                      )}
                      <span className="font-medium">{TYPE_LABELS[req.type] ?? req.type}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                        {req.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{req.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(req.created_at).toLocaleString("pt-PT")}
                      </span>
                      <span>Por: {(profilesMap ?? {})[req.created_by] ?? "—"}</span>
                      {req.reviewed_by && (
                        <span>Revisto por: {(profilesMap ?? {})[req.reviewed_by] ?? "—"}</span>
                      )}
                    </div>
                    {req.reviewer_comment && (
                      <p className="text-xs italic text-muted-foreground">"{req.reviewer_comment}"</p>
                    )}
                  </div>
                  {req.status === "pendente" && (
                    <div className="flex gap-1">
                      {isManager && (
                        <>
                          <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setReviewTarget(req); setReviewAction("aprovado"); }}>
                            <CheckCircle2 className="size-3.5" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7"
                            onClick={() => { setReviewTarget(req); setReviewAction("recusado"); }}>
                            <XCircle className="size-3.5" /> Recusar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7"
                            onClick={() => { setReviewTarget(req); setReviewAction("precisa_alteracoes"); }}>
                            Alterações
                          </Button>
                        </>
                      )}
                      {isOwner && (
                        <Button size="sm" variant="ghost" className="h-7"
                          onClick={() => cancelRequest.mutate(req.id)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de revisão */}
      <Dialog open={!!reviewTarget} onOpenChange={(v) => { if (!v) { setReviewTarget(null); setReviewComment(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "aprovado" ? "Aprovar pedido" :
                reviewAction === "recusado" ? "Recusar pedido" : "Pedir alterações"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {reviewTarget && (
              <p className="text-sm text-muted-foreground">{reviewTarget.description}</p>
            )}
            <div className="space-y-1.5">
              <Label>Comentário (opcional)</Label>
              <Textarea rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Justificação ou notas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancelar</Button>
            <Button
              variant={reviewAction === "recusado" ? "destructive" : "default"}
              onClick={() => review.mutate({ id: reviewTarget.id, status: reviewAction, comment: reviewComment })}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de novo pedido */}
      <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
        <NewRequestDialog onSubmit={(p) => createRequest.mutate(p)} />
      </Dialog>
    </div>
  );
}

function NewRequestDialog({ onSubmit }: { onSubmit: (p: any) => void }) {
  const [type, setType] = useState("criar_encomenda");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Novo pedido de aprovação</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ type, description, priority }); }}>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgente">🔴 Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição *</Label>
          <Textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreve o que precisas de fazer e porquê..." />
        </div>
        <DialogFooter>
          <Button type="submit">Enviar pedido</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
