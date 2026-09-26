-- 0017_license_security.sql — wrong code / wrong password attempts kept in the database (so the
-- limit holds across server instances) and the owner's sign-in log for /licenses.
-- The app also creates these on first use, so existing databases need no manual step.

create table if not exists license_attempts (
  id text primary key,
  k  text   not null,   -- "activate:<ip>" or "owner:<ip>"
  at bigint not null    -- ms since epoch; rows older than a day are removed
);
create index if not exists license_attempts_k on license_attempts (k, at);

create table if not exists license_owner_log (
  id    text primary key,
  at    bigint  not null,
  ok    boolean not null,
  ip    text    not null default '',
  agent text    not null default ''
);
