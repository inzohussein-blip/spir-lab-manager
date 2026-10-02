-- «محطة التواصل»: sealed messages the server cannot open (the lab's internal chat, under a name
-- made from its «رمز المحادثة»; the mailbox between labs, sealed for the receiving lab), and
-- «المحادثة العامة». Kept 30 days. Also created on first use by src/lib/connect/server.ts.
create table if not exists connect_room (id bigserial primary key, scope text not null, tag text not null, at bigint not null, box text not null);
create index if not exists connect_room_tag on connect_room (scope, tag, id);
create table if not exists connect_presence (scope text not null, tag text not null, dev text not null, at bigint not null, box text not null, primary key (scope, tag, dev));
create table if not exists connect_addr (addr text primary key, lid text not null, at bigint not null);
create table if not exists connect_mailbox (id bigserial primary key, to_addr text not null, from_pub text not null, at bigint not null, box text not null);
create index if not exists connect_mailbox_to on connect_mailbox (to_addr, id);
create table if not exists connect_public (id bigserial primary key, at bigint not null, lid text not null, name text not null, lab boolean not null default false, text text not null);
