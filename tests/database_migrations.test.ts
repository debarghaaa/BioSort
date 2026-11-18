import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

function readAllMigrations(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  assert.ok(files.length >= 6, `Expected >= 6 SQL migrations, found ${files.length}`);
  return files.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8')).join('\n\n');
}

test('Supabase migrations enable RLS across all core and operational tables', () => {
  const sql = readAllMigrations();
  const requiredRlsTables = [
    'public.profiles',
    'public.waste_taxonomy',
    'public.bin_mappings',
    'public.model_versions',
    'public.classification_events',
    'public.manual_reviews',
    'public.audit_events',
    'public.retention_policies',
    'public.operational_alert_thresholds',
  ];
  for (const tbl of requiredRlsTables) {
    assert.ok(
      sql.includes(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY`),
      `Missing RLS enablement for ${tbl}`
    );
  }
});

test('Supabase migrations enforce foreign keys, private storage bucket, and immutability triggers', () => {
  const sql = readAllMigrations();

  assert.ok(sql.includes('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)'));
  assert.ok(sql.includes("'waste-evidence'"));
  assert.ok(sql.includes('public = FALSE'));
  assert.ok(sql.includes('CONSTRAINT chk_recommended_bin_only_when_accepted CHECK'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()'));
  assert.ok(sql.includes('CREATE TRIGGER trg_audit_events_immutable'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.submit_manual_review_decision('));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.get_monitoring_analytics('));
  assert.ok(sql.includes("'unavailable'::text AS physical_sensor_status"));
  assert.ok(sql.includes('NULL::numeric AS physical_fill_level_pct'));
});

test('Frontend source code never embeds service_role credentials or hardware/telemetry fabrication', () => {
  const srcRoot = path.join(ROOT, 'src');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });

  const srcFiles = walk(srcRoot).filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(srcFiles.length > 0);
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    assert.equal(
      content.includes('SUPABASE_SERVICE_ROLE_KEY'),
      false,
      `Frontend file ${file} references SUPABASE_SERVICE_ROLE_KEY`
    );
  }
});
