# CLOSE OUT — Memória do Projeto (atualizado 20/05/2026)

## STACK

- React 18 + Vite + Tailwind + shadcn/ui (Lovable) | Supabase | Asaas (PRODUÇÃO)
- Project: qfwyjatumwgdrzaqnmlg | Deploy: closeout.com.br

## ASAAS EM PRODUÇÃO

- URL: https://www.asaas.com/api/v3 (NÃO api.asaas.com)
- Taxas: PIX R$1,99 | Crédito 2,99%+R$0,49 | Débito 1,89%+R$0,35
- Fee hierárquica: event_override > billing_rules > client_default > global(10%)
- Split usa fixedValue (taxa Asaas repassada ao cliente)
- Subconta Serena Bar prod: account a9089831, wallet 73b402c4
- CRÍTICO: Todos 15 eventos em payment_sandbox_mode=true — split nunca testado em produção

## CORREÇÕES SESSÃO 19-20/05/2026

- get_orders_event_summary: GMV unificado com payments.amount WHERE approved
- bulk_cancel_open_qrs: checa payments approved antes de cancelar
- 17 pedidos intermediários cancelados (incluindo R$1M load test)
- VACUUM orders 37.6%→0%, payments 21.7%→0%, qr_tokens 19.8%→0%
- /app/meus-eventos: prompt Lovable aplicado (verificar deploy)

## TESTE ATÔMICO ~95% COBERTURA

- 65+ páginas testadas, 57 tabelas auditadas
- 20 bugs: 3 críticos, 5 altos, 12 médios
- RLS 100%, segurança verificada
- Relatório completo: /mnt/transcripts/2026-05-19-20-02-21-closeout-atomic-test-session.txt

## EDGE FUNCTIONS (13)

- Repo: create-client-with-manager, create-super-admin, create-invite-link, accept-invite, search-product-image, upload-product-image, attach-searched-product-image
- Dashboard: asaas-create-charge, asaas-webhook, asaas-expire-pix, asaas-create-subaccount, asaas-tokenize-card, asaas-healthcheck

## PENDÊNCIAS

1. URGENTE: Testar split com evento payment_sandbox_mode=false
2. URGENTE: Limpar dados load test dia 13/05
3. Cron auto-completar eventos vencidos
4. Filtrar draft events do seletor Caixa
5. Termos de uso
6. Consumer profile edit redesign
7. Client onboarding stepper
8. Push notifications (Capacitor)
9. Relatórios/export
10. Upgrade Supabase Pro

## TRANSCRIPTS

- /mnt/transcripts/2026-04-01-21-01-22-closeout-full-dev-plans-and-features.txt
- /mnt/transcripts/2026-04-14-12-09-12-closeout-full-dev-session-asaas-integration.txt
- /mnt/transcripts/2026-05-06-22-53-30-closeout-full-dev-session-admin-consumer-bar-security-testing.txt
- /mnt/transcripts/2026-05-07-22-43-27-closeout-full-dev-session-asaas-integration.txt
- /mnt/transcripts/2026-05-19-20-02-21-closeout-atomic-test-session.txt

## FEATURE COMANDA — COMPLETA (sessão 28/06/2026)

Modelo: comanda (cartão físico reutilizável c/ QR) em PARALELO ao pré-pago. Flag por evento.
Fluxo: escaneia cartão → cardápio liberado → pede fiado (cai no bar 'preparing') → garçom
entrega na mesa → paga no FIM (app via Asaas OU caixa via carimbo sem gateway) → comprovante.
Anti-calote = portão físico + cartão devolvido; CPF = identificação + blocklist. Calote que
fura o portão = prejuízo do BAR (não da plataforma) — deve estar no contrato B2B.
Monetização do segmento comanda = MENSALIDADE (fora do sistema); fee transacional zerável
via clients.default_fee_percent=0. Sem controle de mensalidade no sistema (decisão Vini).

### BANCO (testado c/ dados reais, advisor limpo, lixo de teste removido)

- Flag: events.comanda_enabled + event_settings.comanda_enabled (bool, default false)
- Tabela `comandas`: id, client_id, event_id, card_number, qr_token(unique), status
  ['free'|'open'|'paid'|'unsettled'], consumer_id, consumer_name/cpf/phone(snapshot),
  opened_at/paid_at/unsettled_at, paid_method, paid_via['app'|'caixa']. Índice parcial
  único ux_comandas_one_open_per_card (1 comanda open por cartão/evento).
- Tabela `comanda_blocklist`: client_id, cpf, consumer_name, reason, event_id_origin,
  comanda_id_origin. Unique (client_id, cpf). Blocklist é POR CLIENTE (não global).
- orders.comanda_id (FK) + orders.is_comanda_closeout (bool) — o "pedido-fechamento".
- RLS: comandas/comanda_blocklist SELECT p/ dono ou staff (user_belongs_to_client);
  escrita só via RPC SECURITY DEFINER. Constraint event_checkins.check_in_method aceita
  'comanda_qr'.
- 9 RPCs (todas SECURITY DEFINER + search_path + valida auth.uid()/role, anon revogado):
  open_comanda(p_qr_token) → abre sessão, valida flag/CPF/blocklist/cadastro, check-in auto
  create_comanda_order(params{comanda_id,items[{product_id|combo_id,quantity}],table_number,
  is_external_area}) → pedido nasce 'preparing' (cai no bar), SEM payment/QR, valida mesa
  close_comanda_caixa(p_comanda_id,p_method['dinheiro'|'pix'|'credit_card'|'debit_card']) →
  CARIMBO sem gateway, só staff
  close_comanda_app(p_comanda_id,p_payment_method['pix'|'credit_card'|'debit_card']) → cria
  pedido-fechamento (sem itens, is_comanda_closeout=true) + payment 'created'; devolve
  order_id/payment_id/amount p/ front chamar asaas-create-charge. NÃO marca paga (webhook faz)
  cancel_comanda_order(p_order_id,p_reason) → SÓ caixa/staff, SÓ pedido sem entrega
  (delivered_quantity=0 em todos os itens)
  settle_event_comandas(p_event_id) → comandas 'open'→'unsettled' + CPF na blocklist; só staff
  list_open_comandas(p_event_id,p_card_number?) → lista p/ caixa (exclui closeout do total)
  get_comanda_detail(p_comanda_id) → pedidos+total; CPF só p/ o DONO (null p/ staff/LGPD)
  get_event_comanda_summary(p_event_id) → baldes: comanda_app_total, comanda_caixa_total,
  comanda_caixa_breakdown{dinheiro,pix,credit_card,debit_card}, unsettled[], open_count
  - helper user_belongs_to_client(client_id)
- DECISÃO-CHAVE: pedido-fechamento é container SEM order_items (evita estoque duplicado no
  webhook). Todos os SUM de total excluem is_comanda_closeout=true (evita double-count).
- Estoque: comanda baixa na ENTREGA via confirm_partial_delivery (igual table service), não
  no pagamento. Pedido de comanda nasce 'preparing' pq fila do bar (ACTIVE_STATUSES) NÃO
  mostra 'pending'.

### EDGE FUNCTION

- asaas-webhook v7: quando pagamento de pedido is_comanda_closeout confirma → marca comanda
  paid via app + carimba paid_at nos pedidos de consumo. Pré-pago 100% intocado.
- asaas-create-charge: NÃO mudou (front chama igual ao pré-pago com IDs do close_comanda_app).

### FRONTEND (Lovable — verificado via grep, build OK; NÃO testado em runtime)

- Consumer: ConsumerContext (comanda_enabled+activeComanda); ConsumerComandaScan.tsx
  (/app/evento/:eventId/comanda/scan, html5-qrcode→open_comanda); gate no ConsumerCardapio
  (sem comanda aberta → "Leia o QR"); pedido fiado em ConsumerCarrinho+ConsumerMesa
  (create_comanda_order, desvia do pré-pago); ConsumerComanda.tsx (/app/comanda, detalhe+total
  realtime); ConsumerComandaFinalizar.tsx (/app/comanda/finalizar — caixa/PIX/cartão via
  close_comanda_app+asaas-create-charge); ConsumerComandaComprovante.tsx
  (/app/comanda/comprovante?order= — relógio AO VIVO anti-print, sem CPF).
- Caixa: aba Comandas (CaixaSidebar + /caixa/comandas, ScrollText); CaixaComandas.tsx
  (lista+busca nº+refresh 5min, checa comanda_enabled); CaixaComandaDetalhe.tsx
  (/caixa/comandas/:id — carimbo+cancelar pedido, sem CPF); CaixaComandaComprovante.tsx
  (/caixa/comandas/:id/comprovante — térmico). ThermalReceipt.tsx ganhou type "comanda".
- Gestor: GestorEventos.changeStatus chama settle_event_comandas ao completar (após
  close_event_cancel_unpaid); GestorEventoFechamento.tsx ganhou seção "Comandas" (baldes
  app/caixa c/ drill-down + lista não-recebidas COM CPF + aviso open_count).
- Bar: BarFilaPedidos.tsx — selo indigo "Comanda #N" no OrderCard (join comandas(card_number)).

### PENDÊNCIAS COMANDA (antes de soltar p/ cliente)

1. CRÍTICO: testar pagamento REAL Asaas no fluxo comanda-app (PIX R$1) — só foi simulado no
   banco. Caminho pedido-fechamento→charge→webhook nunca rodou com dinheiro real.
2. Teste manual runtime de TODOS os fluxos (scanner abrindo câmera, realtime PIX, gate
   escondendo cardápio). Build passou mas runtime não foi testado.
3. Verificar edge case: app reaberto com comanda já aberta — activeComanda depende de
   activeEvent (check-in ativo); se cadeia falhar, cai no gate de novo.
4. Contrato B2B precisa explicitar que calote que fura o portão é risco do bar.
5. (Pré-existente, ainda vale) testes Vitest stale: ConsumerCadastro/ConsumerQR falham, não
   relacionado à comanda.
