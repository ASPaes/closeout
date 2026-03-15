import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestorSidebar } from "@/components/GestorSidebar";
import { RoleGuard } from "@/components/RoleGuard";
import { GestorProvider, useGestor } from "@/contexts/GestorContext";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Shield, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";

function ClientSelector() {
  const { t } = useTranslation();
  const { effectiveClientId, clientName, allClients, setEffectiveClientId, loadingClients } = useGestor();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1 text-[10px] border-primary/40 text-primary bg-primary/10">
        <Shield className="h-3 w-3" />
        {t("gestor_admin_mode")}
      </Badge>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-w-[180px] justify-between border-border/60 bg-secondary/50">
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">
                {clientName || t("gestor_select_client")}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="end">
          <Command>
            <CommandInput placeholder={t("search_clients")} />
            <CommandList>
              <CommandEmpty>{loadingClients ? t("loading") : t("no_clients_found")}</CommandEmpty>
              <CommandGroup>
                {allClients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      setEffectiveClientId(c.id);
                      setOpen(false);
                    }}
                    className={effectiveClientId === c.id ? "bg-primary/10 text-primary" : ""}
                  >
                    <Building2 className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function GestorHeaderContent() {
  const { profile } = useAuth();
  const { clientName, isSuperAdmin } = useGestor();

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        {isSuperAdmin ? (
          <ClientSelector />
        ) : (
          clientName && (
            <span className="text-sm font-medium text-foreground">{clientName}</span>
          )
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
          {profile?.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}

export function GestorLayout() {
  return (
    <RoleGuard area="gestor">
      <GestorProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full dark">
            <GestorSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <GestorHeaderContent />
              <main className="flex-1 overflow-auto p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </GestorProvider>
    </RoleGuard>
  );
}
