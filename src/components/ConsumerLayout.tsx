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
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-[480px] items-center justify-center px-6 pb-5">
        {/* Floating pill */}
        <div
          className="flex w-full max-w-[420px] items-center justify-around rounded-2xl border border-white/[0.06] px-2 py-2"
          style={{
            background: "#0A0A0A",
            boxShadow: "0 -2px 20px rgba(0,0,0,0.6)",
          }}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const isQr = tab.path === "/app/qr";
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
                {isQr && orderReady && (
                  <span className="absolute right-1 top-0.5 z-20 h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_8px_hsl(145,100%,39%,0.6)]">
                    <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
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

function ConsumerHeader() {
  const { activeEvent } = useConsumer();
  const { profile } = useAuth();

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
            <span
              className="text-xs font-bold tracking-wider text-foreground"
              style={{ fontFamily: "'Mustica Pro', sans-serif" }}
            >
              CLOSE OUT
            </span>
            {activeEvent && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                {activeEvent.name}
              </span>
            )}
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.06] text-xs font-semibold text-foreground active:scale-95 transition-transform">
          {profile?.name?.charAt(0)?.toUpperCase() || "?"}
        </button>
      </div>
    </header>
  );
}

function ConsumerContent() {
  return (
    <div className="dark mx-auto min-h-[100dvh] max-w-[480px] bg-background text-foreground">
      <ConsumerHeader />
      <main className="px-5 pb-24 pt-4">
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
