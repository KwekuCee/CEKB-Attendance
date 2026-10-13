import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateSmsCost } from '../src/lib/smsPricing';
import { buildAttendanceCodeSms } from '../supabase/functions/_shared/attendance-code-sms';
import { readFile } from 'node:fs/promises';
import { SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL } from '../src/data/supabase_schema';

test('GSM-7 page counts include multipart boundaries and extension characters', () => {
  assert.equal(estimateSmsCost('a'.repeat(160), 1, 1).pagesPerMessage, 1);
  assert.equal(estimateSmsCost('a'.repeat(161), 1, 1).pagesPerMessage, 2);
  const extended = estimateSmsCost('^', 3, 0.5);
  assert.equal(extended.encoding, 'GSM-7');
  assert.equal(extended.characters, 2);
  assert.equal(extended.totalPages, 3);
  assert.equal(extended.estimatedCost, 1.5);
});

test('Unicode messages use 70/67 character page boundaries', () => {
  assert.equal(estimateSmsCost('文'.repeat(70), 1, 2).pagesPerMessage, 1);
  assert.equal(estimateSmsCost('🙂'.repeat(35), 1, 2).pagesPerMessage, 1);
  assert.equal(estimateSmsCost('🙂'.repeat(36), 1, 2).pagesPerMessage, 2);
  const multi = estimateSmsCost('文'.repeat(71), 2, 1.25);
  assert.equal(multi.encoding, 'Unicode');
  assert.equal(multi.pagesPerMessage, 2);
  assert.equal(multi.totalPages, 4);
  assert.equal(multi.estimatedCost, 5);
});

test('attendance code texts identify the code and explain how to keep it safe', () => {
  const memberMessage = buildAttendanceCodeSms('Ama Mensah', 'CE-2901', 'member');
  assert.match(memberMessage, /^Hello Ama Mensah, your member code: CE-2901\./);
  assert.match(memberMessage, /Keep safe; share only with your church admin or usher/);
  assert.match(memberMessage, /God bless you\.$/);
  assert.match(buildAttendanceCodeSms('Kwame', 'LDR-001', 'leader'), /your leader code: LDR-001/);
  const longCodeMessage = buildAttendanceCodeSms('A'.repeat(80), 'X'.repeat(50), 'member');
  assert.ok(longCodeMessage.length <= 160);
  assert.ok(longCodeMessage.includes('X'.repeat(50)));
});

test('SMS dispatch requires the Developer-configured estimate rate and checks live balance', async () => {
  const edgeFunction = await readFile(
    new URL('../supabase/functions/portal-db/index.ts', import.meta.url),
    'utf8',
  );
  assert.match(edgeFunction, /if \(cfg\.unitRate === null \|\| cfg\.unitRate <= 0\) \{\s*return json\(\{ error: \{ message: 'SMS sending is not configured yet\./);
  assert.match(edgeFunction, /const unitRate = cfg\.unitRate;\s*const estimate = estimateSmsCost\(message, recipients\.length, unitRate\)/);
  assert.match(edgeFunction, /if \(balance < estimate\.estimatedCost\)/);
});

test('copyable schemas include private mNotify request and SMS tables', () => {
  for (const schema of [SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL]) {
    for (const table of ['sender_id_requests', 'sender_id_status_history', 'admin_alerts', 'sms_campaigns', 'sms_recipients']) {
      assert.ok(schema.includes(`CREATE TABLE IF NOT EXISTS public.${table}`));
      assert.ok(schema.includes(`'${table}'`));
    }
  }
});

test('mNotify migration keeps the new tables service-role-only', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20261011200000_mnotify_sender_id_and_campaigns.sql', import.meta.url),
    'utf8',
  );
  for (const table of ['sender_id_requests', 'sender_id_status_history', 'admin_alerts', 'sms_campaigns', 'sms_recipients']) {
    assert.ok(migration.includes(`'${table}'`));
  }
  assert.match(migration, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /CREATE POLICY "Server side access only"/);
});

test('portal-db routes Sender ID actions and registration from the admin UI', async () => {
  const [edgeFunction, settingsView] = await Promise.all([
    readFile(new URL('../supabase/functions/portal-db/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/SettingsView.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(edgeFunction, /case 'mnotifyUser':\s*return await handleMnotifyUserAction/);
  assert.match(edgeFunction, /if \(op === 'submitSenderId'\)/);
  assert.match(settingsView, /action: 'mnotifyUser',\s*op: 'submitSenderId'/);
});

test('Developer can soft-delete a Sender ID request without implying provider deletion', async () => {
  const [edgeFunction, developerPortal, schema, migration, rawPortal] = await Promise.all([
    readFile(new URL('../supabase/functions/portal-db/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/DeveloperPortal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/data/supabase_schema.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20261013160000_soft_delete_sender_id_requests.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/rawPortal.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(edgeFunction, /if \(op === 'deleteSenderId'\)/);
  assert.match(edgeFunction, /session\?\.role !== 'Developer'/);
  assert.match(edgeFunction, /deleted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(edgeFunction, /providerDeleted: false/);
  assert.match(edgeFunction, /\.is\('deleted_at', null\)/);
  assert.match(developerPortal, /op: 'deleteSenderId'/);
  assert.match(developerPortal, /registration in mNotify will remain active/);
  assert.match(schema, /deleted_at TIMESTAMPTZ/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ/);
  assert.match(migration, /deleted_at IS NULL/);
  assert.match(rawPortal, /action === 'devAction' && data\?\.error === 'Unknown operation'/);
  assert.match(rawPortal, /Deploy the latest portal-db Supabase Edge Function/);
});
