-- Lab codes: the owner's last «رمز دخول المحطات» change (a PIN hash set, or removed), applied by the
-- lab's devices at their next check. Also created on first use by src/lib/license/server.ts.
alter table station_licenses add column if not exists station_pin text not null default '';
