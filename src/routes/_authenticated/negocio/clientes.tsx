import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, Mail, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyAccess } from "../casa/index";

const CHANNELS = ["whatsapp", "telefone", "email", "instagram", "outro"] as const;

export const Route = createFileRoute("/_authenticated/negocio/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const { membership, canAccessNegocio, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["clientes", wsId],
    enabled: !!wsId && canAccessNegocio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (p: {
      name: string;
      phone: string;
      email: string;
      address: string;
      notes: string;
      preferred_channel: string | null;
    }) => {
      const { error } = await supabase.from("customers").insert({
        workspace_id: wsId!,
        created_by: userId!,
        ...p,
        preferred_channel: (p.preferred_channel || null) as
          | (typeof CHANNELS)[number]
          | null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes", wsId] });
      toast.success("Cliente criado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAccessNegocio)
    return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Negócio." />;

  const filtered = (data ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        subtitle={`${(data ?? []).length} no total`}
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Novo cliente
                </Button>
              </DialogTrigger>
              <CustomerDialog onSubmit={(p) => create.mutate(p)} />
            </Dialog>
          )
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, telefone ou email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q ? "Sem resultados." : "Sem clientes. Cria o primeiro."}
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.preferred_channel && (
                      <Badge variant="secondary" className="capitalize">
                        {c.preferred_channel}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {c.email}
                      </span>
                    )}
                    {c.notes && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3" /> {c.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerDialog({
  onSubmit,
}: {
  onSubmit: (p: {
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    preferred_channel: string | null;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState<string>("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo cliente</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            phone,
            email,
            address,
            notes,
            preferred_channel: channel || null,
          });
        }}
      >
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Morada</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Canal preferido</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
