import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Bell, PlusCircle, ClipboardList, User } from "lucide-react";
import { useWaiter, WaiterProvider } from "@/contexts/WaiterContext";
import { useTranslation } from "@/i18n/use-translation";
import { RoleGuard } from "@/components/RoleGuard";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/garcom", icon: Home, labelKey: "waiter_dashboard" as const },
  { path: "/garcom/chamados", icon: Bell, labelKey: "waiter_calls" as const },
  { path: "/garcom/pedido", icon: PlusCircle, labelKey: "waiter_new_order" as const },
  { path: "/garcom/pedidos", icon: ClipboardList, labelKey: "waiter_orders" as const },
  { path: "/garcom/turno", icon: User, labelKey: "waiter_shift" as const },
];

function WaiterTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pendingCallsCount } = useWaiter();

  const isActive = (path: string) => {
    if (path === "/garcom") return location.pathname === "/garcom";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-[480px] items-center justify-center px-6 pb-5">
        <div
          className="flex w-full max-w-[420px] items-center justify-around rounded-2xl border border-white/[0.06] px-2 py-2"
          style={{ background: "#0A0A0A", boxShadow: "0 -2px 20px rgba(0,0,0,0.6)" }}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const isCalls = tab.path === "/garcom/chamados";
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 transition-all",
                  "active:scale-95 active:opacity-80",
                  active ? "text-primary" : "text-white/40"
                )}
              >
                <tab.icon className={cn("h-[22px] w-[22px]", active && "drop-shadow-[0_0_8px_hsl(24,100%,50%,0.6)]")} />
                {active && (
                  <span className="text-[10px] font-semibold tracking-wide">{t(tab.labelKey)}</span>
                )}
                {isCalls && pendingCallsCount > 0 && (
                  <span className="absolute right-1 top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-[0_0_8px_hsl(0,100%,50%,0.5)]">
                    {pendingCallsCount > 9 ? "9+" : pendingCallsCount}
                    <span className="absolute inset-0 animate-ping rounded-full bg-destructive/60" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function WaiterHeader() {
  const { eventName, sessionId } = useWaiter();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/[0.06]"
      style={{
        background: "rgba(10, 10, 10, 0.75)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-[10px] font-bold text-primary-foreground"
            style={{ boxShadow: "0 0 12px hsl(24 100% 50% / 0.3)" }}
          >
            CO
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-foreground" style={{ fontFamily: "'Mustica Pro', sans-serif" }}>
              CLOSE OUT
            </span>
            {eventName && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{eventName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionId && (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-semibold text-success">
              {t("waiter_shift")}
            </span>
          )}
          <button
            onClick={() => navigate("/garcom/turno")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.06] text-xs font-semibold text-foreground active:scale-95 transition-transform"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function WaiterContent() {
  return (
    <div className="dark mx-auto min-h-[100dvh] max-w-[480px] bg-background text-foreground" id="waiter-root">
      <WaiterHeader />
      <main className="px-5 pb-24 pt-4">
        <Outlet />
      </main>
      <WaiterTabBar />
    </div>
  );
}

export function WaiterLayout() {
  return (
    <RoleGuard area="garcom">
      <WaiterProvider>
        <WaiterContent />
      </WaiterProvider>
    </RoleGuard>
  );
}
