# CloseOut — Architecture

## RBAC (Role-Based Access Control)

### Enum `app_role`

All roles are defined as a PostgreSQL enum:

| Role | Description |
|---|---|
| `super_admin` | Full platform access |
| `client_admin` | Manages a specific client and its venues/events |
| `venue_manager` | Manages a specific venue |
| `event_manager` | Manages a specific event |
| `event_organizer` | Organizes events (limited scope) |
| `staff` | General staff member |
| `waiter` | Waiter / garçom |
| `cashier` | Cashier / operador de caixa |
| `consumer` | End consumer |

### Table `user_roles`

Single source of truth for role assignments. Each row assigns one role to one user, optionally scoped to a `client_id`, `venue_id`, or `event_id`.

```
user_roles (
  id uuid PK,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  client_id uuid NULL FK → clients,
  venue_id uuid NULL FK → venues,
  event_id uuid NULL FK → events,
  created_at timestamptz
)
```

RLS is enabled with `FORCE ROW LEVEL SECURITY`. All policies are **PERMISSIVE** (OR logic).

### Helper Functions

| Function | Purpose |
|---|---|
| `has_role(user_id, role)` | Returns boolean — used in all RLS policies |
| `get_my_roles()` | Returns all roles for `auth.uid()` (SECURITY DEFINER) |
| `get_user_client_ids(user_id)` | Returns client UUIDs assigned to user |
| `get_user_venue_ids(user_id)` | Returns venue UUIDs assigned to user |
| `get_user_event_ids(user_id)` | Returns event UUIDs assigned to user |

### Scope Hierarchy

```
client → venue → event
```

A `client_admin` scoped to a client can manage all venues and events under that client. A `venue_manager` scoped to a venue can manage events at that venue.

### RLS Policy Pattern

All policies are PERMISSIVE (PostgreSQL default). Multiple policies for the same command use OR logic — if any one passes, access is granted.

Example for `clients` table:
- `cl_all_super`: super_admin can do everything
- `cl_select_client_admin`: client_admin can SELECT their own clients
- `cl_update_client_admin`: client_admin can UPDATE their own clients

---

## Auditoria

### Tabela `audit_logs`

Registra todas as ações relevantes do sistema para fins de compliance e debugging.

```
audit_logs (
  id uuid PK,
  user_id uuid NULL,
  action text NOT NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  old_data jsonb NULL,
  new_data jsonb NULL,
  metadata jsonb NULL,
  user_role text NULL,
  ip_address text NULL,
  created_at timestamptz NOT NULL
)
```

### Função `log_audit`

Função `SECURITY DEFINER` para inserir audit logs de forma segura a partir de Edge Functions e triggers, sem depender de RLS.

```sql
log_audit(p_user_id, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, p_metadata)
```

### Indexes

| Index | Colunas |
|---|---|
| `idx_audit_logs_user_id` | `user_id` |
| `idx_audit_logs_entity` | `entity_type, entity_id` |
| `idx_audit_logs_created_at` | `created_at DESC` |

---

## Enums de Status

| Enum | Valores |
|---|---|
| `app_role` | super_admin, client_admin, venue_manager, event_manager, event_organizer, staff, waiter, cashier, consumer |
| `event_status` | draft, active, completed, cancelled |
| `order_status` | pending, paid, preparing, ready, delivered, cancelled |
| `payment_status` | created, processing, approved, failed, cancelled |
| `qr_status` | valid, used, cancelled, invalid |
| `stock_movement_type` | entry, reservation, release, sale, adjustment |
| `campaign_status` | scheduled, active, paused, ended |
| `cash_register_status` | open, closed |
| `waiter_session_status` | active, closed |
| `order_origin` | consumer_app, waiter_app, cashier |

---

## Constants and Shared Types

### TypeScript Constants (`src/config/`)

All PostgreSQL enums are mirrored as TypeScript `as const` objects in `src/config/enums.ts`. Audit actions are defined in `src/config/audit-actions.ts`. Import via `@/config`.

**Rule:** Never hardcode status strings in components. Always use the typed constants.

### Shared Types (`src/types/`)

Generic reusable types used across multiple features:
- `PaginatedResponse<T>` — paginated Edge Function responses
- `ApiError` — RFC 7807 error format
- `SelectOption` — generic select item `{ value, label }`
- `DateRange` — date range `{ from, to }`

See `docs/specs/technical/CODEBASE_GUIDE.md` for detailed usage guide.

---

## Platform Settings

### Table `platform_settings`

Stores global platform defaults (single row). Managed via the Settings admin page.

```
platform_settings (
  id uuid PK,
  default_geo_radius_meters integer NOT NULL DEFAULT 500,
  default_max_order_value numeric NOT NULL DEFAULT 500.00,
  default_unretrieved_order_alert_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz,
  updated_at timestamptz
)
```

RLS: Only `super_admin` can read/write.

---

## Audit Log Automation

All CRUD operations on core entities (clients, venues, events, user_roles) automatically insert audit logs via the `logAudit()` helper in `src/lib/audit.ts`. This helper calls the `log_audit` database function.

Actions logged:
- `client.created`, `client.updated`
- `venue.created`, `venue.updated`
- `event.created`, `event.updated`
- `user.role_assigned`, `user.role_removed`

### TypeScript Constants (`src/config/`)

All PostgreSQL enums are mirrored as TypeScript `as const` objects in `src/config/enums.ts`. Audit actions are defined in `src/config/audit-actions.ts`. Import via `@/config`.

**Rule:** Never hardcode status strings in components. Always use the typed constants.

### Shared Types (`src/types/`)

Generic reusable types used across multiple features:
- `PaginatedResponse<T>` — paginated Edge Function responses
- `ApiError` — RFC 7807 error format
- `SelectOption` — generic select item `{ value, label }`
- `DateRange` — date range `{ from, to }`

See `docs/specs/technical/CODEBASE_GUIDE.md` for detailed usage guide.
