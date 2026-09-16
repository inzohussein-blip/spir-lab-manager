import "server-only";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Append an immutable audit entry (AuraLIMS-style traceability). Best-effort:
 * an audit failure must never break the user's action, so errors are swallowed.
 */
export async function logAudit(
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const user = await getCurrentUser();
    await query(
      `insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        user?.id ?? null,
        user?.full_name ?? null,
        action,
        entity,
        entityId,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch {
    // never let auditing break the primary action
  }
}
