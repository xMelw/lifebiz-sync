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
import { Home, Briefcase } from "lucide-react";

export const Route = createFileRoute("/auth")({
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
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) router.navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada. Já podes entrar.");
  };

  const handleGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) toast.error((res.error as Error).message ?? "Erro a entrar com Google");
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
        <div className="font-display text-2xl font-semibold tracking-tight">Casa & Negócio</div>
        <div className="space-y-4">
          <h1 className="font-display text-4xl font-medium leading-tight">
            Gere a tua casa e o teu negócio no mesmo sítio.
          </h1>
          <p className="max-w-sm text-sm opacity-80">
            Stock, despesas, clientes, vendas e equipa — uma ferramenta calma, prática, para o dia
            a dia.
          </p>
          <div className="flex gap-2 pt-4 text-xs opacity-80">
            <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1">
              <Home className="size-3.5" /> Casa
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1">
              <Briefcase className="size-3.5" /> Negócio
            </span>
          </div>
        </div>
        <div className="text-xs opacity-60">© Casa & Negócio</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md border-border">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Bem-vindo</CardTitle>
            <CardDescription>Entra na tua conta ou cria uma nova.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="mb-4 w-full" onClick={handleGoogle}>
              Continuar com Google
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">ou com email</span>
              </div>
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pw">Palavra-passe</Label>
                    <Input
                      id="si-pw"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Entrar
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Nome</Label>
                    <Input
                      id="su-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="O teu nome"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pw">Palavra-passe</Label>
                    <Input
                      id="su-pw"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
