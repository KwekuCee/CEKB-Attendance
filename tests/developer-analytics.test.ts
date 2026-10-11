import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { summarizeDeveloperAccounts } from '../supabase/functions/_shared/developer-analytics.ts';
import { SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL } from '../src/data/supabase_schema.ts';

test('Developer account analytics returns counts only', () => {
  const summary = summarizeDeveloperAccounts([
    { role: 'Church Admin', church_name: 'Korle Bu', admin_verified: true },
    { role: 'Church Admin', church_name: 'Korle Bu', admin_verified: false },
    { role: 'Church Pastor', church_name: null, admin_verified: true },
  ]);

  assert.deepEqual(summary, {
    roleCounts: { 'Church Admin': 2, 'Church Pastor': 1 },
    staffByChurch: { 'korle bu': 2 },
    pendingCount: 1,
  });
  assert.equal(JSON.stringify(summary).includes('email'), false);
  assert.equal(JSON.stringify(summary).includes('phone'), false);
});

test('both copyable database scripts enforce server-role-only application table access', () => {
  const lockdown = 'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated';
  assert.ok(SUPABASE_SQL_SCHEMA.includes(lockdown));
  assert.ok(SUPABASE_UPDATE_SQL.includes(lockdown));
  assert.ok(SUPABASE_SQL_SCHEMA.includes('CREATE POLICY "Server side access only"'));
  assert.ok(SUPABASE_UPDATE_SQL.includes('CREATE POLICY "Server side access only"'));
});

test('database hardening includes the private cell reports table', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20261011180000_harden_portal_tables.sql', import.meta.url),
    'utf8',
  );
  for (const sql of [SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL, migration]) {
    assert.match(sql, /'cell_reports'/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  }
});
