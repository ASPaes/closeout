import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RegistrationGuardProps {
  children: React.ReactNode;
}

export function RegistrationGuard({ children }: RegistrationGuardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("registration_complete")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.registration_complete) {
        setComplete(true);
      } else {
        navigate("/app/completar-cadastro", { replace: true });
      }
      setChecking(false);
    };

    check();
  }, [user, navigate]);

  if (checking) {
    return (
      <div className="dark flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!complete) return null;

  return <>{children}</>;
}
