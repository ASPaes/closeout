# CloseOut — Codebase Guide

## Estrutura de Constantes (`src/config/`)

### `src/config/enums.ts`

Contém todas as constantes que espelham os enums do PostgreSQL. Cada enum é exportado como um objeto `as const` com um type helper correspondente.

| Constante | Type | Enum PostgreSQL |
|---|---|---|
| `APP_ROLE` | `AppRole` | `app_role` |
| `EVENT_STATUS` | `EventStatus` | `event_status` |
| `ORDER_STATUS` | `OrderStatus` | `order_status` |
| `PAYMENT_STATUS` | `PaymentStatus` | `payment_status` |
| `QR_STATUS` | `QrStatus` | `qr_status` |
| `STOCK_MOVEMENT_TYPE` | `StockMovementType` | `stock_movement_type` |
| `CAMPAIGN_STATUS` | `CampaignStatus` | `campaign_status` |
| `CASH_REGISTER_STATUS` | `CashRegisterStatus` | `cash_register_status` |
| `WAITER_SESSION_STATUS` | `WaiterSessionStatus` | `waiter_session_status` |
| `ORDER_ORIGIN` | `OrderOrigin` | `order_origin` |
| `ENTITY_STATUS` | `EntityStatus` | — (usado para clients/venues) |

### `src/config/audit-actions.ts`

Contém todas as ações de auditoria tipadas usadas com a função `log_audit()`. Padrão de nomenclatura: `domain.action` (ex: `payment.created`, `order.cancelled`).

### `src/config/index.ts`

Barrel export — importar sempre de `@/config`.

### Quando adicionar novas constantes

- **Novo enum no banco**: criar constante + type em `enums.ts`
- **Nova ação de auditoria**: adicionar em `audit-actions.ts`
- **Nunca** hardcodar strings de status em componentes

### Exemplo de uso

```tsx
import { EVENT_STATUS, ENTITY_STATUS } from "@/config";

// Em queries
supabase.from("venues").select("*").eq("status", ENTITY_STATUS.ACTIVE);

// Em comparações
if (event.status === EVENT_STATUS.DRAFT) { ... }

// Em formulários (usar `as string` para compatibilidade com Select)
const [form, setForm] = useState({ status: EVENT_STATUS.ACTIVE as string });
```

---

## Tipos Compartilhados (`src/types/`)

### `src/types/index.ts`

| Type | Uso |
|---|---|
| `PaginatedResponse<T>` | Resposta paginada de Edge Functions |
| `ApiError` | Erro RFC 7807 retornado por Edge Functions |
| `SelectOption` | Item de select genérico `{ value, label }` |
| `DateRange` | Range de datas `{ from, to }` |

### Quando adicionar novos types

- Types usados por **múltiplos features** → `src/types/`
- Types usados por **um único feature** → dentro do feature
- Types de entidade do banco → usar os gerados em `src/integrations/supabase/types.ts`

---

## UI Standard (Design System Lock)

### Regras obrigatórias

1. **Sempre usar componentes compartilhados** — nenhuma tela pode criar header, tabela, modal ou badge do zero.

| Componente | Uso |
|---|---|
| `PageHeader` | Título + subtítulo + ações de toda página |
| `DataTable` | Qualquer listagem com busca, loading e empty state |
| `ModalForm` | Formulários em sheet (criar/editar) |
| `StatusBadge` | Status em tabelas/listas (`active`, `inactive`, `draft`, `completed`, `cancelled`) |
| `EmptyState` | Estado vazio com mensagem, dica e ação opcional |
| `toast` (sonner) | Feedback de sucesso, erro e info |

2. **Nunca usar cores hardcoded** em páginas ou componentes compartilhados.
   - ✅ `text-primary`, `bg-card`, `border-border`, `text-muted-foreground`
   - ❌ `text-white`, `bg-black`, `text-gray-500`, `bg-green-600`, `#FF6A00`
   - Exceção: `src/components/ui/` (shadcn primitivos) pode manter defaults.

3. **Todo texto de UI deve usar i18n** (`useTranslation` + chaves em `pt-BR.ts` / `en-US.ts`).
   - Nunca hardcodar strings em português diretamente no JSX.

4. **Tokens disponíveis** (definidos em `index.css`):

| Token | Uso |
|---|---|
| `--primary` / `--primary-glow` | Cor principal e efeito glow |
| `--background` | Fundo global |
| `--card` | Superfície de cards |
| `--secondary` | Painéis e inputs |
| `--success` | Status ativo, confirmações |
| `--warning` | Alertas, rascunhos |
| `--destructive` | Erros, cancelamentos |
| `--info` | Informações neutras |

5. **Micro-interações padrão**:
   - `glow-hover` em botões primários
   - `animate-fade-in` em conteúdo que aparece
   - `transition-colors duration-150` em hovers de tabela
   - Focus ring via `ring-ring/60` (automático pelo base layer)

### Exemplo de página padrão

```tsx
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { useTranslation } from "@/i18n/use-translation";

export default function MinhaPage() {
  const { t } = useTranslation();
  // ... estado, fetch, handlers

  const columns: DataTableColumn<T>[] = [
    { key: "name", header: t("name"), render: (r) => r.name },
    { key: "status", header: t("status"), render: (r) => (
      <StatusBadge status={r.is_active ? "active" : "inactive"} label={...} />
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("page_title")} icon={Icon} actions={...} />
      <DataTable columns={columns} data={data} loading={loading} ... />
      <ModalForm open={open} onOpenChange={setOpen} title={...} onSubmit={...}>
        {/* campos do formulário */}
      </ModalForm>
    </div>
  );
}
```
