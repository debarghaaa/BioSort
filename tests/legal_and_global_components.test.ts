import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { StoragePreferencesPanel } from '../src/components/common/CookieConsent';
import { GlobalFooter } from '../src/components/common/GlobalFooter';
import { GlobalHeader } from '../src/components/common/GlobalHeader';
import { ContactForm, validateContactForm } from '../src/components/contact/ContactForm';
import { ContactSection } from '../src/components/contact/ContactSection';
import {
  BROWSER_STORAGE_INVENTORY,
  SITE_CONFIG,
  hasAnyVerifiedContactChannel,
  isContactEndpointConfigured,
  submitContactInquiry,
} from '../src/config/siteConfig';
import { AuthProvider } from '../src/hooks/useAuth';
import { ContactPage } from '../src/pages/ContactPage';
import { CookiePolicyPage } from '../src/pages/CookiePolicyPage';
import { LandingPage } from '../src/pages/LandingPage';
import { PrivacyPolicyPage } from '../src/pages/PrivacyPolicyPage';
import { TermsPage } from '../src/pages/TermsPage';

const ROOT = path.resolve(import.meta.dirname, '..');

function withProviders(element: React.ReactElement, initialEntries: string[] = ['/']) {
  return React.createElement(
    MemoryRouter,
    { initialEntries },
    React.createElement(AuthProvider, null, element)
  );
}

test('App.tsx mounts public legal and contact routes cleanly via PublicLayout and CookieConsent', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf-8');
  for (const route of [
    '/privacy-policy',
    '/cookie-policy',
    '/terms-and-conditions',
    '/contact',
    'PublicLayout',
    'CookieConsent',
    'PrivacyPolicyPage',
    'CookiePolicyPage',
    'TermsPage',
    'ContactPage',
  ]) {
    assert.ok(app.includes(route), `Missing "${route}" in App.tsx`);
  }
});

test('GlobalHeader renders single semantic header without workspace links when unauthenticated', () => {
  const landingHeader = renderToStaticMarkup(
    withProviders(React.createElement(GlobalHeader, { variant: 'landing' }), ['/'])
  );
  assert.equal((landingHeader.match(/<header\b/g) || []).length, 1);
  assert.ok(landingHeader.includes('BioSort'));
  assert.ok(landingHeader.includes('/contact'));
  assert.ok(landingHeader.includes('/login'));
  assert.equal(landingHeader.includes('/review'), false);
  assert.equal(landingHeader.includes('/settings'), false);

  const publicHeader = renderToStaticMarkup(
    withProviders(React.createElement(GlobalHeader, { variant: 'public' }), ['/privacy-policy'])
  );
  assert.equal((publicHeader.match(/<header\b/g) || []).length, 1);
  assert.ok(publicHeader.includes('aria-current="page"'));
  assert.ok(publicHeader.includes('/privacy-policy'));
  assert.ok(publicHeader.includes('/terms-and-conditions'));
});

test('GlobalFooter and LandingPage render a single semantic footer with legal/contact routes and no fabricated legal entity', () => {
  const footerHtml = renderToStaticMarkup(
    withProviders(React.createElement(GlobalFooter, { variant: 'public' }), ['/contact'])
  );
  assert.equal((footerHtml.match(/<footer\b/g) || []).length, 1);
  for (const href of [
    '/privacy-policy',
    '/cookie-policy',
    '/terms-and-conditions',
    '/contact',
  ]) {
    assert.ok(footerHtml.includes(href), `GlobalFooter missing link "${href}"`);
  }
  assert.equal(footerHtml.includes('Inc.'), false);
  assert.equal(footerHtml.includes('support@biosort'), false);

  const landingHtml = renderToStaticMarkup(
    withProviders(React.createElement(LandingPage), ['/'])
  );
  assert.equal((landingHtml.match(/<header\b/g) || []).length, 1, 'LandingPage must have exactly 1 header');
  assert.equal((landingHtml.match(/<footer\b/g) || []).length, 1, 'LandingPage must have exactly 1 footer');
});

test('Legal pages render required disclosures faithfully with zero fabricated entity data or clinical claims', () => {
  const privacyHtml = renderToStaticMarkup(
    withProviders(React.createElement(PrivacyPolicyPage), ['/privacy-policy'])
  );
  const cookieHtml = renderToStaticMarkup(
    withProviders(React.createElement(CookiePolicyPage), ['/cookie-policy'])
  );
  const termsHtml = renderToStaticMarkup(
    withProviders(React.createElement(TermsPage), ['/terms-and-conditions'])
  );
  const contactHtml = renderToStaticMarkup(
    withProviders(React.createElement(ContactPage), ['/contact'])
  );

  // Privacy checks
  assert.ok(privacyHtml.includes('Privacy Policy'));
  assert.ok(privacyHtml.includes('EXIF'));
  assert.ok(privacyHtml.includes('waste-evidence'));
  assert.ok(privacyHtml.includes('90 days'));
  assert.ok(privacyHtml.includes('not yet implemented in the repository'));
  assert.ok(privacyHtml.includes('approved_for_dataset_export'));

  // Cookie checks
  assert.ok(cookieHtml.includes('Cookie Policy'));
  assert.ok(cookieHtml.includes('does not set any custom HTTP tracking, analytics, or advertising cookies'));
  assert.ok(cookieHtml.includes('medwaste_foundation_session_v1'));
  assert.ok(cookieHtml.includes('medwaste_platform_config_v2'));
  assert.ok(cookieHtml.includes('fonts.googleapis.com'));

  // Terms checks
  assert.ok(termsHtml.includes('Terms and Conditions'));
  assert.ok(termsHtml.includes('Bio-Medical Waste Management Rules, 2016'));
  assert.ok(termsHtml.includes('no physical hardware integration'));
  assert.ok(termsHtml.includes('Mandatory human inspection and verification'));

  // Contact page checks (truthful unconfigured fallback by default)
  assert.ok(contactHtml.includes('Contact BioSort'));
  assert.ok(contactHtml.includes('VITE_CONTACT_ENDPOINT_URL'));

  // Zero fake contact details or guarantees across all pages
  const combined = `${privacyHtml}\n${cookieHtml}\n${termsHtml}\n${contactHtml}`.toLowerCase();
  for (const banned of ['support@biosort', 'privacy@biosort', '+1-555', 'biosort inc', '100% accurate', 'guaranteed compliance']) {
    assert.equal(combined.includes(banned), false, `Disallowed fabricated claim "${banned}" found`);
  }
});

test('Storage inventory and preference controls reflect strictly essential browser storage only', () => {
  assert.ok(BROWSER_STORAGE_INVENTORY.length >= 4);
  const panelHtml = renderToStaticMarkup(
    withProviders(React.createElement(StoragePreferencesPanel), ['/cookie-policy'])
  );
  assert.ok(panelHtml.includes('Zero Tracking Cookies'));
  assert.ok(panelHtml.includes('None Implemented'));
  assert.ok(panelHtml.includes('Clear Local Config Drafts'));
});

test('ContactForm validates required fields, rejects unconfigured endpoints honestly, and sends real JSON requests when configured', async () => {
  const emptyErrors = validateContactForm({
    name: 'A',
    email: 'not-an-email',
    subject: 'Hi',
    message: 'Too short',
    honeypot: '',
  });
  assert.ok(emptyErrors.name);
  assert.ok(emptyErrors.email);
  assert.ok(emptyErrors.subject);
  assert.ok(emptyErrors.message);

  const validErrors = validateContactForm({
    name: 'Dr. Ananya Rao',
    email: 'ananya@hospital.example.org',
    subject: 'Deployment Integration',
    message: 'Requesting setup guidance for private ONNX inference backend.',
    honeypot: '',
  });
  assert.deepEqual(validErrors, {});

  assert.equal(hasAnyVerifiedContactChannel({ ...SITE_CONFIG, contactEmail: null, privacyEmail: null, legalEmail: null, grievanceOfficerEmail: null, contactEndpointUrl: null }), false);
  assert.equal(isContactEndpointConfigured({ ...SITE_CONFIG, contactEndpointUrl: null }), false);

  await assert.rejects(
    () =>
      submitContactInquiry(
        {
          name: 'Test User',
          email: 'user@example.org',
          subject: 'Hello',
          message: 'Valid message body of sufficient length.',
        },
        null
      ),
    /VITE_CONTACT_ENDPOINT_URL/
  );

  // Mocked successful POST submission
  const successResult = await submitContactInquiry(
    {
      name: 'Test User',
      email: 'user@example.org',
      subject: 'Hello',
      message: 'Valid message body of sufficient length.',
    },
    'https://api.example.org/contact',
    async () =>
      new Response(JSON.stringify({ reference_id: 'INQ-42', message: 'Received' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
  );
  assert.equal(successResult.delivered, true);
  assert.equal(successResult.referenceId, 'INQ-42');
  assert.equal(successResult.message, 'Received');

  // Mocked endpoint rejection
  await assert.rejects(
    () =>
      submitContactInquiry(
        {
          name: 'Test User',
          email: 'user@example.org',
          subject: 'Hello',
          message: 'Valid message body of sufficient length.',
        },
        'https://api.example.org/contact',
        async () =>
          new Response(JSON.stringify({ detail: 'Rate limit exceeded' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })
      ),
    /Rate limit exceeded/
  );

  // Unconfigured form renders disabled button & explicit notice
  const unconfiguredFormHtml = renderToStaticMarkup(
    withProviders(React.createElement(ContactForm, { endpointUrl: null }))
  );
  assert.ok(unconfiguredFormHtml.includes('Delivery Unavailable'));
  assert.ok(unconfiguredFormHtml.includes('Backend contact delivery is not configured'));

  const configuredSectionHtml = renderToStaticMarkup(
    withProviders(
      React.createElement(ContactSection, {
        config: {
          ...SITE_CONFIG,
          contactEmail: 'ops@facility.example.org',
          contactEndpointUrl: 'https://api.example.org/contact',
        },
      })
    )
  );
  assert.ok(configuredSectionHtml.includes('ops@facility.example.org'));
  assert.ok(configuredSectionHtml.includes('Endpoint Active'));
});
