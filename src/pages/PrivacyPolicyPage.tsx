import { Link } from 'react-router-dom';
import { LegalPageLayout, LegalSection, type LegalSectionMeta } from '../components/legal/LegalPageLayout';
import { SITE_CONFIG } from '../config/siteConfig';

const PRIVACY_SECTIONS: LegalSectionMeta[] = [
  { id: 'introduction-scope', title: 'Introduction and Scope' },
  { id: 'operator-details', title: 'Operator and Data Controller Details' },
  { id: 'information-collected', title: 'Information Processed by BioSort' },
  { id: 'purpose-lawful-basis', title: 'Purposes and Lawful Basis for Processing' },
  { id: 'image-file-handling', title: 'Uploaded Waste Image & File Handling' },
  { id: 'ai-processing', title: 'AI Classification and Training Separation' },
  { id: 'retention-deletion', title: 'Data Retention and Deletion Practices' },
  { id: 'third-party-services', title: 'Infrastructure and Third-Party Services' },
  { id: 'security-measures', title: 'Technical Security Controls and Known Gaps' },
  { id: 'user-rights', title: 'Data Principal Rights and Requests' },
  { id: 'policy-updates', title: 'Policy Updates and Versioning' },
];

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Privacy & Data Protection"
      title="Privacy Policy"
      summary="How BioSort handles uploaded biomedical waste images, workspace authentication data, browser local storage, inference outputs, and audit records—documented directly from verified system behavior."
      sections={PRIVACY_SECTIONS}
    >
      <LegalSection id="introduction-scope" number="01" title="Introduction and Scope">
        <p>
          This Privacy Policy explains how <strong>{SITE_CONFIG.platformName}</strong> processes data
          when you visit public informational pages or use the authenticated biomedical waste image
          classification, manual review, analytics, and configuration workflows.
        </p>
        <p>
          {SITE_CONFIG.platformName} is assistive visual analysis software intended strictly for
          biomedical waste imagery and segregation workflow records. The platform is{' '}
          <strong className="text-[#171717]">not designed to collect, store, or process patient identifiers or Protected Health Information (PHI)</strong>,
          and operators must ensure uploaded images exclude faces, patient charts, barcode wristbands,
          or clinical identifying labels.
        </p>
      </LegalSection>

      <LegalSection id="operator-details" number="02" title="Operator and Data Controller Details">
        <p>
          Operator and statutory Data Fiduciary details depend on the organization deploying this
          instance:
        </p>
        <div className="oi-tile space-y-1.5 text-xs">
          <p>
            <strong className="text-[#171717]">Legal Entity / Operator:</strong>{' '}
            {SITE_CONFIG.legalEntityName ?? (
              <span className="text-[#737373]">
                [Unconfigured — set VITE_LEGAL_ENTITY_NAME prior to production deployment]
              </span>
            )}
          </p>
          <p>
            <strong className="text-[#171717]">Privacy Contact Channel:</strong>{' '}
            {SITE_CONFIG.privacyEmail ? (
              <a
                href={`mailto:${SITE_CONFIG.privacyEmail}`}
                className="text-[#4338CA] hover:underline"
              >
                {SITE_CONFIG.privacyEmail}
              </a>
            ) : (
              <span className="text-[#737373]">
                [Unconfigured — set VITE_PRIVACY_EMAIL or configure VITE_CONTACT_ENDPOINT_URL]
              </span>
            )}
          </p>
          <p>
            <strong className="text-[#171717]">Grievance / Data Protection Contact:</strong>{' '}
            {SITE_CONFIG.grievanceOfficerName || SITE_CONFIG.grievanceOfficerEmail ? (
              `${SITE_CONFIG.grievanceOfficerName ?? 'Designated Officer'}${
                SITE_CONFIG.grievanceOfficerEmail ? ` (${SITE_CONFIG.grievanceOfficerEmail})` : ''
              }`
            ) : (
              <span className="text-[#737373]">
                [Unconfigured — set VITE_GRIEVANCE_OFFICER_NAME and VITE_GRIEVANCE_OFFICER_EMAIL]
              </span>
            )}
          </p>
        </div>
      </LegalSection>

      <LegalSection id="information-collected" number="03" title="Information Processed by BioSort">
        <p>
          Based on verified codebase behavior, BioSort processes only the following categories of
          information:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-[#171717]">Workspace Account Credentials &amp; Role Metadata:</strong>{' '}
            When Supabase Authentication is configured (<code className="font-mono text-[#171717]">VITE_SUPABASE_URL</code>{' '}
            and <code className="font-mono text-[#171717]">VITE_SUPABASE_ANON_KEY</code>), BioSort
            receives your authentication email, user UUID, display name (if supplied on registration),
            and assigned workspace role (<code className="font-mono text-[#171717]">operator</code>,{' '}
            <code className="font-mono text-[#171717]">reviewer</code>, or{' '}
            <code className="font-mono text-[#171717]">admin</code>). In unconfigured previews,
            local Foundation or Guest sessions store only a local preview identifier and role in
            browser <code className="font-mono text-[#171717]">localStorage</code>.
          </li>
          <li>
            <strong className="text-[#171717]">Uploaded Waste Images &amp; File Metadata:</strong>{' '}
            Images uploaded for classification (JPEG or PNG up to 10 MiB, 64x64 to 8192x8192 pixels),
            along with computed SHA-256 checksum, byte size, pixel dimensions, MIME type, optional
            jurisdiction code, classification predictions, confidence scores, and manual review notes.
          </li>
          <li>
            <strong className="text-[#171717]">Audit &amp; Review Events:</strong>{' '}
            Timestamps, operator/reviewer user IDs, initial predicted labels, corrected labels,
            review status, and immutable database <code className="font-mono text-[#171717]">audit_events</code> records.
          </li>
          <li>
            <strong className="text-[#171717]">Browser Storage Preferences:</strong>{' '}
            Local workspace configuration drafts (<code className="font-mono text-[#171717]">medwaste_platform_config_v2</code>),
            local preview session state (<code className="font-mono text-[#171717]">medwaste_foundation_session_v1</code>),
            and storage notice acknowledgement (<code className="font-mono text-[#171717]">biosort_storage_notice_ack_v1</code>).
            BioSort loads no third-party analytics, advertising, or behavioral tracking scripts.
          </li>
          <li>
            <strong className="text-[#171717]">Infrastructure &amp; Font Delivery Requests:</strong>{' '}
            Standard HTTP request metadata (IP address, user-agent, timestamp) handled by hosting
            infrastructure and Google Fonts stylesheet/font requests when loading typography.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="purpose-lawful-basis" number="04" title="Purposes and Lawful Basis for Processing">
        <p>Data is processed solely for operational and security purposes:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Authenticating workspace users and enforcing role-based access control (RBAC).</li>
          <li>Running server-side ONNX biomedical waste image classification and bin mapping.</li>
          <li>Routing uncertain predictions to authorized reviewers for human verification.</li>
          <li>Maintaining immutable operational audit logs and aggregate classification analytics.</li>
          <li>Enforcing API rate limits and validating uploads against malformed or oversized payloads.</li>
        </ul>
        <p>
          Where applicable under India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act)
          and Information Technology Act, 2000 (including phased obligations under the DPDP Rules,
          2025 scheduled through May 2027), deployment operators must establish explicit user notice,
          consent, or legitimate operational/employment basis with qualified legal counsel.
        </p>
      </LegalSection>

      <LegalSection id="image-file-handling" number="05" title="Uploaded Waste Image & File Handling">
        <p>
          Every uploaded file is validated client-side and re-verified server-side for MIME type,
          image signature, decompression-bomb protection, pixel bounds, and a strict 10 MiB limit.
        </p>
        <div className="oi-tile space-y-2 text-xs">
          <p className="oi-subpanel-title">Important Technical Disclosures on Stored Images</p>
          <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-[#171717]">EXIF &amp; Embedded Metadata:</strong> During
              inference, images are converted into normalized RGB tensors in memory; however, the
              evidence storage service currently persists the{' '}
              <strong className="text-[#171717]">original uploaded bytes</strong> without stripping
              embedded EXIF metadata (such as camera model or GPS tags if present in your file).
              Strip EXIF metadata prior to upload if source devices embed location data.
            </li>
            <li>
              <strong className="text-[#171717]">Access Control:</strong> Evidence files reside in
              the private Supabase Storage bucket (<code className="font-mono text-[#171717]">waste-evidence</code>)
              with public access disabled. Access uses short-lived signed URLs (120–180 seconds)
              scoped by Row-Level Security (RLS) to the owning uploader, reviewers, and administrators.
            </li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection id="ai-processing" number="06" title="AI Classification and Training Separation">
        <p>
          Images submitted to <code className="font-mono text-[#171717]">POST /api/v1/classifications</code>{' '}
          are evaluated by a pre-loaded ONNX Runtime classifier. Uploaded images are{' '}
          <strong className="text-[#171717]">not automatically fed into live model retraining</strong>.
        </p>
        <p>
          Only records explicitly reviewed and flagged <code className="font-mono text-[#171717]">approved_for_dataset_export = true</code>{' '}
          by an authorized <code className="font-mono text-[#171717]">reviewer</code> or{' '}
          <code className="font-mono text-[#171717]">admin</code> are included in offline dataset feedback
          exports (<code className="font-mono text-[#171717]">GET /api/v1/reviews/export/dataset-feedback</code>).
        </p>
      </LegalSection>

      <LegalSection id="retention-deletion" number="07" title="Data Retention and Deletion Practices">
        <p>
          The following retention behaviors are verified directly in the database schema and backend code:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-[#171717]">90-Day Evidence Policy Threshold:</strong> The
            database <code className="font-mono text-[#171717]">retention_policies</code> table
            defines a default threshold of <code className="font-mono text-[#171717]">{SITE_CONFIG.retentionPolicyDays} days</code>{' '}
            for <code className="font-mono text-[#171717]">waste_evidence_images</code> along with
            the SQL query helper <code className="font-mono text-[#171717]">list_expired_evidence_paths()</code>.
          </li>
          <li>
            <strong className="text-[#171717]">Automated Purge Gap Disclosed:</strong> An automated
            background cron/worker job executing expired object deletion is{' '}
            <strong className="text-[#171717]">not yet implemented in the repository</strong>;
            operators must schedule or run storage purging externally until automated workers are added.
          </li>
          <li>
            <strong className="text-[#171717]">Immutable Audit Trail:</strong> Database triggers
            (<code className="font-mono text-[#171717]">trg_audit_events_immutable</code>) prevent{' '}
            <code className="font-mono text-[#171717]">UPDATE</code> or{' '}
            <code className="font-mono text-[#171717]">DELETE</code> operations on{' '}
            <code className="font-mono text-[#171717]">audit_events</code> to preserve traceability.
          </li>
          <li>
            <strong className="text-[#171717]">Self-Service Deletion Gap Disclosed:</strong> No
            self-service in-app account or evidence record deletion API/button exists yet. Users
            seeking erasure must contact the deployment operator via the{' '}
            <Link to="/contact" className="text-[#4338CA] hover:underline">
              Contact page
            </Link>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="third-party-services" number="08" title="Infrastructure and Third-Party Services">
        <p>Depending on environment configuration, BioSort interacts only with:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-[#171717]">Supabase (Authentication, Postgres &amp; Private Storage):</strong>{' '}
            Used only when configured with operator credentials.
          </li>
          <li>
            <strong className="text-[#171717]">Configured Inference API Backend:</strong> Receives
            multipart image uploads and returns classification results over HTTPS/HTTP as deployed.
          </li>
          <li>
            <strong className="text-[#171717]">Google Fonts:</strong> Serves <code className="font-mono text-[#171717]">Inter</code>,{' '}
            <code className="font-mono text-[#171717]">Playfair Display</code>, and{' '}
            <code className="font-mono text-[#171717]">JetBrains Mono</code> font assets.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="security-measures" number="09" title="Technical Security Controls and Known Gaps">
        <p>
          Implemented controls include Row-Level Security across Supabase tables, backend-only{' '}
          <code className="font-mono text-[#171717]">service_role</code> isolation, short-lived signed
          evidence URLs, strict MIME/byte/dimension image checks, and FastAPI rate limiting.
        </p>
        <p>
          <strong className="text-[#171717]">Transparent Limitations:</strong> Application-level HTTP
          response security headers (such as <code className="font-mono text-[#171717]">Content-Security-Policy</code>{' '}
          and <code className="font-mono text-[#171717]">Strict-Transport-Security</code>) must be
          enforced at the reverse proxy or hosting layer, as they are not added inside the FastAPI or
          Vite application code. Browser <code className="font-mono text-[#171717]">localStorage</code>{' '}
          values remain readable by same-origin scripts and unencrypted on disk.
        </p>
      </LegalSection>

      <LegalSection id="user-rights" number="10" title="Data Principal Rights and Requests">
        <p>
          Subject to applicable law (including phased provisions under India&apos;s DPDP Act, 2023 and
          DPDP Rules, 2025, or organizational governance policies), authorized users may request
          information about personal data associated with their account, request correction of
          inaccurate profile records, or request deletion where retention is not legally mandated
          (noting that immutable audit logs cannot be selectively altered).
        </p>
        <p>
          To submit a privacy or grievance inquiry, visit the{' '}
          <Link to="/contact" className="text-[#4338CA] hover:underline">
            Contact page
          </Link>
          {SITE_CONFIG.privacyEmail ? (
            <>
              {' '}or email{' '}
              <a
                href={`mailto:${SITE_CONFIG.privacyEmail}`}
                className="text-[#4338CA] hover:underline"
              >
                {SITE_CONFIG.privacyEmail}
              </a>
            </>
          ) : (
            ' (once an operator contact address or endpoint is configured).'
          )}
        </p>
      </LegalSection>

      <LegalSection id="policy-updates" number="11" title="Policy Updates and Versioning">
        <p>
          This policy reflects codebase state as of <span className="font-mono">{SITE_CONFIG.lastUpdated}</span>.
          Material changes to storage, retention, third-party processors, or authentication providers
          must be documented here with an updated revision date.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
