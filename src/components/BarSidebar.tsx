import { ClipboardList, PackageCheck, ScanLine, History, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { useBar } from "@/contexts/BarContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { TranslationKey } from "@/i18n/translations/pt-BR";
import logoMark from "@/assets/brand/logo-mark.png";

const barItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "bar_queue", url: "/bar", icon: ClipboardList },
  { titleKey: "bar_ready", url: "/bar/prontos", icon: PackageCheck },
  { titleKey: "bar_qr_reader", url: "/bar/qr", icon: ScanLine },
  { titleKey: "bar_history", url: "/bar/historico", icon: History },
];

function SidebarNavItem({ item, collapsed, isActive, t }: { item: typeof barItems[0]; collapsed: boolean; isActive: boolean; t: (key: TranslationKey) => string }) {
  const content = (
    <SidebarMenuButton asChild isActive={isActive}>
      <NavLink
        to={item.url}
        end
        className={`transition-all duration-200 ${isActive ? "bg-sidebar-accent text-primary font-medium glow-sm" : "hover:bg-sidebar-accent/50"}`}
        activeClassName="bg-sidebar-accent text-primary font-medium"
      >
        <item.icon className={`h-4 w-4 transition-colors duration-200 ${isActive ? "text-primary" : ""}`} />
        {!collapsed && <span>{t(item.titleKey)}</span>}
      </NavLink>
    </SidebarMenuButton>
  );

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" className="bg-card border-border/60">
              {t(item.titleKey)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  return <SidebarMenuItem>{content}</SidebarMenuItem>;
}

export function BarSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  const { pendingOrdersCount } = useBar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img src={logoMark} alt="Close Out" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <span className="text-base font-bold tracking-tight text-sidebar-foreground" style={{ fontFamily: '"Mustica Pro", sans-serif' }}>
                CLOSE<span className="text-primary"> OUT</span>
              </span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{t("bar_staff_panel")}</p>
            </div>
          </div>
        ) : (
          <img src={logoMark} alt="Close Out" className="h-8 w-8 rounded-lg object-contain mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {barItems.map((item) => (
                <SidebarNavItem key={item.titleKey + item.url} item={item} collapsed={collapsed} isActive={location.pathname === item.url} t={t} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && pendingOrdersCount > 0 && (
          <div className="mx-3 mt-4 rounded-lg bg-primary/10 border border-primary/20 p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
              </span>
              <span className="text-xs font-medium text-primary">
                {pendingOrdersCount} {t("bar_pending")}
              </span>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.name || "Usuário"}</p>
                <Badge variant="secondary" className="mt-0.5 text-[9px] capitalize px-1.5 py-0 h-4">Bar Staff</Badge>
              </div>
            </div>
            <button onClick={signOut} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title={t("sign_out")}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={signOut} className="mx-auto rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card border-border/60">{t("sign_out")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
