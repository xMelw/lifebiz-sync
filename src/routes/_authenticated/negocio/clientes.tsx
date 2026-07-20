import { useState } from "react";
import { ArchiveConfirmDialog } from "@/components/shared/ui-helpers";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Archive, User, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";

export const Route = createFileRoute("/_authenticated/negocio/clientes")({ component: ClientesPage });

const CHANNELS = ["WhatsApp", "Telefone", "Email", "Instagram", "Outro"];

function ClientesPage() {
  const { membership, canAccessNegocio, canWrite, isManager } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["clientes", wsId, showArchived],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const q = supabase.from("customers").select("*").eq("workspace_id", wsId!);
      if (!showArchived) q.eq("status", "active");
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientHistory } = useQuery({
    queryKey: ["client-history", selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const [ordersRes, salesRes] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, total, created_at, priority")
          .eq("customer_id", selectedClient!).order("created_at", { ascending: false }),
        supabase.from("sales").select("id, date, total, status, origin")
          .eq("customer_id", selectedClient!).order("date", { ascending: false }),
      ]);
      return {
        orders: ordersRes.data ?? [],
        sales: salesRes.data ?? [],
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["clientes", wsId] });

  const upsertCustomer = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { error } = await supabase.from("customers").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...p, workspace_id: wsId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(editClient ? "Cliente atualizado" : "Cliente criado");
      setOpen(false); setEditClient(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers")
        .update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Cliente arquivado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers")
        .update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Cliente restaurado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const filtered = (customers ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const selectedData = selectedClient ? (customers ?? []).find((c) => c.id === selectedClient) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        subtitle={`${(customers ?? []).filter((c) => c.status === "active").length} ativos`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditClient(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Novo cliente</Button>
              </DialogTrigger>
              <CustomerFormDialog
                customer={editClient}
                onSubmit={(p) => upsertCustomer.mutate(p)}
              />
            </Dialog>
          )
        }
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, telefone ou email..."
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm"
          onClick={() => setShowArchived(!showArchived)}>
          <Archive className="size-4" /> {showArchived ? "Ocultar arquivados" : "Arquivados"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {search ? "Nenhum cliente encontrado." : "Sem clientes. Cria o primeiro."}
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className={`p-3 cursor-pointer hover:bg-accent/30 transition-colors ${c.status === "archived" ? "opacity-60" : ""}`}
              onClick={() => setSelectedClient(c.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{c.name}</span>
                    {c.status === "archived" && <Badge variant="outline" className="text-xs">Arquivado</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail className="size-3" />{c.email}</span>}
                    {c.preferred_channel && <Badge variant="outline" className="text-xs">{c.preferred_channel}</Badge>}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => {
                      setEditClient(c); setOpen(true);
                    }}>✎</Button>
                    {c.status === "active" ? (
                      <ArchiveConfirmDialog onConfirm={() => archiveCustomer.mutate(c.id)}>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Archive className="size-3.5 text-muted-foreground" /></Button>
                  </ArchiveConfirmDialog>
                    ) : (
                      <Button size="icon" variant="ghost" className="size-7"
                        onClick={() => restoreCustomer.mutate(c.id)}>↩</Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Sheet detalhe + histórico */}
      <Sheet open={!!selectedClient} onOpenChange={(v) => { if (!v) setSelectedClient(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedData && (
            <div className="space-y-4 pt-2">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="size-5" /> {selectedData.name}
                </SheetTitle>
              </SheetHeader>

              {/* Info cliente */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedData.phone && <div><span className="text-muted-foreground">Telefone</span><div>{selectedData.phone}</div></div>}
                {selectedData.email && <div><span className="text-muted-foreground">Email</span><div>{selectedData.email}</div></div>}
                {selectedData.preferred_channel && <div><span className="text-muted-foreground">Canal preferido</span><div>{selectedData.preferred_channel}</div></div>}
                {selectedData.address && <div className="col-span-2"><span className="text-muted-foreground">Morada</span><div>{selectedData.address}</div></div>}
                {selectedData.notes && <div className="col-span-2"><span className="text-muted-foreground">Notas</span><div className="text-muted-foreground">{selectedData.notes}</div></div>}
              </div>

              {/* Histórico */}
              <Tabs defaultValue="orders">
                <TabsList className="w-full">
                  <TabsTrigger value="orders" className="flex-1">
                    Encomendas ({clientHistory?.orders.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="flex-1">
                    Vendas ({clientHistory?.sales.length ?? 0})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="orders" className="mt-3">
                  {(clientHistory?.orders ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem encomendas.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientHistory!.orders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                          <div>
                            <span className="font-mono text-xs text-muted-foreground">{o.order_number}</span>
                            <span className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[10px] ${o.priority === "urgente" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                              {o.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(o.created_at).toLocaleDateString("pt-PT")}
                            </span>
                            <span className="font-mono">€{Number(o.total).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="sales" className="mt-3">
                  {(clientHistory?.sales ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem vendas.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientHistory!.sales.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                          <div>
                            <Badge variant="outline" className="text-xs">{s.origin}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(s.date).toLocaleDateString("pt-PT")}
                            </span>
                            <span className="font-mono">€{Number(s.total).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CustomerFormDialog({ customer, onSubmit }: { customer: any; onSubmit: (p: any) => void }) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [preferredChannel, setPreferredChannel] = useState(customer?.preferred_channel ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id: customer?.id, name, phone: phone || null, email: email || null, address: address || null, preferred_channel: preferredChannel || null, notes: notes || null });
      }}>
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351..." />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Canal preferido</Label>
          <Select value={preferredChannel} onValueChange={setPreferredChannel}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Morada</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit">{customer ? "Guardar" : "Criar cliente"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
