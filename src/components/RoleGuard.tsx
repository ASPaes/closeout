import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

type Area = "admin" | "gestor";

const areaRoles: Record<Area, string[]> = {
  admin: ["super_admin"],
  gestor: ["super_admin", "client_admin"],
};

export function RoleGuard({ area, children }: { area: Area; children: React.ReactNode }) {
  const { session, roles, loading } = useAuth();
  const toastShown = useRef(false);

  const hasAccess = roles.some((r) => areaRoles[area].includes(r.role));

  useEffect(() => {
    if (!loading && session && !hasAccess && !toastShown.current) {
      toastShown.current = true;
      toast.error("Você não tem permissão para acessar esta área.");
    }
  }, [loading, session, hasAccess]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
