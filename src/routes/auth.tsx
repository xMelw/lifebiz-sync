import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Home, Briefcase, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Casa & Negócio" },
      { name: "description", content: "Acede ao teu workspace de Casa e Negócio." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const goNext = () => {
    if (next) window.location.assign(next);
    else router.navigate({ to: "/" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) goNext();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, next]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const returnTo = next ? `${window.location.origin}${next}` : window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: returnTo,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada. Já podes entrar.");
  };

  const handleGoogle = async () => {
    const returnTo = next ? `${window.location.origin}${next}` : window.location.origin;
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: returnTo });
    if (res.error) toast.error((res.error as Error).message ?? "Erro a entrar com Google");
  };

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      {/* Lado esquerdo — branding */}
      <div className="relative hidden overflow-hidden md:flex md:flex-col md:justify-between md:p-12">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in oklch, var(--color-primary) 70%, black) 100%)",
          }}
        />
        {/* Grid pattern subtil */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary-foreground/15 backdrop-blur ring-1 ring-primary-foreground/20">
              <Sparkles className="size-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Casa &amp; Negócio
            </span>
          </div>
        </div>

        <div className="max-w-md space-y-5 text-primary-foreground">
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            Gere a tua casa e o teu negócio no mesmo sítio.
          </h1>
          <p className="text-sm leading-relaxed text-primary-foreground/85">
            Stock, encomendas, vendas, despesas e equipa — uma ferramenta calma,
            prática, para o dia a dia.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-medium ring-1 ring-primary-foreground/20 backdrop-blur">
              <Home className="size-3.5" /> Casa
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-medium ring-1 ring-primary-foreground/20 backdrop-blur">
              <Briefcase className="size-3.5" /> Negócio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="size-3.5" />
          Dados encriptados, respeito pela tua privacidade.
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex items-center justify-center px-4 py-10 md:p-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-foreground text-background">
              <Sparkles className="size-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Casa &amp; Negócio
            </span>
          </div>

          <Card className="border-border/60 shadow-xl shadow-foreground/[0.04]">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="font-display text-xl font-semibold">Bem-vindo</CardTitle>
              <CardDescription>Entra na tua conta ou cria uma nova.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                className="mb-4 w-full h-10 font-medium"
                onClick={handleGoogle}
              >
                <GoogleIcon className="size-4" />
                Continuar com Google
              </Button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/70" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    ou com email
                  </span>
                </div>
              </div>

              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="si-email" className="text-xs font-medium">Email</Label>
                      <Input
                        id="si-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="si-pw" className="text-xs font-medium">Palavra-passe</Label>
                      <Input
                        id="si-pw"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-10"
                      />
                    </div>
                    <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
                      {loading ? "A entrar…" : "Entrar"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="su-name" className="text-xs font-medium">Nome</Label>
                      <Input
                        id="su-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="O teu nome"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-email" className="text-xs font-medium">Email</Label>
                      <Input
                        id="su-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-pw" className="text-xs font-medium">Palavra-passe</Label>
                      <Input
                        id="su-pw"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={6}
                        required
                        className="h-10"
                      />
                    </div>
                    <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
                      {loading ? "A criar…" : "Criar conta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao continuar aceitas os termos e a política de privacidade.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#4285F4" d="M21.8 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1v.1c3.9 0 6.9-2.7 6.9-6.5z" opacity=".9" />
    </svg>
  );
}
