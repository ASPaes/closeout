

# Close Out — System Foundation

## Overview
Multi-tenant SaaS platform for bars, nightclubs, and events. This phase builds the core foundation: authentication, RBAC, tenant hierarchy, and admin panel.

---

## Database Schema

### Core Tables
- **clients** — Business owners (tenant root). Fields: name, slug, logo_url, contact info, active status
- **venues** — Physical locations belonging to a client. Fields: name, address, city, state, capacity, active status
- **events** — Events tied to a venue. Fields: name, date/time, status (draft/active/completed/cancelled), description

### Auth & RBAC
- **user_roles** — Role assignments with scope. Uses `app_role` enum (super_admin, client_admin, venue_manager, event_manager, staff). Each row links a user to a role + optional client_id/venue_id/event_id scope
- **profiles** — Public user profile data (full_name, avatar_url, phone), auto-created on signup via trigger

### Audit
- **audit_logs** — Tracks all significant actions. Fields: user_id, action, table_name, record_id, old_data (jsonb), new_data (jsonb), ip_address, timestamp

---

## Row-Level Security Strategy
- `has_role()` security definer function to check roles without recursion
- `get_user_client_ids()` helper to return which clients a user can access
- All tables have RLS enabled. Policies scope data access by role hierarchy:
  - **super_admin** → sees everything
  - **client_admin** → sees only their client's data
  - **venue_manager** → sees only their venue(s)
  - **event_manager** → sees only their event(s)

---

## Authentication
- Email/password signup & login via Supabase Auth
- Protected routes with auth guard component
- Session management with `onAuthStateChange`
- Password reset flow with `/reset-password` page

---

## Admin Panel (Dark Theme)

### Layout
- Sidebar navigation with collapsible sections
- Top bar showing current user, role badge, and logout
- Dark theme as default using Tailwind CSS variables

### Pages
1. **Login / Signup** — Clean auth forms
2. **Dashboard** — Summary cards (total clients, venues, upcoming events)
3. **Clients** — List, create, edit, deactivate clients
4. **Venues** — List venues (filtered by client), create, edit
5. **Events** — List events (filtered by venue), create, edit, change status
6. **Users & Roles** — List users, assign/revoke roles with scoped permissions
7. **Audit Logs** — Searchable, filterable log viewer (read-only)

### UX Details
- Tables with pagination, search, and sorting
- Forms in slide-over sheets or modals
- Toast notifications for actions
- Breadcrumb navigation reflecting hierarchy (Client → Venue → Event)
- Role-aware UI: menu items and actions hidden based on user's role

