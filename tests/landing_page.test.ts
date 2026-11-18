import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');

test('LandingPage follows Organic Intelligence identity, 3-zone mobile-ready header, and immediate hero rendering', () => {
  const landing = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'LandingPage.tsx'), 'utf-8');
  const header = fs.readFileSync(path.join(ROOT, 'src', 'components', 'common', 'GlobalHeader.tsx'), 'utf-8');
  const visual = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'landing', 'SegmentationHeroVisual.tsx'),
    'utf-8'
  );
  const sections = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'landing', 'LandingSections.tsx'),
    'utf-8'
  );

  // Palette & typography
  for (const token of ['#FCFBF9', '#171717', '#4338CA']) {
    assert.ok(landing.includes(token), `Missing token ${token} in LandingPage`);
  }
  assert.ok(header.includes('BioSort'));
  assert.ok(header.includes('BioSortLogo'));
  assert.ok(landing.includes('GlobalHeader'));
  assert.ok(landing.includes('GlobalFooter'));
  assert.ok(landing.includes('Biomedical Image Intelligence'));
  assert.ok(landing.includes('Give biomedical waste analysis a clearer perspective.'));
  assert.ok(landing.includes('Explore Platform'));
  assert.ok(landing.includes('How It Works'));
  assert.ok(landing.includes('/login'));

  // Mobile nav drawer and below-the-fold lazy loading
  assert.ok(header.includes('landing-mobile-nav'));
  assert.ok(landing.includes('lazy('));
  assert.ok(landing.includes('<Suspense'));

  // All required page sections exist
  for (const anchor of ['id="introduction"', 'id="how-it-works"', 'id="capabilities"', 'id="why-it-matters"']) {
    assert.ok(sections.includes(anchor), `Missing landing section ${anchor}`);
  }

  // Hero visual uses restrained vector contours without fabricated scores
  assert.ok(visual.includes('<svg'));
  assert.equal(/\d+(\.\d+)?%/.test(visual), false, 'Do not fabricate segmentation confidence scores');
});

test('Landing copy strictly avoids unsupported clinical claims, fake stats, or prohibited buzzwords', () => {
  const landing = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'LandingPage.tsx'), 'utf-8');
  const sections = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'landing', 'LandingSections.tsx'),
    'utf-8'
  );
  const combined = `${landing}\n${sections}`.toLowerCase();

  for (const banned of [
    'revolutionizing',
    'fda approved',
    'clinically validated',
    'diagnostic',
    'replaces human',
    '99%',
    '98%',
    '95%',
  ]) {
    assert.equal(combined.includes(banned), false, `Disallowed unsupported claim "${banned}" found in landing copy`);
  }
});

test('App.tsx routes unauthenticated visitors at / to LandingPage while protecting workspace routes', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf-8');

  assert.ok(app.includes('WorkspaceRootGate'));
  assert.ok(app.includes('<LandingPage />'));
  assert.ok(app.includes('/welcome'));
  assert.ok(app.includes('<ProtectedRoute>'));
});
