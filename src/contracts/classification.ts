/**
 * Canonical TypeScript contracts matching /contracts/classification.schema.json
 * and /supabase/migrations/202611170001_initial_schema.sql.
 */

export enum DecisionStatus {
  ACCEPTED = 'accepted',
  REVIEW_REQUIRED = 'review_required',
  MAPPING_UNCONFIGURED = 'mapping_unconfigured',
  REJECTED = 'rejected',
}

export enum UserRole {
  OPERATOR = 'operator',
  REVIEWER = 'reviewer',
  ADMIN = 'admin',
}

export enum MappingVerificationStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  DEPRECATED = 'deprecated',
}

export enum ReviewResolutionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  OVERRIDDEN = 'overridden',
  REJECTED = 'rejected',
}

export enum ModelArchitecture {
  MOBILENET_V3 = 'mobilenetv3',
  EFFICIENTNET = 'efficientnet',
}

export interface CandidatePrediction {
  class_name: string;
  model_score: number;
  calibrated_confidence: number | null;
}

/**
 * Exact Shared Classification Contract between Frontend, FastAPI, and Supabase.
 */
export interface SharedClassificationResult {
  classification_id: string;
  predicted_class: string | null;
  candidate_predictions: CandidatePrediction[];
  model_version: string;
  decision_status: DecisionStatus;
  recommended_bin: string | null;
  requires_manual_review: boolean;
  review_reason: string | null;
  created_at: string;
}

export interface PreprocessingSpec {
  input_width: number;
  input_height: number;
  channel_order: 'RGB';
  resize_mode: 'center_crop' | 'letterbox' | 'direct_resize';
  normalization_mean: [number, number, number];
  normalization_std: [number, number, number];
  accepted_mime_types: string[];
  max_file_bytes: number;
}

export interface ModelVersionRecord {
  model_version: string;
  architecture: ModelArchitecture;
  onnx_artifact_uri: string;
  calibration_method: string | null;
  preprocessing_spec: PreprocessingSpec;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface WasteTaxonomyClass {
  id: string;
  class_name: string;
  display_label: string;
  parent_category: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface RegulatoryBinMapping {
  id: string;
  jurisdiction_code: string;
  class_name: string;
  target_bin_code: string;
  target_bin_label: string;
  handling_notes: string;
  verification_status: MappingVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  updated_at: string;
}

export interface ConfidencePolicyConfig {
  id: string;
  policy_name: string;
  jurisdiction_code: string;
  accept_threshold: number;
  review_floor_threshold: number;
  require_calibrated_confidence: boolean;
  minimum_margin_over_second: number;
  documented_rationale: string;
  is_active: boolean;
  updated_at: string;
}

export interface ClassificationEventRecord extends SharedClassificationResult {
  image_filename: string | null;
  image_storage_path: string | null;
  image_sha256: string | null;
  image_mime_type: string | null;
  image_width: number | null;
  image_height: number | null;
  preview_object_url?: string | null;
  jurisdiction_code: string | null;
  uploaded_by_role: UserRole;
  manual_review?: ManualReviewRecord | null;
}

export interface ManualReviewRecord {
  id: string;
  classification_id: string;
  resolution_status: ReviewResolutionStatus;
  resolved_class: string | null;
  resolved_bin: string | null;
  reviewer_notes: string;
  reviewer_role: UserRole;
  reviewed_at: string | null;
  created_at: string;
}

export interface ManualBinStatusNote {
  id: string;
  bin_code: string;
  reported_status_note: string;
  recorded_by_role: UserRole;
  recorded_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_role: UserRole;
  action_type: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ImageValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  file_name: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  sha256: string | null;
}

const BANNED_OUTCOME_TERMS = ['safe', 'sterile', 'medically approved'];

export function containsBannedOutcomeTerm(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return BANNED_OUTCOME_TERMS.some((term) => normalized.includes(term));
}

export function isValidSharedClassificationResult(
  payload: unknown
): payload is SharedClassificationResult {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  const validStatuses = new Set<string>(Object.values(DecisionStatus));

  if (typeof candidate.classification_id !== 'string') return false;
  if (candidate.predicted_class !== null && typeof candidate.predicted_class !== 'string') {
    return false;
  }
  if (!Array.isArray(candidate.candidate_predictions)) return false;
  if (typeof candidate.model_version !== 'string') return false;
  if (typeof candidate.decision_status !== 'string' || !validStatuses.has(candidate.decision_status)) {
    return false;
  }
  if (candidate.recommended_bin !== null && typeof candidate.recommended_bin !== 'string') {
    return false;
  }
  if (typeof candidate.requires_manual_review !== 'boolean') return false;
  if (candidate.review_reason !== null && typeof candidate.review_reason !== 'string') {
    return false;
  }
  if (typeof candidate.created_at !== 'string') return false;

  if (
    containsBannedOutcomeTerm(candidate.predicted_class) ||
    containsBannedOutcomeTerm(candidate.recommended_bin)
  ) {
    return false;
  }

  return true;
}
