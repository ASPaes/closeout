## Diff Plan — Seção de Comandas no Relatório de Fechamento

### Resumo
Adicionar uma nova seção read-only "Comandas" ao relatório de fechamento de evento (`GestorEventoFechamento.tsx`), posicionada após a seção de receita por forma de pagamento e antes da seção de caixas. A seção só deve aparecer quando o evento possui dados de comanda (receita app, receita caixa, comandas não recebidas ou comandas ainda abertas).

### Arquivos que serão alterados

#### 1. `src/pages/gestor/GestorEventoFechamento.tsx`
- Adicionar estados `comandaSummary` e `comandaLoading`.
- Adicionar `useEffect` que, quando `eventId` existir, chama `supabase.rpc("get_event_comanda_summary", { p_event_id: eventId })` e armazena o resultado.
- Adicionar type inline para o retorno da RPC.
- Inserir a nova seção "Comandas" logo após a "Section 3: Receita por Forma de Pagamento" e antes da "Section 4: Caixas do Evento".
- A seção contém:
  - Dois `MetricCard` lado a lado:
    - "Comanda (app)" — `Smartphone`, sublabel "via app"
    - "Comanda (caixa)" — `Banknote`, sublabel "recebido fora do gateway", expansível com drill-down
  - `Collapsible` (shadcn) no card do caixa para mostrar a quebra por forma de pagamento (`dinheiro`, `pix`, `credit_card`, `debit_card`), exibindo apenas valores > 0.
  - Card com `Table` de comandas não recebidas (`unsettled`), se houver, com colunas: Comanda (#card_number), Cliente, Telefone, CPF, Valor. Visual com tom de alerta sutil.
  - Aviso pequeno se `open_count > 0`.
- Importar `ChevronDown`, `AlertTriangle`, `ScrollText` e o componente `Collapsible`.
- Renderizar a seção apenas se houver dados de comanda (`comanda_app_total > 0 || comanda_caixa_total > 0 || unsettled.length > 0 || open_count > 0`).

#### 2. `src/i18n/translations/pt-BR.ts`
Adicionar chaves no grupo "Gestor Event Closing Report":
- `gef_comandas_section`: "Comandas"
- `gef_comanda_app`: "Comanda (app)"
- `gef_comanda_app_sublabel`: "via app"
- `gef_comanda_caixa`: "Comanda (caixa)"
- `gef_comanda_caixa_sublabel`: "recebido fora do gateway"
- `gef_comanda_caixa_dinheiro`: "Dinheiro"
- `gef_comanda_caixa_pix`: "PIX"
- `gef_comanda_caixa_credit`: "Crédito"
- `gef_comanda_caixa_debit`: "Débito"
- `gef_unsettled_comandas`: "Comandas não recebidas"
- `gef_unsettled_card_number`: "Comanda"
- `gef_unsettled_consumer_name`: "Cliente"
- `gef_unsettled_consumer_phone`: "Telefone"
- `gef_unsettled_consumer_cpf`: "CPF"
- `gef_unsettled_value`: "Valor"
- `gef_open_comandas_warning`: "Há {count} comanda(s) ainda aberta(s). Feche o evento para consolidar as não recebidas."
- `gef_no_comandas`: não aplicável (seção oculta quando vazia)

#### 3. `src/i18n/translations/en-US.ts`
Adicionar as mesmas chaves em inglês.

#### 4. `docs/architecture.md`
Adicionar uma subseção em "Event Closing Report" (ou criar a seção) documentando que o relatório de fechamento consolida dados de comandas físicas: total recebido via app, total recebido no caixa com drill-down por forma de pagamento, e lista de comandas não recebidas (unsettled) para cobrança/registro.

### O que NÃO será alterado
- `useEventClosingReport` hook permanece inalterado.
- Seções existentes do relatório (resumo, origem, pagamento, caixas, cancelamentos) permanecem inalteradas.
- Nenhuma nova tabela, função ou Edge Function será criada; a RPC `get_event_comanda_summary` já existe.
- Nenhuma lógica de negócio editável será adicionada; a seção é read-only, exceto o expand/collapse do drill-down.

### Riscos / Considerações
- O componente `Collapsible` do shadcn já está disponível em `src/components/ui/collapsible.tsx`.
- A RPC `get_event_comanda_summary` é chamada de forma independente, com loading próprio (`comandaLoading`), não impactando o loading geral do relatório.
- A lista de não recebidas exibe o CPF intencionalmente (diferente da tela do caixa), conforme solicitado.