# Close Out — Contexto Completo do Projeto
# Última atualização: 14/04/2026
# Ler este arquivo no início de cada nova sessão de desenvolvimento

## Stack e Infraestrutura
- Frontend: React + Vite + Tailwind + shadcn/ui (via Lovable)
- Backend: Supabase (Project ID: qfwyjatumwgdrzaqnmlg)
- Repo: github.com/ASPaes/closeout
- GitHub PAT: github_pat_11B57HQLQ0jLKRQykYccjA_... (tokens expiram, pedir novo se necessário)
- Design: dark theme, primária laranja hsl(24,100%,50%)
- 6 módulos: Admin(/admin), Gestor(/gestor), Caixa(/caixa), Bar(/bar), Consumidor(/app), Garçom(/garcom)
- 50+ telas, 34+ tabelas, 64+ migrations, 7+ Edge Functions
- Google OAuth configurado e funcionando
- Apple Sign In pendente (Apple Developer $99/ano)

## Workflow
- Frontend: SEMPRE via Lovable prompts (nunca editar código direto no repo pra frontend)
- DB/RPCs: Supabase Dashboard SQL Editor
- Edge Functions: Supabase Dashboard (criar/editar)
- Testes: Vitest (75/75 passando) — podem estar desatualizados após mudanças recentes
- Ale NÃO usa Supabase CLI localmente

## Hierarquia de Roles
owner(Ale, único) → super_admin(sócios) → client_admin(dono bar) → client_manager(gerente) → venue_manager/event_manager → staff/bar_staff/waiter/cashier → consumer
- has_role_name trata owner como super_admin em TODAS as 228 policies
- Todos os roles podem acessar /app (consumidor)

## Features Implementadas

### Pagamento Asaas (FUNCIONANDO no sandbox)
- PIX ✅ — QR code + copia-cola + timer 15min + webhook confirma
- Cartão crédito ✅ — processamento instantâneo
- Cartão débito ⬜ — pendente habilitar na subconta Asaas
- Dinheiro ✅ — garçom confirma via leitura QR
- Split PIX + crédito ✅ — PIX primeiro, cartão cobra automático via realtime
- Split cartão + dinheiro ✅ — garçom confirma cash, cartão cobra automático
- Split PIX + dinheiro — não testado ainda

### Regras de pagamento
- Cartão SEMPRE último no split
- Pedido só vira 'paid' quando TODOS pagamentos confirmados
- PIX expira 15min → pedido cancela automaticamente (cron pg_cron)
- Consumidor não pode fechar app durante split com cartão
- Se fechar e reabrir → tela "Finalize seu pagamento"
- Se cartão falha no split → permite trocar método mantendo PIX/cash pago

### Cadastro do consumidor
- Campos obrigatórios: nome, CPF (validação real + unique), telefone celular (11 dígitos c/ DDD), CEP (ViaCEP automático), número endereço
- Trigger handle_new_user lê tudo do raw_user_meta_data (signup_source='consumer' insere role)
- Google OAuth → RegistrationGuard redireciona pra /app/completar-cadastro
- Botão "Sair" no completar-cadastro faz logout forçado
- CPF editável na hora do pagamento (pode ser diferente do perfil — ex: cartão dos pais)
- Tabela asaas_customer_map: mapeia user_id + CPF → customer Asaas (múltiplos customers por user)

### Entrega parcial
- delivered_quantity no order_items
- order_item_deliveries table
- confirm_partial_delivery RPC
- QR só invalida quando TODOS os itens entregues
- Status partially_delivered

### Split payment (RPC)
- create_consumer_split_order: até 2 métodos, digital nasce como 'pending', cash como 'partially_paid'
- confirm_cash_split_payment: garçom confirma cash via QR
- close_event_cancel_unpaid: cancela pedidos não pagos ao encerrar evento
- Rate limit: 5 pedidos/min por consumidor

### Garçom QR onboarding
- waiter_invites com join_code único
- Rota /garcom/join/:joinCode
- Convites expiram ao encerrar evento

### Client activation
- Edge Functions: create-client-with-manager, create-super-admin
- Dialog de sucesso com credenciais copiáveis

## Edge Functions (Supabase Dashboard)
1. create-client-with-manager — ativa cliente + cria user client_admin
2. create-super-admin — cria super_admin
3. create-invite-link — convite genérico
4. accept-invite — aceita convite
5. asaas-create-charge — cria cobrança PIX/cartão no Asaas (JWT verify OFF)
6. asaas-webhook — recebe confirmações do Asaas (JWT verify OFF)
7. asaas-expire-pix — cron expira PIX pendentes
8. asaas-create-subaccount — cria subconta Asaas pra client_admin

IMPORTANTE: Todas Edge Functions com JWT verify OFF. Autenticação feita dentro do código via supabaseAdmin.auth.getUser(token).

## Asaas — Dados de Configuração
- Subconta Serena Bar: 
  - client_id: cc032d5f-7258-4693-92c5-1dbe35519a37
  - asaas_account_id: 25153437-4b96-4fb3-a0ae-85523312e3c9
  - wallet_id: c39d0c79-c09a-4539-b272-3d4b069423b4
- Secrets configurados: ASAAS_API_KEY_SANDBOX, ASAAS_API_KEY_PROD, ASAAS_WEBHOOK_TOKEN
- Webhook sandbox configurado (sequencial, JSON)
- Cron pg_cron ativo (expira PIX a cada 1min)
- Realtime habilitado na tabela payments (ALTER PUBLICATION)
- CEP fallback hardcoded: 88523000 (Lages/SC)

## Segurança aplicada
- has_role_name/has_role: owner tratado como super_admin
- RPCs de estoque: validação role + client_id
- confirm_partial_delivery/confirm_cash_split_payment: anti-spoofing (auth.uid == p_staff_id)
- Rate limit: 5 pedidos/min
- .env no Git (anon key é pública, Lovable precisa pra build)

## Bugs corrigidos nesta sessão
1. QR sumia após entrega parcial
2. WaiterPedidos lista cash removida (só via QR)
3. InvitePage redirect
4. RoleGuard venue_manager/event_manager
5. Google OAuth redirect
6. GestorEventoFechamento crash (cashRegisters/cancellations undefined)
7. Password requirements sempre visíveis
8. Login erro traduzido
9. Edge Function Invalid JWT → fix: supabaseAdmin.auth.getUser(token)
10. Cartão dados faltantes no body → fix: campos direto no body
11. CEP inválido na Edge Function → fix: 88523000
12. Split cartão não mostrava cartões salvos → fix: condição splitHasCard
13. Split não processava os dois pagamentos → fix: refatoração completa
14. Tela travava em "Cobrando cartão" quando erro → fix: try/catch

## Pendências para pt2
1. Débito no Asaas (habilitar na subconta)
2. Termos de uso (obrigatório antes de produção)
3. Sandbox → produção
4. Teste ponta a ponta completo com todos os módulos
5. Editar perfil consumidor (tela feia + deletar cartões + aviso trocar CPF)
6. Campos CEP/endereço no cadastro do client_admin
7. Consumer onboarding/primeiro acesso client_admin
8. Notificações push
9. Relatórios/exportação
10. Capacitor apps nativos
11. Split PIX + dinheiro (não testado)
12. Mapeamento completo de erros Asaas → mensagens amigáveis

## Regra pro Claude
NUNCA sugerir algo sem verificar se é possível primeiro.
NUNCA dar dados inválidos (CPF, CEP).
SEMPRE dar a solução certa e mais rápida.
Sem enrolação, sem achismo.
Se não sabe, pesquisa antes de responder.
Ale é direto, paga caro, não tolera erro repetido.
