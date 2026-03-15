import { createContext, useContext, useMemo, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "closeout_effective_client_id";

type Client = { id: string; name: string };

type GestorContextType = {
  /** The resolved client ID to use for all queries/mutations */
  effectiveClientId: string | null;
  /** All client IDs from user_roles (for client_admin) */
  clientIds: string[];
  /** Resolved name of effectiveClientId */
  clientName: string | null;
  /** Whether the current user is super_admin */
  isSuperAdmin: boolean;
  /** All active clients (only populated for super_admin) */
  allClients: Client[];
  /** Change the effective client (super_admin only) */
  setEffectiveClientId: (id: string | null) => void;
  /** Loading state for clients list */
  loadingClients: boolean;
};

const GestorContext = createContext<GestorContextType>({
  effectiveClientId: null,
  clientIds: [],
  clientName: null,
  isSuperAdmin: false,
  allClients: [],
  setEffectiveClientId: () => {},
  loadingClients: false,
});

export function GestorProvider({ children }: { children: ReactNode }) {
  const { roles, isSuperAdmin } = useAuth();
  const [clientName, setClientName] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || null;
    }
    return null;
  });

  // client_admin's client IDs from roles
  const clientIds = useMemo(
    () => [...new Set(roles.filter((r) => r.client_id).map((r) => r.client_id!))],
    [roles]
  );

  // For client_admin: fixed to their first client_id
  // For super_admin: whatever they selected
  const effectiveClientId = isSuperAdmin ? selectedClientId : (clientIds[0] ?? null);

  // Fetch all active clients for super_admin
  useEffect(() => {
    if (!isSuperAdmin) {
      setAllClients([]);
      return;
    }
    setLoadingClients(true);
    supabase
      .from("clients")
      .select("id, name")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        setAllClients(data ?? []);
        setLoadingClients(false);

        // Validate persisted selection
        if (selectedClientId && data && !data.some((c) => c.id === selectedClientId)) {
          setSelectedClientId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      });
  }, [isSuperAdmin]);

  // Resolve client name from effectiveClientId
  useEffect(() => {
    if (!effectiveClientId) {
      setClientName(null);
      return;
    }
    // Try from allClients first (super_admin)
    const found = allClients.find((c) => c.id === effectiveClientId);
    if (found) {
      setClientName(found.name);
      return;
    }
    // Fallback: fetch from DB (client_admin case)
    supabase
      .from("clients")
      .select("name")
      .eq("id", effectiveClientId)
      .single()
      .then(({ data }) => setClientName(data?.name ?? null));
  }, [effectiveClientId, allClients]);

  const setEffectiveClientId = useCallback((id: string | null) => {
    setSelectedClientId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <GestorContext.Provider
      value={{
        effectiveClientId,
        clientIds,
        clientName,
        isSuperAdmin,
        allClients,
        setEffectiveClientId,
        loadingClients,
      }}
    >
      {children}
    </GestorContext.Provider>
  );
}

export function useGestor() {
  return useContext(GestorContext);
}
