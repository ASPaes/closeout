import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BarSidebar } from "@/components/BarSidebar";
import { RoleGuard } from "@/components/RoleGuard";
import { BarProvider, useBar } from "@/contexts/BarContext";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function EventSelector() {
  const { t } = useTranslation();
  const { eventId, eventName, availableEvents, setEventId, loadingEvents } = useBar();
  const [open, setOpen] = useState(false);

  if (availableEvents.length <= 1) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[180px] justify-between border-border/60 bg-secondary/50">
          <div className="flex items-center gap-2 truncate">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{eventName || t("bar_no_event")}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder={t("search")} />
          <CommandList>
            <CommandEmpty>{loadingEvents ? t("loading") : t("no_results")}</CommandEmpty>
            <CommandGroup>
              {availableEvents.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.name}
                  onSelect={() => { setEventId(e.id); setOpen(false); }}
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

function BarHeaderContent() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { eventName, pendingOrdersCount } = useBar();

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        {eventName && (
          <span className="text-sm font-medium text-foreground">{eventName}</span>
        )}
        <EventSelector />
      </div>
      <div className="flex items-center gap-3">
        {pendingOrdersCount > 0 && (
          <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary bg-primary/10 animate-pulse">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {pendingOrdersCount} {t("bar_pending")}
          </Badge>
        )}
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
          {profile?.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}

export function BarLayout() {
  return (
    <RoleGuard area="bar">
      <BarProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full dark">
            <BarSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <BarHeaderContent />
              <main className="flex-1 overflow-auto p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BarProvider>
    </RoleGuard>
  );
}
