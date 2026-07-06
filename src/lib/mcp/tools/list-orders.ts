import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "Listar encomendas",
  description: "Lista as encomendas mais recentes do workspace do utilizador (modo Negócio).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Número máximo de encomendas a devolver (por defeito 20)."),
    status: z.string().optional().describe("Filtrar por status (ex.: rascunho, pendente_aprovacao, confirmada)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("orders")
      .select("id, order_number, status, priority, total, created_at, customer_id")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status as never);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { orders: data },
    };
  },
});
