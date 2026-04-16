# CLOSE OUT — Memória do Projeto

## IDENTIDADE

Close Out é uma plataforma de operações para bares, baladas e eventos. B2B (vende pra donos de bar) com camada B2C (consumidor final pede pelo app). Ale (Alexandre, ASP Paes) é o owner/fundador. Paga $800/mês no Claude e exige eficácia total.

---

## STACK E INFRAESTRUTURA

- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui (via Lovable)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
- **Supabase Project ID:** qfwyjatumwgdrzaqnmlg
- **Supabase URL:** https://qfwyjatumwgdrzaqnmlg.supabase.co
- **Repositório:** github.com/ASPaes/closeout (branch: main)
- **Deploy:** closeout.lovable.app (via Lovable)
- **Gateway pagamento:** Asaas (sandbox funcional, produção pendente)
- **Design system:** dark theme, primária laranja hsl(24,100%,50%), fontes Inter/Mustica Pro, mobile-first
- **i18n:** pt-BR forçado (sistema i18n existe mas só português é usado)

---

## WORKFLOW (NUNCA QUEBRAR ESTA REGRA)

- **Frontend:** SEMPRE via Lovable prompts. Nunca editar código no repo diretamente pra mudanças de UI.
- **Banco de dados (SQL, RPCs, triggers):** Supabase Dashboard → SQL Editor
- **Edge Functions:** Supabase Dashboard → Edge Functions (criar/editar código lá)
- **Git push de arquivos não-UI:** Pode fazer direto via GitHub PAT
- **Ale NÃO usa Supabase CLI localmente**
- **O .env DEVE estar no Git** (anon key é pública, Lovable precisa pra build)

---

## 6 MÓDULOS E ROTAS

### Admin (/admin) — owner e super_admin
- /admin → Dashboard
- /admin/clients → Clients (ativação de clientes com subconta Asaas)
- /admin/venues → Venues
- /admin/events → Events
- /admin/users → UsersRoles
- /admin/audit-logs → AuditLogs
- /admin/settings → Settings (taxa, sandbox, PIX expiração, valor mínimo)

### Gestor (/gestor) — client_admin, client_manager, venue_manager, event_manager
- /gestor → GestorDashboard (com métricas financeiras Asaas)
- /gestor/produtos → GestorProdutos
- /gestor/categorias → GestorCategorias
- /gestor/combos → GestorCombos
- /gestor/campanhas → GestorCampanhas
- /gestor/estoque → GestorEstoque
- /gestor/catalogos → GestorCatalogos
- /gestor/locais → GestorLocais
- /gestor/eventos → GestorEventos (flag sandbox por evento)
- /gestor/eventos/:eventId/fechamento → GestorEventoFechamento
- /gestor/equipe → GestorEquipe
- /gestor/usuarios → GestorUsuarios
- /gestor/caixas → GestorCaixas
- /gestor/bar → GestorBarOperacao
- /gestor/garcons → GestorGarcons

### Caixa (/caixa) — cashier, client_admin, client_manager
- /caixa → CaixaDashboard
- /caixa/venda → CaixaVenda
- /caixa/movimentacoes → CaixaMovimentacoes
- /caixa/devolucoes → CaixaDevolucoes
- /caixa/trocas → CaixaTrocas
- /caixa/fechamento → CaixaFechamento

### Bar (/bar) — bar_staff, staff, client_admin, client_manager
- /bar → BarFilaPedidos
- /bar/prontos → BarProntos
- /bar/qr → BarLeitorQR
- /bar/historico → BarHistorico

### Consumidor (/app) — TODAS as roles (qualquer usuário logado)
- /app/login → ConsumerLogin
- /app/cadastro → ConsumerCadastro
- /app/completar-cadastro → ConsumerCompletarCadastro (Google OAuth)
- /app → ConsumerEventos (protegido por RegistrationGuard)
- /app/evento/:eventId → ConsumerEventoCardapio
- /app/cardapio → ConsumerCardapio
- /app/carrinho → ConsumerCarrinho
- /app/pagamento → ConsumerPagamento
- /app/qr → ConsumerQR
- /app/pedidos → ConsumerPedidos
- /app/perfil → ConsumerPerfil (com cartões salvos)
- /app/limites → ConsumerLimites
- /app/checkin → ConsumerCheckin
- /app/presentes → ConsumerPresentes

### Garçom (/garcom) — waiter, client_admin, client_manager
- /garcom/login → WaiterLogin
- /garcom/join/:joinCode → WaiterJoinEvent
- /garcom → WaiterDashboard
- /garcom/chamados → WaiterChamados
- /garcom/pedido → WaiterNovoPedido
- /garcom/pedido-avulso → WaiterPedidoAvulso
- /garcom/pedidos → WaiterPedidos
- /garcom/turno → WaiterTurno
- /garcom/qr → WaiterLeitorQR
- /garcom/historico → WaiterHistorico

---

## HIERARQUIA DE ROLES

owner (Ale, único) → super_admin (sócios) → client_admin (dono do bar) → client_manager (gerente) → venue_manager → event_manager → bar_staff/staff/waiter/cashier → consumer

- **has_role_name** e **has_role**: owner é tratado como super_admin em TODAS as 228 policies RLS
- **RoleGuard** controla acesso por área no frontend
- **Todos os roles** podem acessar /app (consumidor)

---

## BANCO DE DADOS — 49 TABELAS

### Core
profiles, clients, venues, events, event_settings, event_images, event_catalogs, event_billing_overrides, user_roles, user_invites, platform_settings, audit_logs, roles

### Produtos e catálogos
products, categories, combos, combo_items, catalogs, catalog_items, campaigns, campaign_items, product_recipes, product_image_library

### Pedidos e pagamentos
orders, order_items, order_item_deliveries, payments, qr_tokens, validations

### Estoque
stock_balances, stock_entries, stock_reservations

### Caixa
cash_registers, cash_movements, cash_orders, cash_order_counters, returns, exchanges

### Consumidor
event_checkins, user_consumption_limits, user_payment_methods

### Garçom
waiter_sessions, waiter_invites, waiter_calls, waiter_cancellation_requests

### Asaas (gateway de pagamento)
asaas_subaccounts, asaas_charges, asaas_customer_cards, asaas_customer_map

### Billing
billing_rules

### Views
clients_limited, consumer_event_stats, consumer_event_stats_secure, v_event_cancellations, v_event_cash_movements, v_event_closing_report, v_event_sales_summary

---

## ENUMS

- **app_role:** owner, super_admin, client_admin, venue_manager, event_manager, staff, waiter, cashier, consumer, event_organizer, client_manager, bar_staff
- **order_status:** pending, processing_payment, partially_paid, paid, preparing, ready, partially_delivered, delivered, cancelled
- **payment_status:** created, processing, approved, failed, cancelled, refunded, expired
- **qr_status:** valid, used, cancelled, invalid
- **event_status:** draft, active, completed, cancelled
- **order_origin:** consumer_app, waiter_app, cashier
- **campaign_status:** scheduled, active, paused, ended
- **cash_register_status:** open, closed
- **stock_movement_type:** entry, reservation, release, sale, adjustment
- **waiter_session_status:** active, closed

---

## RPCs CHAMADAS PELO FRONTEND (30 funções)

accept_waiter_call, accept_waiter_invite, bootstrap_super_admin, check_username_available, close_cash_register, close_event_cancel_unpaid, close_waiter_session, complete_waiter_call, confirm_cash_split_payment, confirm_partial_delivery, consumer_checkin, consumer_checkout, create_consumer_split_order (com rate limit 5/min), create_waiter_invite, create_waiter_order, delete_stock_entry (protegida: role+client_id), ensure_consumer_role, get_client_managers, get_consumer_profile_stats, get_event_checkin_counts, log_audit, next_cash_order_number, release_stock_for_order, request_waiter_cancellation, reserve_stock_for_order, review_waiter_cancellation, set_checkin_visibility, start_waiter_session, update_stock_entry (protegida: role+client_id), validate_qr

---

## EDGE FUNCTIONS (11 total)

### No repositório (supabase/functions/):
1. create-client-with-manager — ativa cliente + cria user client_admin
2. create-super-admin — cria super_admin
3. create-invite-link — convite genérico
4. accept-invite — aceita convite
5. search-product-image — busca imagem de produto
6. upload-product-image — upload de imagem
7. attach-searched-product-image — anexa imagem buscada

### Apenas no Supabase Dashboard (NÃO estão no repo):
8. asaas-create-charge — cria cobrança PIX/cartão no Asaas com split automático
9. asaas-webhook — recebe confirmações do Asaas (pagamento confirmado/cancelado)
10. asaas-expire-pix — cron expira PIX pendentes (roda a cada 1min via pg_cron)
11. asaas-create-subaccount — cria subconta Asaas pra client_admin

**IMPORTANTE:** Todas Edge Functions com JWT verify OFF. Autenticação é feita dentro do código via `supabaseAdmin.auth.getUser(token)`.

---

## CONTEXTOS REACT

- **GestorContext:** effectiveClientId, clientName, isSuperAdmin, allClients, selectedClientId
- **CaixaContext:** eventId, clientId, cashRegisterId, cart, registerNumber, operatorName
- **BarContext:** eventId, clientId
- **ConsumerContext:** activeEvent, activeOrder, cart, consumptionLimits, location
- **WaiterContext:** sessionId, eventId, clientId, waiterId, waiterName, pendingCallsCount

---

## GUARDS

- **RoleGuard:** controla acesso por área (admin, gestor, caixa, bar, consumer, garcom)
- **RegistrationGuard:** verifica registration_complete no profile, redireciona pra /app/completar-cadastro
- **WaiterSessionGuard:** verifica sessão ativa do garçom
- **BarEventGuard:** verifica evento ativo no bar
- **GestorClientGuard:** verifica client selecionado no gestor
- **CaixaEventGuard:** verifica evento ativo no caixa
- **AuthGuard:** verifica sessão de login

---

## ASAAS — INTEGRAÇÃO DE PAGAMENTO (SANDBOX FUNCIONAL)

### Status dos métodos:
- PIX ✅ — QR code + copia-cola + timer 15min + webhook confirma
- Crédito ✅ — processamento instantâneo
- Débito ⬜ — pendente habilitar na subconta
- Dinheiro ✅ — garçom confirma via QR (não passa pelo Asaas)
- Split PIX+crédito ✅
- Split cartão+dinheiro ✅
- Split PIX+dinheiro ⬜ (não testado)

### Regras de negócio do pagamento:
- Cartão é SEMPRE o último a ser cobrado no split
- PIX/cash confirma primeiro → cartão cobra automático via realtime
- Pedido só vira 'paid' quando TODOS os pagamentos são confirmados
- PIX expira em 15 minutos → cron cancela automaticamente
- Consumidor não pode fechar app durante split com cartão pendente
- Se fechar e reabrir → tela "Finalize seu pagamento"
- Se cartão falha no split → permite trocar método mantendo PIX/cash já pago
- Pedido SÓ aparece na fila do bar DEPOIS de totalmente pago
- Estoque reservado APENAS quando pedido vira 'paid'
- create_consumer_split_order: digital nasce como 'pending', cash como 'partially_paid'

### Subconta Serena Bar (teste):
- client_id: cc032d5f-7258-4693-92c5-1dbe35519a37
- asaas_account_id: 25153437-4b96-4fb3-a0ae-85523312e3c9
- wallet_id: c39d0c79-c09a-4539-b272-3d4b069423b4

### Configuração:
- Secrets: ASAAS_API_KEY_SANDBOX, ASAAS_API_KEY_PROD, ASAAS_WEBHOOK_TOKEN (todos configurados)
- Webhook sandbox: configurado (sequencial, JSON, URL da Edge Function)
- Cron pg_cron: ativo, expira PIX a cada 1min
- Realtime: habilitado na tabela payments (ALTER PUBLICATION)
- CEP fallback: 88523000 (Lages/SC) hardcoded na Edge Function
- Tabela asaas_customer_map: mapeia user_id + CPF → customer Asaas (múltiplos customers por user, pois CPF pode ser diferente do perfil na hora do pagamento)

---

## CADASTRO DO CONSUMIDOR

- Campos obrigatórios: nome, CPF (validação real + unique), telefone celular (11 dígitos com DDD), CEP (ViaCEP automático), número do endereço
- Trigger **handle_new_user** lê TUDO do raw_user_meta_data no signUp (signup_source='consumer' insere role automaticamente)
- Google OAuth → RegistrationGuard redireciona pra /app/completar-cadastro (mesma tela do cadastro, com dados do Google pré-preenchidos)
- Botão "Sair" no completar-cadastro faz logout forçado
- CPF editável na hora do pagamento (pode ser diferente do perfil — ex: menor usando cartão dos pais)
- CPF duplicado bloqueado no cadastro com mensagem amigável

---

## SEGURANÇA APLICADA

- has_role_name/has_role: owner tratado como super_admin em todas policies
- RPCs de estoque (delete_stock_entry, update_stock_entry): validação role + client_id
- confirm_partial_delivery e confirm_cash_split_payment: anti-spoofing (auth.uid == p_staff_id)
- Rate limit: 5 pedidos/min por consumidor (check_order_rate_limit)
- Edge Functions: JWT verify OFF, validação dentro do código via supabaseAdmin.auth.getUser(token)
- .env no Git (anon key é pública por design, Lovable precisa pra build)

---

## FEATURES IMPLEMENTADAS

1. **Entrega parcial:** delivered_quantity no order_items, order_item_deliveries, confirm_partial_delivery RPC, QR só invalida quando TODOS itens entregues
2. **Split payment:** até 2 métodos, cartão sempre último, dinheiro via QR do garçom
3. **QR garçom por evento:** waiter_invites com join_code, rota /garcom/join/:joinCode, convites expiram ao encerrar evento
4. **Ativação de cliente:** super_admin cria client + user client_admin, Edge Functions: create-client-with-manager, create-super-admin
5. **Pagamento Asaas:** PIX, crédito, dinheiro, splits (detalhado acima)
6. **Cadastro consumidor:** CPF, telefone, CEP/ViaCEP, registro completo via trigger
7. **RegistrationGuard:** Google OAuth protegido, completar cadastro obrigatório
8. **Dashboard financeiro gestor:** métricas Asaas (faturamento, líquido, taxa, pendentes)
9. **Settings admin:** taxa Close Out, sandbox mode, valor mínimo, PIX expiração, fee_payer
10. **Flag sandbox por evento:** testar pagamento fake por evento individual
11. **Cartões salvos:** tokenização Asaas, listar/deletar no perfil, usar cartão salvo no pagamento

---

## TESTES

- 75 testes Vitest (9 arquivos) — podem estar desatualizados após mudanças do Asaas
- src/test/mocks.ts: mocks centralizados (Supabase, useAuth, contexts, guards, i18n, react-query)
- Arquivos: auth.test.tsx, admin.test.tsx, consumer.test.tsx, garcom.test.tsx, gestor.test.tsx, bar.test.tsx, caixa.test.tsx, password.test.ts

---

## PENDÊNCIAS

1. Débito no Asaas (habilitar na subconta)
2. Termos de uso (obrigatório antes de produção — processamento de pagamentos de terceiros)
3. Sandbox → produção (trocar flag + webhook + teste com R$2 real)
4. Teste ponta a ponta completo com todos os módulos
5. Editar perfil consumidor (tela feia, precisa refazer + deletar cartões + aviso ao trocar CPF)
6. Campos CEP/endereço no cadastro do client_admin
7. Onboarding/primeiro acesso client_admin (stepper guiado)
8. Notificações push (Consumer + Garçom)
9. Relatórios/exportação (Excel/PDF)
10. Capacitor apps nativos (Consumer + Garçom)
11. Split PIX+dinheiro (não testado)
12. Mapeamento completo de erros Asaas → mensagens amigáveis
13. Apple Sign In (pendente Apple Developer $99/ano)

---

## REGRAS CRÍTICAS PRO CLAUDE

1. NUNCA sugerir algo sem verificar se é possível primeiro
2. NUNCA dar dados inválidos (CPF, CEP, etc)
3. SEMPRE dar a solução certa e mais rápida — sem enrolação, sem achismo
4. Se não sabe, pesquisa antes de responder
5. Verificar planos contra o código real antes de apresentar
6. Discutir regras de negócio e confirmar ANTES de gerar código/prompts
7. Quebrar prompts Lovable em chunks claros e executáveis
8. Para SQL: usar CREATE OR REPLACE pra substituir RPCs
9. Edge Functions do Asaas ficam no Supabase Dashboard, NÃO no repo
10. Ale corrige planos mid-stream — absorver correções sem fricção

---

## TRANSCRIPTS E CONTEXTO

- Arquivo de contexto no repo: CLAUDE_CONTEXT.md
- Transcript sessão 1: /mnt/transcripts/2026-04-01-21-01-22-closeout-full-dev-plans-and-features.txt
- Transcript sessão 2: /mnt/transcripts/2026-04-14-12-09-12-closeout-full-dev-session-asaas-integration.txt
- Para detalhes técnicos específicos, clonar o repo e ler o código diretamente
