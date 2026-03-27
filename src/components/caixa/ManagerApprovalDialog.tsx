import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Manager = { user_id: string; user_name: string; user_email: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  /** Called with the authorized manager's user_id on success */
  onAuthorized: (managerId: string) => void;
  /** Whether the current operator cannot authorize themselves (default true) */
  blockSelfApproval?: boolean;
  title?: string;
  description?: string;
};

export function ManagerApprovalDialog({
  open,
  onOpenChange,
  clientId,
  onAuthorized,
  blockSelfApproval = true,
  title,
  description,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authorizing, setAuthorizing] = useState(false);
  const [loadingManagers, setLoadingManagers] = useState(false);

  // Fetch managers when dialog opens
  useEffect(() => {
    if (!open || !clientId) return;
    setLoadingManagers(true);
    supabase
      .rpc("get_client_managers", { p_client_id: clientId })
      .then(({ data }) => {
        const list = (data as Manager[] | null) ?? [];
        // Filter out self if blockSelfApproval
        const filtered = blockSelfApproval
          ? list.filter((m) => m.user_id !== user?.id)
          : list;
        setManagers(filtered);
        if (filtered.length === 1) {
          setSelectedManagerId(filtered[0].user_id);
        }
        setLoadingManagers(false);
      });
  }, [open, clientId, blockSelfApproval, user?.id]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedManagerId("");
      setPassword("");
      setError("");
    }
  }, [open]);

  const selectedManager = managers.find((m) => m.user_id === selectedManagerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager || !password) return;

    setAuthorizing(true);
    setError("");

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: authData, error: authErr } = await tempClient.auth.signInWithPassword({
        email: selectedManager.user_email,
        password,
      });

      if (authErr || !authData.user) {
        setError(t("mgr_approval_invalid_password"));
        setAuthorizing(false);
        return;
      }

      // Verify user matches
      if (authData.user.id !== selectedManager.user_id) {
        setError(t("mgr_approval_error"));
        setAuthorizing(false);
        return;
      }

      onAuthorized(selectedManager.user_id);
    } catch {
      setError(t("mgr_approval_error"));
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-sm border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title || t("mgr_approval_title")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {description || t("mgr_approval_description")}
          </p>

          <div className="space-y-2">
            <Label>{t("mgr_approval_select_manager")}</Label>
            <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingManagers ? t("loading") : t("mgr_approval_select_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              placeholder={t("mgr_approval_password_placeholder")}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={authorizing}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="flex-1 glow-hover"
              disabled={!selectedManagerId || !password || authorizing}
            >
              {authorizing ? (
                <span className="animate-pulse">{t("ret_authorizing")}</span>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t("mgr_approval_authorize")}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
