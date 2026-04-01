import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import logoMark from "@/assets/brand/logo-mark.png";

type JoinResult = {
  ok: boolean;
  error?: string;
  event_name?: string;
  waiter_name?: string;
  session_id?: string;
};

const SESSION_KEY = "closeout_waiter_join_code";

export default function WaiterJoinEvent() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<JoinResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (joinCode) sessionStorage.setItem(SESSION_KEY, joinCode);
      navigate("/garcom/login", { replace: true });
      return;
    }

    if (!joinCode) {
      setStatus("error");
      setErrorMsg(t("wj_invalid_code"));
      return;
    }

    const accept = async () => {
      try {
        const { data, error } = await supabase.rpc("accept_waiter_invite", {
          p_join_code: joinCode,
        } as any);

        const res = data as any as JoinResult;
        if (error || !res?.ok) {
          setStatus("error");
          const errKey = res?.error || "UNKNOWN";
          if (errKey === "INVALID_CODE") setErrorMsg(t("wj_invalid_code"));
          else if (errKey === "EVENT_CLOSED") setErrorMsg(t("wj_event_closed"));
          else if (errKey === "ALREADY_USED") setErrorMsg(t("wj_already_used"));
          else setErrorMsg(t("wj_generic_error"));
          return;
        }

        setResult(res);
        setStatus("success");
        sessionStorage.removeItem(SESSION_KEY);

        setTimeout(() => navigate("/garcom", { replace: true }), 2500);
      } catch {
        setStatus("error");
        setErrorMsg(t("wj_generic_error"));
      }
    };

    accept();
  }, [user, authLoading, joinCode]);

  return (
    <div className="dark mx-auto flex min-h-[100dvh] max-w-[480px] flex-col items-center justify-center gap-6 bg-background px-6 text-foreground">
      <img src={logoMark} alt="Close Out" className="h-16 w-16 rounded-2xl object-cover" />

      {status === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-base font-medium text-muted-foreground">{t("wj_joining")}</p>
        </>
      )}

      {status === "success" && result && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("wj_welcome")}</h1>
          <p className="text-sm text-muted-foreground">
            {result.event_name && <span className="block font-medium text-foreground">{result.event_name}</span>}
            {result.waiter_name && <span className="block text-muted-foreground">{result.waiter_name}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{t("wj_redirecting")}</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{errorMsg}</h1>
          <button
            onClick={() => navigate("/garcom", { replace: true })}
            className="h-12 rounded-xl bg-white/[0.08] px-8 text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
          >
            {t("wj_back")}
          </button>
        </div>
      )}
    </div>
  );
}
