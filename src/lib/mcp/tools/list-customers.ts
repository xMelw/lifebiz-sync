import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_customers",
  title: "Listar clientes",
  description: "Lista clientes do workspace, opcionalmente filtrados por nome ou email.",
  inputSchema: {
    search: z.string().optional().describe("Texto para filtrar por nome ou email."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("customers")
      .select("id, name, email, phone, created_at")
      .order("name", { ascending: true })
      .limit(limit ?? 50);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { customers: data },
    };
  },
});
