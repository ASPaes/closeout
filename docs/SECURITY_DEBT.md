# CloseOut — Security Debt Tracker

## Resolved

### 2026-03-06 — Fase 1.2: RLS Geral, Audit Logs e Enums

- ✅ `FORCE ROW LEVEL SECURITY` applied on all tables: `audit_logs`, `clients`, `venues`, `events`, `profiles`
- ✅ All RLS policies recreated as **PERMISSIVE** (fixed bug from Phase 1.1 where policies were RESTRICTIVE)
- ✅ `audit_logs` expanded with `old_data`, `new_data`, `user_role` columns
- ✅ Indexes created on `audit_logs` for `user_id`, `entity_type+entity_id`, `created_at`
- ✅ `log_audit()` SECURITY DEFINER function created
- ✅ 8 status enums created: `order_status`, `payment_status`, `qr_status`, `stock_movement_type`, `campaign_status`, `cash_register_status`, `waiter_session_status`, `order_origin`

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
