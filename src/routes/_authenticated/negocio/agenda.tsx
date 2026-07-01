import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Calendar, MapPin, Clock, User, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "../casa/index";

export const Route = createFileRoute("/_authenticated/negocio/agenda")({ component: AgendaPage });

const TYPE_LABELS: Record<string, string> = {
  venda_marcada: "Venda marcada",
  entrega: "Entrega",
  lembrete: "Lembrete",
  compra_stock: "Compra de stock",
  encomenda: "Encomenda",
};
const TYPE_COLORS: Record<string, string> = {
  venda_marcada: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  entrega: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  lembrete: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  compra_stock: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  encomenda: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};
const STATUS_COLORS: Record<string, string> = {
  pendente: "outline",
  confirmado: "default",
  concluido: "secondary",
  cancelado: "destructive",
};

function AgendaPage() {
  const { membership, canAccessNegocio, canWrite, isManager, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("upcoming");

  const { data: events } = useQuery({
    queryKey: ["calendar-events", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*, customers(name), orders(order_number)")
        .eq("workspace_id", wsId!)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["clientes-list", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members-list", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data: mems } = await supabase.from("workspace_members")
        .select("user_id").eq("workspace_id", wsId!).eq("status", "active");
      const ids = (mems ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, email").in("id", ids);
      return (profs ?? []).map((p) => ({ id: p.id, name: p.display_name ?? p.email ?? p.id }));
    },
  });

  // Propostas de nova data pendentes (de ações do cliente)
  const { data: clientProposals } = useQuery({
    queryKey: ["client-proposals", wsId],
    enabled: !!wsId && isManager,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_client_actions")
        .select("*, orders(order_number, id)")
        .eq("action", "proposta_data")
        .order("created_at", { ascending: false });
      return (data ?? []).filter((p: any) =>
        p.proposed_date && new Date(p.proposed_date) > new Date()
      );
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar-events", wsId] });

  const upsertEvent = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { error } = await supabase.from("calendar_events").update({ ...p }).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendar_events").insert({ ...p, workspace_id: wsId!, created_by: userId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success("Evento guardado"); setOpen(false); setEditEvent(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Evento eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      const { error } = await supabase.from("calendar_events").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Estado atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(today); monthEnd.setMonth(monthEnd.getMonth() + 1);

  const allEvents = events ?? [];
  const filtered = allEvents.filter((e) => {
    const d = new Date(e.event_date);
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterDate === "today") return d.toDateString() === today.toDateString();
    if (filterDate === "week") return d >= today && d <= weekEnd;
    if (filterDate === "month") return d >= today && d <= monthEnd;
    if (filterDate === "upcoming") return d >= today;
    return true;
  });

  const stats = {
    total: allEvents.length,
    pending: allEvents.filter((e) => e.status === "pendente").length,
    confirmed: allEvents.filter((e) => e.status === "confirmado").length,
    today: allEvents.filter((e) => new Date(e.event_date).toDateString() === today.toDateString()).length,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agenda"
        subtitle={`${stats.total} eventos`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Novo evento</Button>
              </DialogTrigger>
              <EventFormDialog
                event={null} customers={customers ?? []} members={members ?? []}
                onSubmit={(p) => upsertEvent.mutate(p)}
              />
            </Dialog>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Pendentes", value: stats.pending, color: "text-yellow-600" },
          { label: "Confirmados", value: stats.confirmed, color: "text-green-600" },
          { label: "Hoje", value: stats.today, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <div className={`text-2xl font-bold ${s.color ?? ""}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Propostas pendentes do cliente */}
      {isManager && (clientProposals ?? []).length > 0 && (
        <Card className="border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                {clientProposals!.length} proposta(s) de data do cliente
              </p>
              <div className="mt-2 space-y-1">
                {clientProposals!.map((p: any) => (
                  <p key={p.id} className="text-xs text-yellow-700 dark:text-yellow-400">
                    {(p.orders as any)?.order_number ?? "Encomenda"} —{" "}
                    {new Date(p.proposed_date).toLocaleString("pt-PT")}
                    {p.client_name ? ` (por ${p.client_name})` : ""}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterDate} onValueChange={setFilterDate}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Próximos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sem eventos com estes filtros.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ev) => {
            const typeColor = TYPE_COLORS[ev.type] ?? "bg-muted text-muted-foreground";
            const customerName = (ev.customers as any)?.name;
            const orderNum = (ev.orders as any)?.order_number;
            return (
              <Card key={ev.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{ev.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}>
                        {TYPE_LABELS[ev.type] ?? ev.type}
                      </span>
                      <Badge variant={STATUS_COLORS[ev.status] as any} className="capitalize text-xs">
                        {ev.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(ev.event_date).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })}
                        {ev.event_time && ` · ${ev.event_time.slice(0, 5)}`}
                      </span>
                      {ev.duration_minutes && (
                        <span className="flex items-center gap-1"><Clock className="size-3" />{ev.duration_minutes}min</span>
                      )}
                      {ev.location && (
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{ev.location}</span>
                      )}
                      {customerName && (
                        <span className="flex items-center gap-1"><User className="size-3" />{customerName}</span>
                      )}
                      {orderNum && <span className="font-mono">{orderNum}</span>}
                    </div>
                    {ev.notes && <p className="text-xs text-muted-foreground line-clamp-1">{ev.notes}</p>}
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      {ev.status === "pendente" && isManager && (
                        <Button size="icon" variant="ghost" className="size-7"
                          onClick={() => updateStatus.mutate({ id: ev.id, status: "confirmado" })}>
                          <CheckCircle2 className="size-4 text-green-600" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-7"
                        onClick={() => { setEditEvent(ev); setOpen(true); }}>
                        ✏️
                      </Button>
                      {isManager && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-7">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar evento?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteEvent.mutate(ev.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editEvent && (
        <Dialog open={!!editEvent} onOpenChange={(v) => { if (!v) { setEditEvent(null); setOpen(false); } }}>
          <EventFormDialog
            event={editEvent} customers={customers ?? []} members={members ?? []}
            onSubmit={(p) => upsertEvent.mutate({ ...p, id: editEvent.id })}
          />
        </Dialog>
      )}
    </div>
  );
}

function EventFormDialog({ event, customers, members, onSubmit }: {
  event: any; customers: any[]; members: any[]; onSubmit: (p: any) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState(event?.type ?? "lembrete");
  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [eventTime, setEventTime] = useState(event?.event_time?.slice(0, 5) ?? "");
  const [duration, setDuration] = useState(String(event?.duration_minutes ?? ""));
  const [location, setLocation] = useState(event?.location ?? "");
  const [customerId, setCustomerId] = useState(event?.customer_id ?? "");
  const [status, setStatus] = useState(event?.status ?? "pendente");
  const [responsibleId, setResponsibleId] = useState(event?.responsible_id ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title, type, event_date: eventDate, event_time: eventTime || null,
          duration_minutes: duration ? Number(duration) : null,
          location: location || null, customer_id: customerId || null,
          status, responsible_id: responsibleId || null, notes: notes || null,
        });
      }}>
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Hora</Label>
            <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duração (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" />
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Localização</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Morada ou local..." />
        </div>
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
