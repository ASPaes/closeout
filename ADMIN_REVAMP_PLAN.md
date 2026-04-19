# Close Out — Admin Revamp: Plano Mestre

> **Versão:** 1.0
> **Criado em:** 19/04/2026
> **Status:** Aprovado — pronto para execução
> **Owner:** Vini (ASPaes)
> **Última auditoria de infraestrutura:** 19/04/2026 (repo em `cfe5623`, DB em produção)

Este documento é a **fonte única da verdade** para o revamp completo do módulo Admin da plataforma Close Out. Consolida a conversa de discovery, auditoria do código e banco, decisões de negócio, arquitetura e plano de execução em 10 fases. Substitui qualquer informação divergente em `CLAUDE_CONTEXT.md` ou userMemories no que se refere a este projeto.

---

## Índice

- [§1 Contexto e objetivos](#1-contexto-e-objetivos)
- [§2 Arquitetura final — 20 telas](#2-arquitetura-final--20-telas)
- [§3 Decisões de negócio](#3-decisões-de-negócio)
- [§4 Matriz dos 81 itens](#4-matriz-dos-81-itens)
- [§5 Fases de execução](#5-fases-de-execução)
- [§6 Pré-requisitos operacionais da Fase 4b (Asaas)](#6-pré-requisitos-operacionais-da-fase-4b-asaas)
- [§7 Infraestrutura nova — catálogo completo](#7-infraestrutura-nova--catálogo-completo)
- [§8 Débitos técnicos conhecidos](#8-débitos-técnicos-conhecidos)
- [§9 Glossário](#9-glossário)
- [§10 Decisões revistas](#10-decisões-revistas)
- [§11 Changelog](#11-changelog)

---

## §1 Contexto e objetivos

### 1.1 Situação atual

O módulo Admin do Close Out (`/admin`) tem hoje **7 rotas** (`dashboard`, `clients`, `venues`, `events`, `users`, `audit-logs`, `settings`), mas serve basicamente como CRUD administrativo simples com 4 cards de contagem no painel principal.

A plataforma em produção tem:
- 4 clients ativos (Serena Bar, Boliche Lages, Bryan, +1)
- 6 eventos (1 active, 4 completed, 1 draft)
- 13 pedidos processados (todos consumer_app até agora)
- 19 pagamentos (11 approved, 4 failed, 4 processing)
- 469 registros em `audit_logs`
- 5 regras em `billing_rules` (3 tipos: transaction_fee, monthly_saas, activation_fee)
- 1 subconta Asaas configurada (Serena Bar — sandbox)
- 12 Edge Functions ativas, 93 funções PL/pgSQL, 88 triggers, 1 cron job

### 1.2 Propósito do módulo Admin

Após discovery com o Vini, o módulo Admin tem **três propósitos dominantes** (em ordem):

1. **Estratégico** — métricas de negócio para tomada de decisão (MRR, GMV, LTV, crescimento, churn, concentração de receita)
2. **Administrativo** — gestão de clients, locais, eventos, usuários e configurações
3. **Operacional de plataforma** (não de evento) — saúde da infraestrutura, alertas de incidentes, segurança, pagamentos problemáticos

O que explicitamente **não** é propósito do Admin: operação de evento ao vivo (isso vive no módulo Gestor), acompanhamento de pedidos individuais (módulo Bar), check-in de consumidores (módulo Consumidor).

### 1.3 Por que o revamp agora

- Dashboard atual mostra 4 cards inúteis ("Total Clientes: 4", "Total Locais: 4") que não orientam nenhuma decisão.
- Zero visibilidade de receita da plataforma (MRR, fees, GMV).
- Zero visibilidade operacional de saúde (webhook falhando? PIX travado? client inativo? Descobre-se tarde demais).
- Zero sistema de cobrança da plataforma aos clients — `billing_rules` define regras mas não há como saber quem pagou/está em atraso.
- Crescendo pra 20+ clients, essa ausência vira blocker operacional.

### 1.4 Princípios norteadores

- **Agrupamento por intenção, não por entidade** — menu separa Análise / Operações / Gestão / Sistema, não "Clientes / Eventos / Produtos".
- **Painel é resumo executivo** — visão em 10 segundos, drill-down nas telas específicas.
- **Toda tela tem propósito único e curto** — 20 telas pequenas > 6 telas gigantes.
- **Aproveita o que existe** — a auditoria revelou muito mais infra pronta do que esperado; apenas o estritamente necessário vira tabela/RPC nova.
- **Performance primeiro** — 401 lints de performance no banco precisam ser resolvidos antes de construir dashboards, senão Admin nasce lento.

---

## §2 Arquitetura final — 20 telas

### 2.1 Estrutura de navegação

```
NAVEGAÇÃO ADMIN
├─ Painel                         [resumo executivo]
│
├─ ANÁLISE (7 telas)
│  ├─ Receita                     [MRR, ARR, fees, ARPU, crescimento MoM]
│  ├─ GMV & Transações            [volume da plataforma, take rate]
│  ├─ Crescimento                 [aquisição, churn, funil de ativação]
│  ├─ Clientes (analítico)        [LTV, top, concentração, risco, expansão]
│  ├─ Eventos (analítico)         [realizados, ticket, duração, horários]
│  ├─ Produtos & Vendas           [top produtos, categorias]
│  ├─ Comportamento               [DAU/WAU/MAU, retenção, picos]
│  └─ Geografia                   [mapa, regiões, expansão]
│
├─ OPERAÇÕES (4 telas)
│  ├─ Central de Alertas          [inbox de incidentes]
│  ├─ Eventos Ativos              [eventos rolando agora, realtime]
│  ├─ Pagamentos                  [conversão, PIX, cartão, chargebacks]
│  ├─ Saúde da Plataforma         [Edge Functions, webhooks, pg_cron, storage]
│  └─ Segurança & Auditoria       [sessões, IPs, RLS bloqueado, secrets]
│
├─ GESTÃO (4 telas — CRUD revitalizado)
│  ├─ Clientes                    [lista + detalhe individual]
│  ├─ Locais                      [lista + detalhe individual]
│  ├─ Eventos                     [lista + calendário + detalhe]
│  └─ Usuários e Papéis           [já robusto, só enriquecer]
│
└─ SISTEMA (2 telas)
   ├─ Planos & Billing            [faturas plataforma → clients]
   └─ Configurações               [global platform_settings]
```

*Contagem: 1 + 7 + 5 + 4 + 2 = **19 itens no menu**. A Central de Alertas é a 20ª tela por convenção (inclui badge de contagem no sidebar).*

### 2.2 Detalhamento tela a tela

Cada tela abaixo lista: **propósito · KPIs · visualizações · ações · fonte de dados**.

#### 2.2.1 Painel (`/admin`)

- **Propósito:** resumo executivo. "O que eu preciso saber em 10s ao abrir o Admin."
- **KPIs (6 cards):**
  1. MRR + variação vs mês anterior
  2. GMV do mês + variação
  3. Receita total do mês (MRR + fees)
  4. Novos clients no mês
  5. Eventos ativos agora
  6. Alertas abertos (com badge)
- **Gráficos resumidos:**
  - Série temporal de receita últimos 30 dias
  - Top 5 clients por GMV do mês
- **Operacional:**
  - Lista dos 3-5 alertas abertos mais críticos (link "ver todos")
  - Semáforo de saúde geral (4 linhas: plataforma / pagamentos / segurança / eventos)
- **Filtro:** período global (hoje / 7d / 30d / mês)
- **Fonte:** RPC `get_admin_dashboard_metrics` + `get_platform_health_summary`

#### 2.2.2 Análise → Receita (`/admin/analise/receita`)

- **Propósito:** quanto o Close Out está faturando e como evolui.
- **KPIs:** MRR realizado, MRR esperado, ARR, Receita de fees, Receita total, ARPU, Receita nova vs recorrente, Crescimento MoM (receita)
- **Gráficos:**
  - Evolução MRR últimos 12 meses (linha)
  - Receita total empilhada (mensalidade vs fee) por mês
  - Breakdown nova vs recorrente (stacked bar)
  - Crescimento MoM em %
- **Tabelas:** receita por client (ranking), histórico de invoices recentes
- **Filtros:** período, tipo (mensalidade / fee / ativação)
- **Fonte:** RPC `get_revenue_metrics` (consome `platform_invoices` + `payments.closeout_amount` + `billing_rules`)

#### 2.2.3 Análise → GMV & Transações (`/admin/analise/gmv`)

- **Propósito:** volume financeiro que passa pela plataforma.
- **KPIs:** GMV total, Take rate médio, Ticket médio plataforma, Total pedidos, Consumers únicos
- **Gráficos:**
  - GMV por dia/semana/mês (linha)
  - GMV por client (barras horizontais)
  - GMV por local
  - GMV por método de pagamento (pizza)
  - Ticket médio ao longo do tempo
- **Tabelas:** top clients, top locais
- **Filtros:** período, client, local, método
- **Fonte:** RPC `get_gmv_metrics`

#### 2.2.4 Análise → Crescimento (`/admin/analise/crescimento`)

- **Propósito:** aquisição e retenção da base de clients.
- **KPIs:** Novos clients no período, Taxa de ativação, Churn rate, Churn revenue, Net New Revenue
- **Gráficos:**
  - Novos clients/mês (barras)
  - Funil de ativação (cadastrados → ativados → 1º evento → recorrentes)
  - Curva de churn mensal
  - Cascata NNR (+ novos, − churn, = líquido)
  - Distribuição de tempo até primeiro evento
- **Tabelas:** clients cadastrados no período + status, clients que deram churn
- **Fonte:** RPC `get_growth_metrics` (depende de `platform_invoices` pra churn real)

#### 2.2.5 Análise → Clientes (analítico) (`/admin/analise/clientes`)

- **Propósito:** análise profunda da base (não é CRUD — CRUD fica em Gestão).
- **KPIs:** LTV médio, Top 10 por receita, Concentração top 3/5/10, Clients em risco
- **Gráficos:**
  - LTV por cohort (mensal)
  - Concentração de receita (Pareto)
  - Distribuição por faixa de faturamento
- **Tabelas:**
  - Top 10 clients por receita
  - Clients em risco (score composto: inatividade + queda + ticket médio + sem eventos)
  - Clients com expansão (histórico via `audit_logs`)
- **Fonte:** RPC `get_client_value_metrics`

#### 2.2.6 Análise → Eventos (analítico) (`/admin/analise/eventos`)

- **Propósito:** análise histórica de eventos já realizados.
- **KPIs:** Eventos realizados/mês, Ticket médio por evento, Faturamento médio, Duração média, Taxa de sucesso
- **Gráficos:**
  - Eventos/mês (barras)
  - Heatmap dia da semana × hora (horários mais movimentados)
  - Distribuição de duração
- **Tabelas:** top eventos por GMV
- **Fonte:** RPC `get_events_analytics` (consome `events` + `orders` + RPC existente `get_events_revenue`)

#### 2.2.7 Análise → Produtos & Vendas (`/admin/analise/produtos`)

- **Propósito:** o que está sendo vendido na plataforma.
- **KPIs:** Total unidades vendidas, Categoria líder, Ticket médio por consumer
- **Gráficos:**
  - Top 20 produtos (barras horizontais)
  - Categorias mais vendidas (pizza)
  - Evolução de vendas por categoria
- **Tabelas:** ranking completo com drill-down "clients que mais vendem produto X"
- **Fonte:** RPC `get_products_analytics` (consome `order_items` + `products` + `categories`)

#### 2.2.8 Análise → Comportamento (`/admin/analise/comportamento`)

- **Propósito:** quem compra, quando, com que frequência.
- **KPIs:** DAU, WAU, MAU, Taxa de retorno, Frequência média
- **Gráficos:**
  - DAU/WAU/MAU últimos 90 dias
  - Heatmap horários de pico (dia da semana × hora)
  - Cohort de retenção (7d/30d/90d)
  - Distribuição de frequência de compra
- **Tabelas:** consumers mais recorrentes
- **Fonte:** RPC `get_behavior_metrics` (consome `orders` + `profiles` + `auth.users.last_sign_in_at`)

#### 2.2.9 Análise → Geografia (`/admin/analise/geografia`)

- **Propósito:** distribuição e expansão geográfica.
- **KPIs:** Estados cobertos, Cidade líder, Concentração regional
- **Visualização:**
  - Mapa do Brasil com calor por estado
  - Ranking de cidades
  - Linha temporal de expansão (novos estados/cidades ao longo do tempo)
- **Tabelas:** clients por estado, faturamento por região
- **Fonte:** RPC `get_geography_metrics` (consome `venues.city/state/lat/lng` + `profiles.city/state`)

#### 2.2.10 Operações → Central de Alertas (`/admin/operacoes/alertas`)

- **Propósito:** inbox único de incidentes da plataforma.
- **Abas:** Abertos / Em investigação / Resolvidos
- **Item do inbox (cada alerta):** severidade (crítico/alto/médio/baixo), categoria (plataforma/clients/pagamentos/segurança), descrição, quando, link para contexto, ações (investigar / resolver / dismiss / adicionar nota)
- **Filtros:** categoria, severidade, período, client relacionado
- **Fonte:** tabela nova `platform_alerts` + RPCs detectoras (§7)

#### 2.2.11 Operações → Eventos Ativos (`/admin/operacoes/eventos-ativos`)

- **Propósito:** o que está rolando agora na plataforma inteira.
- **Visualização:** lista de eventos com status `active` + Realtime
- **Cada evento mostra:** client, local, pedidos em andamento, faturamento parcial, tempo decorrido, taxa de sucesso ao vivo
- **Drill-down:** clicar abre painel lateral com detalhes (pedidos travados, problemas)
- **Fonte:** RPC `get_active_events_overview` + Realtime em `orders` e `events`

#### 2.2.12 Operações → Pagamentos (`/admin/operacoes/pagamentos`)

- **Propósito:** saúde operacional dos pagamentos.
- **KPIs:** Taxa de conversão, Taxa de PIX expirado, Cartões recusados (últimas 24h), Pedidos em partially_paid travados, Tempo médio de confirmação
- **Gráficos:**
  - Taxa de conversão ao longo do tempo
  - PIX expirado por dia
  - Falhas por bandeira de cartão
- **Tabelas:**
  - Pedidos travados agora (com tempo decorrido + ação "cancelar")
  - Chargebacks/disputas Asaas (após F6)
  - Saldo pendente vs disponível nas subcontas (via API Asaas)
  - Taxa efetiva Asaas por client
- **Fonte:** RPC `get_payments_operational_metrics` + Edge Function `asaas-balance-proxy` (F6)

#### 2.2.13 Operações → Saúde da Plataforma (`/admin/operacoes/saude`)

- **Propósito:** telemetria da infraestrutura Supabase + Asaas.
- **Seções (uma por linha):**
  - Edge Functions: 12 ativas, erros últimas 24h, tempo médio de resposta
  - Webhooks Asaas: taxa de sucesso, últimos falhos
  - pg_cron: jobs ativos, última execução, falhas
  - Realtime: conexões ativas, travamentos
  - Storage: uso vs limite, top buckets (client-logos, avatars, event-images)
  - API Supabase: requests/min, uso vs plano
  - Taxa de erro geral: % requests com erro últimas 24h
- **Fonte:** Edge Function nova `platform-health-proxy` que chama Supabase Management API + queries em `cron.job_run_details` e `payments.webhook_data`

#### 2.2.14 Operações → Segurança & Auditoria (`/admin/operacoes/seguranca`)

- **Propósito:** visibilidade de eventos de segurança e mudanças sensíveis.
- **Seções:**
  - **Sessões ativas:** lista agrupada por user_id, com IP + user_agent + criada em. Alerta em múltiplas sessões.
  - **IPs novos:** logins vindos de IPs nunca vistos antes para aquele user.
  - **Permissões bloqueadas (RLS):** tentativas que caíram em RLS (após F6).
  - **Mudanças de schema:** alterações em RPCs/policies via event trigger DDL (após F6).
  - **Secrets:** lista com data de expiração cadastrada (após F6).
- **Fonte:** `auth.sessions` + `rls_violations` (F6) + `audit_logs` filtrado + `secrets_registry` (F6)

#### 2.2.15 Gestão → Clientes (`/admin/gestao/clientes` + `/admin/gestao/clientes/:id`)

- **Propósito:** CRUD enriquecido + página de detalhe.
- **Lista (melhora da tela atual):**
  - Colunas: nome, plano, MRR que gera, último evento, saúde (✅/⚠️/🔴), status, ações
  - Filtros: status, tem evento ativo, tem subconta Asaas, tem billing_rule ativa
  - Ordenação por coluna, busca, paginação
- **Detalhe (nova página):**
  - Dados cadastrais + bancários + billing rules
  - Faturamento gráfico (histórico mensal)
  - Locais vinculados, usuários, eventos históricos
  - Histórico de billing (invoices)
  - Ações: suspender, reativar (com opcional nova activation_fee), trocar plano, exportar dados, emitir fatura manual
- **Fonte:** `clients` + joins + `platform_invoices` + RPC `get_client_360(client_id)`

#### 2.2.16 Gestão → Locais (`/admin/gestao/locais` + `/admin/gestao/locais/:id`)

- **Lista:**
  - Colunas: nome, client dono, eventos realizados, GMV acumulado, status operacional (tem evento ativo?)
  - Filtros: client, status, com/sem eventos
- **Detalhe:** eventos históricos, faturamento, consumers únicos, mapa do venue (se lat/lng preenchido)
- **Fonte:** `venues` + joins + RPC `get_venue_360(venue_id)`

#### 2.2.17 Gestão → Eventos (`/admin/gestao/eventos` + `/admin/gestao/eventos/:id`)

- **Lista dupla:** lista normal + visualização de calendário (toggle)
- **Filtros:** status, client, local, período, tipo de evento
- **Detalhe:** timeline completa, produtos mais vendidos, pedidos, problemas operacionais que rolaram
- **Fonte:** `events` + RPC `get_event_360(event_id)`

#### 2.2.18 Gestão → Usuários e Papéis (`/admin/gestao/usuarios` + `/admin/gestao/usuarios/:id`)

- **Lista (melhora da tela atual já robusta):**
  - Filtros adicionais: último login (>30d sem logar), sessões ativas agora, role
  - Ações em massa
- **Detalhe:** auditoria completa do user (últimas ações em `audit_logs`), sessões ativas, IPs recentes, roles atribuídas
- **Fonte:** `profiles` + `user_roles` + `auth.sessions` + `auth.users` + `audit_logs`

#### 2.2.19 Sistema → Planos & Billing (`/admin/sistema/billing`)

- **Propósito:** gestão de faturas emitidas da plataforma aos clients.
- **KPIs topo:**
  - MRR esperado
  - MRR recebido no mês (com % progresso)
  - A vencer próximos 7 dias
  - Em atraso
- **Abas:** Todas / Em aberto / Pagas / Em atraso
- **Filtros:** client, tipo (mensalidade/ativação/ajuste), período, busca
- **Tabela:** invoices com client, tipo, período, valor, vencimento, status, ações
- **Ações:**
  - Marcar como paga (modal com data, método, valor, notas, número NF opcional)
  - Cancelar invoice (com motivo)
  - Cobrar via Asaas (após F4b — gera link de pagamento)
  - Gerar fatura manual (modal de criação)
  - Baixar dados pra NF (JSON/CSV com dados pra colar no portal do ISS)
- **Aba secundária: Regras ativas** — lista de `billing_rules` ativas por client + projeção de receita dessas regras
- **Fonte:** `platform_invoices` + `billing_rules` + RPC `get_billing_dashboard`

#### 2.2.20 Sistema → Configurações (`/admin/sistema/configuracoes`)

- **Propósito:** configurações globais da plataforma.
- **Seções (mantém o que já existe + novos):**
  - Padrões da plataforma (geo_radius, max_order, alert_minutes) ✓ já existe
  - Pagamentos Asaas (sandbox mode, fee%, min_order, PIX expire, fee_payer) ✓ já existe
  - **Novo:** Política de atraso (overdue_fine_percent, overdue_interest_percent_month, overdue_grace_days, auto_suspend_after_days)
  - **Novo:** Feature flags (reserva pra futuras features)
  - **Novo:** Integrações (Asaas, ViaCEP, Google OAuth) — só leitura de status

---

## §3 Decisões de negócio

Estas decisões foram tomadas por mim (Claude) a pedido do Vini de fazer "a melhor versão", com justificativa técnica. Podem ser revistas a qualquer momento (§10).

### 3.1 Emissão de Nota Fiscal (NFS-e)

**Decisão:** NF **manual no começo**, estrutura preparada pra automatizar depois.

**Como funciona:**
- `platform_invoices` terá colunas `invoice_number_external` (nullable), `invoice_number_issued_at` (nullable), `invoice_pdf_url` (nullable).
- Na UI, ao marcar uma fatura como paga, campo opcional "Número da NF" é exibido.
- Botão "Baixar dados pra NF" gera JSON/CSV com dados do client + valor + período pra colar no portal do ISS ou plataforma de NF (eNotas, Bling, NFE.io).

**Justificativa:**
- Emissão automática requer certificado digital A1 + integração com ISS local ou plataforma paga — sub-projeto em si.
- Com 3-4 clients hoje, emissão manual é operacionalmente viável.
- Estrutura do banco fica pronta pra automação futura sem migration dolorosa.

**Débito técnico:** integração NFS-e automatizada (ver §8).

### 3.2 Taxa de ativação

**Decisão:** cobrada **1x por ciclo do client**, com possibilidade de recobrar em reativação mediante **decisão explícita do admin**.

**Como funciona:**
- Flag em `clients`: **`activation_fee_charged`** (boolean, default `false`).
- Trigger ou RPC gera `activation_invoice` automaticamente na primeira vez que o client tem status → `active`, desde que haja regra `activation_fee` ativa em `billing_rules`. Ao gerar, marca `activation_fee_charged = true`.
- Reativação de client (`suspended` → `active`) **não** gera nova invoice automaticamente.
- UI na tela Clientes, ao reativar, exibe checkbox opcional "Cobrar nova taxa de ativação? R$ X" — decisão do admin.

**Justificativa:**
- Default "não recobrar" protege contra cobranças indevidas em suspensões temporárias técnicas.
- Permite exceção comercial quando faz sentido.
- "Gerar fatura manual" cobre casos não-previstos.

### 3.3 Início da contagem do monthly_saas

**Decisão:** começa a partir de **`billing_start_date`** (novo campo em `billing_rules`), default = data de criação da regra.

**Como funciona:**
- Nova coluna `billing_rules.billing_start_date` (DATE NOT NULL DEFAULT `CURRENT_DATE`).
- Primeira invoice é gerada no **primeiro `billing_day` ≥ `billing_start_date`**.
  - Exemplo 1: Regra criada 16/03 com `billing_day=28` → 1ª invoice gerada em 28/03.
  - Exemplo 2: Regra criada 30/03 com `billing_day=28` → 1ª invoice gerada em 28/04 (já passou o 28/03).
- UI: campo "Data de início da cobrança" com calendário, default hoje.
- Ajustando pra frente = período de trial grátis.

**Justificativa:**
- Flexibilidade sem complexidade.
- Nunca gera invoice retroativa.
- Data explícita > data inferida (evita bugs em edição de regra).

### 3.4 Pro-rata no primeiro mês

**Decisão:** **mês cheio por padrão**, com flag opcional por regra.

**Como funciona:**
- Nova coluna `billing_rules.prorate_first_month` (boolean, default `false`).
- Se `false`: primeira invoice = valor cheio, independente do dia que começou.
- Se `true`: primeira invoice = `ROUND((monthly_amount × dias_restantes_no_mês) / dias_no_mês, 2)`.
  - Exemplo: R$ 600, começa dia 16/04 (abril 30d, restam 15d) → R$ 300,00.
- Invoices subsequentes sempre cheias.
- UI: checkbox "Cobrar proporcional no 1º mês" na regra.

**Justificativa:**
- Mês cheio é padrão SaaS B2B no Brasil.
- Pro-rata disponível como exceção comercial.
- Flag por regra (não global) permite negociação por client.

### 3.5 Política de atraso

**Decisão:** **multa + juros configuráveis globalmente**, **suspensão automática desabilitada por padrão** (alerta manual em vez).

**Como funciona:**
- Novas colunas em `platform_settings`:
  - `overdue_fine_percent` (numeric, default 2.0) — multa única ao ficar em atraso
  - `overdue_interest_percent_month` (numeric, default 1.0) — juros ao mês acumulados pro rata die
  - `overdue_grace_days` (integer, default 3) — carência antes de aplicar multa/juros
  - `auto_suspend_after_days` (integer, default NULL) — NULL = nunca suspender; se preenchido (ex: 15), sistema gera alerta sugerindo suspensão
- Invoice em atraso calcula valor atualizado em tempo real: `amount + fine + interest`.
- Suspensão automática **não existe** na v1. Alertas automáticos informam o admin e ele decide.

**Justificativa:**
- 2% multa + 1%/mês juros é padrão brasileiro (compatível com Lei da Usura e CDC).
- Suspensão automática é perigosa — pode cortar cliente por bug técnico ou atraso operacional de 1 dia.
- Alertas > automação silenciosa.

### 3.6 Método de cobrança Asaas (Fase 4b)

**Decisão:** **Let the client choose** — Asaas gera link único que permite PIX, Boleto ou Cartão.

**Como funciona:**
- Edge Function `create-platform-charge` (F4b) cria cobrança Asaas com `billingType: 'UNDEFINED'` (nome técnico Asaas pra multi-opção).
- Link de pagamento é enviado ao client por email (Asaas automaticamente) ou exposto na UI "Copiar link de pagamento".
- Cliente escolhe método no próprio checkout Asaas.
- Webhook Asaas atualiza `platform_invoices.status` quando confirma.

**Justificativa:**
- Escolha do Vini (flexibilidade pro client).
- Reduz atrito: cada client usa o método que prefere.
- Asaas absorve a complexidade do checkout multi-método.

---

## §4 Matriz dos 81 itens

Cada item mapeado para:
- **Status** — 🟢 PRONTO (construível já) / 🟡 PARCIAL (existe base, precisa complemento) / 🔴 A CRIAR (infra nova necessária)
- **Fonte de dados** — tabela/RPC/API de origem
- **Tela** — onde aparece no revamp
- **Fase** — fase onde é construída

### 4.1 Operacional — Saúde da Plataforma (8/8)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Edge Functions com erro (24h) | 🟢 | Supabase Logs API (via Edge Function proxy) | Saúde da Plataforma | F3 |
| 2 | Webhooks Asaas falhando | 🟢 | `payments.webhook_data` + Logs API | Saúde + Alertas | F3/F5 |
| 3 | Latência do Supabase | 🟢 | Supabase Metrics API | Saúde | F3 |
| 4 | pg_cron rodando | 🟢 | `cron.job` + `cron.job_run_details` | Saúde | F3 |
| 5 | Realtime estável | 🟢 | Supabase Realtime API | Saúde | F3 |
| 6 | Storage próximo do limite | 🟢 | Supabase Management API | Saúde | F3 |
| 7 | Uso de API vs limite | 🟢 | Supabase Management API | Saúde | F3 |
| 8 | Taxa de erro geral (24h) | 🟢 | Supabase Logs API | Saúde | F3 |

### 4.2 Operacional — Saúde dos Clients (6/6)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Inativos sem evento há 30/60/90d | 🟢 | `clients` LEFT JOIN `events` + temporal | Alertas + Clientes | F5 |
| 2 | Queda de faturamento vs período anterior | 🟢 | `get_events_revenue` + comparação temporal | Alertas + Clientes | F5 |
| 3 | Primeiro evento nunca aconteceu | 🟢 | `clients` LEFT JOIN `events` | Alertas + Clientes | F5 |
| 4 | Sem usuários além do admin | 🟢 | `clients` × `user_roles` COUNT | Alertas | F5 |
| 6 | Sem subconta Asaas | 🟢 | `clients` LEFT JOIN `asaas_subaccounts` | Alertas | F5 |
| 7 | Com produtos zerados | 🟢 | `clients` LEFT JOIN `products` | Alertas | F5 |

### 4.3 Operacional — Segurança (6/6)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 3 | Usuários criados em massa | 🟢 | `auth.users.created_at` (clustering) | Segurança + Alertas | F5 |
| 4 | Logins de IPs novos | 🟢 | `auth.sessions.ip` + histórico | Segurança + Alertas | F5 |
| 5 | Múltiplas sessões ativas | 🟢 | `auth.sessions` GROUP BY user_id | Segurança + Alertas | F5 |
| 6 | Tentativas RLS bloqueadas | 🔴 | Tabela nova `rls_violations` | Segurança | F6 |
| 7 | Alterações em RPCs/policies | 🔴 | Event trigger DDL → `audit_logs` | Segurança | F6 |
| 8 | Secrets expirando | 🔴 | Tabela nova `secrets_registry` | Segurança | F6 |

### 4.4 Operacional — Financeiro (9/9)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Taxa de conversão de pagamento | 🟢 | `orders` status chain | Pagamentos | F3 |
| 2 | Taxa de PIX expirado | 🟢 | `payments` status=expired | Pagamentos | F3 |
| 3 | Cartões recusados repetidos | 🟢 | `payments` status=failed + agrupamento | Pagamentos + Alertas | F3/F5 |
| 4 | Pedidos em partially_paid travados | 🟢 | `orders.status = 'partially_paid'` | Pagamentos + Alertas | F3/F5 |
| 6 | Chargebacks/disputas Asaas | 🔴 | Webhook Asaas precisa processar eventos | Pagamentos | F6 |
| 7 | Saldo pendente vs disponível | 🟡 | API Asaas via Edge Function proxy | Pagamentos | F3 |
| 8 | Taxa efetiva Asaas | 🟢 | `payments.fee_amount / amount` | Pagamentos | F3 |
| 9 | Ticket médio caindo | 🟢 | comparação agregada | Pagamentos + Alertas | F3/F5 |
| 10 | Tempo médio de confirmação | 🟢 | `paid_at - created_at` em payments | Pagamentos | F3 |

### 4.5 Operacional — Comportamento (3/3)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Horários de pico (plataforma) | 🟢 | `orders.created_at` heatmap | Comportamento | F2 |
| 5 | DAU/WAU/MAU | 🟢 | `auth.users.last_sign_in_at` + `orders` | Comportamento | F2 |
| 6 | Retenção de consumer | 🟢 | `orders` cohort analysis | Comportamento | F2 |

### 4.6 Operacional — Incidentes (3/3)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Alertas abertos (inbox) | 🔴 | Tabela nova `platform_alerts` | Central de Alertas | F5 |
| 3 | Eventos em andamento agora | 🟢 | `events.status = 'active'` + Realtime | Eventos Ativos | F3 |
| 4 | Pedidos travados > N min | 🟢 | `orders` + `updated_at` + threshold | Alertas + Pagamentos | F5 |

### 4.7 Estratégico — Receita (8/8)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | MRR | 🟡 | `platform_invoices` (criar em F4a) | Receita + Painel | F4a |
| 2 | Receita de fees do mês | 🟢 | `SUM(payments.closeout_amount)` | Receita + Painel | F2 |
| 3 | Receita total (MRR + fees) | 🟡 | soma das duas | Receita + Painel | F4a |
| 4 | ARR | 🟡 | MRR × 12 | Receita | F4a |
| 5 | Receita por modelo (mensalidade vs fee) | 🟡 | breakdown | Receita | F4a |
| 7 | Crescimento MoM (receita) | 🟡 | comparação temporal | Receita | F4a |
| 9 | ARPU | 🟡 | receita total / clients ativos | Receita | F4a |
| 10 | Receita nova vs recorrente | 🟡 | invoices do período: 1ª vez do client vs recorrente | Receita | F4a |

### 4.8 Estratégico — Crescimento (5/5)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Novos clients/mês | 🟢 | `clients.created_at` | Crescimento + Painel | F2 |
| 2 | Churn rate | 🟡 | `clients.status` + `audit_logs` histórico | Crescimento | F4a |
| 3 | Churn revenue | 🟡 | ticket × clients perdidos | Crescimento | F4a |
| 4 | Net New Revenue | 🟡 | novos − churn | Crescimento | F4a |
| 5 | Taxa de ativação | 🟢 | `clients` LEFT JOIN `events` com timing | Crescimento | F2 |

### 4.9 Estratégico — Valor do Cliente (5/5)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | LTV | 🟡 | soma histórica de invoices por client | Clientes (analítico) | F4a |
| 4 | Clients mais valiosos (top 10) | 🟢 | `SUM(payments.closeout_amount) + MRR` | Clientes + Painel | F2/F4a |
| 5 | Concentração de receita | 🟢 | % top 3/5/10 | Clientes | F2 |
| 6 | Clients em risco | 🟢 | score composto (inatividade + queda + ticket) | Clientes + Alertas | F2/F5 |
| 7 | Expansão (aumento de plano) | 🟢 | `audit_logs` de `billing_rules` | Clientes | F2 |

### 4.10 Estratégico — GMV & Transações (9/9)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | GMV total | 🟢 | `SUM(payments.amount)` aprovadas | GMV + Painel | F2 |
| 2 | GMV por período | 🟢 | agregação temporal | GMV | F2 |
| 3 | Take rate | 🟢 | `closeout_amount / amount` | GMV | F2 |
| 4 | GMV por client | 🟢 | GROUP BY client_id | GMV + Painel | F2 |
| 5 | GMV por local | 🟢 | JOIN venues | GMV | F2 |
| 6 | GMV por método de pagamento | 🟢 | GROUP BY payment_method | GMV | F2 |
| 7 | Ticket médio da plataforma | 🟢 | `AVG(orders.total)` | GMV + Painel | F2 |
| 8 | Total pedidos processados | 🟢 | COUNT(orders) | GMV | F2 |
| 9 | Consumers únicos | 🟢 | COUNT DISTINCT consumer_id | GMV | F2 |

### 4.11 Estratégico — Eventos (7/7)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Eventos realizados/mês | 🟢 | `events.status = 'completed'` | Eventos (analítico) | F2 |
| 2 | Eventos ativos agora | 🟢 | `events.status = 'active'` | Painel + Eventos Ativos | F1/F3 |
| 3 | Ticket médio por evento | 🟢 | `get_events_revenue` ÷ COUNT orders | Eventos | F2 |
| 4 | Faturamento médio por evento | 🟢 | AVG de `get_events_revenue` | Eventos | F2 |
| 6 | Duração média | 🟢 | `end_at - start_at` | Eventos | F2 |
| 7 | Taxa de sucesso | 🟢 | eventos sem problemas / total (score composto) | Eventos | F2 |
| 8 | Horários/dias mais movimentados | 🟢 | heatmap `orders.created_at` por evento | Eventos | F2 |

### 4.12 Estratégico — Produtos & Comportamento (6/6)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Produtos mais vendidos | 🟢 | `order_items` GROUP BY product | Produtos | F2 |
| 2 | Categorias mais vendidas | 🟢 | `order_items` × `products.category_id` | Produtos | F2 |
| 3 | Clients que mais vendem produto X | 🟢 | drill-down do top produtos | Produtos | F2 |
| 4 | Consumers recorrentes | 🟢 | `orders` COUNT DISTINCT consumer | Comportamento | F2 |
| 5 | Ticket médio por consumer | 🟢 | AVG per-consumer | Comportamento | F2 |
| 6 | Frequência de compra | 🟢 | distribuição de intervalos | Comportamento | F2 |

### 4.13 Estratégico — Geografia (4/4)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Distribuição geográfica dos clients | 🟢 | `venues.city/state` | Geografia | F2 |
| 2 | Faturamento por região | 🟢 | JOIN venues + SUM payments | Geografia | F2 |
| 3 | Expansão geográfica | 🟢 | `venues.created_at` por estado | Geografia | F2 |
| 4 | Concentração regional | 🟢 | % receita por estado | Geografia | F2 |

### 4.14 Estratégico — Projeções (2/2)

| # | Item | Status | Fonte | Tela | Fase |
|---|---|---|---|---|---|
| 1 | Projeção de receita 30/90d | 🔴 | Aguarda 6+ meses de histórico | — | F8 |
| 2 | Projeção de churn | 🔴 | Aguarda 6+ meses de histórico | — | F8 |

### 4.15 Totalizador

| Status | Contagem | % |
|---|---|---|
| 🟢 PRONTO | 60 | 74% |
| 🟡 PARCIAL (precisa `platform_invoices`) | 14 | 17% |
| 🔴 A CRIAR (infra nova) | 7 | 9% |
| **TOTAL** | **81** | **100%** |

---

## §5 Fases de execução

Execução estritamente **em ordem**. Cada fase tem: objetivo, pré-requisitos, tarefas separadas por onde rodar, output esperado, critérios de aceite, estimativa em chunks, riscos.

### Fase 0 — Limpeza de dívida técnica

**Objetivo:** base performática e limpa antes de construir qualquer métrica. Sem isso, Admin nasce lento.

**Pré-requisitos:** nenhum.

#### Tarefas SQL (Supabase Dashboard → SQL Editor)

1. **Corrigir 169 `auth_rls_initplan`** — gerar script em batch que substitui `auth.uid()` por `(SELECT auth.uid())` em todas as policies afetadas. O script é gerado dinamicamente consultando `pg_policies` e usando `ALTER POLICY` com os novos predicados. Executar em chunks de 20 policies por vez.

2. **Consolidar `multiple_permissive_policies`** nas tabelas quentes:
   - `orders`, `payments`, `order_items`, `qr_tokens`, `validations`, `asaas_subaccounts`
   - Unir policies redundantes em uma única mais abrangente, preservando semântica de acesso.
   - Meta: reduzir de 142 lints pra <40.

3. **Adicionar índices críticos em `payments`:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
   CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
   CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
   CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
   CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC) WHERE paid_at IS NOT NULL;
   ```

4. **Adicionar índices em `clients`:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
   CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
   ```

5. **Corrigir `unindexed_foreign_keys`** — focar nas 10-15 mais relevantes pro Admin:
   - `asaas_charges.client_id`, `event_id`, `payment_id`
   - `order_items.product_id` (já tem? verificar)
   - Outras identificadas pelo advisor
   - Criar apenas onde a FK é usada em JOIN frequente.

6. **Remover 4 índices duplicados:**
   - `audit_logs`: dropar `audit_logs_entity_idx`, `audit_logs_created_at_idx`, `audit_logs_user_id_idx` (ficam os `idx_audit_logs_*`)
   - `events`: dropar `events_venue_id_idx` (fica `idx_events_venue_id`)
   - `venues`: dropar `venues_client_id_idx` (fica `idx_venues_client_id`)

7. **Remover índices nunca usados** — seletivo. Gerar lista do advisor, revisar caso a caso com `pg_stat_user_indexes`. Dropar só os com `idx_scan = 0` há mais de 30 dias.

8. **Limpar ghost row de `platform_settings`:**
   ```sql
   DELETE FROM platform_settings WHERE id <> '00000000-0000-0000-0000-000000000001';
   ```

9. **Mover `pg_net` pro schema `extensions`:**
   ```sql
   -- (Pode exigir recriação; cuidado com o cron job que usa net.http_post)
   ```
   Requer atualização do cron job atual pra usar `extensions.net.http_post`.

10. **Decisão sobre `is_client_manager`:** confirmar se deve adicionar `OR role = 'owner'` como condição. Investigar se `owner` é um role real em uso atualmente.

#### Onde executar

- **Somente SQL Editor.** Nenhum Lovable. Nenhuma Edge Function.

#### Output esperado

- Advisors de performance: <50 lints (vs 401 atuais). Diferença: os remanescentes são informativos, não de alto impacto.
- Advisors de segurança: 1-2 WARNs (mantém buckets públicos com policy permissiva — decisão de produto).
- `platform_settings` com 1 row só.

#### Critérios de aceite

- [ ] Rodar `Supabase:get_advisors` type=performance, comparar antes/depois.
- [ ] Testar query real de dashboard (ex: `SELECT SUM(closeout_amount) FROM payments WHERE created_at >= now() - interval '30 days'`) e medir tempo. Deve ser <100ms.
- [ ] Confirmar que nenhuma funcionalidade existente quebrou (testar Consumer login, criar pedido, pagar PIX).

#### Estimativa

- 5-6 chunks SQL (policies, indexes novas, indexes duplicados, indexes mortos, cleanup, extensions).

#### Riscos

- **Alto:** alterar RLS em produção. Mitigação: gerar script com rollback completo. Rodar em horário de baixo tráfego.
- **Médio:** dropar índice em uso pode lentificar queries específicas. Mitigação: revisar cada drop individualmente, não dropar automaticamente.

---

### Fase 1 — Painel (resumo executivo)

**Objetivo:** substituir `/admin` atual (4 cards simples) pelo painel executivo.

**Pré-requisitos:** F0 concluída.

#### Tarefas SQL

1. **RPC `get_admin_dashboard_metrics(p_start_date, p_end_date)`** — retorna JSON único com:
   - `mrr_expected` (soma de `billing_rules.monthly_amount` WHERE is_active AND rule_type='monthly_saas') — stub até F4a
   - `gmv_total_period`
   - `fees_total_period` (SUM `closeout_amount`)
   - `new_clients_period`
   - `active_events_now`
   - `alerts_open` — stub até F5 (retorna 0)
   - `top_clients` (array top 5 por GMV)
   - `revenue_timeseries` (array de {date, value} últimos 30 dias)
   - `frozen_orders_count` (partially_paid > 30 min)
   - Validação: role owner / super_admin

2. **RPC `get_platform_health_summary()`** — retorna 4 semáforos (plataforma/pagamentos/segurança/eventos) com base em checks simples. Stubs até F3/F5/F6.

#### Tarefas Lovable

1. **Prompt 1 — Estrutura do novo Painel:**
   - Reescrever `src/pages/Dashboard.tsx` com novo layout
   - Header com seletor de período (hoje/7d/30d/mês)
   - Grid de 6 KPIs (MRR, GMV, Receita Total, Novos Clients, Eventos Ativos, Alertas)
   - Não implementar gráficos ainda

2. **Prompt 2 — Gráficos e saúde:**
   - Adicionar série temporal de receita (Recharts)
   - Adicionar top 5 clients (barras)
   - Semáforo de saúde geral (componente Status com 4 linhas)

3. **Prompt 3 — Lista de alertas críticos:**
   - Componente que lista até 5 alertas (stub até F5)
   - Link "ver todos" que aponta pra `/admin/operacoes/alertas`

#### Output esperado

- `/admin` com KPIs reais calculados, gráficos renderizando, filtro de período funcional.

#### Critérios de aceite

- [ ] Painel carrega em <1s (com F0 feita).
- [ ] KPIs mostram valores consistentes com queries diretas no banco.
- [ ] Filtro de período recalcula tudo.
- [ ] Em dark theme com laranja Close Out.

#### Estimativa

- 2 chunks SQL + 3 chunks Lovable.

---

### Fase 2 — Telas de Análise (7 telas)

**Objetivo:** construir as 7 telas da seção "Análise".

**Pré-requisitos:** F0 e F1 concluídas.

#### 2.1 — GMV & Transações

**SQL:**
- RPC `get_gmv_metrics(p_start, p_end, p_client_id, p_venue_id, p_method)` — retorna JSON com KPIs + série temporal + breakdown por client/venue/método.

**Lovable:**
- Tela `/admin/analise/gmv` com 5 KPIs + 5 gráficos + 2 tabelas + filtros.

#### 2.2 — Eventos (analítico)

**SQL:**
- RPC `get_events_analytics(p_start, p_end, p_client_id)` — realizados/mês, ticket médio, faturamento médio, duração média, taxa de sucesso, heatmap horário/dia, top eventos por GMV.

**Lovable:**
- Tela `/admin/analise/eventos`.

#### 2.3 — Produtos & Vendas

**SQL:**
- RPC `get_products_analytics(p_start, p_end, p_client_id)` — top 20 produtos, top categorias, drill-down por produto.

**Lovable:**
- Tela `/admin/analise/produtos`.

#### 2.4 — Comportamento

**SQL:**
- RPC `get_behavior_metrics(p_start, p_end)` — DAU/WAU/MAU, heatmap horário, cohort retenção 7d/30d/90d, frequência de compra.

**Lovable:**
- Tela `/admin/analise/comportamento`.

#### 2.5 — Geografia

**SQL:**
- RPC `get_geography_metrics(p_start, p_end)` — distribuição estados/cidades, GMV por região, expansão temporal.

**Lovable:**
- Tela `/admin/analise/geografia` com mapa do Brasil (biblioteca: `react-simple-maps` ou GeoJSON via D3).

#### 2.6 — Receita (parcial)

**SQL:**
- RPC `get_revenue_metrics(p_start, p_end)` — versão parcial que calcula apenas: Receita de fees (já pronto), MRR Esperado (via billing_rules), ARR estimado, Crescimento MoM de fees.
- Placeholders ("Aguardando sistema de invoices") para: MRR realizado, Receita total, Receita nova vs recorrente, ARPU, Receita por modelo.

**Lovable:**
- Tela `/admin/analise/receita` com placeholders visíveis onde apropriado.

#### 2.7 — Crescimento (parcial)

**SQL:**
- RPC `get_growth_metrics(p_start, p_end)` — Novos clients/mês (pronto), Taxa de ativação (pronto), stubs para churn/NNR.

**Lovable:**
- Tela `/admin/analise/crescimento`.

#### 2.8 — Clientes (analítico)

**SQL:**
- RPC `get_client_value_metrics(p_start, p_end)` — LTV (stub até F4a), Top 10, Concentração, Clients em risco, Expansão via audit_logs.

**Lovable:**
- Tela `/admin/analise/clientes`.

#### Output esperado

- 7 novas rotas em `/admin/analise/*` funcionais.

#### Critérios de aceite

- [ ] Cada tela carrega em <1.5s.
- [ ] Dados coerentes com queries diretas.
- [ ] Filtros recalculam tudo.
- [ ] Drill-downs (ex: produto → clients) funcionam.

#### Estimativa

- 7 RPCs + 7 chunks Lovable.

---

### Fase 3 — Operações (3 telas + Eventos Ativos)

**Objetivo:** telas operacionais (Saúde Plataforma, Eventos Ativos, Pagamentos).

**Pré-requisitos:** F0 concluída.

#### 3.1 — Saúde da Plataforma

**Edge Function nova (Supabase Dashboard):**
- `platform-health-proxy` — consome Supabase Management API (requer service role key via secret). Retorna: logs Edge Functions (erros 24h), latência DB, storage usage, API requests count, realtime stats.

**SQL:**
- RPC `get_cron_jobs_status()` — query em `cron.job` + `cron.job_run_details` pra últimas 24h.

**Lovable:**
- Tela `/admin/operacoes/saude`.

#### 3.2 — Eventos Ativos

**SQL:**
- RPC `get_active_events_overview()` — todos `events.status = 'active'` + orders/payments em andamento + tempo decorrido.

**Lovable:**
- Tela `/admin/operacoes/eventos-ativos` com Realtime subscribe em `orders`, `payments`, `events`.

#### 3.3 — Pagamentos

**SQL:**
- RPC `get_payments_operational_metrics(p_period)` — conversão, PIX expirado, cartões recusados, partially_paid travados, tempo médio confirmação, taxa efetiva por client.

**Edge Function nova:**
- `asaas-balance-proxy` — consulta saldo pendente vs disponível em cada subconta Asaas via API Asaas.

**Lovable:**
- Tela `/admin/operacoes/pagamentos`.

#### Output esperado

- 3 novas rotas em `/admin/operacoes/*` (Alertas fica pra F5).

#### Estimativa

- 3 RPCs + 2 Edge Functions + 3 chunks Lovable.

---

### Fase 4a — Billing: fundação

**Objetivo:** sistema de invoices com entrada manual. Desbloqueia MRR/ARR/LTV/Churn reais.

**Pré-requisitos:** F0 concluída. Decisões de negócio §3.1 a §3.5 aprovadas.

#### Tarefas SQL

1. **Adicionar colunas em `billing_rules`:**
   ```sql
   ALTER TABLE billing_rules ADD COLUMN billing_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
   ALTER TABLE billing_rules ADD COLUMN prorate_first_month BOOLEAN NOT NULL DEFAULT FALSE;
   ```

2. **Adicionar colunas em `clients`:**
   ```sql
   ALTER TABLE clients ADD COLUMN activation_fee_charged BOOLEAN NOT NULL DEFAULT FALSE;
   ```

3. **Adicionar colunas em `platform_settings`:**
   ```sql
   ALTER TABLE platform_settings ADD COLUMN overdue_fine_percent NUMERIC NOT NULL DEFAULT 2.0;
   ALTER TABLE platform_settings ADD COLUMN overdue_interest_percent_month NUMERIC NOT NULL DEFAULT 1.0;
   ALTER TABLE platform_settings ADD COLUMN overdue_grace_days INTEGER NOT NULL DEFAULT 3;
   ALTER TABLE platform_settings ADD COLUMN auto_suspend_after_days INTEGER;
   ```

4. **Criar tabela `platform_invoices`:**
   ```sql
   CREATE TABLE platform_invoices (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     client_id UUID NOT NULL REFERENCES clients(id),
     billing_rule_id UUID REFERENCES billing_rules(id),
     invoice_type TEXT NOT NULL CHECK (invoice_type IN ('monthly', 'activation', 'manual', 'adjustment')),
     period_start DATE,
     period_end DATE,
     amount NUMERIC NOT NULL,
     due_date DATE NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
     paid_at TIMESTAMPTZ,
     paid_amount NUMERIC,
     payment_method TEXT,
     notes TEXT,
     invoice_number_external TEXT,
     invoice_number_issued_at TIMESTAMPTZ,
     invoice_pdf_url TEXT,
     asaas_charge_id TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_platform_invoices_client ON platform_invoices(client_id);
   CREATE INDEX idx_platform_invoices_status ON platform_invoices(status);
   CREATE INDEX idx_platform_invoices_due_date ON platform_invoices(due_date);
   CREATE INDEX idx_platform_invoices_billing_rule ON platform_invoices(billing_rule_id);
   ```
   + RLS policies (só super_admin/owner).
   + Trigger `audit_platform_invoices`.
   + Trigger `updated_at`.

5. **RPCs:**
   - `generate_monthly_invoices()` — roda diariamente. Para cada `billing_rule` com `rule_type=monthly_saas`, `is_active=true`, `billing_day = EXTRACT(DAY FROM CURRENT_DATE)`, `billing_start_date <= CURRENT_DATE`: cria invoice se não existe já para o período. Aplica pro-rata se `prorate_first_month=true` e for a primeira invoice.
   - `generate_activation_invoice(p_client_id)` — verifica se client tem regra `activation_fee` ativa e `activation_fee_charged = false`. Cria invoice + marca flag.
   - `mark_invoice_paid(p_invoice_id, p_paid_at, p_paid_amount, p_payment_method, p_notes, p_invoice_number_external)` — marca como paga.
   - `cancel_invoice(p_invoice_id, p_reason)` — status → cancelled + nota.
   - `create_manual_invoice(p_client_id, p_amount, p_due_date, p_notes)` — fatura avulsa.
   - `get_billing_dashboard(p_period_start, p_period_end)` — KPIs da tela.
   - `mark_overdue_invoices()` — roda diariamente. Invoices com `due_date + overdue_grace_days < CURRENT_DATE` e status `pending` → `overdue`.
   - `get_revenue_metrics_full(p_start, p_end)` — versão completa pra substituir a parcial da F2.6.
   - `get_growth_metrics_full(p_start, p_end)` — versão completa pra F2.7.
   - `get_client_ltv(p_client_id)` — soma histórica de invoices pagas.

6. **pg_cron job diário:**
   ```sql
   SELECT cron.schedule(
     'billing_daily_generation',
     '5 0 * * *',  -- todo dia às 00:05
     $$
       SELECT public.generate_monthly_invoices();
       SELECT public.mark_overdue_invoices();
     $$
   );
   ```

7. **Hook na criação de client:**
   - Opção A: adicionar chamada de `generate_activation_invoice` na Edge Function `create-client-with-manager`.
   - Opção B: trigger AFTER INSERT em `clients` que chama a RPC.
   - **Escolha:** Opção A (evita overhead de trigger em toda inserção, e a Edge Function já tem contexto completo).

#### Tarefas Lovable

1. **Prompt 1 — Tela Planos & Billing:**
   - Criar `/admin/sistema/billing`
   - Header + 4 KPIs + abas (Todas / Em aberto / Pagas / Em atraso)
   - Tabela com filtros
   - Mockup da estrutura aprovado pelo Vini

2. **Prompt 2 — Modais de ação:**
   - Modal "Marcar como paga"
   - Modal "Cancelar invoice"
   - Modal "Gerar fatura manual"
   - Modal "Baixar dados pra NF"

3. **Prompt 3 — Aba "Regras ativas":**
   - Lista de `billing_rules` + projeção de receita

4. **Prompt 4 — Atualizar `ClientBillingRules.tsx`:**
   - Adicionar campos `billing_start_date` e `prorate_first_month` no formulário de regra

5. **Prompt 5 — Atualizar telas F2.6 e F2.7:**
   - Substituir placeholders pelas métricas reais via RPCs completas

#### Output esperado

- Sistema de invoices rodando. 13 métricas parciais → status 🟢 PRONTO.

#### Critérios de aceite

- [ ] Primeira invoice gerada automaticamente pelo cron para o Boliche Lages no próximo dia 28.
- [ ] UI permite marcar como paga e status atualiza em tempo real.
- [ ] KPIs de MRR no Painel mostram valor real após alguns pagamentos registrados.
- [ ] Activation invoice gerada automaticamente na criação de novo client.
- [ ] Audit log registra todas mudanças em invoices.

#### Estimativa

- 4-5 chunks SQL + 5 chunks Lovable.

#### Riscos

- **Médio:** geração automática de invoice pode dar bug e criar cobrança indevida. Mitigação: deixar cron **desativado** por 7 dias após deploy, gerar manualmente algumas pra validar, só então ativar.

---

### Fase 4b — Billing: integração Asaas

**Objetivo:** cobrar automaticamente os clients via Asaas (Let client choose).

**Pré-requisitos:** F4a concluída + checklist operacional §6 feito pelo Vini.

#### Tarefas

1. **Edge Function nova `create-platform-charge`:**
   - Recebe `invoice_id` como parâmetro.
   - Busca dados completos do client (precisa CNPJ/CPF + endereço).
   - Cria customer no Asaas (ou reutiliza se já existir — mapeamento via tabela nova `platform_asaas_customers` ou coluna em `clients.asaas_platform_customer_id`).
   - Cria cobrança com `billingType: 'UNDEFINED'` (multi-método).
   - Retorna `checkout_url` e salva `asaas_charge_id` em `platform_invoices`.

2. **Atualização `asaas-webhook`:**
   - Diferenciar eventos de charge B2C (consumer→bar) vs B2B (plataforma→client).
   - Usar `externalReference` no payload pra identificar: se começa com `inv_` é platform invoice.
   - Ao receber `PAYMENT_CONFIRMED` para invoice → chamar `mark_invoice_paid`.

3. **Nova coluna (se optar por tabela dedicada):**
   - `clients.asaas_platform_customer_id` (TEXT)

4. **Lovable:**
   - Botão "Cobrar via Asaas" na row da invoice.
   - Botão "Copiar link de pagamento" se já tem `asaas_charge_id`.
   - Indicador visual de invoices cobradas via Asaas.

5. **Flow completo:**
   - Cron gera invoice → admin revisa → clica "Cobrar via Asaas" → Edge Function cria cobrança → link é exibido/enviado → cliente paga → webhook marca como paga.

#### Output esperado

- Admin pode emitir cobrança via Asaas para qualquer invoice aberta.

#### Critérios de aceite

- [ ] Teste sandbox: criar invoice de R$ 2,00, cobrar via Asaas, simular pagamento, invoice fica "paid" automaticamente.
- [ ] Teste produção: R$ 10,00 com um client real.
- [ ] Conciliação: saldo recebido = soma de invoices pagas via Asaas.

#### Estimativa

- 1 Edge Function nova + atualização webhook + 2 chunks Lovable.

#### Riscos

- **Alto:** cobrança errada em produção. Mitigação: modo "preview" antes de enviar + confirmação do admin + trilha de auditoria.

---

### Fase 5 — Central de Alertas

**Objetivo:** inbox único de incidentes com detectores automáticos.

**Pré-requisitos:** F0 + F4a concluídas.

#### Tarefas SQL

1. **Criar tabela `platform_alerts`:**
   ```sql
   CREATE TABLE platform_alerts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     category TEXT NOT NULL CHECK (category IN ('platform', 'clients', 'payments', 'security', 'operational')),
     severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
     title TEXT NOT NULL,
     description TEXT,
     entity_type TEXT,
     entity_id UUID,
     detector_key TEXT NOT NULL,  -- chave do detector que criou (pra dedupe)
     dedup_hash TEXT,  -- pra não criar alertas duplicados
     status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
     notes TEXT,
     resolved_by UUID REFERENCES auth.users(id),
     resolved_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_alerts_status ON platform_alerts(status);
   CREATE INDEX idx_alerts_category ON platform_alerts(category);
   CREATE INDEX idx_alerts_severity ON platform_alerts(severity);
   CREATE UNIQUE INDEX idx_alerts_dedup ON platform_alerts(dedup_hash) WHERE status = 'open';
   ```
   + RLS (super_admin/owner) + trigger updated_at.

2. **RPCs detectoras:**
   - `detect_inactive_clients()` — gera alertas para clients sem evento há 30/60/90d.
   - `detect_frozen_payments()` — `orders.status = 'partially_paid' AND updated_at < now() - interval '30 minutes'`.
   - `detect_asaas_webhook_failures()` — consumindo `payments.webhook_data` e inspecionando falhas recentes.
   - `detect_client_without_subaccount()` — `clients` ativos sem row em `asaas_subaccounts`.
   - `detect_client_without_products()` — clients sem `products`.
   - `detect_new_ip_login()` — comparando `auth.sessions.ip` com histórico por user (últimas 100 sessions).
   - `detect_multiple_active_sessions()` — users com > N sessões ativas (N configurável, default 3).
   - `detect_frozen_orders_custom(p_threshold_minutes)` — flexível.
   - `detect_overdue_invoices()` — invoices em atraso há > X dias (disparado por F4a, reaproveitado aqui).

3. **RPCs de ação:**
   - `mark_alert_investigating(p_alert_id)`
   - `resolve_alert(p_alert_id, p_notes)`
   - `dismiss_alert(p_alert_id, p_reason)`
   - `add_alert_note(p_alert_id, p_note)`

4. **Dedup:** todos os detectores geram `dedup_hash` (ex: `md5(detector_key || entity_id || date)`). Se já existe `open` com mesmo hash, não insere novo.

5. **pg_cron a cada 15 min:**
   ```sql
   SELECT cron.schedule('alert_detection', '*/15 * * * *', $$
     SELECT public.detect_inactive_clients();
     SELECT public.detect_frozen_payments();
     SELECT public.detect_asaas_webhook_failures();
     SELECT public.detect_client_without_subaccount();
     SELECT public.detect_client_without_products();
     SELECT public.detect_new_ip_login();
     SELECT public.detect_multiple_active_sessions();
     SELECT public.detect_overdue_invoices();
   $$);
   ```

#### Tarefas Lovable

1. **Prompt 1 — Tela `/admin/operacoes/alertas`:**
   - Abas Abertos / Em investigação / Resolvidos
   - Cards de severity por categoria
   - Tabela de alertas

2. **Prompt 2 — Drill-down e ações:**
   - Painel lateral com contexto do alerta
   - Botões de ação (investigar / resolver / dismiss)
   - Input de notas

3. **Prompt 3 — Badge no sidebar:**
   - Atualizar `AppSidebar.tsx` pra mostrar contagem de alertas abertos
   - Realtime subscribe em `platform_alerts`

4. **Prompt 4 — Integrar alertas no Painel:**
   - Substituir stub do card "Alertas abertos" pelo valor real
   - Lista dos 3-5 mais críticos

#### Output esperado

- Inbox funcional. Badge no sidebar. Alertas automáticos.

#### Estimativa

- 8 RPCs detectoras + 4 RPCs de ação + 4 chunks Lovable.

---

### Fase 6 — Segurança avançada + Chargebacks

**Objetivo:** completar cobertura de segurança + processar chargebacks Asaas.

**Pré-requisitos:** F0 + F5 concluídas.

#### Tarefas SQL

1. **Tabela `rls_violations`:**
   ```sql
   CREATE TABLE rls_violations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id),
     table_name TEXT NOT NULL,
     operation TEXT NOT NULL,  -- SELECT/INSERT/UPDATE/DELETE
     policy_name TEXT,
     context JSONB,
     ip_address TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_rls_viol_created ON rls_violations(created_at DESC);
   CREATE INDEX idx_rls_viol_user ON rls_violations(user_id);
   ```

2. **Event trigger DDL** pra capturar alterações em schema:
   ```sql
   CREATE OR REPLACE FUNCTION capture_ddl_changes() RETURNS event_trigger AS $$
   DECLARE obj RECORD;
   BEGIN
     FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
     LOOP
       INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, user_role)
       VALUES (
         auth.uid(),
         'schema.' || obj.command_tag,
         obj.object_type,
         NULL,
         jsonb_build_object('command', obj.command_tag, 'object_identity', obj.object_identity),
         'system'
       );
     END LOOP;
   END;
   $$ LANGUAGE plpgsql;
   CREATE EVENT TRIGGER audit_schema_changes ON ddl_command_end EXECUTE FUNCTION capture_ddl_changes();
   ```

3. **Tabela `secrets_registry`:**
   ```sql
   CREATE TABLE secrets_registry (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT UNIQUE NOT NULL,
     description TEXT,
     added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     expires_at TIMESTAMPTZ,
     rotated_at TIMESTAMPTZ,
     status TEXT NOT NULL DEFAULT 'active',
     notes TEXT
   );
   ```
   Populada manualmente com: `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_KEY_PROD`, `ASAAS_WEBHOOK_TOKEN`, etc.

4. **RPC `log_rls_violation(p_table, p_operation, p_context)`** — chamada manualmente no frontend em catch de erros específicos, ou via trigger de segurança.

#### Edge Function

5. **Atualizar `asaas-webhook`** para processar:
   - `PAYMENT_CHARGEBACK_REQUESTED`
   - `PAYMENT_CHARGEBACK_DISPUTE`
   - `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`
   - `PAYMENT_CHARGEBACK_REVERSAL_CONFIRMED`
   - Adicionar colunas em `payments`:
     ```sql
     ALTER TABLE payments ADD COLUMN chargeback_status TEXT;
     ALTER TABLE payments ADD COLUMN chargeback_amount NUMERIC;
     ALTER TABLE payments ADD COLUMN chargeback_requested_at TIMESTAMPTZ;
     ALTER TABLE payments ADD COLUMN chargeback_resolved_at TIMESTAMPTZ;
     ```
   - Ao detectar chargeback: criar alerta automático em `platform_alerts` (via RPC `detect_chargebacks`).

#### Tarefas Lovable

1. **Prompt 1 — Tela `/admin/operacoes/seguranca`:**
   - Seções: Sessões ativas / IPs novos / Permissões bloqueadas / Mudanças de schema / Secrets

2. **Prompt 2 — Atualizar tela Pagamentos (F3.3):**
   - Seção de chargebacks

3. **Prompt 3 — Tela de gestão de secrets:**
   - CRUD básico em secrets_registry (por enquanto só cadastro, não rotação)

#### Estimativa

- 3 tabelas + event trigger + 2-3 RPCs + update Edge Function + 3 chunks Lovable.

---

### Fase 7 — Gestão CRUD revitalizada

**Objetivo:** enriquecer telas atuais Clientes/Locais/Eventos/Usuários com métricas + páginas de detalhe individual.

**Pré-requisitos:** F0 a F5 concluídas (ideal — usa dados gerados por todas).

#### 7.1 — Clientes

**SQL:**
- RPC `get_client_360(p_client_id)` — JSON com: dados cadastrais, billing rules ativas, MRR gerado, GMV histórico, locais, usuários, eventos recentes, invoices, alertas abertos.

**Lovable:**
- Prompt 1: enriquecer lista (adicionar colunas MRR, último evento, saúde).
- Prompt 2: criar página `/admin/gestao/clientes/:id` com abas (Dados/Billing/Eventos/Usuários/Auditoria/Ações).
- Prompt 3: ações (suspender/reativar com checkbox de activation_fee/trocar plano/exportar).

#### 7.2 — Locais

**SQL:**
- RPC `get_venue_360(p_venue_id)`.

**Lovable:**
- Prompt 1: enriquecer lista.
- Prompt 2: página `/admin/gestao/locais/:id`.

#### 7.3 — Eventos

**SQL:**
- RPC `get_event_360(p_event_id)`.

**Lovable:**
- Prompt 1: toggle lista/calendário.
- Prompt 2: página `/admin/gestao/eventos/:id` (timeline completa).

#### 7.4 — Usuários

**Lovable:**
- Prompt 1: filtros adicionais (último login, sessões ativas).
- Prompt 2: página `/admin/gestao/usuarios/:id`.

#### Estimativa

- 3 RPCs + 7 chunks Lovable.

---

### Fase 8 — Projeções (aguardando histórico)

**Objetivo:** projeções de receita 30/90d e churn baseadas em modelo estatístico.

**Pré-requisito:** 6+ meses de histórico acumulado em `platform_invoices`.

**Estado:** **Não será executada no escopo atual.** Fica registrada para retomada futura. Provavelmente 2º ou 3º trimestre de 2026 (assumindo F4a ativa em abril/26, histórico completo em outubro/26+).

Técnicas a considerar:
- Projeção linear simples (média móvel + tendência).
- Sazonalidade por mês.
- Projeção de churn baseada em cohort.

---

## §6 Pré-requisitos operacionais da Fase 4b (Asaas)

Checklist que o **Vini executa** (não é tarefa de código):

### 6.1 Conta Asaas

- [ ] Confirmar conta principal Close Out (CNPJ) com API key de produção.
- [ ] Confirmar se é a mesma conta dos secrets `ASAAS_API_KEY_PROD`/`ASAAS_API_KEY_SANDBOX` ou é outra. Se for outra: criar secrets novos `ASAAS_PLATFORM_API_KEY_PROD`/`ASAAS_PLATFORM_API_KEY_SANDBOX`.

### 6.2 Dados completos dos clients

- [ ] Garantir que todos os clients atuais tenham `document` preenchido (CPF ou CNPJ válido).
- [ ] Decidir: cobrança vai no CNPJ do client (se tiver) ou CPF do owner? Default: CNPJ > CPF owner.
- [ ] **Recomendado:** criar colunas separadas em `clients`:
  ```sql
  ALTER TABLE clients ADD COLUMN street TEXT;
  ALTER TABLE clients ADD COLUMN address_number TEXT;
  ALTER TABLE clients ADD COLUMN complement TEXT;
  ALTER TABLE clients ADD COLUMN district TEXT;
  ALTER TABLE clients ADD COLUMN city TEXT;
  ALTER TABLE clients ADD COLUMN state TEXT;
  ALTER TABLE clients ADD COLUMN postal_code TEXT;
  ```
  (Adicionar como sub-tarefa da F4b.)
- [ ] Preencher manualmente esses campos pros 4 clients existentes.

### 6.3 Webhook Asaas

- [ ] **Decisão tomada:** usar o mesmo webhook atual (`asaas-webhook`) com lógica condicional baseada em `externalReference`. **Sem ação do Vini no painel Asaas.**

### 6.4 Método de cobrança

- [x] **Decisão tomada:** Let the client choose (PIX + Boleto + Cartão). Asaas gera link único.

### 6.5 NFS-e automatizada (opcional futuro)

- [ ] (Fora de escopo F4b.) Registrado em §8 como débito técnico.

### 6.6 Testes controlados (ordem)

1. [ ] Sandbox: criar invoice de R$ 2,00 e cobrar. Validar confirmação via webhook.
2. [ ] Produção: invoice de R$ 10,00 em um client real (com consentimento), conferir extrato.
3. [ ] Liberar automação para todos os clients.

---

## §7 Infraestrutura nova — catálogo completo

### 7.1 Tabelas novas

| Tabela | Fase | Propósito |
|---|---|---|
| `platform_invoices` | F4a | Faturas plataforma → client |
| `platform_alerts` | F5 | Inbox de incidentes |
| `rls_violations` | F6 | Log de tentativas bloqueadas por RLS |
| `secrets_registry` | F6 | Catálogo de secrets + expiração |

### 7.2 Colunas a adicionar em tabelas existentes

| Tabela | Coluna | Fase | Motivo |
|---|---|---|---|
| `billing_rules` | `billing_start_date` DATE NOT NULL | F4a | Quando começa a contar monthly |
| `billing_rules` | `prorate_first_month` BOOLEAN | F4a | Pro-rata opcional |
| `clients` | `activation_fee_charged` BOOLEAN | F4a | Evitar duplicar ativação |
| `clients` | `asaas_platform_customer_id` TEXT | F4b | Customer Asaas da plataforma |
| `clients` | `street, address_number, complement, district, city, state, postal_code` | F4b | Endereço estruturado pra Asaas/NF |
| `platform_settings` | `overdue_fine_percent, overdue_interest_percent_month, overdue_grace_days, auto_suspend_after_days` | F4a | Política de atraso |
| `payments` | `chargeback_status, chargeback_amount, chargeback_requested_at, chargeback_resolved_at` | F6 | Chargeback tracking |

### 7.3 RPCs novas (por fase)

**F1 — Painel:**
- `get_admin_dashboard_metrics(p_start_date, p_end_date)`
- `get_platform_health_summary()`

**F2 — Análise:**
- `get_gmv_metrics(p_start, p_end, p_client_id, p_venue_id, p_method)`
- `get_events_analytics(p_start, p_end, p_client_id)`
- `get_products_analytics(p_start, p_end, p_client_id)`
- `get_behavior_metrics(p_start, p_end)`
- `get_geography_metrics(p_start, p_end)`
- `get_revenue_metrics(p_start, p_end)` — versão parcial
- `get_growth_metrics(p_start, p_end)` — versão parcial
- `get_client_value_metrics(p_start, p_end)`

**F3 — Operações:**
- `get_cron_jobs_status()`
- `get_active_events_overview()`
- `get_payments_operational_metrics(p_period)`

**F4a — Billing:**
- `generate_monthly_invoices()`
- `generate_activation_invoice(p_client_id)`
- `mark_invoice_paid(p_invoice_id, p_paid_at, p_paid_amount, p_payment_method, p_notes, p_invoice_number_external)`
- `cancel_invoice(p_invoice_id, p_reason)`
- `create_manual_invoice(p_client_id, p_amount, p_due_date, p_notes, p_invoice_type)`
- `get_billing_dashboard(p_period_start, p_period_end)`
- `mark_overdue_invoices()`
- `get_revenue_metrics_full(p_start, p_end)` — substitui versão parcial
- `get_growth_metrics_full(p_start, p_end)` — substitui versão parcial
- `get_client_ltv(p_client_id)`

**F5 — Alertas:**
- `detect_inactive_clients()`
- `detect_frozen_payments()`
- `detect_asaas_webhook_failures()`
- `detect_client_without_subaccount()`
- `detect_client_without_products()`
- `detect_new_ip_login()`
- `detect_multiple_active_sessions()`
- `detect_frozen_orders_custom(p_threshold_minutes)`
- `detect_overdue_invoices()`
- `detect_chargebacks()` (F6)
- `mark_alert_investigating(p_alert_id)`
- `resolve_alert(p_alert_id, p_notes)`
- `dismiss_alert(p_alert_id, p_reason)`
- `add_alert_note(p_alert_id, p_note)`

**F6 — Segurança:**
- `log_rls_violation(p_table, p_operation, p_context)`
- (event trigger DDL, não é RPC tradicional)

**F7 — Gestão 360:**
- `get_client_360(p_client_id)`
- `get_venue_360(p_venue_id)`
- `get_event_360(p_event_id)`

**Total:** ~35 RPCs novas.

### 7.4 Edge Functions novas

| Function | Fase | Propósito | verify_jwt |
|---|---|---|---|
| `platform-health-proxy` | F3 | Proxy para Supabase Management API | false (auth interno) |
| `asaas-balance-proxy` | F3 | Saldo subcontas Asaas | false (auth interno) |
| `create-platform-charge` | F4b | Criar cobrança no Asaas (plataforma → client) | false (auth interno) |

### 7.5 Edge Functions atualizadas

| Function | Fase | Mudança |
|---|---|---|
| `asaas-webhook` | F4b + F6 | Processar invoices de plataforma + chargebacks |
| `create-client-with-manager` | F4a | Chamar `generate_activation_invoice` após criar client |

### 7.6 Cron jobs novos

| Job | Schedule | Fase | O que faz |
|---|---|---|---|
| `billing_daily_generation` | `5 0 * * *` (00:05) | F4a | Gera invoices + marca em atraso |
| `alert_detection` | `*/15 * * * *` (a cada 15 min) | F5 | Roda todos detectores |

### 7.7 Triggers novos

| Trigger | Em | Fase | O que faz |
|---|---|---|---|
| `audit_platform_invoices` | platform_invoices | F4a | Audit log automático |
| `set_updated_at` (platform_invoices) | platform_invoices | F4a | updated_at |
| `audit_schema_changes` | (event trigger DDL) | F6 | Log de mudanças em RPCs/policies |

---

## §8 Débitos técnicos conhecidos

Lista de tópicos identificados durante o discovery que **não entram no escopo atual**, mas ficam registrados:

1. **Integração NFS-e automatizada** — exige certificado digital A1 + integração com ISS ou plataforma (eNotas, NFE.io, Asaas NFS-e). Sub-projeto dedicado. Impacta Sistema → Planos & Billing.

2. **Projeções estatísticas** (F8) — aguarda 6+ meses de histórico em `platform_invoices`.

3. **`clients.address` como campo único** — refatorar pra campos separados já coberto em F4b (§6.2), mas aplicável a CRUD geral.

4. **`is_client_manager()` não trata `role = 'owner'`** — verificado na auditoria. Pode ser bug de segurança ou decisão intencional. Decidir em F0 (§5.F0.10).

5. **3 WARNs de segurança do advisor:**
   - `pg_net` em schema `public` — coberto em F0 item 9.
   - Bucket `avatars` com policy de listagem ampla — decidir se corrige ou aceita (avatars são públicos mesmo).
   - Bucket `event-images` com policy de listagem ampla — idem.

6. **Rotação de secrets automatizada** — `secrets_registry` da F6 só cataloga, não rotaciona. Automação fica pra depois.

7. **Tela de relatórios/export Excel/PDF** — mencionada na userMemories original mas não coberta pelo revamp. Pode ser adicionada pós F7 por demanda.

8. **Capacitor native apps** — fora do escopo Admin.

9. **Push notifications** — fora do escopo Admin.

10. **Apple Sign In** — pendente enrollment Apple Developer.

11. **Email automático** (ex: notificar client quando invoice é gerada) — não coberto. Sub-projeto.

12. **Testes de pentesting/bypass RLS** (24-28 na lista original de testes) — não cobertos. Devem ser executados pós-F0 pra validar a limpeza de RLS.

---

## §9 Glossário

| Termo | Definição | Como calcular |
|---|---|---|
| **MRR** | Monthly Recurring Revenue — receita mensal recorrente | Soma de `platform_invoices` tipo `monthly` pagas no mês |
| **ARR** | Annual Recurring Revenue | MRR × 12 |
| **GMV** | Gross Merchandise Value — volume transacionado | Soma de `payments.amount` aprovadas |
| **Take Rate** | % do GMV que fica pra plataforma | `SUM(closeout_amount) / SUM(amount)` |
| **ARPU** | Average Revenue Per User — receita média por client | Receita total / clients ativos |
| **LTV** | Lifetime Value — receita total esperada por client | Soma histórica de invoices pagas do client |
| **Churn Rate** | % de clients perdidos no período | Clients que ficaram inativos / clients ativos no início do período |
| **Churn Revenue** | Receita perdida por churn | Σ MRR dos clients que deram churn |
| **NNR** | Net New Revenue — novos menos churn | Receita de novos clients − churn revenue |
| **DAU/WAU/MAU** | Daily/Weekly/Monthly Active Users | Users distintos com atividade (login ou pedido) |
| **Pro-rata** | Cálculo proporcional ao tempo | `(valor × dias_no_período) / dias_no_mês` |
| **Dedup hash** | Hash pra evitar duplicação | `md5(detector_key || entity_id || date)` |
| **CAC** | Customer Acquisition Cost | (Não rastreado — débito técnico) |
| **Payback** | Quantos meses pra client pagar o próprio CAC | LTV / CAC (não calculado por enquanto) |
| **Cohort** | Grupo de usuários que começou no mesmo período | Grupamento por mês de `created_at` |
| **Taxa de ativação** | % de clients que fizeram 1º evento | clients com 1+ evento / total clients |
| **Taxa de sucesso de evento** | Eventos sem problemas operacionais | Score composto — definido na F2.6 |

---

## §10 Decisões revistas

Template para registrar mudanças nas decisões originais ao longo do projeto. **Seção vazia por enquanto.**

```
### Decisão DD/MM/AAAA — [Título]
- Decisão original: ...
- Nova decisão: ...
- Motivo: ...
- Impacto: ...
- Fases afetadas: ...
```

---

## §11 Changelog

### v1.0 — 19/04/2026

- Versão inicial pós-auditoria completa (repo + banco).
- Arquitetura de 20 telas definida.
- 81 métricas mapeadas (60 prontas, 14 parciais, 7 a criar).
- 6 decisões de negócio tomadas (§3).
- 10 fases de execução detalhadas.
- Checklist operacional F4b Asaas.
- Catálogo completo de infra nova.
- 12 débitos técnicos registrados.
- Autor: Vini (owner/founder) + Claude (arquiteto técnico da sessão).

---

**FIM DO DOCUMENTO MESTRE v1.0**

*Próxima ação: Fase 0 — Limpeza de dívida técnica.*
