import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

type Area = "admin" | "gestor" | "caixa" | "bar" | "consumer" | "garcom";

const areaRoles: Record<Area, string[]> = {
  admin: ["owner", "super_admin"],
  gestor: ["owner", "super_admin", "client_admin", "client_manager", "venue_manager", "event_manager"],
  caixa: ["owner", "cashier", "super_admin", "client_admin", "client_manager"],
  bar: ["owner", "bar_staff", "staff", "super_admin", "client_admin", "client_manager"],
  consumer: ["consumer", "owner", "super_admin"],
  garcom: ["owner", "waiter", "super_admin", "client_admin", "client_manager"],
};

const redirectForUnauthorized: Record<Area, string> = {
  admin: "/gestor",
  gestor: "/login",
  caixa: "/login",
  bar: "/login",
  consumer: "/app/login",
  garcom: "/login",
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
    return <Navigate to={redirectForUnauthorized[area]} replace />;
  }

  if (!hasAccess) {
    return <Navigate to={redirectForUnauthorized[area]} replace />;
  }

  return <>{children}</>;
}
