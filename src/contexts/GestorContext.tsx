import { createContext, useContext, useMemo, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type GestorContextType = {
  clientId: string | null;
  clientIds: string[];
  clientName: string | null;
  isSuperAdmin: boolean;
};

const GestorContext = createContext<GestorContextType>({
  clientId: null,
  clientIds: [],
  clientName: null,
  isSuperAdmin: false,
});

export function GestorProvider({ children }: { children: ReactNode }) {
  const { roles, isSuperAdmin } = useAuth();
  const [clientName, setClientName] = useState<string | null>(null);

  const clientIds = useMemo(
    () => [...new Set(roles.filter((r) => r.client_id).map((r) => r.client_id!))],
    [roles]
  );

  const clientId = clientIds[0] ?? null;

  useEffect(() => {
    if (!clientId) { setClientName(null); return; }
    supabase.from("clients").select("name").eq("id", clientId).single()
      .then(({ data }) => setClientName(data?.name ?? null));
  }, [clientId]);

  return (
    <GestorContext.Provider value={{ clientId, clientIds, clientName, isSuperAdmin }}>
      {children}
    </GestorContext.Provider>
  );
}

export function useGestor() {
  return useContext(GestorContext);
}
