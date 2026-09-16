-- 0008_audit.sql — immutable audit trail + order accession number.
-- Adapted from AuraLIMS's audit/traceability model: every clinically meaningful
-- action (order created, result saved/verified, status change, report sent) is
-- appended here with who/when/what, for traceability.

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_name  text,
  action      text not null,   -- 'order.created' | 'result.saved' | 'order.status' | 'report.sent' | 'patient.created'
  entity      text,            -- 'order' | 'patient' | 'result' | 'report'
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_created on audit_log (created_at desc);
create index if not exists idx_audit_entity on audit_log (entity, entity_id);

-- Human-friendly sample/accession id shown on the order and report.
alter table test_orders add column if not exists accession_no text;
