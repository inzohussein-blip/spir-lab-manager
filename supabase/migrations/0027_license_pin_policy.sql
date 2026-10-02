-- Lab codes: the owner's «رموز الدخول (PIN)» for the lab — the feature hidden or shown, and each
-- station's PINs (hashes and names; one station may have several). Applied by the lab's devices at
-- their next check. Also created on first use by src/lib/license/server.ts.
alter table station_licenses add column if not exists pin_policy text not null default '';
