import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL } from '../src/data/supabase_schema.ts';

test('church deletion only filters service types by columns in the service_types schema', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20261013133000_fix_church_deletion_service_types.sql', import.meta.url),
    'utf8',
  );
  for (const sql of [SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL, migration]) {
    const statement = sql.match(/DELETE FROM public\.service_types[^;]*;/i)?.[0] || '';
    assert.match(statement, /WHERE is_global = FALSE AND church_id = OLD\.id/i);
    assert.doesNotMatch(statement, /church_name/i);
  }
});

test('both admin dashboards use the role-checked server-side delete action', async () => {
  const service = await readFile(new URL('../src/lib/supabaseService.ts', import.meta.url), 'utf8');
  const developer = await readFile(new URL('../src/components/DeveloperPortal.tsx', import.meta.url), 'utf8');
  const backend = await readFile(new URL('../supabase/functions/portal-db/index.ts', import.meta.url), 'utf8');

  assert.match(service, /rawPortal\([\s\S]{0,120}action: 'deleteChurch'/);
  assert.match(service, /portal-db Edge Function is outdated/);
  assert.match(service, /Apply migration 20261013133000_fix_church_deletion_service_types\.sql/);
  assert.match(developer, /deleteChurchFromSupabase\(targetId \|\| targetName, token\)/);
  assert.match(developer, /result\.error/);
  assert.match(backend, /case 'deleteChurch':\s+return await handleChurchDeletion\(body, session\)/);
  assert.match(backend, /Only the Developer or Group Pastor can delete a church/);
  assert.match(backend, /Could not delete \$\{church\.name\}/);
});
