import { createAdminClient } from "@/lib/supabase/admin";

export async function logAudit(entry: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    details: entry.details ?? null,
  });
}
