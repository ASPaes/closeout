import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, LogIn } from "lucide-react";

type InviteStatus = "loading" | "needs_auth" | "accepting" | "success" | "error";

const ERROR_MAP: Record<string, string> = {
  INVITE_NOT_FOUND: "Este link de convite é inválido.",
  INVITE_ALREADY_USED: "Este convite já foi utilizado.",
  INVITE_EXPIRED: "Este convite expirou.",
};

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [roleName, setRoleName] = useState("");

  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Link de convite inválido. Token não encontrado.");
      return;
    }
    if (authLoading) return;
    if (!user) {
      setStatus("needs_auth");
      return;
    }
    acceptInvite();
  }, [token, user, authLoading]);

  const acceptInvite = async () => {
    setStatus("accepting");
    try {
      const { data, error } = await supabase.functions.invoke("accept-invite", {
        body: { token },
      });

      if (error) {
        console.error("[InvitePage] error", error);
        // Try to parse the error body for specific codes
        const detail = (error as any)?.context?.body
          ? await tryParseDetail((error as any).context.body)
          : null;
        const mapped = detail && ERROR_MAP[detail] ? ERROR_MAP[detail] : getPtBrErrorMessage(error);
        setErrorMsg(mapped);
        setStatus("error");
        return;
      }

      if (data?.data?.accepted) {
        setRoleName(data.data.role || "");
        setStatus("success");
        toast.success(t("invite_accepted"));
      } else {
        setErrorMsg(t("invite_error_generic"));
        setStatus("error");
      }
    } catch (err) {
      console.error("[InvitePage] error", err);
      setErrorMsg(getPtBrErrorMessage(err));
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("invite_page_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t("invite_verifying")}</span>
            </div>
          )}

          {status === "needs_auth" && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{t("invite_login_required")}</p>
              <div className="flex gap-2 justify-center">
                <Button asChild>
                  <Link to={`/login?redirect=/invite?token=${encodeURIComponent(token)}`}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t("login")}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/signup?redirect=/invite?token=${encodeURIComponent(token)}`}>
                    {t("create_account")}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {status === "accepting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t("invite_accepting")}</span>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <p className="text-foreground font-medium">{t("invite_success")}</p>
              {roleName && (
                <p className="text-sm text-muted-foreground">
                  {t("invite_role_assigned_as")} <strong className="capitalize">{roleName.replace(/_/g, " ")}</strong>
                </p>
              )}
              <Button onClick={() => navigate("/")}>{t("invite_go_to_panel")}</Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-destructive font-medium">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate("/login")}>
                {t("back_to_login")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function tryParseDetail(body: unknown): Promise<string | null> {
  try {
    if (typeof body === "string") {
      const parsed = JSON.parse(body);
      return parsed?.detail || null;
    }
    if (body && typeof body === "object" && "detail" in body) {
      return (body as any).detail || null;
    }
  } catch { /* ignore */ }
  return null;
}
