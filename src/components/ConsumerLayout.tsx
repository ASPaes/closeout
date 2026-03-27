import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, UtensilsCrossed, QrCode, Receipt, User } from "lucide-react";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { ConsumerProvider } from "@/contexts/ConsumerContext";
import { RoleGuard } from "@/components/RoleGuard";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/app", icon: Home, labelKey: "consumer_tab_events" as const },
  { path: "/app/cardapio", icon: UtensilsCrossed, labelKey: "consumer_tab_menu" as const },
  { path: "/app/qr", icon: QrCode, labelKey: "consumer_tab_qr" as const },
  { path: "/app/pedidos", icon: Receipt, labelKey: "consumer_tab_orders" as const },
  { path: "/app/perfil", icon: User, labelKey: "consumer_tab_profile" as const },
];

function ConsumerTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeOrder } = useConsumer();

  const isActive = (path: string) => {
    if (path === "/app") return location.pathname === "/app";
    return location.pathname.startsWith(path);
  };

  const orderReady = activeOrder?.status === "ready";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-[480px] items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const isQr = tab.path === "/app/qr";
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 transition-colors",
                "active:bg-muted/50",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              {active && (
                <span className="text-[10px] font-medium">{t(tab.labelKey)}</span>
              )}
              {isQr && orderReady && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ConsumerHeader() {
  const { activeEvent } = useConsumer();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-card px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          CO
        </div>
        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
          {activeEvent?.name || "Close Out"}
        </span>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {profile?.name?.charAt(0)?.toUpperCase() || "?"}
      </div>
    </header>
  );
}

function ConsumerContent() {
  return (
    <div className="dark mx-auto min-h-[100dvh] max-w-[480px] bg-background text-foreground">
      <ConsumerHeader />
      <main className="px-4 pb-20 pt-4">
        <Outlet />
      </main>
      <ConsumerTabBar />
    </div>
  );
}

export function ConsumerLayout() {
  return (
    <RoleGuard area="consumer">
      <ConsumerProvider>
        <ConsumerContent />
      </ConsumerProvider>
    </RoleGuard>
  );
}
