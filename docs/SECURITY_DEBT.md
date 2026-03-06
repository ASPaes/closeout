# CloseOut — Security Debt Tracker

## Resolved

### 2026-03-06 — RBAC Consolidation (Phase 1.1)

- ✅ `FORCE ROW LEVEL SECURITY` applied on `user_roles`
- ✅ All RLS policies migrated from `has_role_name()` → `has_role()` (enum-based)
- ✅ All RLS policies migrated from `*_v2` scope functions → v1 functions (`get_user_client_ids`, etc.)
- ✅ All policies changed from RESTRICTIVE → PERMISSIVE (OR logic for multi-tenant)
- ✅ Dropped obsolete tables: `user_roles_new`, `roles`
- ✅ Dropped obsolete functions: `has_role_name`, `get_user_client_ids_v2`, `get_user_venue_ids_v2`, `get_user_event_ids_v2`
- ✅ Created helper function `get_my_roles()`

## Open

_(none currently)_
