export {
  containsBannedOutcomeTerm,
  DecisionStatus,
  isValidSharedClassificationResult,
  MappingVerificationStatus,
  ModelArchitecture,
  ReviewResolutionStatus,
  UserRole,
  type AuditLogRecord,
  type CandidatePrediction,
  type ClassificationEventRecord,
  type ConfidencePolicyConfig,
  type ImageValidationReport,
  type ManualBinStatusNote,
  type ManualReviewRecord,
  type ModelVersionRecord,
  type PreprocessingSpec,
  type RegulatoryBinMapping,
  type SharedClassificationResult,
  type WasteTaxonomyClass,
} from '../contracts/classification';

export interface ClassificationRecordItem {
  classification_id: string;
  predicted_class: string | null;
  candidate_predictions: Array<{
    class_name: string;
    model_score: number;
    calibrated_confidence: number | null;
  }>;
  decision_status: import('../contracts/classification').DecisionStatus;
  recommended_bin: string | null;
  requires_manual_review: boolean;
  review_reason: string | null;
  model_version: string;
  preprocessing_version?: string | null;
  review_status?: string | null;
  resolved_class?: string | null;
  created_at: string;
  jurisdiction_code?: string | null;
  image_filename?: string | null;
  image_storage_path?: string | null;
  image_sha256?: string | null;
  image_mime_type?: string | null;
  image_width?: number | null;
  image_height?: number | null;
}

export interface PaginatedClassificationsResponse {
  items: ClassificationRecordItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReadinessProbeResult {
  reachable: boolean;
  liveness: 'alive' | 'unreachable' | 'unconfigured';
  readiness: 'ready' | 'not_ready' | 'unreachable' | 'unconfigured';
  model_loaded: boolean;
  model_version: string | null;
  jwt_configured: boolean;
  supabase_connected: boolean;
  errors: string[];
}

export interface LoadedModelMetadata {
  model_version: string;
  input_name: string;
  input_shape: Array<number | null>;
  output_name: string;
  class_names: string[];
  preprocessing: Record<string, unknown>;
  confidence_calibration: Record<string, unknown>;
}

export interface AnalyticsSummaryData {
  total_events: number;
  by_decision_status: Record<string, number>;
  pending_reviews: number;
  resolved_reviews: number;
  source_note: string;
}

export type ReviewQueueStatus =
  | 'pending'
  | 'in_progress'
  | 'confirmed'
  | 'relabelled'
  | 'unresolved';

export type ReviewAction = 'confirmed' | 'relabelled' | 'unresolved';

export type ReviewSortOption = 'oldest_first' | 'newest_first' | 'lowest_confidence_first';

export interface ReviewAuditEntry {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  event_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export interface ReviewQueueItem {
  id: string;
  classification_id: string;
  queue_status: ReviewQueueStatus;
  version: number;
  predicted_class: string | null;
  candidate_predictions: Array<{
    class_name: string;
    model_score: number;
    calibrated_confidence: number | null;
  }>;
  model_score: number | null;
  calibrated_confidence: number | null;
  original_decision_status: import('../contracts/classification').DecisionStatus | null;
  model_version: string;
  preprocessing_version: string | null;
  review_reason: string;
  image_storage_path: string | null;
  image_signed_url: string | null;
  resolved_class: string | null;
  verified_mapped_bin: string | null;
  reviewer_notes: string;
  reviewer_id: string | null;
  reviewer_display_name: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  approved_for_dataset_export: boolean;
  review_history: ReviewAuditEntry[];
}

export interface ApprovedTaxonomyOption {
  id: string;
  class_code: string;
  display_name: string;
  taxonomy_version: string;
}

export interface DatasetFeedbackExportItem {
  classification_id: string;
  review_id: string;
  original_predicted_class: string | null;
  reviewer_resolved_class: string;
  review_outcome: 'confirmed' | 'relabelled';
  taxonomy_version: string;
  model_version: string;
  preprocessing_version: string | null;
  image_storage_path: string;
  reviewer_id: string | null;
  reviewed_at: string;
  reviewer_notes: string;
}

export interface DatasetFeedbackExportResponse {
  exported_at: string;
  total_approved_records: number;
  training_workflow_notice: string;
  items: DatasetFeedbackExportItem[];
}

export interface ConfiguredCategoryAppearance {
  class_name: string;
  display_label: string;
  color_hex: string | null;
}

export interface DailyVolumePoint {
  date: string;
  total: number;
  accepted: number;
  review_required: number;
  mapping_unconfigured: number;
  rejected: number;
}

export interface CategoryDistributionItem {
  class_code: string;
  display_name: string;
  count: number;
  accepted_count: number;
  percentage: number;
}

export interface DecisionDistributionItem {
  status: import('../contracts/classification').DecisionStatus | string;
  count: number;
  percentage: number;
}

export interface ConfidenceBinItem {
  bin_index: number;
  label: string;
  count: number;
}

export interface ReviewTrendPoint {
  date: string;
  queued: number;
  confirmed: number;
  relabelled: number;
  unresolved: number;
}

export interface ModelComparisonItem {
  model_version: string;
  framework: string;
  deployment_status: string;
  preprocessing_version: string;
  total_classifications: number;
  accepted_count: number;
  review_required_count: number;
  average_model_score: number | null;
  training_eval_metrics: Record<string, unknown>;
}

export interface VirtualBinAssignmentItem {
  bin_code: string;
  virtual_assignment_count: number;
  percentage: number;
  last_assigned_at: string | null;
  physical_sensor_status: 'unavailable';
  physical_fill_level_pct: null;
}

export interface ReviewedComparisonSummary {
  comparison_sample_count: number;
  confirmed_count: number;
  relabelled_count: number;
  agreement_rate_pct: number | null;
}

export interface OperationalAlertThresholds {
  pending_review_backlog_threshold: number;
  classification_failure_threshold: number;
}

export interface OperationalAlertItem {
  event: 'review_backlog' | 'classification_failure' | 'mapping_incomplete' | 'model_unavailable';
  severity: 'warning' | 'critical';
  active: boolean;
  title: string;
  detail: string;
  observed_value: number | null;
  threshold_value: number | null;
}

export interface MonitoringDashboardData {
  generated_at: string;
  total_classifications: number;
  accepted_predictions: number;
  review_required: number;
  unconfigured_mappings: number;
  rejected_inputs: number;
  average_model_score: number | null;
  average_calibrated_confidence: number | null;
  calibrated_sample_count: number;
  total_review_records: number;
  resolved_review_count: number;
  review_resolution_rate: number | null;
  pending_queue_backlog: number;
  reviewed_comparison: ReviewedComparisonSummary;
  classification_volume_over_time: DailyVolumePoint[];
  classification_distribution: CategoryDistributionItem[];
  decision_status_distribution: DecisionDistributionItem[];
  confidence_distribution: ConfidenceBinItem[];
  manual_review_trends: ReviewTrendPoint[];
  model_version_comparison: ModelComparisonItem[];
  virtual_bin_assignments: VirtualBinAssignmentItem[];
  unmapped_categories: string[];
  failure_event_count: number;
  thresholds: OperationalAlertThresholds;
  alerts: OperationalAlertItem[];
  source_note: string;
}

export type AnalyticsReportType =
  | 'classification_history'
  | 'analytics_summary'
  | 'model_usage'
  | 'manual_review'
  | 'category_distribution';

