import {
  DecisionStatus,
  isValidSharedClassificationResult,
  type AnalyticsSummaryData,
  type ClassificationRecordItem,
  type LoadedModelMetadata,
  type PaginatedClassificationsResponse,
  type ReadinessProbeResult,
  type RegulatoryBinMapping,
  type ReviewQueueItem,
  type SharedClassificationResult,
} from '../../types/platform';

const runtimeEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
const envBaseUrl = (
  runtimeEnv?.VITE_API_BASE_URL ||
  runtimeEnv?.VITE_INFERENCE_API_URL ||
  ''
).trim();

export const DEFAULT_API_BASE_URL = envBaseUrl.replace(/\/+$/, '');

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function normalizeBaseUrl(overrideBaseUrl?: string): string {
  return (overrideBaseUrl ?? DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');
}

function buildAuthHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function parseErrorDetail(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return String((detail as { message: unknown }).message);
    }
    return String(detail);
  }
  return `Backend request failed with HTTP ${response.status}.`;
}

export async function probeBackendHealthAndReadiness(
  overrideBaseUrl?: string
): Promise<ReadinessProbeResult> {
  const baseUrl = normalizeBaseUrl(overrideBaseUrl);
  if (!baseUrl) {
    return {
      reachable: false,
      liveness: 'unconfigured',
      readiness: 'unconfigured',
      model_loaded: false,
      model_version: null,
      jwt_configured: false,
      supabase_connected: false,
      errors: [
        'API_BASE_URL is not configured. Deploy /services/inference-api and set VITE_API_BASE_URL.',
      ],
    };
  }

  try {
    const healthResp = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!healthResp.ok) {
      return {
        reachable: false,
        liveness: 'unreachable',
        readiness: 'unreachable',
        model_loaded: false,
        model_version: null,
        jwt_configured: false,
        supabase_connected: false,
        errors: [`Liveness endpoint /health returned HTTP ${healthResp.status}.`],
      };
    }

    const readyResp = await fetch(`${baseUrl}/ready`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const readyBody = (await readyResp.json().catch(() => ({}))) as {
      status?: string;
      model_loaded?: boolean;
      model_version?: string | null;
      jwt_configured?: boolean;
      supabase_connected?: boolean;
      errors?: string[];
    };

    const isReady = readyResp.ok && readyBody.status === 'ready';
    return {
      reachable: true,
      liveness: 'alive',
      readiness: isReady ? 'ready' : 'not_ready',
      model_loaded: Boolean(readyBody.model_loaded),
      model_version: readyBody.model_version ?? null,
      jwt_configured: Boolean(readyBody.jwt_configured),
      supabase_connected: Boolean(readyBody.supabase_connected),
      errors: Array.isArray(readyBody.errors) ? readyBody.errors : [],
    };
  } catch (err) {
    return {
      reachable: false,
      liveness: 'unreachable',
      readiness: 'unreachable',
      model_loaded: false,
      model_version: null,
      jwt_configured: false,
      supabase_connected: false,
      errors: [
        err instanceof Error
          ? `Network error contacting FastAPI backend: ${err.message}`
          : 'Network error contacting FastAPI backend.',
      ],
    };
  }
}

export async function classifyWasteImage(params: {
  file: File;
  jurisdictionCode?: string;
  accessToken?: string | null;
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<SharedClassificationResult> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError(
      'FastAPI backend URL is not configured. Configure API_BASE_URL in Settings or environment variables.',
      0
    );
  }

  const formData = new FormData();
  formData.append('file', params.file);
  if (params.jurisdictionCode?.trim()) {
    formData.append('jurisdiction_code', params.jurisdictionCode.trim());
  }

  const headers: Record<string, string> = {};
  if (params.accessToken) {
    headers.Authorization = `Bearer ${params.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/classifications`, {
      method: 'POST',
      headers,
      body: formData,
      signal: params.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiRequestError(
      err instanceof Error
        ? `Network failure reaching FastAPI inference service: ${err.message}`
        : 'Network failure reaching FastAPI inference service.',
      0
    );
  }

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }

  const payload = await response.json().catch(() => null);
  if (!isValidSharedClassificationResult(payload)) {
    throw new ApiRequestError(
      'Backend response failed SharedClassificationResult contract validation.',
      502
    );
  }

  return payload;
}

export async function fetchClassificationHistory(params: {
  baseUrl?: string;
  accessToken?: string | null;
  decisionStatus?: DecisionStatus | '';
  requiresManualReview?: boolean | null;
  category?: string;
  modelVersion?: string;
  reviewStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedClassificationsResponse> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const query = new URLSearchParams();
  if (params.decisionStatus) query.set('decision_status', params.decisionStatus);
  if (params.requiresManualReview !== null && params.requiresManualReview !== undefined) {
    query.set('requires_manual_review', String(params.requiresManualReview));
  }
  if (params.category?.trim()) query.set('category', params.category.trim());
  if (params.modelVersion?.trim()) query.set('model_version', params.modelVersion.trim());
  if (params.reviewStatus?.trim()) query.set('review_status', params.reviewStatus.trim());
  if (params.dateFrom) query.set('date_from', params.dateFrom);
  if (params.dateTo) query.set('date_to', params.dateTo);
  query.set('limit', String(params.limit ?? 20));
  query.set('offset', String(params.offset ?? 0));

  const response = await fetch(`${baseUrl}/api/v1/classifications?${query.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }

  return (await response.json()) as PaginatedClassificationsResponse;
}

export async function fetchClassificationDetail(params: {
  classificationId: string;
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<ClassificationRecordItem> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(
    `${baseUrl}/api/v1/classifications/${encodeURIComponent(params.classificationId)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(params.accessToken),
    }
  );
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as ClassificationRecordItem;
}

export async function fetchCurrentModelMetadata(params: {
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<LoadedModelMetadata> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(`${baseUrl}/api/v1/models/current`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as LoadedModelMetadata;
}

export async function fetchBinMappingsFromApi(params: {
  baseUrl?: string;
  accessToken?: string | null;
  jurisdictionCode?: string;
}): Promise<RegulatoryBinMapping[]> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const query = new URLSearchParams();
  if (params.jurisdictionCode) query.set('jurisdiction_code', params.jurisdictionCode);
  const qs = query.toString() ? `?${query.toString()}` : '';

  const response = await fetch(`${baseUrl}/api/v1/bin-mappings${qs}`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  const body = (await response.json()) as { items?: RegulatoryBinMapping[] };
  return Array.isArray(body.items) ? body.items : [];
}

export async function fetchReviewsFromApi(params: {
  baseUrl?: string;
  accessToken?: string | null;
  status?: import('../../types/platform').ReviewQueueStatus | '';
  predictedCategory?: string;
  modelVersion?: string;
  reviewReason?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: import('../../types/platform').ReviewSortOption;
}): Promise<ReviewQueueItem[]> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.predictedCategory?.trim()) {
    query.set('predicted_category', params.predictedCategory.trim());
  }
  if (params.modelVersion?.trim()) query.set('model_version', params.modelVersion.trim());
  if (params.reviewReason?.trim()) query.set('review_reason', params.reviewReason.trim());
  if (params.dateFrom) query.set('date_from', params.dateFrom);
  if (params.dateTo) query.set('date_to', params.dateTo);
  if (params.sort) query.set('sort', params.sort);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${baseUrl}/api/v1/reviews${qs}`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  const body = (await response.json()) as { items?: ReviewQueueItem[] };
  return Array.isArray(body.items) ? body.items : [];
}

export async function fetchReviewDetailFromApi(params: {
  classificationId: string;
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<ReviewQueueItem> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(
    `${baseUrl}/api/v1/reviews/${encodeURIComponent(params.classificationId)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(params.accessToken),
    }
  );
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as ReviewQueueItem;
}

export async function claimReviewInApi(params: {
  classificationId: string;
  expectedVersion?: number;
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<ReviewQueueItem> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(
    `${baseUrl}/api/v1/reviews/${encodeURIComponent(params.classificationId)}/claim`,
    {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(params.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expected_version: params.expectedVersion ?? null,
      }),
    }
  );
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as ReviewQueueItem;
}

export async function submitReviewDecisionToApi(params: {
  classificationId: string;
  action: import('../../types/platform').ReviewAction;
  resolvedClass: string | null;
  reviewerNotes: string;
  expectedVersion?: number;
  approvedForDatasetExport?: boolean;
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<ReviewQueueItem> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(
    `${baseUrl}/api/v1/reviews/${encodeURIComponent(params.classificationId)}`,
    {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(params.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: params.action,
        resolved_class: params.resolvedClass,
        reviewer_notes: params.reviewerNotes,
        expected_version: params.expectedVersion ?? null,
        approved_for_dataset_export: Boolean(params.approvedForDatasetExport),
      }),
    }
  );
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as ReviewQueueItem;
}

export async function fetchApprovedTaxonomyFromApi(params: {
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<import('../../types/platform').ApprovedTaxonomyOption[]> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(`${baseUrl}/api/v1/reviews/taxonomy`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  const body = (await response.json()) as {
    items?: import('../../types/platform').ApprovedTaxonomyOption[];
  };
  return Array.isArray(body.items) ? body.items : [];
}

export async function exportDatasetFeedbackFromApi(params: {
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<import('../../types/platform').DatasetFeedbackExportResponse> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(`${baseUrl}/api/v1/reviews/export/dataset-feedback`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as import('../../types/platform').DatasetFeedbackExportResponse;
}

export async function fetchAnalyticsSummaryFromApi(params: {
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<AnalyticsSummaryData> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(`${baseUrl}/api/v1/analytics/summary`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as AnalyticsSummaryData;
}

export interface MonitoringFilterParams {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  decisionStatus?: DecisionStatus | '';
  modelVersion?: string;
  reviewStatus?: string;
}

function buildMonitoringQuery(filters: MonitoringFilterParams): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.dateFrom) query.set('date_from', filters.dateFrom);
  if (filters.dateTo) query.set('date_to', filters.dateTo);
  if (filters.category?.trim()) query.set('category', filters.category.trim());
  if (filters.decisionStatus) query.set('decision_status', filters.decisionStatus);
  if (filters.modelVersion?.trim()) query.set('model_version', filters.modelVersion.trim());
  if (filters.reviewStatus?.trim()) query.set('review_status', filters.reviewStatus.trim());
  return query;
}

export async function fetchMonitoringDashboardFromApi(
  params: MonitoringFilterParams & {
    baseUrl?: string;
    accessToken?: string | null;
  }
): Promise<import('../../types/platform').MonitoringDashboardData> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const query = buildMonitoringQuery(params);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${baseUrl}/api/v1/analytics/dashboard${qs}`, {
    method: 'GET',
    headers: buildAuthHeaders(params.accessToken),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as import('../../types/platform').MonitoringDashboardData;
}

export async function updateAlertThresholdsInApi(params: {
  thresholds: import('../../types/platform').OperationalAlertThresholds;
  baseUrl?: string;
  accessToken?: string | null;
}): Promise<import('../../types/platform').OperationalAlertThresholds> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const response = await fetch(`${baseUrl}/api/v1/analytics/alerts/config`, {
    method: 'PUT',
    headers: {
      ...buildAuthHeaders(params.accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.thresholds),
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return (await response.json()) as import('../../types/platform').OperationalAlertThresholds;
}

export async function fetchAnalyticsCsvReportFromApi(
  params: MonitoringFilterParams & {
    reportType: import('../../types/platform').AnalyticsReportType;
    baseUrl?: string;
    accessToken?: string | null;
  }
): Promise<string> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new ApiRequestError('FastAPI backend URL is not configured.', 0);
  }

  const query = buildMonitoringQuery(params);
  query.set('report_type', params.reportType);
  const response = await fetch(`${baseUrl}/api/v1/analytics/export?${query.toString()}`, {
    method: 'GET',
    headers: params.accessToken ? { Authorization: `Bearer ${params.accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorDetail(response), response.status);
  }
  return await response.text();
}

