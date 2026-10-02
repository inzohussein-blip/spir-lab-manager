-- «نافذة الأطباء»: one sealed copy of a doctor's results per doctor code (under a name made from
-- the code, which never reaches the server). Replaced at each upload; removed when the lab stops
-- the code or after 90 days without an upload. Also created on first use by src/lib/doctors/server.ts.
create table if not exists doctor_shares (tag text primary key, scope text not null, at bigint not null, box text not null);
