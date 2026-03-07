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
