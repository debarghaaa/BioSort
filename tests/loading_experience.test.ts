import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');

test('index.html provides immediate pre-JS Organic Intelligence loading shell with reduced-motion fallback', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

  assert.ok(html.includes('oi-boot-shell'), 'Missing pre-JS oi-boot-shell in index.html');
  assert.ok(html.includes('#FCFBF9'), 'Missing Organic Intelligence cream background in boot shell');
  assert.ok(html.includes('#4338CA'), 'Missing primary indigo emphasis in boot shell');
  assert.ok(html.includes('BioSort'), 'Missing BioSort branding in boot shell');
  assert.ok(html.includes('prefers-reduced-motion'), 'Missing reduced-motion support in boot shell');
});

test('OrganicLoadingScreen aligns with Auth1 design tokens, uses organic wave visual without spinner, and handles errors', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'common', 'OrganicLoadingScreen.tsx'),
    'utf-8'
  );

  // Uses existing project logo and editorial lockup
  assert.ok(source.includes('BioSortLogo'));
  assert.ok(source.includes('BioSort'));
  assert.ok(source.includes('auth-organic-display'));

  // Organic Intelligence palette
  for (const token of ['#FCFBF9', '#FFFFFF', '#171717', '#4338CA', '#6366F1', '#E5E5E5']) {
    assert.ok(source.includes(token), `Missing design token ${token} in OrganicLoadingScreen`);
  }

  // Uses organic wave SVG + restrained indeterminate progress bar (no spinning Loader2 or fake percentage)
  assert.ok(source.includes('oi-wave-segment'));
  assert.ok(source.includes('oi-progress-track'));
  assert.ok(source.includes('oi-progress-sweep'));
  assert.equal(source.includes('Loader2'), false);
  assert.equal(source.includes('animate-spin'), false);

  // Real error recovery actions
  assert.ok(source.includes('onRetry'));
  assert.ok(source.includes('onContinueToLogin'));
  assert.ok(source.includes('Retry session restoration'));
});

test('useAuth handles initialization failures cleanly without hanging and exposes retryInitialization', () => {
  const useAuth = fs.readFileSync(path.join(ROOT, 'src', 'hooks', 'useAuth.tsx'), 'utf-8');

  assert.ok(useAuth.includes('initError: string | null'));
  assert.ok(useAuth.includes('retryInitialization'));
  assert.ok(useAuth.includes('clearInitError'));
  assert.ok(useAuth.includes('restoreSession'));
  assert.equal(/\bconsole\.log\s*\(/.test(useAuth), false);
});

test('AppEntryGate consolidates root initialization without artificial delays or duplicate page loaders', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf-8');
  const gate = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'common', 'AppEntryGate.tsx'),
    'utf-8'
  );
  const login = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'LoginPage.tsx'), 'utf-8');
  const register = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'RegisterPage.tsx'), 'utf-8');
  const reset = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'ResetPasswordPage.tsx'), 'utf-8');
  const css = fs.readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf-8');

  assert.ok(app.includes('<AppEntryGate>'), 'App.tsx must wrap routes in AppEntryGate');
  assert.ok(app.includes('</AppEntryGate>'));
  assert.ok(gate.includes('OrganicLoadingScreen'));
  assert.ok(gate.includes('retryInitialization'));
  assert.equal(gate.includes('setTimeout'), false, 'Do not introduce artificial loading delays');

  // Ensure route pages no longer duplicate !auth.initialized loaders
  assert.equal(login.includes('!auth.initialized'), false);
  assert.equal(register.includes('!auth.initialized'), false);
  assert.equal(reset.includes('!auth.initialized'), false);

  // Ensure CSS provides compositor animations + reduced motion rules
  assert.ok(css.includes('@keyframes oiProgressSweep'));
  assert.ok(css.includes('@keyframes oiWaveDrift'));
  assert.ok(css.includes('@keyframes oiFadeIn'));
  assert.ok(css.includes('.oi-fade-in'));
});
