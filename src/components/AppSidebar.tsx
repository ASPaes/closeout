import { LayoutDashboard, Building2, MapPin, CalendarDays, Users, LogOut, Settings, ArrowRightLeft, DollarSign, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { TranslationKey } from "@/i18n/translations/pt-BR";
import logoMark from "@/assets/brand/logo-mark.png";

type NavItem = { titleKey: TranslationKey; url: string; icon: any };

const panelItems: NavItem[] = [
  { titleKey: "dashboard", url: "/admin", icon: LayoutDashboard },
];

const analysisItems: NavItem[] = [
  { titleKey: "gmv_transactions", url: "/admin/analise/gmv", icon: DollarSign },
];

const managementItems: NavItem[] = [
  { titleKey: "clients", url: "/admin/clients", icon: Building2 },
  { titleKey: "venues", url: "/admin/venues", icon: MapPin },
  { titleKey: "events", url: "/admin/events", icon: CalendarDays },
  { titleKey: "users_roles", url: "/admin/users", icon: Users },
];

const systemItems: NavItem[] = [
  { titleKey: "audit_logs", url: "/admin/audit-logs", icon: FileText },
  { titleKey: "settings", url: "/admin/settings", icon: Settings },
];

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  client_admin: "Admin do Cliente",
  venue_manager: "Gerente de Local",
  event_manager: "Gerente de Evento",
  event_organizer: "Organizador",
  staff: "Equipe",
  waiter: "Garçom",
  cashier: "Caixa",
  consumer: "Consumidor",
};

function SidebarNavItem({ item, collapsed, isActive, t }: { item: NavItem; collapsed: boolean; isActive: boolean; t: (key: TranslationKey) => string }) {
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, roles, signOut, isSuperAdmin } = useAuth();
  const { t } = useTranslation();

  const primaryRole = roles[0]?.role ? (roleLabels[roles[0].role] ?? roles[0].role) : "sem papel";

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
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{t("admin_panel")}</p>
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
              {mainItems.map((item) => (
                <SidebarNavItem key={item.titleKey} item={item} collapsed={collapsed} isActive={location.pathname === item.url} t={t} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("system")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {systemItems.map((item) => (
                  <SidebarNavItem key={item.titleKey} item={item} collapsed={collapsed} isActive={location.pathname === item.url} t={t} />
                ))}
                <SidebarNavItem
                  item={{ titleKey: "go_to_gestor", url: "/gestor", icon: ArrowRightLeft }}
                  collapsed={collapsed}
                  isActive={false}
                  t={t}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                  {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.name || "Usuário"}</p>
                  <Badge variant="secondary" className="mt-0.5 text-[9px] capitalize px-1.5 py-0 h-4">{primaryRole}</Badge>
                </div>
              </div>
              <button onClick={signOut} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title={t("sign_out")}>
                <LogOut className="h-4 w-4" />
              </button>
            </div>
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
