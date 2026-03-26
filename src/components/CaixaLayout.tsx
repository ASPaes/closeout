import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CaixaSidebar } from "@/components/CaixaSidebar";
import { RoleGuard } from "@/components/RoleGuard";
import { CaixaProvider, useCaixa } from "@/contexts/CaixaContext";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Bell, CalendarDays, ChevronDown, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";

function EventSelector() {
  const { t } = useTranslation();
  const { eventId, eventName, availableEvents, setEventId, loading } = useCaixa();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[180px] justify-between border-border/60 bg-secondary/50">
          <div className="flex items-center gap-2 truncate">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">
              {eventName || t("caixa_select_event")}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder={t("caixa_search_events")} />
          <CommandList>
            <CommandEmpty>{loading ? t("loading") : t("caixa_no_events")}</CommandEmpty>
            <CommandGroup>
              {availableEvents.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.name}
                  onSelect={() => {
                    setEventId(e.id);
                    setOpen(false);
                  }}
                  className={eventId === e.id ? "bg-primary/10 text-primary" : ""}
                >
                  <CalendarDays className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{e.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CaixaHeaderContent() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { eventName, cashRegisterId } = useCaixa();

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <EventSelector />
        {eventName && (
          <Badge
            variant="outline"
            className={`gap-1 text-[10px] ${
              cashRegisterId
                ? "border-green-500/40 text-green-400 bg-green-500/10"
                : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
            }`}
          >
            <CircleDot className="h-3 w-3" />
            {cashRegisterId ? t("caixa_status_open") : t("caixa_status_closed")}
          </Badge>
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

export function CaixaLayout() {
  return (
    <RoleGuard area="caixa">
      <CaixaProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full dark">
            <CaixaSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <CaixaHeaderContent />
              <main className="flex-1 overflow-auto p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </CaixaProvider>
    </RoleGuard>
  );
}
