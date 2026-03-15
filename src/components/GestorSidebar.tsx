import { LayoutDashboard, Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, LogOut, Shield, ArrowRightLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

const gestorItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "dashboard", url: "/gestor", icon: LayoutDashboard },
  { titleKey: "gestor_products", url: "/gestor/produtos", icon: Package },
  { titleKey: "gestor_categories", url: "/gestor/categorias", icon: Tags },
  { titleKey: "gestor_combos", url: "/gestor/combos", icon: Layers },
  { titleKey: "gestor_campaigns", url: "/gestor/campanhas", icon: Megaphone },
  { titleKey: "gestor_stock", url: "/gestor/estoque", icon: Warehouse },
  { titleKey: "events", url: "/gestor/eventos", icon: CalendarDays },
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
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-sidebar-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                CLOSE<span className="text-primary"> OUT</span>
              </span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{t("gestor_panel")}</p>
            </div>
          </div>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {gestorItems.map((item) => (
                <SidebarMenuItem key={item.titleKey + item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50 transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" className="hover:bg-sidebar-accent/50 transition-colors">
                      <ArrowRightLeft className="h-4 w-4" />
                      {!collapsed && <span>{t("go_to_admin")}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
          <button onClick={signOut} className="mx-auto rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title={t("sign_out")}>
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
