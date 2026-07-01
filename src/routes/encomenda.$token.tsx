import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CheckCircle2, XCircle, MessageSquare, Calendar, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/encomenda/$token")({ component: PublicOrderPage });

const STATUS_PT: Record<string, string> = {
  rascunho: "Rascunho",
  pendente_aprovacao: "A aguardar aprovação",
  alteracoes_pedidas: "Alterações pedidas",
  aprovada_envio: "Aprovada",
  enviada_cliente: "Enviada",
  vista_pelo_cliente: "Em análise",
  em_negociacao: "Em negociação",
  confirmada: "Confirmada ✓",
  cancelada: "Cancelada",
  convertida_venda: "Concluída",
  arquivada: "Arquivada",
};

type OrderData = {
  id: string; order_number: string; status: string; total: number;
  signal_amount: number; event_date: string | null; location: string | null;
  client_notes: string | null; delivery_date: string | null;
  workspace_name: string; expires_at: string;
};

function PublicOrderPage() {
  const { token } = Route.useParams();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [actionSent, setActionSent] = useState<string | null>(null);
  const [actionStep, setActionStep] = useState<"menu" | "comment" | "date" | null>(null);
  const [actionType, setActionType] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [comment, setComment] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedLocation, setProposedLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const verifyPin = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("verify_order_pin", {
      _token: token, _pin: pin,
    });
    setLoading(false);
    if (err) { setError("Erro ao verificar PIN. Tenta novamente."); return; }
    const result = data as any;
    if (!result) { setError("Encomenda não encontrada."); return; }
    if (result.error === "expired") { setError("Este link expirou. Pede um novo link ao responsável."); return; }
    if (result.error === "locked") {
      const until = new Date(result.locked_until);
      setLockedUntil(until.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
      setError("PIN bloqueado temporariamente por demasiadas tentativas erradas.");
      return;
    }
    if (result.error === "wrong_pin") { setError("PIN incorreto. Verifica e tenta novamente."); setPin(""); return; }
    setOrderData(result);
  };

  const sendAction = async (type: string) => {
    setSubmitting(true);
    const { data, error: err } = await supabase.rpc("submit_client_action", {
      _token: token, _pin: pin, _action: type,
      _comment: comment || null,
      _proposed_date: proposedDate || null,
      _proposed_location: proposedLocation || null,
      _client_name: clientName || null,
    });
    setSubmitting(false);
    if (err || !(data as any)?.success) {
      setError("Erro ao enviar ação. Tenta novamente.");
      return;
    }
    setActionSent(type);
    setActionStep(null);
  };

  if (actionSent) {
    const msgs: Record<string, { title: string; desc: string; color: string }> = {
      confirmou: { title: "Encomenda confirmada!", desc: "Obrigado! A tua encomenda foi confirmada com sucesso.", color: "text-green-600" },
      cancelou: { title: "Encomenda cancelada.", desc: "A encomenda foi cancelada. Contacta-nos se precisares de ajuda.", color: "text-red-600" },
      pediu_alteracao: { title: "Pedido de alteração enviado.", desc: "O responsável vai analisar o teu pedido e entrar em contacto.", color: "text-yellow-600" },
      comentou: { title: "Comentário enviado!", desc: "O responsável vai receber o teu comentário.", color: "text-blue-600" },
      proposta_data: { title: "Proposta enviada!", desc: "A proposta de data foi enviada. Aguarda confirmação.", color: "text-purple-600" },
    };
    const m = msgs[actionSent] ?? { title: "Ação enviada!", desc: "A tua ação foi registada.", color: "text-foreground" };
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <CheckCircle2 className={`mx-auto size-12 ${m.color}`} />
          <h2 className={`text-xl font-bold ${m.color}`}>{m.title}</h2>
          <p className="text-muted-foreground">{m.desc}</p>
          <Button variant="outline" onClick={() => { setActionSent(null); setActionStep(null); setComment(""); setProposedDate(""); setProposedLocation(""); }}>
            Voltar à encomenda
          </Button>
        </Card>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold">Consultar encomenda</h1>
            <p className="text-sm text-muted-foreground">Introduz o PIN de 4 dígitos que recebeste</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={4}
              pattern={REGEXP_ONLY_DIGITS}
              value={pin}
              onChange={(v) => { setPin(v); setError(null); }}
              onComplete={verifyPin}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
                {error}
                {lockedUntil && <div className="mt-1 text-xs">Podes tentar novamente às {lockedUntil}</div>}
              </div>
            )}
            <Button className="w-full" onClick={verifyPin} disabled={pin.length !== 4 || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Ver encomenda"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <h1 className="text-lg font-bold">{orderData.workspace_name}</h1>
          <p className="text-sm text-muted-foreground">Detalhe da encomenda</p>
        </div>

        <Card className="p-5 space-y-4">
          {/* Número e estado */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs text-muted-foreground">Encomenda</span>
              <div className="font-mono font-bold">{orderData.order_number}</div>
            </div>
            <Badge className="capitalize">
              {STATUS_PT[orderData.status] ?? orderData.status}
            </Badge>
          </div>

          {/* Detalhes */}
          <div className="grid gap-2 text-sm border-t border-border pt-3">
            {orderData.event_date && (
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground shrink-0" />
                <span>{new Date(orderData.event_date).toLocaleString("pt-PT")}</span>
              </div>
            )}
            {orderData.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span>{orderData.location}</span>
              </div>
            )}
          </div>

          {/* Valor */}
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="font-medium">Total</span>
            <span className="font-mono text-lg font-bold">€{Number(orderData.total).toFixed(2)}</span>
          </div>
          {orderData.signal_amount > 0 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Sinal / Reserva</span>
              <span className="font-mono">€{Number(orderData.signal_amount).toFixed(2)}</span>
            </div>
          )}

          {/* Notas para cliente */}
          {orderData.client_notes && (
            <div className="rounded-md bg-muted/50 p-3 text-sm border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Nota do responsável</p>
              <p>{orderData.client_notes}</p>
            </div>
          )}
        </Card>

        {/* Ações do cliente */}
        {!["cancelada", "convertida_venda"].includes(orderData.status) && (
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">O que queres fazer?</h3>

            {/* Nome do cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs">O teu nome (opcional)</Label>
              <Input
                placeholder="Como te chamas?"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {actionStep === null && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white h-10"
                  onClick={() => { setActionType("confirmou"); sendAction("confirmou"); }}
                  disabled={submitting}
                >
                  <CheckCircle2 className="size-4" /> Confirmar
                </Button>
                <Button
                  variant="destructive" className="h-10"
                  onClick={() => { setActionType("cancelou"); sendAction("cancelou"); }}
                  disabled={submitting}
                >
                  <XCircle className="size-4" /> Recusar
                </Button>
                <Button
                  variant="outline" className="h-10"
                  onClick={() => { setActionStep("comment"); setActionType("pediu_alteracao"); }}
                  disabled={submitting}
                >
                  Pedir alteração
                </Button>
                <Button
                  variant="outline" className="h-10"
                  onClick={() => { setActionStep("date"); setActionType("proposta_data"); }}
                  disabled={submitting}
                >
                  <Calendar className="size-4" /> Propor data
                </Button>
                <Button
                  variant="outline" className="col-span-2 h-10"
                  onClick={() => { setActionStep("comment"); setActionType("comentou"); }}
                  disabled={submitting}
                >
                  <MessageSquare className="size-4" /> Comentar
                </Button>
              </div>
            )}

            {actionStep === "comment" && (
              <div className="space-y-3">
                <Textarea
                  placeholder={actionType === "pediu_alteracao" ? "Descreve as alterações que precisas..." : "Escreve o teu comentário..."}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setActionStep(null)}>Cancelar</Button>
                  <Button className="flex-1" onClick={() => sendAction(actionType)} disabled={submitting}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : "Enviar"}
                  </Button>
                </div>
              </div>
            )}

            {actionStep === "date" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nova data/hora proposta</Label>
                  <Input type="datetime-local" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Local (opcional)</Label>
                  <Input placeholder="Morada ou local..." value={proposedLocation} onChange={(e) => setProposedLocation(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nota (opcional)</Label>
                  <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Motivo da alteração..." />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setActionStep(null)}>Cancelar</Button>
                  <Button className="flex-1" onClick={() => sendAction("proposta_data")} disabled={submitting || !proposedDate}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : "Enviar proposta"}
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          Link válido até {new Date(orderData.expires_at).toLocaleDateString("pt-PT")}
        </p>
      </div>
    </div>
  );
}
