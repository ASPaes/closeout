import { ReactNode, useState, useEffect, useRef } from "react";
import { useWaiter } from "@/contexts/WaiterContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, QrCode, ChevronDown, UserCheck, MapPin, List } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type EventOption = { id: string; name: string; venue_name: string };

export function WaiterSessionGuard({ children }: { children: ReactNode }) {
  const { sessionId, loading, refreshSession } = useWaiter();
  const { user, roles } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [showManual, setShowManual] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [starting, setStarting] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // QR scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Fetch events for manual select
  useEffect(() => {
    if (!showManual || !user) return;
    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        const isMgmt = roles.some((r) => ["super_admin", "client_admin", "client_manager"].includes(r.role));
        let query = supabase.from("events").select("id, name, venues:venue_id(name)").eq("status", "active");
        if (!isMgmt) {
          const waiterRoles = roles.filter((r) => r.role === "waiter" && r.event_id);
          const eventIds = waiterRoles.map((r) => r.event_id!);
          if (eventIds.length === 0) { setEvents([]); setLoadingEvents(false); return; }
          query = query.in("id", eventIds);
        }
        const { data } = await query;
        if (data) {
          setEvents(data.map((e: any) => ({ id: e.id, name: e.name, venue_name: (e.venues as any)?.name || "" })));
        }
      } catch { /* ignore */ } finally { setLoadingEvents(false); }
    };
    fetchEvents();
  }, [showManual, user, roles]);

  const handleStartShift = async () => {
    if (!selectedEventId) { toast.error(t("wsg_select_event")); return; }
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc("start_waiter_session", {
        p_event_id: selectedEventId,
        p_assignment_type: "free",
        p_assignment_value: null,
      } as any);
      const result = data as any;
      if (error || !result?.ok) {
        const errMsg = result?.error === "SESSION_ALREADY_ACTIVE" ? t("wsg_already_active")
          : result?.error === "EVENT_NOT_FOUND" ? t("wsg_event_not_found")
          : t("wsg_start_error");
        toast.error(errMsg);
        return;
      }
      toast.success(t("wsg_shift_started"));
      await refreshSession();
    } catch { toast.error(t("wsg_start_error")); } finally { setStarting(false); }
  };

  // QR Scanner
  const handleQrResult = async (decodedText: string) => {
    const match = decodedText.match(/\/garcom\/join\/([A-Za-z0-9]+)/);
    const code = match ? match[1] : decodedText.trim();
    if (!code) return;
    stopScanner();
    setScanning(true);
    try {
      const { data, error } = await supabase.rpc("accept_waiter_invite", { p_join_code: code } as any);
      const res = data as any;
      if (error || !res?.ok) {
        const errKey = res?.error || "UNKNOWN";
        if (errKey === "INVALID_CODE") toast.error(t("wj_invalid_code"));
        else if (errKey === "EVENT_CLOSED") toast.error(t("wj_event_closed"));
        else if (errKey === "ALREADY_USED") toast.error(t("wj_already_used"));
        else toast.error(t("wj_generic_error"));
        return;
      }
      toast.success(t("wsg_shift_started"));
      await refreshSession();
    } catch { toast.error(t("wj_generic_error")); } finally { setScanning(false); }
  };

  const startScanner = async () => {
    setShowScanner(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    await new Promise((r) => setTimeout(r, 150));
    if (!document.getElementById("wsg-qr-scanner")) return;
    const scanner = new Html5Qrcode("wsg-qr-scanner");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        handleQrResult,
        () => {}
      );
    } catch {
      toast.error(t("wl_camera_error"));
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
    setShowScanner(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessionId) return <>{children}</>;

  // No active session — show options
  return (
    <div className="flex min-h-[60vh] flex-col items-center gap-6 px-2 pt-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <UserCheck className="h-8 w-8 text-primary" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{t("waiter_start_shift")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("wsg_scan_or_select")}</p>
      </div>

      {/* Primary: QR Scanner */}
      {scanning ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("wj_joining")}</p>
        </div>
      ) : showScanner ? (
        <div className="w-full space-y-3">
          <div
            id="wsg-qr-scanner"
            ref={scannerContainerRef}
            className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl"
          />
          <button
            type="button"
            onClick={stopScanner}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-white/[0.06] text-sm text-muted-foreground"
          >
            {t("cancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startScanner}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
        >
          <QrCode className="h-5 w-5" />
          {t("wsg_scan_qr")}
        </button>
      )}

      {/* Secondary: Manual event select */}
      {!showScanner && !scanning && (
        <>
          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <List className="h-4 w-4" />
            {t("wsg_select_manual")}
          </button>

          {showManual && (
            <div className="w-full space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("wsg_event")}
                </label>
                {loadingEvents ? (
                  <div className="flex h-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="flex h-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-4">
                    <p className="text-sm text-muted-foreground">{t("wsg_no_events")}</p>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="h-14 w-full appearance-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 pr-10 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      style={{ fontSize: "16px" }}
                    >
                      <option value="" className="bg-background text-muted-foreground">{t("wsg_select_event")}...</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id} className="bg-background text-foreground">
                          {ev.name}{ev.venue_name ? ` — ${ev.venue_name}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                )}
              </div>

              <button
                onClick={handleStartShift}
                disabled={!selectedEventId || starting}
                className={cn(
                  "flex h-14 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98]",
                  selectedEventId
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.06] text-muted-foreground cursor-not-allowed"
                )}
              >
                {starting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <UserCheck className="h-5 w-5" />
                    {t("waiter_start_shift")}
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
