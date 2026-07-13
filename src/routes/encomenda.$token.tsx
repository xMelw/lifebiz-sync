import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CheckCircle2, XCircle, MessageSquare, Calendar, MapPin, Loader2, Lock, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/encomenda/$token")({ component: PublicOrderPage });

const STATUS_PT: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Em preparação", color: "text-muted-foreground" },
  pendente_aprovacao: { label: "A aguardar", color: "text-yellow-600" },
  alteracoes_pedidas: { label: "Alterações pedidas", color: "text-orange-600" },
  aprovada_envio: { label: "Aprovada ✓", color: "text-blue-600" },
  enviada_cliente: { label: "Enviada", color: "text-blue-600" },
  vista_pelo_cliente: { label: "Em análise", color: "text-purple-600" },
  em_negociacao: { label: "Em negociação", color: "text-yellow-600" },
  confirmada: { label: "Confirmada ✓", color: "text-green-600" },
  cancelada: { label: "Cancelada", color: "text-destructive" },
  convertida_venda: { label: "Concluída ✓", color: "text-green-600" },
};

type OrderData = {
  id: string; order_number: string; status: string; total: number;
  signal_amount: number; event_date: string | null; location: string | null;
  client_notes: string | null; workspace_name: string; expires_at: string;
};

function PublicOrderPage() {
  const { token } = Route.useParams();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [actionSent, setActionSent] = useState<string | null>(null);
  const [actionStep, setActionStep] = useState<"menu" | "comment" | "date" | null>("menu");
  const [actionType, setActionType] = useState("");
  const [clientName, setClientName] = useState("");
  const [comment, setComment] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedLocation, setProposedLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const verifyPin = async () => {
    if (pin.length !== 4) return;
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.rpc("verify_order_pin", { _token: token, _pin: pin });
    setLoading(false);
    if (err) { setError("Erro ao verificar PIN."); return; }
    const result = data as any;
    if (!result) { setError("Encomenda não encontrada."); return; }
    if (result.error === "expired") { setError("Este link expirou. Contacta o responsável para obter um novo link."); return; }
    if (result.error === "locked") {
      const until = new Date(result.locked_until);
      setLockedUntil(until.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
      setError("PIN bloqueado por demasiadas tentativas."); return;
    }
    if (result.error === "wrong_pin") { setError("PIN incorreto. Verifica e tenta novamente."); setPin(""); return; }
    setOrderData(result);
  };

  const sendAction = async (type: string) => {
    setSubmitting(true);
    const { data, error: err } = await supabase.rpc("submit_client_action", {
      _token: token, _pin: pin, _action: type,
      _comment: comment || undefined, _proposed_date: proposedDate || undefined,
      _proposed_location: proposedLocation || undefined, _client_name: clientName || undefined,
    });
    setSubmitting(false);
    if (err || !(data as any)?.success) { setError("Erro ao enviar. Tenta novamente."); return; }
    setActionSent(type);
  };

  // Resultado de ação enviada
  if (actionSent) {
    const msgs: Record<string, { title: string; desc: string; icon: typeof CheckCircle2; color: string }> = {
      confirmou: { title: "Encomenda confirmada!", desc: "Obrigado! A tua confirmação foi registada com sucesso.", icon: CheckCircle2, color: "text-green-600" },
      cancelou: { title: "Encomenda recusada.", desc: "A recusa foi registada. Contacta-nos se precisares de ajuda.", icon: XCircle, color: "text-destructive" },
      pediu_alteracao: { title: "Pedido enviado.", desc: "O responsável vai analisar e entrar em contacto.", icon: MessageSquare, color: "text-yellow-600" },
      comentou: { title: "Comentário enviado.", desc: "O responsável recebeu o teu comentário.", icon: MessageSquare, color: "text-blue-600" },
      proposta_data: { title: "Proposta enviada!", desc: "A proposta de nova data foi enviada. Aguarda confirmação.", icon: Calendar, color: "text-purple-600" },
    };
    const m = msgs[actionSent] ?? { title: "Enviado!", desc: "A tua ação foi registada.", icon: CheckCircle2, color: "text-foreground" };
    const Icon = m.icon;
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-xl p-8 text-center space-y-4">
          <div className={`mx-auto grid size-16 place-items-center rounded-full bg-muted ${m.color}`}>
            <Icon className="size-8" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className={`font-display text-xl font-bold ${m.color}`}>{m.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => { setActionSent(null); setActionStep("menu"); setComment(""); setProposedDate(""); setProposedLocation(""); }}>
            Voltar à encomenda
          </Button>
        </div>
      </div>
    );
  }

  // PIN screen
  if (!orderData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-foreground/5 ring-1 ring-border/60">
              <Lock className="size-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-2xl font-bold">Consultar encomenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">Introduz o PIN de 4 dígitos que recebeste</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card shadow-xl p-8 space-y-6">
            <div className="flex flex-col items-center gap-5">
              <InputOTP maxLength={4} pattern={REGEXP_ONLY_DIGITS} value={pin}
                onChange={(v) => { setPin(v); setError(null); }} onComplete={verifyPin}>
                <InputOTPGroup className="gap-3">
                  {[0,1,2,3].map(i => (
                    <InputOTPSlot key={i} index={i} className="h-14 w-14 text-xl rounded-xl border-border/70" />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {error && (
                <div className="w-full flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm text-destructive">
                    {error}
                    {lockedUntil && <div className="mt-0.5 text-xs opacity-80">Tenta novamente às {lockedUntil}</div>}
                  </div>
                </div>
              )}

              <Button className="w-full h-11 text-base font-semibold" onClick={verifyPin} disabled={pin.length !== 4 || loading}>
                {loading ? <Loader2 className="size-5 animate-spin" /> : "Aceder à encomenda"}
              </Button>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground/60">Powered by LifeBiz</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_PT[orderData.status] ?? { label: orderData.status, color: "text-muted-foreground" };
  const isFinal = ["cancelada", "convertida_venda"].includes(orderData.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 p-4 pb-10">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="pt-6 pb-2 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-foreground/5 ring-1 ring-border/60">
            <span className="font-display text-lg font-bold">{orderData.workspace_name.charAt(0)}</span>
          </div>
          <h1 className="font-display text-xl font-bold">{orderData.workspace_name}</h1>
          <p className="text-sm text-muted-foreground">Detalhe da encomenda</p>
        </div>

        {/* Card principal */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
          {/* Cabeçalho do card */}
          <div className="border-b border-border/60 bg-muted/30 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Encomenda</p>
              <p className="font-display text-lg font-bold money">{orderData.order_number}</p>
            </div>
            <span className={`font-semibold text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Detalhes */}
            {(orderData.event_date || orderData.location) && (
              <div className="space-y-2">
                {orderData.event_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="size-4 text-muted-foreground shrink-0" />
                    <span>{new Date(orderData.event_date).toLocaleString("pt-PT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                {orderData.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-muted-foreground shrink-0" />
                    <span>{orderData.location}</span>
                  </div>
                )}
              </div>
            )}

            {/* Totais */}
            <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-xl font-bold money">€{Number(orderData.total).toFixed(2)}</span>
              </div>
              {orderData.signal_amount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Sinal pago</span>
                  <span className="money text-green-600">€{Number(orderData.signal_amount).toFixed(2)}</span>
                </div>
              )}
              {orderData.signal_amount > 0 && (
                <div className="flex justify-between items-center text-sm border-t border-border/60 pt-1.5">
                  <span className="text-muted-foreground">Restante</span>
                  <span className="money font-semibold">€{Math.max(Number(orderData.total) - Number(orderData.signal_amount), 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Notas para cliente */}
            {orderData.client_notes && (
              <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary/70 mb-1">Nota do responsável</p>
                <p className="text-sm">{orderData.client_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        {!isFinal && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
            <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
              <h3 className="font-semibold text-sm">O que queres fazer?</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O teu nome</Label>
                <Input placeholder="Como te chamas? (opcional)" value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-9" />
              </div>

              {actionStep === "menu" && (
                <div className="space-y-2">
                  <Button className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold" onClick={() => sendAction("confirmou")} disabled={submitting}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <><CheckCircle2 className="size-4" /> Confirmar encomenda</>}
                  </Button>
                  <Button variant="destructive" className="w-full h-11 font-semibold" onClick={() => sendAction("cancelou")} disabled={submitting}>
                    <XCircle className="size-4" /> Recusar
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-10" onClick={() => { setActionStep("comment"); setActionType("pediu_alteracao"); }} disabled={submitting}>
                      Pedir alteração
                    </Button>
                    <Button variant="outline" className="h-10" onClick={() => { setActionStep("date"); setActionType("proposta_data"); }} disabled={submitting}>
                      <Calendar className="size-4" /> Nova data
                    </Button>
                    <Button variant="outline" className="col-span-2 h-10" onClick={() => { setActionStep("comment"); setActionType("comentou"); }} disabled={submitting}>
                      <MessageSquare className="size-4" /> Comentar
                    </Button>
                  </div>
                </div>
              )}

              {actionStep === "comment" && (
                <div className="space-y-3">
                  <Textarea
                    placeholder={actionType === "pediu_alteracao" ? "Descreve as alterações que precisas…" : "Escreve o teu comentário…"}
                    value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setActionStep("menu")}>Voltar</Button>
                    <Button className="flex-1 font-semibold" onClick={() => sendAction(actionType)} disabled={submitting}>
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : "Enviar"}
                    </Button>
                  </div>
                </div>
              )}

              {actionStep === "date" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova data/hora</Label>
                    <Input type="datetime-local" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Local (opcional)</Label>
                    <Input placeholder="Morada ou local…" value={proposedLocation} onChange={(e) => setProposedLocation(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motivo (opcional)</Label>
                    <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className="resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setActionStep("menu")}>Voltar</Button>
                    <Button className="flex-1 font-semibold" onClick={() => sendAction("proposta_data")} disabled={submitting || !proposedDate}>
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : "Enviar proposta"}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/50 pb-4">
          Link válido até {new Date(orderData.expires_at).toLocaleDateString("pt-PT")} · Powered by LifeBiz
        </p>
      </div>
    </div>
  );
}
