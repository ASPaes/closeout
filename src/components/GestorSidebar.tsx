import { LayoutDashboard, Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, LogOut, ArrowRightLeft, BookOpen, MapPin, UserPlus, Users, Banknote, Beer } from "lucide-react";
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

const gestorItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "dashboard", url: "/gestor", icon: LayoutDashboard },
  { titleKey: "gestor_products", url: "/gestor/produtos", icon: Package },
  { titleKey: "gestor_categories", url: "/gestor/categorias", icon: Tags },
  { titleKey: "gestor_combos", url: "/gestor/combos", icon: Layers },
  { titleKey: "gestor_campaigns", url: "/gestor/campanhas", icon: Megaphone },
  { titleKey: "gestor_stock", url: "/gestor/estoque", icon: Warehouse },
  { titleKey: "ctlg_title", url: "/gestor/catalogos", icon: BookOpen },
  { titleKey: "gestor_venues", url: "/gestor/locais", icon: MapPin },
  { titleKey: "events", url: "/gestor/eventos", icon: CalendarDays },
  { titleKey: "gusr_title", url: "/gestor/usuarios", icon: Users },
  { titleKey: "gcx_title", url: "/gestor/caixas", icon: Banknote },
  { titleKey: "gbar_ops_title", url: "/gestor/bar", icon: Beer },
  { titleKey: "gestor_invite_team", url: "/gestor/equipe", icon: UserPlus },
];

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  client_admin: "Admin do Cliente",
  client_manager: "Gestor do Cliente",
  venue_manager: "Gerente de Local",
  event_manager: "Gerente de Evento",
  event_organizer: "Organizador",
  staff: "Equipe",
  bar_staff: "Equipe de Bar",
  waiter: "Garçom",
  cashier: "Caixa",
  consumer: "Consumidor",
};

function SidebarNavItem({ item, collapsed, isActive, t }: { item: typeof gestorItems[0]; collapsed: boolean; isActive: boolean; t: (key: TranslationKey) => string }) {
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

export function GestorSidebar() {
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
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{t("gestor_panel")}</p>
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
              {gestorItems.map((item) => (
                <SidebarNavItem key={item.titleKey + item.url} item={item} collapsed={collapsed} isActive={location.pathname === item.url} t={t} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavItem
                  item={{ titleKey: "go_to_admin", url: "/admin", icon: ArrowRightLeft }}
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
