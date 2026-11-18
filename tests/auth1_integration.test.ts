import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  parseConfiguredOAuthProviders,
  sanitizeRedirectPath,
  validateEmail,
  validatePassword,
} from '../src/utils/authValidation.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Email and password validation enforce clear client-side constraints', () => {
  assert.ok(validateEmail('') !== null);
  assert.ok(validateEmail('not-an-email') !== null);
  assert.equal(validateEmail('operator@hospital.org'), null);

  assert.ok(validatePassword('') !== null);
  assert.ok(validatePassword('short', { minLength: 8 }) !== null);
  assert.equal(validatePassword('ClinicalPass#2026', { minLength: 8 }), null);
});

test('Redirect sanitizer blocks open-redirect and auth-loop targets', () => {
  assert.equal(sanitizeRedirectPath('/review'), '/review');
  assert.equal(sanitizeRedirectPath('/classify'), '/classify');
  assert.equal(sanitizeRedirectPath('//evil.example.com'), '/');
  assert.equal(sanitizeRedirectPath('https://evil.example.com/phish'), '/');
  assert.equal(sanitizeRedirectPath('/login'), '/');
  assert.equal(sanitizeRedirectPath('/register'), '/');
  assert.equal(sanitizeRedirectPath('/reset-password'), '/');
  assert.equal(sanitizeRedirectPath(undefined), '/');
});

test('OAuth provider parser returns only genuinely configured providers when Supabase is active', () => {
  assert.deepEqual(parseConfiguredOAuthProviders('google,github', false), []);
  assert.deepEqual(parseConfiguredOAuthProviders('', true), []);
  assert.deepEqual(parseConfiguredOAuthProviders('google, github, google, microsoft', true), [
    { id: 'google', label: 'Google' },
    { id: 'github', label: 'GitHub' },
    { id: 'azure', label: 'Microsoft' },
  ]);
});

test('Auth1 component and auth routes implement Organic Intelligence design without duplicate auth providers or console credential logging', () => {
  const auth1Source = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'ui', 'auth1', 'index.tsx'),
    'utf-8'
  );
  const loginSource = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'LoginPage.tsx'), 'utf-8');
  const registerSource = fs.readFileSync(
    path.join(ROOT, 'src', 'pages', 'RegisterPage.tsx'),
    'utf-8'
  );
  const resetSource = fs.readFileSync(
    path.join(ROOT, 'src', 'pages', 'ResetPasswordPage.tsx'),
    'utf-8'
  );
  const useAuthSource = fs.readFileSync(path.join(ROOT, 'src', 'hooks', 'useAuth.tsx'), 'utf-8');
  const appSource = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf-8');

  // Verify no duplicate auth files remain
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'components', 'AuthModal.tsx')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'state', 'usePlatformStore.tsx')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'lib', 'supabaseClient.ts')), false);

  // Verify routes are wired in App.tsx
  for (const route of ['/login', '/register', '/reset-password']) {
    assert.ok(appSource.includes(route), `Missing route ${route}`);
  }

  // Verify Organic Intelligence palette & BioSort domain branding
  for (const token of ['#FFFFFF', '#171717', '#4338CA', '#6366F1', '#E5E5E5', '#737373', '#D9534F', '#238B68']) {
    assert.ok(auth1Source.includes(token), `Missing Organic Intelligence color token ${token}`);
  }
  const sidebarSource = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'common', 'SidebarNavigation.tsx'),
    'utf-8'
  );
  const indexHtmlSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  assert.ok(loginSource.includes('brandName="BioSort"'));
  assert.ok(registerSource.includes('brandName="BioSort"'));
  assert.ok(resetSource.includes('BioSortLogo'));
  assert.ok(sidebarSource.includes('BioSort') && sidebarSource.includes('BioSortLogo'));
  assert.ok(indexHtmlSource.includes('<title>BioSort'));
  assert.ok(loginSource.includes('Sign in to workspace'));
  assert.ok(loginSource.includes('SECURE ACCESS'));

  // Verify no console.log in auth modules and type="button" on toggles
  for (const source of [auth1Source, loginSource, registerSource, resetSource, useAuthSource]) {
    assert.equal(/\bconsole\.log\s*\(/.test(source), false, 'Found console.log in auth code');
  }
  assert.ok(auth1Source.includes('type="button"'));
  assert.ok(useAuthSource.includes('signUpWithSupabase'));
  assert.ok(useAuthSource.includes('resetPasswordForEmail'));
  assert.ok(useAuthSource.includes('signInWithOAuth'));
});
