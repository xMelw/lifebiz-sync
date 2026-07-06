import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrders from "./tools/list-orders";
import listCustomers from "./tools/list-customers";
import listProducts from "./tools/list-products";
import listHomeStock from "./tools/list-home-stock";
import createOrder from "./tools/create-order";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "casa-negocio-mcp",
  title: "Casa & Negócio",
  version: "0.1.0",
  instructions:
    "Ferramentas para gerir o workspace Casa & Negócio do utilizador autenticado: encomendas, clientes, produtos e stock de casa. Todas as operações respeitam o acesso do utilizador (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrders, listCustomers, listProducts, listHomeStock, createOrder],
});
