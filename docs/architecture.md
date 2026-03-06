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
