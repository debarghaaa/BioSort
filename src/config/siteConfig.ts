export interface SiteLegalContactConfig {
  platformName: string;
  platformDescriptor: string;
  lastUpdated: string;
  legalDraftStatus: string;
  retentionPolicyDays: number;
  maxUploadBytes: number;
  legalEntityName: string | null;
  governingJurisdiction: string | null;
  contactEmail: string | null;
  privacyEmail: string | null;
  legalEmail: string | null;
  grievanceOfficerName: string | null;
  grievanceOfficerEmail: string | null;
  contactEndpointUrl: string | null;
}

export interface BrowserStorageInventoryItem {
  key: string;
  mechanism: 'localStorage' | 'httpRequest';
  category: 'strictly_necessary' | 'preference_acknowledgement' | 'external_asset';
  purpose: string;
  retention: string;
  conditionalOn: string;
}

export interface ContactSubmissionPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSubmissionResult {
  delivered: boolean;
  referenceId: string | null;
  message: string;
}

function readRuntimeEnv(): Record<string, string | undefined> | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (viteEnv && Object.keys(viteEnv).length > 0) {
    return viteEnv;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return undefined;
}

function readOptionalEnv(name: string): string | null {
  const value = readRuntimeEnv()?.[name]?.trim();
  return value ? value : null;
}

export const SITE_CONFIG: SiteLegalContactConfig = {
  platformName: 'BioSort',
  platformDescriptor:
    'AI-assisted biomedical waste image segmentation and classification platform supporting visual analysis and human review.',
  lastUpdated: '2026-11-18',
  legalDraftStatus:
    'Draft generated from verified codebase behavior — requires review and sign-off by qualified Indian legal counsel prior to production reliance.',
  retentionPolicyDays: 90,
  maxUploadBytes: 10 * 1024 * 1024,
  legalEntityName: readOptionalEnv('VITE_LEGAL_ENTITY_NAME'),
  governingJurisdiction: readOptionalEnv('VITE_GOVERNING_JURISDICTION'),
  contactEmail: readOptionalEnv('VITE_CONTACT_EMAIL'),
  privacyEmail: readOptionalEnv('VITE_PRIVACY_EMAIL'),
  legalEmail: readOptionalEnv('VITE_LEGAL_EMAIL'),
  grievanceOfficerName: readOptionalEnv('VITE_GRIEVANCE_OFFICER_NAME'),
  grievanceOfficerEmail: readOptionalEnv('VITE_GRIEVANCE_OFFICER_EMAIL'),
  contactEndpointUrl: readOptionalEnv('VITE_CONTACT_ENDPOINT_URL'),
};

export const LOCAL_STORAGE_NOTICE_ACK_KEY = 'biosort_storage_notice_ack_v1';

export const BROWSER_STORAGE_INVENTORY: BrowserStorageInventoryItem[] = [
  {
    key: 'sb-<project-ref>-auth-token (Supabase Auth)',
    mechanism: 'localStorage',
    category: 'strictly_necessary',
    purpose:
      'Maintains authenticated user sessions and refreshes access tokens when Supabase Authentication is configured.',
    retention: 'Persists until user sign-out, token revocation, or browser storage clearance.',
    conditionalOn: 'Active only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.',
  },
  {
    key: 'medwaste_foundation_session_v1',
    mechanism: 'localStorage',
    category: 'strictly_necessary',
    purpose:
      'Stores local Foundation role or Guest inspection session mode when previewing workspace workflows.',
    retention: 'Persists until Exit Guest / Sign Out or browser storage clearance.',
    conditionalOn: 'Active only when using Guest Mode or local Foundation Mode.',
  },
  {
    key: 'medwaste_platform_config_v2',
    mechanism: 'localStorage',
    category: 'strictly_necessary',
    purpose:
      'Stores local workspace configuration drafts (taxonomy rules, bin mappings, confidence thresholds, inference endpoint URL, and recent session audit log entries).',
    retention: 'Persists in your browser until reset in Settings, cleared below, or browser data is cleared.',
    conditionalOn: 'Active during authenticated or local workspace operation.',
  },
  {
    key: LOCAL_STORAGE_NOTICE_ACK_KEY,
    mechanism: 'localStorage',
    category: 'preference_acknowledgement',
    purpose:
      'Records whether you dismissed the informational browser storage transparency notice.',
    retention: 'Persists until cleared in Cookie & Storage Policy or browser data clearance.',
    conditionalOn: 'Stored only when you click Acknowledge on the storage notice.',
  },
  {
    key: 'fonts.googleapis.com / fonts.gstatic.com',
    mechanism: 'httpRequest',
    category: 'external_asset',
    purpose:
      'Loads Inter, Playfair Display, and JetBrains Mono stylesheets and font files from Google Fonts (no custom analytics or tracking cookies are set by BioSort).',
    retention: 'Governed by your browser HTTP cache and Google Fonts service headers.',
    conditionalOn: 'Requested automatically on initial page load unless self-hosted fonts are configured.',
  },
];

export function hasAnyVerifiedContactChannel(config: SiteLegalContactConfig = SITE_CONFIG): boolean {
  return Boolean(
    config.contactEmail ||
      config.privacyEmail ||
      config.legalEmail ||
      config.grievanceOfficerEmail ||
      config.contactEndpointUrl
  );
}

export function isContactEndpointConfigured(config: SiteLegalContactConfig = SITE_CONFIG): boolean {
  return Boolean(config.contactEndpointUrl);
}

export async function submitContactInquiry(
  payload: ContactSubmissionPayload,
  endpointUrl: string | null = SITE_CONFIG.contactEndpointUrl,
  fetchImpl: typeof fetch = fetch
): Promise<ContactSubmissionResult> {
  if (!endpointUrl) {
    throw new Error(
      'Direct message delivery is not configured for this deployment. Set VITE_CONTACT_ENDPOINT_URL to enable backend form submission.'
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: payload.name.trim(),
        email: payload.email.trim(),
        subject: payload.subject.trim(),
        message: payload.message.trim(),
        source: 'biosort_contact_form',
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Unable to reach contact delivery endpoint: ${err.message}`
        : 'Unable to reach contact delivery endpoint.'
    );
  }

  if (!response.ok) {
    let detail = `Contact endpoint rejected the submission (HTTP ${response.status}).`;
    try {
      const errorJson = (await response.json()) as { detail?: string; message?: string; error?: string };
      const parsed = errorJson.detail || errorJson.message || errorJson.error;
      if (parsed) detail = parsed;
    } catch {
      // Ignore non-JSON error responses
    }
    throw new Error(detail);
  }

  let referenceId: string | null = null;
  let serverMessage = 'Your inquiry was delivered to the configured contact endpoint.';
  try {
    const data = (await response.json()) as { reference_id?: string; id?: string; message?: string };
    referenceId = data.reference_id || data.id || null;
    if (data.message) serverMessage = data.message;
  } catch {
    // Allow 204/empty success payloads
  }

  return {
    delivered: true,
    referenceId,
    message: serverMessage,
  };
}
