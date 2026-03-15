import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestorSidebar } from "@/components/GestorSidebar";
import { RoleGuard } from "@/components/RoleGuard";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GestorLayout() {
  const { profile } = useAuth();

  return (
    <RoleGuard area="gestor">
      <SidebarProvider>
        <div className="min-h-screen flex w-full dark">
          <GestorSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
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
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </RoleGuard>
  );
}
