# CloseOut — Security Debt Tracker

## Resolved

### 2026-04-01 — Security Scan Hardening (8 findings)

- ✅ **waiter_invites overpermissive RLS**: Replaced `wi_all_manager` policy to use `is_client_manager()` instead of `get_user_client_ids()` — prevents waiters/bar_staff/cashiers from reading/managing invite codes
- ✅ **clients table sensitive data exposure**: Created `clients_limited` view (id, name, slug, logo_url, status) for lower-privileged roles. Policies `cl_select_venue_manager` and `cl_select_event_assigned` still grant row-level SELECT, but sensitive fields (CPF, owner data, financial info) should be accessed via the limited view for non-admin users
- ✅ **has_role_for_event client-level bypass**: Client-level role match in `has_role_for_event()` now restricted to admin/manager roles only (`client_admin`, `client_manager`, `super_admin`). Operational roles (`bar_staff`, `cashier`, `waiter`) must have explicit `event_id` assignment
- ✅ **Function search_path mutable**: Set `search_path = public` on all public functions: `has_role`, `has_role_for_client`, `has_role_for_event`, `is_super_admin`, `is_client_manager`, `is_cashier`, `has_role_in_client`, `is_waiter_for_event`, `set_updated_at`, `cash_orders_set_order_number`, `close_cash_register`, `next_cash_order_number`, `handle_orders_updated_at`, `expire_waiter_invites_on_event_close`
- ✅ **waiter_calls always-true INSERT**: Replaced `WITH CHECK (true)` with proper check requiring authenticated user + valid event association (via check-in or role assignment)
- ✅ **Security definer views**: Converted 6 views to `security_invoker = true`: `v_event_closing_report`, `v_event_sales_summary`, `v_event_cash_movements`, `v_event_cancellations`, `consumer_event_stats`, `consumer_event_stats_secure`
- ✅ **user_roles privilege escalation** (fixed prior): `ur_insert_client_manager` policy now validates `venue_id`/`event_id` belong to the manager's client

### 2026-03-12 — Fix RLS infinite recursion (42P17)

- ✅ Root cause: cross-table inline subqueries in RLS policies caused infinite recursion (venues↔events)
- ✅ Created 4 SECURITY DEFINER helper functions to break the cycle:
  - `get_venues_for_user_clients()`, `get_clients_for_user_venues()`, `get_clients_for_user_events()`, `get_venues_for_user_events()`
- ✅ Rewrote 6 policies on clients/venues/events to use helpers instead of inline subqueries
- ✅ All policies remain PERMISSIVE (OR logic)

### 2026-03-12 — Granular RLS policies for all roles

- ✅ `venue_manager` can UPDATE assigned venues and CRUD events at their venues
- ✅ `event_manager` can UPDATE assigned events
- ✅ Users assigned to events can SELECT the parent venue and client (read-only)
- ✅ `venue_manager` can SELECT the parent client (read-only)
- ✅ All policies remain PERMISSIVE (OR logic)

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

### Realtime messages — no RLS policies

- ⚠️ The `realtime.messages` table has no RLS policies. Any authenticated user can subscribe to any Realtime channel and receive row-change events for orders, waiter_sessions, waiter_calls, and waiter_cancellation_requests
- **Impact**: Sensitive operational and financial data could be observed by unauthorized users
- **Note**: This is in the `realtime` schema (Supabase-reserved) — direct policy modification is not recommended. Consider implementing channel-level authorization via Supabase Realtime authorization features or migrating to Broadcast with server-side filtering
