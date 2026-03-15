import { createContext, useContext, useMemo, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

type GestorContextType = {
  clientId: string | null;
  clientIds: string[];
  isSuperAdmin: boolean;
};

const GestorContext = createContext<GestorContextType>({
  clientId: null,
  clientIds: [],
  isSuperAdmin: false,
});

export function GestorProvider({ children }: { children: ReactNode }) {
  const { roles, isSuperAdmin } = useAuth();

  const clientIds = useMemo(
    () => [...new Set(roles.filter((r) => r.client_id).map((r) => r.client_id!))],
    [roles]
  );

  const clientId = clientIds[0] ?? null;

  return (
    <GestorContext.Provider value={{ clientId, clientIds, isSuperAdmin }}>
      {children}
    </GestorContext.Provider>
  );
}

export function useGestor() {
  return useContext(GestorContext);
}
