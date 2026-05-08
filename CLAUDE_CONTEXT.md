# CLOSE OUT — Memória do Projeto (atualizado 08/05/2026)

## STACK
- React 18 + Vite + Tailwind + shadcn/ui (Lovable) | Supabase | Asaas (PRODUÇÃO)
- Project: qfwyjatumwgdrzaqnmlg | Deploy: closeout.lovable.app

## ASAAS EM PRODUÇÃO
- URL: https://www.asaas.com/api/v3 (NÃO api.asaas.com)
- Taxas: PIX R$1,99 | Crédito 2,99%+R$0,49 | Débito 1,89%+R$0,35
- Fee hierárquica: event_override > billing_rules > client_default > global(10%)
- Serena Bar=5%, Boliche=6.5%
- Split usa fixedValue (taxa Asaas repassada ao cliente)
- Subconta Serena Bar prod: account a9089831-664f-4a00-bc57-87bc8cc3e663, wallet 73b402c4-f7de-4fbf-b67e-ed87e2e15923
- asaas-expire-pix verifica Asaas antes de expirar (recupera pagos)
- QR PIX retry 3x com delay 1.5s
- Taxas em platform_settings: asaas_fee_pix, asaas_fee_credit_fixed/percent, asaas_fee_debit_fixed/percent

## OTIMIZAÇÕES
- next_order_number() com sequence nativa
- idx_user_roles_user_role, idx_orders_consumer_event
- ux_user_roles_one_consumer_per_user
- bulk_cancel_open_qrs RPC (libera estoque + preserva pagos)
- Limite: ~80 simultâneos no Free | k6: 250 VUs, 4149 pedidos, 99.95% sucesso

## CAMPOS NOVOS
- clients: postal_code, owner_birth_date, income_value, address_number, province, mobile_phone
- platform_settings: asaas_fee_pix, asaas_fee_credit_fixed, asaas_fee_credit_percent, asaas_fee_debit_fixed, asaas_fee_debit_percent

## RPCs NOVAS
- get_gestor_fee_breakdown(p_client_id, p_start_date, p_end_date, p_event_id)
- get_gestor_top_products, get_orders_event_summary, bulk_cancel_open_qrs, next_order_number

## PENDÊNCIAS
1. Testar pagamento com novo split fixedValue
2. KPI Taxa Gateway no Gestor (verificar render)
3. Termos de uso
4. Consumer profile edit
5. Client onboarding stepper
6. Push notifications
7. Relatórios/export
8. Capacitor native
9. Apple Sign In
10. Upgrade Supabase Pro (300+ pessoas)

## TRANSCRIPTS
- /mnt/transcripts/2026-04-01-21-01-22-closeout-full-dev-plans-and-features.txt
- /mnt/transcripts/2026-04-14-12-09-12-closeout-full-dev-session-asaas-integration.txt
- /mnt/transcripts/2026-05-06-22-53-30-closeout-full-dev-session-admin-consumer-bar-security-testing.txt
- /mnt/transcripts/2026-05-07-22-43-27-closeout-full-dev-session-asaas-integration.txt
