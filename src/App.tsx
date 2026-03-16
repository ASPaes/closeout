import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/language-provider";
import { AdminLayout } from "@/components/AdminLayout";
import { GestorLayout } from "@/components/GestorLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Venues from "@/pages/Venues";
import Events from "@/pages/Events";
import UsersRoles from "@/pages/UsersRoles";
import AuditLogs from "@/pages/AuditLogs";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import InvitePage from "@/pages/InvitePage";
import GestorDashboard from "@/pages/gestor/GestorDashboard";
import GestorCategorias from "@/pages/gestor/GestorCategorias";
import GestorProdutos from "@/pages/gestor/GestorProdutos";
import GestorCombos from "@/pages/gestor/GestorCombos";
import GestorCampanhas from "@/pages/gestor/GestorCampanhas";
import GestorEstoque from "@/pages/gestor/GestorEstoque";
import GestorEventos from "@/pages/gestor/GestorEventos";
import GestorCatalogos from "@/pages/gestor/GestorCatalogos";
import GestorLocais from "@/pages/gestor/GestorLocais";
import GestorEquipe from "@/pages/gestor/GestorEquipe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite" element={<InvitePage />} />

            {/* Admin area */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="venues" element={<Venues />} />
              <Route path="events" element={<Events />} />
              <Route path="users" element={<UsersRoles />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Gestor area */}
            <Route path="/gestor" element={<GestorLayout />}>
              <Route index element={<GestorDashboard />} />
              <Route path="produtos" element={<GestorProdutos />} />
              <Route path="categorias" element={<GestorCategorias />} />
              <Route path="combos" element={<GestorCombos />} />
              <Route path="campanhas" element={<GestorCampanhas />} />
              <Route path="estoque" element={<GestorEstoque />} />
              <Route path="catalogos" element={<GestorCatalogos />} />
              <Route path="locais" element={<GestorLocais />} />
              <Route path="eventos" element={<GestorEventos />} />
              <Route path="equipe" element={<GestorEquipe />} />
            </Route>

            {/* Legacy redirects */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/clients" element={<Navigate to="/admin/clients" replace />} />
            <Route path="/venues" element={<Navigate to="/admin/venues" replace />} />
            <Route path="/events" element={<Navigate to="/admin/events" replace />} />
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/audit-logs" element={<Navigate to="/admin/audit-logs" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
