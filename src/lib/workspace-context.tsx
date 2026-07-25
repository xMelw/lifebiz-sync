import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  firstName: string | null;
  membership: Membership | null;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  canAccessCasa: boolean;
  canAccessNegocio: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canWrite: boolean;
  refetch: () => void;
  updateDisplayName: (name: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const MODE_KEY = "app.mode";

/** Extract a friendly first name from an email address.
 *  "carolina2000xD@gmail.com" → "Carolina"
 *  "joao.silva@empresa.pt"    → "João" (keeps only leading letters)
 */
export function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  // Take leading letters only (stops at digits, dots, underscores, etc.)
  const letters = local.match(/^[a-záàâãéèêíìîóòôõúùûçA-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]+/i)?.[0] ?? local;
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

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

      // Fetch profile (display_name can be set by user)
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: rows, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, access_casa, access_negocio, workspaces(name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      const membership: Membership | null = rows
        ? {
            workspace_id: rows.workspace_id,
            workspace_name: (rows.workspaces as { name: string } | null)?.name ?? "Workspace",
            role: rows.role,
            access_casa: rows.access_casa,
            access_negocio: rows.access_negocio,
          }
        : null;

      return { user, membership, profile };
    },
  });

  // Update display name in profiles table
  const updateDisplayName = useCallback(async (name: string) => {
    const userId = data?.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", userId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["current-membership"] });
  }, [data?.user?.id, qc]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) refetch();
    });
    return () => sub.subscription.unsubscribe();
  }, [refetch]);

  useEffect(() => {
    const m = data?.membership;
    if (!m) return;
    if (mode === "casa" && !m.access_casa && m.access_negocio) setMode("negocio");
    if (mode === "negocio" && !m.access_negocio && m.access_casa) setMode("casa");
  }, [data?.membership]);

  const value = useMemo<WorkspaceContextValue>(() => {
    const m = data?.membership ?? null;
    const role = m?.role ?? null;
    const email = data?.user?.email ?? null;
    // Priority: profiles.display_name → user_metadata.display_name → derived from email
    const rawName =
      data?.profile?.display_name ||
      (data?.user?.user_metadata?.display_name as string | undefined) ||
      null;
    const displayName = rawName ?? (email ? firstNameFromEmail(email) : null);
    const firstName = displayName ? displayName.split(" ")[0] : null;

    return {
      loading: isLoading,
      userId: data?.user?.id ?? null,
      email,
      displayName,
      firstName,
      membership: m,
      mode,
      setMode,
      canAccessCasa: !!m?.access_casa,
      canAccessNegocio: !!m?.access_negocio,
      isAdmin: role === "admin",
      isManager: role === "admin" || role === "gestor",
      canWrite: role === "admin" || role === "gestor" || role === "colaborador",
      refetch,
      updateDisplayName,
    };
  }, [data, isLoading, mode, updateDisplayName]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
