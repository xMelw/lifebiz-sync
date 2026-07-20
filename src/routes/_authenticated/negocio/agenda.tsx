import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Calendar, MapPin, Clock, User, AlertTriangle, Trash2, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";
import { EmptyState, DialogHeader2, DialogFooter2, LoadingSkeleton, KpiCard } from "@/components/shared/ui-helpers";

export const Route = createFileRoute("/_authenticated/negocio/agenda")({ component: AgendaPage });

const TYPE_META: Record<string, { label: string; cls: string }> = {
  venda_marcada: { label: "Venda",        cls: "status-pill-success" },
  entrega:       { label: "Entrega",      cls: "status-pill-info" },
  lembrete:      { label: "Lembrete",     cls: "status-pill-warning" },
  compra_stock:  { label: "Stock",        cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 status-pill" },
  encomenda:     { label: "Encomenda",    cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 status-pill" },
};

const STATUS_META: Record<string, { label: string; variant: "default"|"secondary"|"outline"|"destructive" }> = {
  pendente:   { label: "Pendente",  variant: "outline" },
  confirmado: { label: "Confirmado",variant: "default" },
  concluido:  { label: "Concluído", variant: "secondary" },
  cancelado:  { label: "Cancelado", variant: "destructive" },
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

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar-events", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*, customers(name), orders(order_number)")
        .eq("workspace_id", wsId!)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["clientes-list", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const { data: clientProposals } = useQuery({
    queryKey: ["client-proposals", wsId],
    enabled: !!wsId && isManager,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_client_actions")
        .select("*, orders(order_number, id)")
        .eq("action", "proposta_data")
        .order("created_at", { ascending: false });
      return (data ?? []).filter((p: any) => p.proposed_date && new Date(p.proposed_date) > new Date());
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar-events", wsId] });

  const upsertEvent = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("calendar_events").update(rest).eq("id", id);
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
    pending: allEvents.filter(e => e.status === "pendente").length,
    confirmed: allEvents.filter(e => e.status === "confirmado").length,
    today: allEvents.filter(e => new Date(e.event_date).toDateString() === today.toDateString()).length,
  };

  // Group events by date for a nicer timeline
  const grouped: Record<string, typeof filtered> = {};
  for (const ev of filtered) {
    const key = ev.event_date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="Agenda"
        subtitle={`${stats.total} evento${stats.total !== 1 ? "s" : ""}`}
        action={canWrite && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditEvent(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Novo evento</Button>
            </DialogTrigger>
            <EventFormDialog event={editEvent} customers={customers ?? []} onSubmit={(p) => upsertEvent.mutate(p)} />
          </Dialog>
        )}
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="Pendentes" value={stats.pending} tone={stats.pending > 0 ? "warning" : "neutral"} />
        <KpiCard label="Confirmados" value={stats.confirmed} tone="success" />
        <KpiCard label="Hoje" value={stats.today} tone={stats.today > 0 ? "success" : "neutral"} />
      </div>

      {/* Propostas pendentes do cliente */}
      {isManager && (clientProposals ?? []).length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-400/40 bg-yellow-50/60 dark:bg-yellow-900/10 px-4 py-3">
          <AlertTriangle className="size-4 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              {clientProposals!.length} proposta{clientProposals!.length > 1 ? "s" : ""} de data de cliente pendente{clientProposals!.length > 1 ? "s" : ""}
            </p>
            <div className="mt-1 space-y-0.5">
              {clientProposals!.map((p: any) => (
                <p key={p.id} className="text-xs text-yellow-700 dark:text-yellow-400">
                  {(p.orders as any)?.order_number ?? "Encomenda"} — {new Date(p.proposed_date).toLocaleString("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {p.client_name ? ` (por ${p.client_name})` : ""}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filterDate} onValueChange={setFilterDate}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Próximos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista agrupada por data */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Calendar} title="Sem eventos" description="Adiciona o primeiro evento à agenda." />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, evs]) => {
            const d = new Date(date);
            const isToday = d.toDateString() === today.toDateString();
            const isTomorrow = d.toDateString() === new Date(today.getTime() + 86400000).toDateString();
            const label = isToday ? "Hoje" : isTomorrow ? "Amanhã"
              : d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });

            return (
              <div key={date}>
                <div className={`mb-2 flex items-center gap-2 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  <Calendar className="size-3.5" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-primary" : ""}`}>
                    {label}
                  </span>
                  <span className="text-xs">({evs.length})</span>
                </div>
                <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                  {evs.map((ev) => {
                    const typeMeta = TYPE_META[ev.type] ?? { label: ev.type, cls: "status-pill-neutral" };
                    const statusMeta = STATUS_META[ev.status] ?? { label: ev.status, variant: "outline" as const };
                    const customerName = (ev.customers as any)?.name;
                    const orderNum = (ev.orders as any)?.order_number;
                    return (
                      <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        {/* Hora */}
                        <div className="w-12 shrink-0 text-right">
                          {ev.event_time ? (
                            <span className="text-xs font-mono font-medium text-muted-foreground">{ev.event_time.slice(0,5)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </div>
                        {/* Linha vertical */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className={`size-2.5 rounded-full mt-1 ${ev.status === "confirmado" ? "bg-primary" : ev.status === "cancelado" ? "bg-destructive/50" : ev.status === "concluido" ? "bg-muted-foreground" : "bg-border"}`} />
                          <div className="w-px flex-1 bg-border/60 min-h-[1rem]" />
                        </div>
                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{ev.title}</span>
                            <span className={typeMeta.cls}>{typeMeta.label}</span>
                            <Badge variant={statusMeta.variant} className="text-[10px] capitalize">{statusMeta.label}</Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {ev.duration_minutes && <span className="flex items-center gap-1"><Clock className="size-3" />{ev.duration_minutes}min</span>}
                            {ev.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{ev.location}</span>}
                            {customerName && <span className="flex items-center gap-1"><User className="size-3" />{customerName}</span>}
                            {orderNum && <span className="font-mono">{orderNum}</span>}
                          </div>
                          {ev.notes && <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-1">{ev.notes}</p>}
                        </div>
                        {/* Acções */}
                        {canWrite && (
                          <div className="flex items-center gap-1 shrink-0">
                            {ev.status === "pendente" && isManager && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Confirmar"
                                onClick={() => updateStatus.mutate({ id: ev.id, status: "confirmado" })}>
                                <CheckCircle2 className="size-3.5 text-green-600" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => { setEditEvent(ev); setOpen(true); }}>
                              <Pencil className="size-3.5" />
                            </Button>
                            {isManager && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7">
                                    <Trash2 className="size-3.5 text-destructive/70" />
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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editEvent && (
        <Dialog open={!!editEvent} onOpenChange={(v) => { if (!v) { setEditEvent(null); } }}>
          <EventFormDialog event={editEvent} customers={customers ?? []} onSubmit={(p) => upsertEvent.mutate({ ...p, id: editEvent.id })} />
        </Dialog>
      )}
    </div>
  );
}

function EventFormDialog({ event, customers, onSubmit }: {
  event: any; customers: any[]; onSubmit: (p: any) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState(event?.type ?? "lembrete");
  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [eventTime, setEventTime] = useState(event?.event_time?.slice(0, 5) ?? "");
  const [duration, setDuration] = useState(String(event?.duration_minutes ?? ""));
  const [location, setLocation] = useState(event?.location ?? "");
  const [customerId, setCustomerId] = useState(event?.customer_id ?? "");
  const [status, setStatus] = useState(event?.status ?? "pendente");
  const [notes, setNotes] = useState(event?.notes ?? "");

  return (
    <DialogContent className="max-w-lg gap-0 p-0">
      <DialogHeader2 title={event ? "Editar evento" : "Novo evento"} />
      <form className="space-y-3 px-6 py-5" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, type, event_date: eventDate, event_time: eventTime || null, duration_minutes: duration ? Number(duration) : null, location: location || null, customer_id: customerId || null, status, notes: notes || null });
      }}>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título *</Label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data *</Label>
            <Input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hora</Label>
            <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duração (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Morada ou local…" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notas</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none" />
        </div>
        <DialogFooter2>
          <Button type="submit" className="h-10 px-6 font-semibold">Guardar evento</Button>
        </DialogFooter2>
      </form>
    </DialogContent>
  );
}
