import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_home_stock",
  title: "Listar stock de Casa",
  description: "Lista os itens em stock no modo Casa (despensa/casa), com quantidade e validade.",
  inputSchema: {
    low_only: z.boolean().optional().describe("Apenas itens abaixo do mínimo."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ low_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("home_stock_items")
      .select("id, name, category, quantity, min_stock, expiry_date")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(limit ?? 100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const filtered = low_only
      ? (data ?? []).filter((r) => Number(r.quantity) <= Number(r.min_stock ?? 0))
      : data;
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { items: filtered },
    };
  },
});
