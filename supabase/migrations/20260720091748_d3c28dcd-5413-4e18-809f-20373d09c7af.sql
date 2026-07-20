
ALTER TABLE public.home_stock_items
  ADD COLUMN IF NOT EXISTS weekly_consumption NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_deduct BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_deducted_at TIMESTAMPTZ;

-- Recipes (workspace_id NULL = global/system recipe visible to all)
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID,
  name TEXT NOT NULL,
  description TEXT,
  servings INTEGER NOT NULL DEFAULT 4,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  category TEXT NOT NULL DEFAULT 'outro'
    CHECK (category IN ('pequeno_almoco','almoco','jantar','snack','sobremesa','sopa','outro')),
  instructions TEXT,
  tags TEXT[],
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT TO authenticated
  USING (is_system = true OR (workspace_id IS NOT NULL AND private.has_workspace_access(auth.uid(), workspace_id, 'casa')));
CREATE POLICY "recipes_insert" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND private.can_write(auth.uid(), workspace_id, 'casa') AND created_by = auth.uid() AND is_system = false);
CREATE POLICY "recipes_update" ON public.recipes FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND private.can_write(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "recipes_delete" ON public.recipes FOR DELETE TO authenticated
  USING (workspace_id IS NOT NULL AND private.can_manage(auth.uid(), workspace_id, 'casa'));
CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION private.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(10,3),
  unit TEXT,
  stock_item_id UUID REFERENCES public.home_stock_items(id) ON DELETE SET NULL,
  optional BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_ing_select" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND (r.is_system = true OR (r.workspace_id IS NOT NULL AND private.has_workspace_access(auth.uid(), r.workspace_id, 'casa')))));
CREATE POLICY "recipe_ing_write" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND r.workspace_id IS NOT NULL AND private.can_write(auth.uid(), r.workspace_id, 'casa')));

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Plano semanal',
  week_start DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plans TO authenticated;
GRANT ALL ON public.meal_plans TO service_role;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_plans_select" ON public.meal_plans FOR SELECT TO authenticated
  USING (private.has_workspace_access(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "meal_plans_write" ON public.meal_plans FOR ALL TO authenticated
  USING (private.can_write(auth.uid(), workspace_id, 'casa'));

CREATE TABLE IF NOT EXISTS public.meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  custom_meal TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('pequeno_almoco','almoco','jantar','snack')),
  servings INTEGER NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_items TO authenticated;
GRANT ALL ON public.meal_plan_items TO service_role;
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_plan_items_select" ON public.meal_plan_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meal_plans mp WHERE mp.id = plan_id
    AND private.has_workspace_access(auth.uid(), mp.workspace_id, 'casa')));
CREATE POLICY "meal_plan_items_write" ON public.meal_plan_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meal_plans mp WHERE mp.id = plan_id
    AND private.can_write(auth.uid(), mp.workspace_id, 'casa')));

CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT ALL ON public.shopping_lists TO service_role;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopping_lists_all" ON public.shopping_lists FOR ALL TO authenticated
  USING (private.has_workspace_access(auth.uid(), workspace_id, 'casa'));

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(10,3),
  unit TEXT,
  category TEXT,
  checked BOOLEAN NOT NULL DEFAULT false,
  stock_item_id UUID REFERENCES public.home_stock_items(id) ON DELETE SET NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;
GRANT ALL ON public.shopping_list_items TO service_role;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopping_list_items_all" ON public.shopping_list_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shopping_lists sl WHERE sl.id = list_id
    AND private.has_workspace_access(auth.uid(), sl.workspace_id, 'casa')));

CREATE OR REPLACE FUNCTION public.apply_weekly_consumption(_workspace_id uuid)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  weeks_elapsed NUMERIC;
  to_deduct NUMERIC;
  affected INTEGER := 0;
BEGIN
  IF NOT private.can_write(auth.uid(), _workspace_id, 'casa') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  FOR r IN
    SELECT id, quantity, weekly_consumption, last_deducted_at
    FROM public.home_stock_items
    WHERE workspace_id = _workspace_id
      AND auto_deduct = true
      AND weekly_consumption > 0
      AND status = 'active'
  LOOP
    IF r.last_deducted_at IS NULL THEN
      weeks_elapsed := 1;
    ELSE
      weeks_elapsed := EXTRACT(EPOCH FROM (now() - r.last_deducted_at)) / (7 * 86400);
    END IF;
    IF weeks_elapsed >= 1 THEN
      to_deduct := FLOOR(weeks_elapsed) * r.weekly_consumption;
      UPDATE public.home_stock_items
        SET quantity = GREATEST(quantity - to_deduct, 0),
            last_deducted_at = now()
        WHERE id = r.id;
      affected := affected + 1;
    END IF;
  END LOOP;
  RETURN affected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_weekly_consumption(uuid) TO authenticated;

-- System recipes (workspace_id NULL, is_system=true, visible to all)
INSERT INTO public.recipes (id, workspace_id, created_by, is_system, name, description, servings, prep_minutes, cook_minutes, category, tags) VALUES
  ('00000000-0000-0000-0001-000000000001', NULL, NULL, true, 'Caldo Verde', 'Sopa tradicional portuguesa com couve e chouriço', 4, 15, 30, 'sopa', ARRAY['tradicional','sopa','facil']),
  ('00000000-0000-0000-0001-000000000002', NULL, NULL, true, 'Bacalhau à Brás', 'Bacalhau desfiado com ovos e batata palha', 4, 20, 25, 'jantar', ARRAY['bacalhau','tradicional']),
  ('00000000-0000-0000-0001-000000000003', NULL, NULL, true, 'Frango no Forno', 'Frango assado com batatas e alho', 4, 15, 60, 'jantar', ARRAY['frango','forno','facil']),
  ('00000000-0000-0000-0001-000000000004', NULL, NULL, true, 'Arroz de Feijão', 'Arroz cremoso com feijão vermelho', 4, 10, 25, 'almoco', ARRAY['arroz','vegetariano','economico']),
  ('00000000-0000-0000-0001-000000000005', NULL, NULL, true, 'Sopa de Legumes', 'Sopa nutritiva de legumes da época', 4, 15, 30, 'sopa', ARRAY['sopa','vegetariano','saudavel']),
  ('00000000-0000-0000-0001-000000000006', NULL, NULL, true, 'Esparguete à Bolonhesa', 'Massa com molho de carne picada', 4, 10, 30, 'jantar', ARRAY['massa','carne','rapido']),
  ('00000000-0000-0000-0001-000000000007', NULL, NULL, true, 'Ovos Mexidos com Tomate', 'Pequeno-almoço rápido e nutritivo', 2, 5, 10, 'pequeno_almoco', ARRAY['ovos','rapido','facil']),
  ('00000000-0000-0000-0001-000000000008', NULL, NULL, true, 'Salada de Atum', 'Salada fresca com atum e legumes', 2, 10, 0, 'almoco', ARRAY['atum','salada','rapido','saudavel'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recipe_ingredients (recipe_id, name, quantity, unit) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Batata', 500, 'g'),
  ('00000000-0000-0000-0001-000000000001', 'Couve portuguesa', 200, 'g'),
  ('00000000-0000-0000-0001-000000000001', 'Chouriço', 100, 'g'),
  ('00000000-0000-0000-0001-000000000001', 'Cebola', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000001', 'Azeite', 3, 'tbsp'),
  ('00000000-0000-0000-0001-000000000002', 'Bacalhau desfiado', 400, 'g'),
  ('00000000-0000-0000-0001-000000000002', 'Batata palha', 200, 'g'),
  ('00000000-0000-0000-0001-000000000002', 'Ovos', 4, 'unidade'),
  ('00000000-0000-0000-0001-000000000002', 'Cebola', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000002', 'Azeitonas', 50, 'g'),
  ('00000000-0000-0000-0001-000000000002', 'Azeite', 4, 'tbsp'),
  ('00000000-0000-0000-0001-000000000003', 'Frango inteiro', 1200, 'g'),
  ('00000000-0000-0000-0001-000000000003', 'Batata', 600, 'g'),
  ('00000000-0000-0000-0001-000000000003', 'Alho', 4, 'unidade'),
  ('00000000-0000-0000-0001-000000000003', 'Limão', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000003', 'Azeite', 3, 'tbsp'),
  ('00000000-0000-0000-0001-000000000004', 'Arroz', 300, 'g'),
  ('00000000-0000-0000-0001-000000000004', 'Feijão vermelho', 400, 'g'),
  ('00000000-0000-0000-0001-000000000004', 'Cebola', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000004', 'Azeite', 2, 'tbsp'),
  ('00000000-0000-0000-0001-000000000005', 'Cenoura', 2, 'unidade'),
  ('00000000-0000-0000-0001-000000000005', 'Batata', 300, 'g'),
  ('00000000-0000-0000-0001-000000000005', 'Alho francês', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000005', 'Cebola', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000005', 'Azeite', 2, 'tbsp'),
  ('00000000-0000-0000-0001-000000000006', 'Esparguete', 400, 'g'),
  ('00000000-0000-0000-0001-000000000006', 'Carne picada', 500, 'g'),
  ('00000000-0000-0000-0001-000000000006', 'Tomate pelado', 400, 'g'),
  ('00000000-0000-0000-0001-000000000006', 'Cebola', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000006', 'Alho', 2, 'unidade'),
  ('00000000-0000-0000-0001-000000000007', 'Ovos', 3, 'unidade'),
  ('00000000-0000-0000-0001-000000000007', 'Tomate', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000007', 'Manteiga', 10, 'g'),
  ('00000000-0000-0000-0001-000000000008', 'Atum em lata', 160, 'g'),
  ('00000000-0000-0000-0001-000000000008', 'Alface', 100, 'g'),
  ('00000000-0000-0000-0001-000000000008', 'Tomate', 1, 'unidade'),
  ('00000000-0000-0000-0001-000000000008', 'Ovo cozido', 2, 'unidade'),
  ('00000000-0000-0000-0001-000000000008', 'Milho', 50, 'g')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS recipes_workspace_idx ON public.recipes(workspace_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS meal_plans_workspace_idx ON public.meal_plans(workspace_id);
CREATE INDEX IF NOT EXISTS shopping_lists_workspace_idx ON public.shopping_lists(workspace_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_list_idx ON public.shopping_list_items(list_id);
