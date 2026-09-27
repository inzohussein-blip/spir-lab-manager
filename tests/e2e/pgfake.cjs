/**
 * For the lab-database sync tests: throw-away PostgreSQL databases, and a small stand-in for a
 * Supabase project (its sign-in and REST calls) backed by a real PostgreSQL. Queries run as the
 * "authenticated" role, so the grants of SUPABASE_SQL are exercised as on Supabase.
 *  - E2E_PG_URL: a PostgreSQL the tests may create databases in (e.g. the CI service).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client, Pool } = require('pg');

const PG = process.env.E2E_PG_URL || '';
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'sync', 'protocol.ts'), 'utf8');
const grab = (name) => new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`).exec(src)[1];
const SCHEMA_SQL = grab('SCHEMA_SQL');
const SUPABASE_SQL = grab('SUPABASE_SQL').replace('${SCHEMA_SQL}', () => SCHEMA_SQL);

const withDb = (url, db) => { const u = new URL(url); u.pathname = `/${db}`; return u.toString(); };

/** A new empty database (optionally with the Supabase setup script run in it). */
async function freshDb(prefix, { supabase = false } = {}) {
  const name = `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const admin = new Client({ connectionString: PG }); await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = withDb(PG, name);
  if (supabase) {
    const c = new Client({ connectionString: url }); await c.connect();
    for (const r of ['anon', 'authenticated']) await c.query(`do $$ begin if not exists (select from pg_roles where rolname = '${r}') then create role ${r} nologin; end if; end $$;`);
    await c.query(SUPABASE_SQL);
    await c.end();
  }
  return {
    url,
    async query(sql, params) { const c = new Client({ connectionString: url }); await c.connect(); try { return (await c.query(sql, params)).rows; } finally { await c.end(); } },
    async drop() {
      const a = new Client({ connectionString: PG }); await a.connect();
      await a.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [name]).catch(() => {});
      await a.query(`drop database if exists ${name}`).catch(() => {}); await a.end();
    },
  };
}

/** A Supabase stand-in on `port`: /auth/v1/token and the REST calls the stations make. */
function fakeSupabase(dbUrl, port, { anon = 'anon-test', email = 'lab@example.com', password = 'lab-pass' } = {}) {
  const pool = new Pool({ connectionString: dbUrl, max: 3 });
  const tokens = new Set();
  const calls = { signIn: 0, pull: 0, push: 0 };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, authorization, content-type, prefer', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-expose-headers': 'content-range' };
  const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...cors, ...extra }); res.end(JSON.stringify(body)); };
  const asUser = async (fn) => {
    const c = await pool.connect();
    try { await c.query('begin'); await c.query('set local role authenticated'); const r = await fn(c); await c.query('commit'); return r; }
    catch (e) { await c.query('rollback').catch(() => {}); throw e; }
    finally { c.release(); }
  };
  const pgErr = (res, e) => (e.code === '42P01' || e.code === '42883') ? send(res, 404, { code: 'PGRST205', message: e.message }) : e.code === '42501' ? send(res, 403, { code: '42501', message: e.message }) : send(res, 400, { code: e.code, message: e.message });
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const u = new URL(req.url, `http://localhost:${port}`);
    let body = ''; for await (const ch of req) body += ch;
    if (req.headers.apikey !== anon) return send(res, 401, { message: 'Invalid API key' });
    if (u.pathname === '/auth/v1/token') {
      const b = JSON.parse(body || '{}');
      const grant = u.searchParams.get('grant_type');
      if (grant === 'password' && (b.email !== email || b.password !== password)) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      if (grant === 'refresh_token' && !String(b.refresh_token || '').startsWith('r-')) return send(res, 400, { error: 'invalid_grant' });
      calls.signIn++;
      const t = 't-' + crypto.randomBytes(8).toString('hex'); tokens.add(t);
      return send(res, 200, { access_token: t, refresh_token: 'r-' + t, expires_in: 3600 });
    }
    const tok = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (!tokens.has(tok)) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
    try {
      if (u.pathname === '/rest/v1/rpc/lab_sync_push' && req.method === 'POST') {
        calls.push++;
        const { batch } = JSON.parse(body || '{}');
        const n = await asUser((c) => c.query('select lab_sync_push($1::jsonb) as n', [JSON.stringify(batch)]));
        return send(res, 200, n.rows[0].n);
      }
      if (u.pathname === '/rest/v1/lab_sync_records' && req.method === 'GET') {
        const cols = (u.searchParams.get('select') || '*').split(',').filter((c) => /^(coll|id|data|mtime|deleted|ord|node|rev)$/.test(c));
        const where = [], params = [];
        const rev = u.searchParams.get('rev'); if (rev) { params.push(Number(rev.replace(/^gt\./, ''))); where.push(`rev > $${params.length}`); }
        const node = u.searchParams.get('node'); if (node != null) { params.push(node.replace(/^neq\./, '')); where.push(`node <> $${params.length}`); }
        if (u.searchParams.get('deleted') === 'is.false') where.push('not deleted');
        const order = u.searchParams.get('order') === 'rev.desc' ? 'rev desc' : 'rev asc';
        const limit = Math.min(1000, Number(u.searchParams.get('limit')) || 1000);
        const w = where.length ? `where ${where.join(' and ')}` : '';
        calls.pull++;
        const { rows, total } = await asUser(async (c) => ({
          rows: (await c.query(`select ${cols.join(', ')} from lab_sync_records ${w} order by ${order} limit ${limit}`, params)).rows,
          total: /count=exact/.test(req.headers.prefer || '') ? Number((await c.query(`select count(*)::int as n from lab_sync_records ${w}`, params)).rows[0].n) : null,
        }));
        return send(res, 200, rows, total == null ? {} : { 'content-range': rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}` });
      }
      return send(res, 404, { message: 'not found' });
    } catch (e) { return pgErr(res, e); }
  });
  return new Promise((resolve) => server.listen(port, () => resolve({
    url: `http://localhost:${port}`, anon, email, password, calls,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => pool.end().then(r, r)); }),
  })));
}

/** Poll until fn() is truthy (or time runs out). */
async function waitFor(fn, ms = 20000, step = 400) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await new Promise((r) => setTimeout(r, step));
  }
}

module.exports = { PG, freshDb, fakeSupabase, waitFor, SUPABASE_SQL };
