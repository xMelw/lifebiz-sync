import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, getUserWorkspaceId } from "../supabase";

export default defineTool({
  name: "create_order",
  title: "Criar encomenda (rascunho)",
  description:
    "Cria uma nova encomenda em rascunho no modo Negócio, associada opcionalmente a um cliente.",
  inputSchema: {
    customer_id: z.string().uuid().optional().describe("ID do cliente."),
    notes: z.string().optional().describe("Notas internas da encomenda."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ customer_id, notes }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const workspaceId = await getUserWorkspaceId(supabase, ctx.getUserId()!);
    if (!workspaceId) return { content: [{ type: "text", text: "Sem workspace ativo" }], isError: true };
    const { data, error } = await supabase
      .from("orders")
      .insert({
        workspace_id: workspaceId,
        created_by: ctx.getUserId()!,
        customer_id: customer_id ?? null,
        notes: notes ?? null,
        status: "rascunho" as never,
      })
      .select("id, order_number, status")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Encomenda criada: ${data.order_number ?? data.id}` }],
      structuredContent: { order: data },
    };
  },
});
