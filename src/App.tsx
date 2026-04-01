import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/language-provider";
import { AdminLayout } from "@/components/AdminLayout";
import { GestorLayout } from "@/components/GestorLayout";
import { CaixaLayout } from "@/components/CaixaLayout";
import { BarLayout } from "@/components/BarLayout";
import { ConsumerLayout } from "@/components/ConsumerLayout";
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
import GestorUsuarios from "@/pages/gestor/GestorUsuarios";
import GestorCaixas from "@/pages/gestor/GestorCaixas";
import GestorBarOperacao from "@/pages/gestor/GestorBarOperacao";
import GestorGarcons from "@/pages/gestor/GestorGarcons";
import GestorEventoFechamento from "@/pages/gestor/GestorEventoFechamento";
import CaixaDashboard from "@/pages/caixa/CaixaDashboard";
import CaixaVenda from "@/pages/caixa/CaixaVenda";
import CaixaMovimentacoes from "@/pages/caixa/CaixaMovimentacoes";
import CaixaDevolucoes from "@/pages/caixa/CaixaDevolucoes";
import CaixaTrocas from "@/pages/caixa/CaixaTrocas";
import CaixaFechamento from "@/pages/caixa/CaixaFechamento";
import BarFilaPedidos from "@/pages/bar/BarFilaPedidos";
import BarProntos from "@/pages/bar/BarProntos";
import BarLeitorQR from "@/pages/bar/BarLeitorQR";
import BarHistorico from "@/pages/bar/BarHistorico";
// Waiter pages
import { WaiterLayout } from "@/components/WaiterLayout";
import WaiterLogin from "@/pages/garcom/WaiterLogin";
import WaiterJoinEvent from "@/pages/garcom/WaiterJoinEvent";
import WaiterDashboard from "@/pages/garcom/WaiterDashboard";
import WaiterChamados from "@/pages/garcom/WaiterChamados";
import WaiterNovoPedido from "@/pages/garcom/WaiterNovoPedido";
import WaiterPedidoAvulso from "@/pages/garcom/WaiterPedidoAvulso";
import WaiterPedidos from "@/pages/garcom/WaiterPedidos";
import WaiterTurno from "@/pages/garcom/WaiterTurno";
import WaiterLeitorQR from "@/pages/garcom/WaiterLeitorQR";
import WaiterHistorico from "@/pages/garcom/WaiterHistorico";
// Consumer pages
import ConsumerLogin from "@/pages/consumer/ConsumerLogin";
import ConsumerCadastro from "@/pages/consumer/ConsumerCadastro";
import ConsumerEventos from "@/pages/consumer/ConsumerEventos";
import ConsumerCardapio from "@/pages/consumer/ConsumerCardapio";
import ConsumerCarrinho from "@/pages/consumer/ConsumerCarrinho";
import ConsumerPagamento from "@/pages/consumer/ConsumerPagamento";
import ConsumerQR from "@/pages/consumer/ConsumerQR";
import ConsumerPedidos from "@/pages/consumer/ConsumerPedidos";
import ConsumerPerfil from "@/pages/consumer/ConsumerPerfil";
import ConsumerLimites from "@/pages/consumer/ConsumerLimites";
import ConsumerCheckin from "@/pages/consumer/ConsumerCheckin";
import ConsumerPresentes from "@/pages/consumer/ConsumerPresentes";
import ConsumerEventoCardapio from "@/pages/consumer/ConsumerEventoCardapio";

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
              <Route path="usuarios" element={<GestorUsuarios />} />
              <Route path="caixas" element={<GestorCaixas />} />
              <Route path="bar" element={<GestorBarOperacao />} />
              <Route path="garcons" element={<GestorGarcons />} />
            </Route>

            {/* Caixa area */}
            <Route path="/caixa" element={<CaixaLayout />}>
              <Route index element={<CaixaDashboard />} />
              <Route path="venda" element={<CaixaVenda />} />
              <Route path="movimentacoes" element={<CaixaMovimentacoes />} />
              <Route path="devolucoes" element={<CaixaDevolucoes />} />
              <Route path="trocas" element={<CaixaTrocas />} />
              <Route path="fechamento" element={<CaixaFechamento />} />
            </Route>

            {/* Bar area */}
            <Route path="/bar" element={<BarLayout />}>
              <Route index element={<BarFilaPedidos />} />
              <Route path="prontos" element={<BarProntos />} />
              <Route path="qr" element={<BarLeitorQR />} />
              <Route path="historico" element={<BarHistorico />} />
            </Route>

            {/* Waiter area */}
            <Route path="/garcom/login" element={<WaiterLogin />} />
            <Route path="/garcom/join/:joinCode" element={<WaiterJoinEvent />} />
            <Route path="/garcom" element={<WaiterLayout />}>
              <Route index element={<WaiterDashboard />} />
              <Route path="chamados" element={<WaiterChamados />} />
              <Route path="pedido" element={<WaiterNovoPedido />} />
              <Route path="pedido-avulso" element={<WaiterPedidoAvulso />} />
              <Route path="pedidos" element={<WaiterPedidos />} />
              <Route path="turno" element={<WaiterTurno />} />
              <Route path="qr" element={<WaiterLeitorQR />} />
              <Route path="historico" element={<WaiterHistorico />} />
            </Route>

            {/* Consumer app — auth (no layout) */}
            <Route path="/app/login" element={<ConsumerLogin />} />
            <Route path="/app/cadastro" element={<ConsumerCadastro />} />

            {/* Consumer app — authenticated */}
            <Route path="/app" element={<ConsumerLayout />}>
              <Route index element={<ConsumerEventos />} />
              <Route path="evento/:eventId" element={<ConsumerEventoCardapio />} />
              <Route path="cardapio" element={<ConsumerCardapio />} />
              <Route path="carrinho" element={<ConsumerCarrinho />} />
              <Route path="pagamento" element={<ConsumerPagamento />} />
              <Route path="qr" element={<ConsumerQR />} />
              <Route path="pedidos" element={<ConsumerPedidos />} />
              <Route path="perfil" element={<ConsumerPerfil />} />
              <Route path="limites" element={<ConsumerLimites />} />
              <Route path="checkin" element={<ConsumerCheckin />} />
              <Route path="presentes" element={<ConsumerPresentes />} />
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
