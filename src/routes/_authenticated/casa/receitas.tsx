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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyAccess } from "@/components/shared/page-components";
import { EmptyState, DialogHeader2, DialogFooter2 } from "@/components/shared/ui-helpers";
import {
  ChefHat, Search, Plus, ShoppingCart, Check, X, Clock,
  Minus, Users, BookOpen, Trash2
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/casa/receitas")({ component: ReceitasPage });

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  todos:           { label: "Todas",          emoji: "🍽️" },
  pequeno_almoco:  { label: "Pequeno-almoço", emoji: "☀️" },
  almoco:          { label: "Almoço",         emoji: "🌿" },
  jantar:          { label: "Jantar",         emoji: "🌙" },
  sopa:            { label: "Sopa",           emoji: "🍲" },
  snack:           { label: "Snack",          emoji: "🥨" },
  sobremesa:       { label: "Sobremesa",      emoji: "🍰" },
  outro:           { label: "Outro",          emoji: "📌" },
};

const GLOBAL_WS = "00000000-0000-0000-0000-000000000001";

function ReceitasPage() {
  const { membership, canAccessCasa, canWrite, userId } = useWorkspace();
  const wsId = membership?.workspace_id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("todos");
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [shoppingList, setShoppingList] = useState<{ name: string; qty: number; unit: string; have: boolean }[] | null>(null);

  const { data: recipes } = useQuery({
    queryKey: ["recipes", wsId],
    enabled: !!wsId && canAccessCasa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*, recipe_ingredients(*)")
        .or(`workspace_id.eq.${wsId},workspace_id.eq.${GLOBAL_WS}`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stock } = useQuery({
    queryKey: ["casa-stock", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("home_stock_items")
        .select("name, quantity, unit, min_stock")
        .eq("workspace_id", wsId!).eq("status", "active");
      return data ?? [];
    },
  });

  const createRecipe = useMutation({
    mutationFn: async (p: { name: string; description: string; category: string; servings: number; prepMin: number; cookMin: number; instructions: string; ingredients: { name: string; quantity: number; unit: string }[] }) => {
      const { data: rec, error } = await supabase.from("recipes").insert({
        workspace_id: wsId!, created_by: userId!,
        name: p.name, description: p.description, category: p.category,
        servings: p.servings, prep_minutes: p.prepMin || null, cook_minutes: p.cookMin || null,
        instructions: p.instructions || null,
      }).select("id").single();
      if (error) throw error;
      if (p.ingredients.length) {
        const { error: e2 } = await supabase.from("recipe_ingredients").insert(
          p.ingredients.filter(i => i.name).map(i => ({ recipe_id: rec.id, name: i.name, quantity: i.quantity || null, unit: i.unit || null }))
        );
        if (e2) throw e2;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes", wsId] }); toast.success("Receita criada"); setNewOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes", wsId] }); setSelectedRecipe(null); toast.success("Receita eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const buildShoppingList = (recipe: any, servings: number = recipe.servings) => {
    const stockMap = new Map((stock ?? []).map(s => [s.name.toLowerCase(), s]));
    const ingredients: typeof shoppingList = (recipe.recipe_ingredients ?? []).map((ing: any) => {
      const ratio = servings / (recipe.servings || 1);
      const needed = (ing.quantity ?? 0) * ratio;
      const stockItem = stockMap.get(ing.name.toLowerCase());
      const have = stockItem ? Number(stockItem.quantity) >= needed : false;
      return { name: ing.name, qty: needed, unit: ing.unit ?? "", have };
    });
    setShoppingList(ingredients);
  };

  const addMissingToShoppingList = async (missing: typeof shoppingList) => {
    if (!missing || !wsId) return;
    const toAdd = missing.filter(i => !i.have);
    if (!toAdd.length) { toast.success("Tens tudo o que precisas!"); return; }
    const { data: lists } = await supabase.from("shopping_lists")
      .select("id").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(1);
    let listId: string;
    if (lists?.length) {
      listId = lists[0].id;
    } else {
      const { data: newList, error } = await supabase.from("shopping_lists")
        .insert({ workspace_id: wsId, created_by: userId!, name: "Lista de compras" }).select("id").single();
      if (error) { toast.error("Erro ao criar lista"); return; }
      listId = newList.id;
    }
    await supabase.from("shopping_list_items").insert(
      toAdd.map(i => ({ list_id: listId, name: i.name, quantity: i.qty, unit: i.unit }))
    );
    toast.success(`${toAdd.length} produto${toAdd.length !== 1 ? "s" : ""} adicionado${toAdd.length !== 1 ? "s" : ""} à lista de compras`);
    setShoppingList(null);
  };

  if (!canAccessCasa) return <EmptyAccess title="Sem acesso" message="Pede acesso ao modo Casa." />;

  const allRecipes = recipes ?? [];
  const filtered = allRecipes.filter(r => {
    if (filterCat !== "todos" && r.category !== filterCat) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const selectedData = selectedRecipe ? allRecipes.find(r => r.id === selectedRecipe) : null;
  const isOwned = selectedData?.workspace_id === wsId;

  return (
    <div className="space-y-0">
      <PageHeader
        title="Receitas"
        subtitle={`${allRecipes.length} receita${allRecipes.length !== 1 ? "s" : ""}`}
        action={canWrite && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Nova receita</Button></DialogTrigger>
            <NewRecipeDialog onSubmit={(p) => createRecipe.mutate(p)} loading={createRecipe.isPending} />
          </Dialog>
        )}
      />

      {/* Filtro por categoria */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {Object.entries(CATEGORIES).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setFilterCat(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              filterCat === key
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-muted/60 text-muted-foreground ring-border hover:bg-muted"
            }`}
          >
            <span>{meta.emoji}</span>
            {meta.label}
          </button>
        ))}
      </div>

      {/* Pesquisa */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Pesquisar receita…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ChefHat} title="Sem receitas" description="Cria a tua primeira receita personalizada." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(recipe => {
            const ings = (recipe.recipe_ingredients ?? []) as any[];
            const stockMap = new Map((stock ?? []).map(s => [s.name.toLowerCase(), Number(s.quantity)]));
            const haveCount = ings.filter((i: any) => stockMap.has(i.name.toLowerCase()) && stockMap.get(i.name.toLowerCase())! > 0).length;
            const totalCount = ings.length;
            const hasAll = haveCount === totalCount && totalCount > 0;
            const catMeta = CATEGORIES[recipe.category] ?? CATEGORIES.outro;
            const totalMin = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
            const isGlobal = recipe.workspace_id === GLOBAL_WS;

            return (
              <Card
                key={recipe.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-px group"
                onClick={() => setSelectedRecipe(recipe.id)}
              >
                {/* Header colorido */}
                <div className={`px-4 py-5 ${hasAll ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl">{catMeta.emoji}</span>
                    <div className="flex gap-1">
                      {hasAll && <span className="status-pill-success text-[10px]">✓ Tens tudo</span>}
                      {isGlobal && <span className="status-pill-neutral text-[10px]">Sugerida</span>}
                    </div>
                  </div>
                  <p className="mt-2 font-display font-semibold">{recipe.name}</p>
                  {recipe.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>}
                </div>

                {/* Footer com stats */}
                <div className="border-t border-border/60 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {totalMin > 0 && <span className="flex items-center gap-1"><Clock className="size-3" />{totalMin}min</span>}
                    <span className="flex items-center gap-1"><Users className="size-3" />{recipe.servings} doses</span>
                  </div>
                  {totalCount > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${hasAll ? "bg-green-500" : "bg-primary"}`}
                          style={{ width: `${(haveCount / totalCount) * 100}%` }} />
                      </div>
                      <span className={hasAll ? "text-green-600 font-medium" : ""}>{haveCount}/{totalCount}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sheet de detalhe da receita */}
      <Sheet open={!!selectedRecipe} onOpenChange={(v) => { if (!v) { setSelectedRecipe(null); setShoppingList(null); } }}>
        <SheetContent side="bottom" className="h-[92vh] w-full rounded-t-2xl p-0 sm:h-full sm:max-w-xl sm:rounded-none">
          {selectedData && (
            <RecipeDetail
              recipe={selectedData}
              isOwned={!!isOwned}
              stock={stock ?? []}
              shoppingList={shoppingList}
              onBuild={(servings) => buildShoppingList(selectedData, servings)}
              onClearShopping={() => setShoppingList(null)}
              onAddMissing={() => addMissingToShoppingList(shoppingList)}
              onDelete={() => deleteRecipe.mutate(selectedData.id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RecipeDetail({
  recipe, isOwned, stock, shoppingList, onBuild, onClearShopping, onAddMissing, onDelete,
}: {
  recipe: any; isOwned: boolean; stock: any[];
  shoppingList: { name: string; qty: number; unit: string; have: boolean }[] | null;
  onBuild: (servings: number) => void;
  onClearShopping: () => void;
  onAddMissing: () => void;
  onDelete: () => void;
}) {
  const ings = (recipe.recipe_ingredients ?? []) as any[];
  const stockMap = new Map(stock.map((s: any) => [s.name.toLowerCase(), Number(s.quantity)]));
  const [servings, setServings] = useState<number>(recipe.servings ?? 4);
  const ratio = servings / (recipe.servings || 1);
  const catMeta = CATEGORIES[recipe.category] ?? CATEGORIES.outro;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-5">
        <SheetHeader className="p-0 text-left">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none">{catMeta.emoji}</span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-lg sm:text-xl leading-tight">{recipe.name}</SheetTitle>
              {recipe.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{recipe.description}</p>}
            </div>
          </div>
        </SheetHeader>

        {(recipe.prep_minutes || recipe.cook_minutes) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm text-muted-foreground border-b border-border/60 pb-4">
            {recipe.prep_minutes && <span className="flex items-center gap-1"><Clock className="size-3.5" />Prep: {recipe.prep_minutes}min</span>}
            {recipe.cook_minutes && <span className="flex items-center gap-1"><Clock className="size-3.5" />Cozinha: {recipe.cook_minutes}min</span>}
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doses</p>
          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setServings(Math.max(1, servings - 1))}>
              <Minus className="size-4" />
            </Button>
            <span className="font-display text-2xl font-bold w-10 text-center tabular-nums">{servings}</span>
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setServings(servings + 1)}>
              <Plus className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">pessoa{servings !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {ings.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredientes</p>
            <div className="divide-y divide-border/50 rounded-xl border border-border/60 overflow-hidden">
              {ings.map((ing: any) => {
                const needed = (ing.quantity ?? 0) * ratio;
                const inStock = stockMap.get(ing.name.toLowerCase()) ?? 0;
                const ok = inStock >= needed;
                const partial = !ok && inStock > 0;
                return (
                  <div key={ing.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className={`size-5 shrink-0 rounded-full flex items-center justify-center ${ok ? "bg-green-100 dark:bg-green-900/30" : partial ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-destructive/10"}`}>
                      {ok ? <Check className="size-3 text-green-600" /> : partial ? <Minus className="size-3 text-yellow-600" /> : <X className="size-3 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!ok && !partial ? "font-medium" : ""}`}>{ing.name}</p>
                      {partial && <p className="text-[11px] text-yellow-600 truncate">Tens {inStock} {ing.unit ?? ""} (precisa {needed % 1 === 0 ? needed : needed.toFixed(1)})</p>}
                      {!ok && !partial && inStock === 0 && <p className="text-[11px] text-destructive">Sem stock</p>}
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground shrink-0 tabular-nums">
                      {needed % 1 === 0 ? needed : needed.toFixed(1)} {ing.unit ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recipe.instructions && (
          <div>
            <p className="mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instruções</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{recipe.instructions}</p>
          </div>
        )}

        {shoppingList && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3 flex items-center justify-between">
              <p className="font-semibold text-sm">Lista de compras</p>
              <button onClick={onClearShopping} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="divide-y divide-border/50">
              {shoppingList.filter(i => !i.have).length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <Check className="mx-auto size-8 text-green-600 mb-2" />
                  <p className="font-medium text-green-700 dark:text-green-400">Tens tudo!</p>
                  <p className="text-xs text-muted-foreground mt-1">O teu stock tem todos os ingredientes.</p>
                </div>
              ) : (
                shoppingList.filter(i => !i.have).map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="truncate">{i.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{i.qty % 1 === 0 ? i.qty : i.qty.toFixed(1)} {i.unit}</span>
                  </div>
                ))
              )}
            </div>
            {shoppingList.filter(i => !i.have).length > 0 && (
              <div className="border-t border-border/60 p-3">
                <Button className="w-full h-10 font-semibold" onClick={onAddMissing}>
                  <ShoppingCart className="size-4" /> Adicionar à lista de compras
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-background/95 backdrop-blur px-4 py-3 sm:px-6 flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="w-full h-11 font-semibold" onClick={() => onBuild(servings)}>
          <ShoppingCart className="size-4" /> Ver o que falta comprar
        </Button>
        {isOwned && (
          <Button variant="outline" className="w-full h-10 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Eliminar receita
          </Button>
        )}
      </div>
    </div>
  );
}

function NewRecipeDialog({ onSubmit, loading }: {
  onSubmit: (p: any) => void; loading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("jantar");
  const [servings, setServings] = useState("4");
  const [prepMin, setPrepMin] = useState("");
  const [cookMin, setCookMin] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ings, setIngs] = useState([{ name: "", quantity: "", unit: "g" }]);

  const updateIng = (idx: number, patch: any) =>
    setIngs(prev => prev.map((i, n) => n === idx ? { ...i, ...patch } : i));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0">
      <DialogHeader2 title="Nova receita" subtitle="Adiciona uma receita personalizada ao teu livro" />
      <form className="space-y-4 px-4 py-4 sm:px-6 sm:py-5" onSubmit={e => { e.preventDefault(); onSubmit({ name, description, category, servings: Number(servings) || 4, prepMin: Number(prepMin), cookMin: Number(cookMin), instructions, ingredients: ings }); }}>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome *</Label>
          <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Frango assado com batatas" className="h-9" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIES).filter(([k]) => k !== "todos").map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.emoji} {m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doses</Label>
            <Input type="number" min="1" value={servings} onChange={e => setServings(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preparação (min)</Label>
            <Input type="number" min="0" value={prepMin} onChange={e => setPrepMin(e.target.value)} placeholder="15" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cozinha (min)</Label>
            <Input type="number" min="0" value={cookMin} onChange={e => setCookMin(e.target.value)} placeholder="30" className="h-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição…" className="h-9" />
        </div>

        {/* Ingredientes */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredientes</Label>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            {ings.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 border-b border-border/40 last:border-0">
                <Input className="h-8 text-sm flex-1" placeholder="Nome" value={ing.name} onChange={e => updateIng(idx, { name: e.target.value })} />
                <Input className="h-8 text-sm w-16" type="number" step="0.001" placeholder="Qtd" value={ing.quantity} onChange={e => updateIng(idx, { quantity: e.target.value })} />
                <Select value={ing.unit} onValueChange={v => updateIng(idx, { unit: v })}>
                  <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["g","kg","ml","L","unidade","tbsp","tsp","pacote","caixa"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setIngs(p => p.filter((_, i) => i !== idx))}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <button type="button" onClick={() => setIngs(p => [...p, { name: "", quantity: "", unit: "g" }])}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors">
              <Plus className="size-3.5" /> Adicionar ingrediente
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instruções (opcional)</Label>
          <Textarea rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Passo 1: …&#10;Passo 2: …" className="resize-none text-sm" />
        </div>

        <DialogFooter2>
          <Button type="submit" className="h-10 px-6 font-semibold" disabled={loading}>
            {loading ? "A criar…" : "Criar receita"}
          </Button>
        </DialogFooter2>
      </form>
    </DialogContent>
  );
}
