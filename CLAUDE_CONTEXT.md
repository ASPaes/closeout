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
