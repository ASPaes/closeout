# ADR-001: RBAC Consolidation

**Date:** 2026-03-06
**Status:** Accepted
**Decision makers:** Engineering team

## Context

The platform had two parallel RBAC systems:

1. **`user_roles`** — uses PostgreSQL enum `app_role`, with `has_role()` function
2. **`user_roles_new`** — uses FK to a `roles` table, with `has_role_name()` function

Both systems had their own RLS policies and scope-resolution functions (`_v1` and `_v2`). The `user_roles_new` table was empty in production. All existing role assignments used `user_roles`.

Additionally, all RLS policies were created as `RESTRICTIVE` (AND logic), which broke multi-tenant access — a `super_admin` needed to also pass `client_admin` policies to access data.

## Decision

1. **Standardize on `user_roles` + enum `app_role`** as the single RBAC system.
2. **Drop** `user_roles_new`, `roles` table, `has_role_name()`, and all `_v2` scope functions.
3. **Expand** `app_role` enum with: `waiter`, `cashier`, `consumer`, `event_organizer`.
4. **Rewrite all RLS policies** as PERMISSIVE (OR logic).
5. **Apply `FORCE ROW LEVEL SECURITY`** on `user_roles`.
6. **Create `get_my_roles()`** helper function.

## Consequences

### Positive
- Single source of truth for roles — no ambiguity
- Enum validation at database level — invalid roles impossible
- PERMISSIVE policies correctly implement multi-tenant OR logic
- Simplified codebase — fewer functions and tables to maintain
- `FORCE RLS` on `user_roles` prevents privilege escalation even for table owners

### Negative
- Adding new roles requires a database migration (`ALTER TYPE ... ADD VALUE`)
- Enum values cannot be removed once added (PostgreSQL limitation)

## Alternatives Considered

- **Keep both systems**: Rejected — maintenance burden, confusion, empty `user_roles_new`
- **Migrate to `user_roles_new`**: Rejected — would require migrating all existing data, and enum validation is stronger than FK to a roles table
