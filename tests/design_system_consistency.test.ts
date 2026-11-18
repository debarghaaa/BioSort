import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');

function listTsAndCssFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsAndCssFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

test('All src modules use unified Organic Intelligence tokens without legacy .neu- classes', () => {
  const files = listTsAndCssFiles(path.join(ROOT, 'src'));
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    assert.equal(
      /\bneu-(card|inset|input|btn)/.test(content),
      false,
      `Legacy .neu-* class found in ${path.relative(ROOT, file)}`
    );
    assert.equal(
      content.includes('#000000'),
      false,
      `Legacy #000000 color found in ${path.relative(ROOT, file)}`
    );
    assert.equal(
      content.includes('#F4F4F5'),
      false,
      `Legacy #F4F4F5 color found in ${path.relative(ROOT, file)}`
    );
  }
});

test('src/index.css defines Organic Intelligence palette, typography scale, motion curve, and reduced-motion rules', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf-8');
  for (const token of [
    '--bg-base: #FCFBF9',
    '--surface: #FFFFFF',
    '--fg-primary: #171717',
    '--primary: #4338CA',
    '--secondary: #6366F1',
    '--border-subtle: #E5E5E5',
    '.oi-page-title',
    '.oi-section-title',
    '.oi-card-title',
    '.oi-body-sm',
    '.oi-label',
    '.oi-tech-label',
    '.oi-card',
    '.oi-card-elevated',
    '.oi-input',
    '.oi-btn-primary',
    '.oi-btn-secondary',
    'prefers-reduced-motion',
  ]) {
    assert.ok(css.includes(token), `Missing token or primitive "${token}" in src/index.css`);
  }
});

test('index.html loads optimized typography without unused font families or bold weights', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  assert.ok(html.includes('Inter:wght@400;500;600'));
  assert.ok(html.includes('Playfair+Display:wght@500;600'));
  assert.ok(html.includes('JetBrains+Mono:wght@400;500;600'));
  assert.ok(html.includes('display=swap'));
  assert.equal(html.includes('DM+Sans'), false);
  assert.equal(html.includes('Plus+Jakarta+Sans'), false);
});

test('ApplicationLayout includes global BioSort footer and App.tsx lazy-loads secondary feature routes', () => {
  const layout = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'common', 'ApplicationLayout.tsx'),
    'utf-8'
  );
  const footer = fs.readFileSync(
    path.join(ROOT, 'src', 'components', 'common', 'GlobalFooter.tsx'),
    'utf-8'
  );
  const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf-8');

  assert.ok(layout.includes('GlobalFooter'), 'ApplicationLayout should render GlobalFooter');
  assert.ok(footer.includes('<footer'), 'GlobalFooter should include a semantic <footer>');
  assert.ok(footer.includes('platformName'), 'GlobalFooter should include BioSort platform identity');
  assert.ok(layout.includes('SidebarNavigation'), 'ApplicationLayout should render SidebarNavigation');
  assert.ok(app.includes('lazy('), 'App.tsx should lazy-load heavy operational routes');
  assert.ok(app.includes('<Suspense'), 'App.tsx should wrap lazy routes in Suspense');
});
