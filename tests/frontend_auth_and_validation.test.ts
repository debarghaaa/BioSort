import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
} from '../src/utils/imageValidation.ts';
import { formatTimestamp, isValidHexColor } from '../src/utils/formatters.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Frontend upload validation bounds match backend FastAPI limits', () => {
  assert.deepEqual(ACCEPTED_IMAGE_MIME_TYPES, ['image/jpeg', 'image/jpg', 'image/png']);
  assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  assert.equal(MIN_IMAGE_DIMENSION, 64);
  assert.equal(MAX_IMAGE_DIMENSION, 8192);
});

test('Formatter helpers safely format ISO timestamps and validate category hex swatches', () => {
  assert.notEqual(formatTimestamp('2026-11-17T10:15:30Z'), '—');
  assert.equal(formatTimestamp(null), '—');
  assert.equal(isValidHexColor('#0369A1'), true);
  assert.equal(isValidHexColor('not-a-color'), false);
});

test('Application router defines all required pages, RBAC review guard, and guest mode support', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf-8');
  for (const route of ['/login', '/classify', '/history', '/review', '/analytics', '/models', '/settings']) {
    assert.ok(appSource.includes(route), `Missing route ${route} in src/App.tsx`);
  }
  assert.ok(
    appSource.includes('allowedRoles={[UserRole.REVIEWER, UserRole.ADMIN]}'),
    'Missing RBAC role guard on /review'
  );

  const authSource = fs.readFileSync(path.join(ROOT, 'src', 'hooks', 'useAuth.tsx'), 'utf-8');
  assert.ok(authSource.includes('enterGuestSession'), 'Missing enterGuestSession in useAuth.tsx');

  const loginSource = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'LoginPage.tsx'), 'utf-8');
  assert.ok(loginSource.includes('enterGuestSession'), 'Missing Guest Mode action on LoginPage');
});
