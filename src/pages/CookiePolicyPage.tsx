import { Link } from 'react-router-dom';
import { StoragePreferencesPanel } from '../components/common/CookieConsent';
import { LegalPageLayout, LegalSection, type LegalSectionMeta } from '../components/legal/LegalPageLayout';
import { BROWSER_STORAGE_INVENTORY, SITE_CONFIG } from '../config/siteConfig';

const COOKIE_SECTIONS: LegalSectionMeta[] = [
  { id: 'overview', title: 'What Cookies and Browser Storage Are' },
  { id: 'actual-technologies', title: 'Technologies Actually Used by BioSort' },
  { id: 'strictly-necessary', title: 'Strictly Necessary Storage' },
  { id: 'functional-preferences', title: 'Functional Workspace Preferences' },
  { id: 'analytics-performance', title: 'Analytics & Performance Cookies (None)' },
  { id: 'marketing-advertising', title: 'Marketing & Advertising Cookies (None)' },
  { id: 'third-party-requests', title: 'Third-Party Requests (Google Fonts & Supabase)' },
  { id: 'storage-inventory', title: 'Storage Key Inventory & Duration' },
  { id: 'storage-controls', title: 'Manage Local Storage Preferences' },
  { id: 'browser-controls', title: 'Browser-Level Controls' },
  { id: 'contact-updates', title: 'Contact and Policy Updates' },
];

export function CookiePolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Cookies & Client Storage"
      title="Cookie Policy"
      summary="An accurate technical disclosure of cookies and browser localStorage used by BioSort. BioSort sets zero analytics or advertising cookies and relies strictly on essential client storage."
      sections={COOKIE_SECTIONS}
    >
      <LegalSection id="overview" number="01" title="What Cookies and Browser Storage Are">
        <p>
          HTTP cookies are small text files sent or read by web servers or scripts via{' '}
          <code className="font-mono text-[#171717]">document.cookie</code>. Modern web applications
          also use Web Storage APIs such as browser{' '}
          <code className="font-mono text-[#171717]">localStorage</code> to maintain authentication
          sessions and user interface state across page reloads without transmitting those keys on
          every HTTP request.
        </p>
      </LegalSection>

      <LegalSection id="actual-technologies" number="02" title="Technologies Actually Used by BioSort">
        <p>
          A direct audit of the {SITE_CONFIG.platformName} source code confirms that the application{' '}
          <strong className="text-[#171717]">does not set any custom HTTP tracking, analytics, or advertising cookies</strong>.
          Instead, BioSort relies solely on browser <code className="font-mono text-[#171717]">localStorage</code>{' '}
          for essential session persistence and local workspace settings, plus standard HTTP asset
          requests for typography stylesheets.
        </p>
      </LegalSection>

      <LegalSection id="strictly-necessary" number="03" title="Strictly Necessary Storage">
        <p>
          The following storage keys are strictly necessary for authentication and role-scoped access:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <code className="font-mono text-[#171717]">sb-&lt;project-ref&gt;-auth-token</code>:
            Managed by <code className="font-mono text-[#171717]">@supabase/supabase-js</code> when
            Supabase Authentication is enabled (<code className="font-mono text-[#171717]">persistSession: true</code>).
          </li>
          <li>
            <code className="font-mono text-[#171717]">medwaste_foundation_session_v1</code>:
            Stores the active Foundation role or Guest preview session when operating without
            configured Supabase Auth credentials.
          </li>
          <li>
            <code className="font-mono text-[#171717]">{`biosort_storage_notice_ack_v1`}</code>:
            Stores whether you dismissed the informational browser storage transparency notice.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="functional-preferences" number="04" title="Functional Workspace Preferences">
        <p>
          BioSort stores non-credential workspace configuration in{' '}
          <code className="font-mono text-[#171717]">medwaste_platform_config_v2</code>. This includes
          your draft inference API URL, waste taxonomy class labels, bin mapping rules, confidence
          threshold policy settings, manual notes, and in-session recent classification logs for local
          continuity.
        </p>
      </LegalSection>

      <LegalSection id="analytics-performance" number="05" title="Analytics & Performance Cookies (None)">
        <p>
          BioSort loads <strong className="text-[#171717]">zero</strong> third-party analytics or telemetry
          cookies (no Google Analytics, PostHog, Mixpanel, Segment, Hotjar, or Sentry tracking scripts
          are embedded in the application).
        </p>
      </LegalSection>

      <LegalSection id="marketing-advertising" number="06" title="Marketing & Advertising Cookies (None)">
        <p>
          BioSort does not use advertising networks, retargeting pixels, cross-site tracking identifiers,
          or behavioral profiling cookies.
        </p>
      </LegalSection>

      <LegalSection id="third-party-requests" number="07" title="Third-Party Requests (Google Fonts & Supabase)">
        <p>
          On page load, <code className="font-mono text-[#171717]">index.html</code> requests typography
          stylesheets and font files from{' '}
          <code className="font-mono text-[#171717]">fonts.googleapis.com</code> and{' '}
          <code className="font-mono text-[#171717]">fonts.gstatic.com</code> to render{' '}
          <code className="font-mono text-[#171717]">Playfair Display</code>,{' '}
          <code className="font-mono text-[#171717]">Inter</code>, and{' '}
          <code className="font-mono text-[#171717]">JetBrains Mono</code>. When configured by the
          operator, authentication and evidence storage requests communicate directly with the
          configured Supabase project endpoint.
        </p>
      </LegalSection>

      <LegalSection id="storage-inventory" number="08" title="Storage Key Inventory & Duration">
        <div className="overflow-x-auto rounded-xl border border-[#E5E5E5] bg-[#FFFFFF]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FCFBF9] text-[#171717]">
                <th className="py-2.5 px-3 font-semibold">Key / Origin</th>
                <th className="py-2.5 px-3 font-semibold">Mechanism</th>
                <th className="py-2.5 px-3 font-semibold">Purpose</th>
                <th className="py-2.5 px-3 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {BROWSER_STORAGE_INVENTORY.map((item) => (
                <tr key={item.key} className="align-top">
                  <td className="py-3 px-3 font-mono text-[11px] text-[#171717] break-all">
                    {item.key}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#525252] whitespace-nowrap">
                    {item.mechanism}
                  </td>
                  <td className="py-3 px-3 text-[#525252] leading-relaxed">
                    {item.purpose}
                    <span className="block text-[11px] text-[#737373] mt-1">
                      {item.conditionalOn}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#525252] leading-relaxed">{item.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="storage-controls" number="09" title="Manage Local Storage Preferences">
        <StoragePreferencesPanel />
      </LegalSection>

      <LegalSection id="browser-controls" number="10" title="Browser-Level Controls">
        <p>
          You can clear <code className="font-mono text-[#171717]">localStorage</code> or block
          third-party font requests using standard site-data settings in Chrome, Firefox, Edge, or
          Safari. Clearing essential authentication storage will sign you out of active workspace
          sessions.
        </p>
      </LegalSection>

      <LegalSection id="contact-updates" number="11" title="Contact and Policy Updates">
        <p>
          If optional analytics or additional cookies are introduced in future versions, this policy
          and the consent mechanism will be updated prior to activation. Questions can be submitted
          via the{' '}
          <Link to="/contact" className="text-[#4338CA] hover:underline">
            Contact page
          </Link>{' '}
          or reviewed alongside our{' '}
          <Link to="/privacy-policy" className="text-[#4338CA] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
