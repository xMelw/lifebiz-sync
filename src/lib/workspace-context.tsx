import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppMode = "casa" | "negocio";
export type Role = Database["public"]["Enums"]["app_role"];

interface Membership {
  workspace_id: string;
  workspace_name: string;
  role: Role;
  access_casa: boolean;
  access_negocio: boolean;
}

interface WorkspaceContextValue {
  loading: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  membership: Membership | null;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  canAccessCasa: boolean;
  canAccessNegocio: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canWrite: boolean;
  refetch: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const MODE_KEY = "app.mode";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window === "undefined") return "negocio";
    return (localStorage.getItem(MODE_KEY) as AppMode) || "negocio";
  });

  const setMode = (m: AppMode) => {
    setModeState(m);
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, m);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["current-membership"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data: rows, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, access_casa, access_negocio, workspaces(name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!rows) return { user, membership: null as Membership | null };
      const membership: Membership = {
        workspace_id: rows.workspace_id,
        workspace_name: (rows.workspaces as { name: string } | null)?.name ?? "Workspace",
        role: rows.role,
        access_casa: rows.access_casa,
        access_negocio: rows.access_negocio,
      };
      return { user, membership };
    },
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        refetch();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refetch]);

  // Auto-adjust mode based on access
  useEffect(() => {
    const m = data?.membership;
    if (!m) return;
    if (mode === "casa" && !m.access_casa && m.access_negocio) setMode("negocio");
    if (mode === "negocio" && !m.access_negocio && m.access_casa) setMode("casa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.membership]);

  const value = useMemo<WorkspaceContextValue>(() => {
    const m = data?.membership ?? null;
    const role = m?.role ?? null;
    return {
      loading: isLoading,
      userId: data?.user?.id ?? null,
      email: data?.user?.email ?? null,
      displayName: (data?.user?.user_metadata?.display_name as string) ?? data?.user?.email ?? null,
      membership: m,
      mode,
      setMode,
      canAccessCasa: !!m?.access_casa,
      canAccessNegocio: !!m?.access_negocio,
      isAdmin: role === "admin",
      isManager: role === "admin" || role === "gestor",
      canWrite: role === "admin" || role === "gestor" || role === "colaborador",
      refetch,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading, mode]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
