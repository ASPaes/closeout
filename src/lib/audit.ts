import { supabase } from "@/integrations/supabase/client";
import type { AuditAction } from "@/config/audit-actions";

export async function logAudit(params: {
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("log_audit", {
    p_user_id: user.id,
    p_action: params.action,
    p_entity_type: params.entityType,
    p_entity_id: params.entityId,
    p_metadata: params.metadata ?? null,
    p_old_data: params.oldData ?? null,
    p_new_data: params.newData ?? null,
  });
}
