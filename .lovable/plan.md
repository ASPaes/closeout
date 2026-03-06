

## Fase 1.2 — RLS Geral, Audit Logs e Enums

### Problema critico encontrado

Todas as policies existentes ainda estao como **RESTRICTIVE** (`Permissive: No` no schema dump). A migration da Fase 1.1 deveria ter criado policies PERMISSIVE mas falhou — provavelmente usou `AS RESTRICTIVE` ou a syntax errada. Esta fase vai corrigir isso junto com o resto.

### Resumo

- Corrigir audit_logs (3 colunas + 3 indexes)
- Criar funcao `log_audit` (SECURITY DEFINER)
- Criar 8 enums de status
- Aplicar FORCE RLS em 5 tabelas
- Recriar policies de audit_logs como PERMISSIVE (dropar as RESTRICTIVE existentes)
- Recriar TODAS as policies de TODAS as tabelas como PERMISSIVE (corrigir bug da Fase 1.1)
- Atualizar 3 arquivos de documentacao
- Atualizar types.ts (automatico via Supabase sync)

### Migration SQL (unica)

```sql
-- 1. Expandir audit_logs
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb,
  ADD COLUMN IF NOT EXISTS user_role text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 2. Funcao log_audit
CREATE OR REPLACE FUNCTION log_audit(...) -- conforme especificado na tarefa

-- 3. Criar 8 enums
CREATE TYPE order_status AS ENUM (...);
CREATE TYPE payment_status AS ENUM (...);
-- ... (todos os 8 conforme especificado)

-- 4. FORCE RLS em todas as tabelas
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE venues FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- 5. DROP todas as policies RESTRICTIVE existentes (TODAS as tabelas)
DROP POLICY IF EXISTS al_select_super ON audit_logs;
DROP POLICY IF EXISTS al_select_client_admin ON audit_logs;
DROP POLICY IF EXISTS al_insert_auth ON audit_logs;
DROP POLICY IF EXISTS cl_all_super ON clients;
DROP POLICY IF EXISTS cl_select_client_admin ON clients;
DROP POLICY IF EXISTS cl_update_client_admin ON clients;
DROP POLICY IF EXISTS vn_all_super ON venues;
DROP POLICY IF EXISTS vn_select_client_admin ON venues;
DROP POLICY IF EXISTS vn_insert_client_admin ON venues;
DROP POLICY IF EXISTS vn_update_client_admin ON venues;
DROP POLICY IF EXISTS vn_delete_client_admin ON venues;
DROP POLICY IF EXISTS vn_select_assigned ON venues;
DROP POLICY IF EXISTS ev_all_super ON events;
DROP POLICY IF EXISTS ev_select_client_admin ON events;
DROP POLICY IF EXISTS ev_insert_client_admin ON events;
DROP POLICY IF EXISTS ev_update_client_admin ON events;
DROP POLICY IF EXISTS ev_delete_client_admin ON events;
DROP POLICY IF EXISTS ev_select_assigned ON events;
DROP POLICY IF EXISTS pf_select_own ON profiles;
DROP POLICY IF EXISTS pf_select_super ON profiles;
DROP POLICY IF EXISTS pf_update_own ON profiles;
DROP POLICY IF EXISTS pf_update_super ON profiles;
DROP POLICY IF EXISTS ur_all_super ON user_roles;
DROP POLICY IF EXISTS ur_select_own ON user_roles;
DROP POLICY IF EXISTS ur_select_client_admin ON user_roles;
DROP POLICY IF EXISTS ur_insert_client_admin ON user_roles;
DROP POLICY IF EXISTS ur_update_client_admin ON user_roles;
DROP POLICY IF EXISTS ur_delete_client_admin ON user_roles;

-- 6. Recriar TODAS as policies como PERMISSIVE (sem AS RESTRICTIVE)
-- audit_logs: al_select_super_admin, al_select_client_admin, al_insert_authenticated
-- clients: cl_all_super, cl_select_client_admin, cl_update_client_admin
-- venues: vn_all_super, vn_select/insert/update/delete_client_admin, vn_select_assigned
-- events: ev_all_super, ev_select/insert/update/delete_client_admin, ev_select_assigned
-- profiles: pf_select_own, pf_select_super, pf_update_own, pf_update_super
-- user_roles: ur_all_super, ur_select_own, ur_select/insert/update/delete_client_admin
```

A syntax correta para PERMISSIVE e simplesmente `CREATE POLICY name ON table ...` sem `AS RESTRICTIVE`.

### Frontend

Nenhuma alteracao de tela — apenas o `AuditLog` type em `AuditLogs.tsx` precisa incluir `old_data`, `new_data` e `user_role` no tipo local (as novas colunas). O `select("*")` ja vai trazer automaticamente.

### Documentacao (3 arquivos)

| Arquivo | Alteracao |
|---|---|
| `docs/architecture.md` | Adicionar secoes "Auditoria" e "Enums de Status" |
| `docs/SECURITY_DEBT.md` | Registrar FORCE RLS em todas as tabelas + correcao RESTRICTIVE→PERMISSIVE |
| `docs/specs/technical/BUSINESS_LOGIC.md` | Criar — documentar todos os enums e valores validos |

### Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/[timestamp].sql` | Criado — migration completa |
| `src/pages/AuditLogs.tsx` | Editado — expandir tipo AuditLog |
| `docs/architecture.md` | Editado — novas secoes |
| `docs/SECURITY_DEBT.md` | Editado — registrar fase 1.2 |
| `docs/specs/technical/BUSINESS_LOGIC.md` | Criado |

### Nao alterar

- Tabelas clients, venues, events, profiles (estrutura)
- Logica de autenticacao
- Nenhuma tela ou componente novo
- Nenhuma tabela nova

