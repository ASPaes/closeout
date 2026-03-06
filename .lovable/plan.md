

## Consolidar RBAC — Fase 1.1 (PERMISSIVE)

Confirmação: todas as policies serão criadas como **PERMISSIVE** (padrão do PostgreSQL — lógica OR entre policies do mesmo comando).

### 1. Migration SQL (única, atômica)

**a) Expandir enum `app_role`**
```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'waiter';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'consumer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'event_organizer';
```

**b) Dropar todas as policies existentes** (todas são RESTRICTIVE e usam `has_role_name`/`*_v2`)

Tabelas: `audit_logs`, `clients`, `events`, `venues`, `profiles`, `roles`, `user_roles_new`, `user_roles`

**c) Dropar tabelas e funções obsoletas**
```sql
DROP TABLE IF EXISTS user_roles_new CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP FUNCTION IF EXISTS get_user_client_ids_v2;
DROP FUNCTION IF EXISTS get_user_event_ids_v2;
DROP FUNCTION IF EXISTS get_user_venue_ids_v2;
DROP FUNCTION IF EXISTS has_role_name;
```

**d) Recriar policies PERMISSIVE** usando `has_role()` e funções v1:

| Tabela | Policy | Cmd | USING / WITH CHECK |
|---|---|---|---|
| **audit_logs** | `al_select_super` | SELECT | `has_role(auth.uid(), 'super_admin')` |
| | `al_select_client_admin` | SELECT | `has_role(auth.uid(), 'client_admin') AND user_id = auth.uid()` |
| | `al_insert_auth` | INSERT | `auth.role() = 'authenticated' AND user_id = auth.uid()` |
| **clients** | `cl_all_super` | ALL | `has_role(auth.uid(), 'super_admin')` |
| | `cl_select_client_admin` | SELECT | `has_role(auth.uid(), 'client_admin') AND id IN (SELECT get_user_client_ids(auth.uid()))` |
| | `cl_update_client_admin` | UPDATE | same |
| **venues** | `vn_all_super` | ALL | `has_role(auth.uid(), 'super_admin')` |
| | `vn_crud_client_admin` | SELECT/INSERT/UPDATE/DELETE (4 policies) | `has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT get_user_client_ids(auth.uid()))` |
| | `vn_select_assigned` | SELECT | `id IN (SELECT get_user_venue_ids(auth.uid()))` |
| **events** | `ev_all_super` | ALL | `has_role(auth.uid(), 'super_admin')` |
| | `ev_crud_client_admin` | SELECT/INSERT/UPDATE/DELETE (4 policies) | `has_role(auth.uid(), 'client_admin') AND venue_id IN (SELECT id FROM venues WHERE client_id IN (SELECT get_user_client_ids(auth.uid())))` |
| | `ev_select_assigned` | SELECT | `id IN (SELECT get_user_event_ids(auth.uid()))` |
| **profiles** | `pf_select_own` | SELECT | `id = auth.uid()` |
| | `pf_select_super` | SELECT | `has_role(auth.uid(), 'super_admin')` |
| | `pf_update_own` | UPDATE | `id = auth.uid()` |
| | `pf_update_super` | UPDATE | `has_role(auth.uid(), 'super_admin')` |
| **user_roles** | FORCE RLS + new policies: |
| | `ur_all_super` | ALL | `has_role(auth.uid(), 'super_admin')` |
| | `ur_select_own` | SELECT | `user_id = auth.uid()` |
| | `ur_select_client_admin` | SELECT | `has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT get_user_client_ids(auth.uid()))` |
| | `ur_insert_client_admin` | INSERT | same |
| | `ur_update_client_admin` | UPDATE | same |
| | `ur_delete_client_admin` | DELETE | same |

**e) Criar `get_my_roles()`**

**f) FORCE RLS em `user_roles`**

### 2. Frontend (3 arquivos)

- **`src/hooks/useAuth.tsx`**: Expandir union type do role com `event_organizer`, `waiter`, `cashier`, `consumer`
- **`src/pages/UsersRoles.tsx`**: Adicionar 4 novos roles em `roleLabels` e no `<Select>`
- **`src/i18n/translations/pt-BR.ts`** e **`en-US.ts`**: Traduções dos novos roles

### 3. Documentação (3 arquivos novos)

- `docs/architecture.md` — Seção RBAC consolidado
- `docs/SECURITY_DEBT.md` — RLS aplicado em `user_roles`, policies migradas
- `docs/specs/technical/adr/ADR-001-rbac-consolidation.md`

### Sem alterar

- Tabelas `clients`, `venues`, `events`, `profiles`, `audit_logs` (apenas policies)
- Lógica de autenticação
- Nenhuma tela ou componente novo

