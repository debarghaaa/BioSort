import React, { useCallback, useEffect, useState } from 'react';
import { Download, Lock, RefreshCw } from 'lucide-react';
import { AlertBanner } from '../../components/common/AlertBanner';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { PanelHeader } from '../../components/common/PanelHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import {
  ApiRequestError,
  claimReviewInApi,
  exportDatasetFeedbackFromApi,
  fetchApprovedTaxonomyFromApi,
  fetchReviewDetailFromApi,
  fetchReviewsFromApi,
  submitReviewDecisionToApi,
} from '../../services/api/classificationApi';
import { createEvidenceSignedUrl } from '../../services/supabase/client';
import {
  UserRole,
  type ApprovedTaxonomyOption,
  type ReviewAction,
  type ReviewQueueItem,
  type ReviewQueueStatus,
  type ReviewSortOption,
} from '../../types/platform';
import { formatScore, formatTimestamp } from '../../utils/formatters';
import { resolveWasteCategoryVisual } from '../../utils/wasteCategories';

const STATUS_TABS: Array<{ value: ReviewQueueStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'relabelled', label: 'Relabelled' },
  { value: 'unresolved', label: 'Unresolved' },
];

export function ManualReviewPanel() {
  const { auth } = useAuth();
  const { config, getCategoryAppearance } = usePlatformConfig();

  const isAuthorizedReviewer = auth.role === UserRole.REVIEWER || auth.role === UserRole.ADMIN;

  // Filters & sorting
  const [statusFilter, setStatusFilter] = useState<ReviewQueueStatus | ''>('pending');
  const [predictedCategory, setPredictedCategory] = useState('');
  const [modelVersion, setModelVersion] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOption, setSortOption] = useState<ReviewSortOption>('oldest_first');

  // Queue state
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected item detail + evidence image + approved taxonomy
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewQueueItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [taxonomyOptions, setTaxonomyOptions] = useState<ApprovedTaxonomyOption[]>([]);

  // Action form state
  const [action, setAction] = useState<ReviewAction>('confirmed');
  const [resolvedClass, setResolvedClass] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [approveForExport, setApproveForExport] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Dataset feedback export state
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportIsError, setExportIsError] = useState(false);

  const loadTaxonomy = useCallback(async () => {
    if (!config.apiBaseUrl) {
      setTaxonomyOptions([]);
      return;
    }
    try {
      const items = await fetchApprovedTaxonomyFromApi({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      setTaxonomyOptions(items);
    } catch {
      setTaxonomyOptions([]);
    }
  }, [auth.accessToken, config.apiBaseUrl]);

  const loadQueue = useCallback(async () => {
    if (!config.apiBaseUrl) {
      setReviews([]);
      setError(
        'FastAPI backend URL is not configured. Persisted manual review records and evidence images are unavailable.'
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchReviewsFromApi({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
        status: statusFilter,
        predictedCategory,
        modelVersion,
        reviewReason,
        dateFrom,
        dateTo,
        sort: sortOption,
      });
      setReviews(list);
      setSelectedId((prev) => {
        if (prev && list.some((item) => item.classification_id === prev)) {
          return prev;
        }
        return list.length > 0 ? list[0].classification_id : null;
      });
    } catch (err) {
      setReviews([]);
      setError(err instanceof Error ? err.message : 'Unable to load manual review queue.');
    } finally {
      setLoading(false);
    }
  }, [
    auth.accessToken,
    config.apiBaseUrl,
    dateFrom,
    dateTo,
    modelVersion,
    predictedCategory,
    reviewReason,
    sortOption,
    statusFilter,
  ]);

  const loadDetail = useCallback(
    async (classificationId: string) => {
      if (!config.apiBaseUrl) return;
      setDetailLoading(true);
      setDetailError(null);
      setConflictMessage(null);
      setEvidenceUrl(null);
      try {
        const record = await fetchReviewDetailFromApi({
          classificationId,
          baseUrl: config.apiBaseUrl,
          accessToken: auth.accessToken,
        });
        setDetail(record);
        if (record.image_signed_url) {
          setEvidenceUrl(record.image_signed_url);
        } else if (record.image_storage_path) {
          const clientSigned = await createEvidenceSignedUrl(record.image_storage_path);
          setEvidenceUrl(clientSigned);
        }
      } catch (err) {
        setDetail(null);
        setDetailError(
          err instanceof Error ? err.message : 'Failed to load full review evidence and history.'
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [auth.accessToken, config.apiBaseUrl]
  );

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEvidenceUrl(null);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const approvedClassList =
    taxonomyOptions.length > 0
      ? taxonomyOptions.map((t) => ({ code: t.class_code, label: t.display_name }))
      : config.taxonomyClasses
          .filter((c) => c.is_active)
          .map((c) => ({ code: c.class_name, label: c.display_label }));

  const handleClaim = async () => {
    if (!detail || !isAuthorizedReviewer) return;
    setClaiming(true);
    setSubmitError(null);
    setConflictMessage(null);
    try {
      const updated = await claimReviewInApi({
        classificationId: detail.classification_id,
        expectedVersion: detail.version,
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      setDetail(updated);
      await loadQueue();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setConflictMessage(err.message);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Unable to claim review.');
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setConflictMessage(null);

    if (!isAuthorizedReviewer) {
      setSubmitError('Only authorised reviewers or administrators may submit review decisions.');
      return;
    }
    if (action === 'relabelled') {
      if (!resolvedClass) {
        setSubmitError('Select a target class from the approved taxonomy list.');
        return;
      }
      if (!approvedClassList.some((c) => c.code === resolvedClass)) {
        setSubmitError('Arbitrary categories outside the approved taxonomy are not permitted.');
        return;
      }
      if (reviewerNotes.trim().length < 3) {
        setSubmitError('A documented relabelling reason (at least 3 characters) is required.');
        return;
      }
    }
    if (action === 'unresolved' && reviewerNotes.trim().length < 3) {
      setSubmitError('Document why the evidence is insufficient for category assignment.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!detail) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError(null);
    setConflictMessage(null);
    try {
      const updated = await submitReviewDecisionToApi({
        classificationId: detail.classification_id,
        action,
        resolvedClass:
          action === 'relabelled'
            ? resolvedClass
            : action === 'confirmed'
              ? detail.predicted_class
              : null,
        reviewerNotes: reviewerNotes.trim(),
        expectedVersion: detail.version,
        approvedForDatasetExport: action === 'unresolved' ? false : approveForExport,
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      setDetail(updated);
      setReviewerNotes('');
      setResolvedClass('');
      setApproveForExport(false);
      await loadQueue();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setConflictMessage(
          `${err.message} Refreshing detail will show the latest saved review state.`
        );
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Failed to record manual review decision.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportDatasetFeedback = async () => {
    if (!config.apiBaseUrl) return;
    setExporting(true);
    setExportMessage(null);
    setExportIsError(false);
    try {
      const manifest = await exportDatasetFeedbackFromApi({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `approved-dataset-feedback-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage(
        `Exported ${manifest.total_approved_records} explicitly approved record(s) for separate Colab retraining.`
      );
    } catch (err) {
      setExportIsError(true);
      setExportMessage(
        err instanceof Error ? err.message : 'Failed to export approved dataset feedback.'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Governance Notice & Dataset Feedback Export Bar */}
      <div className="oi-panel flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-[68ch]">
          <p className="oi-card-title">
            Controlled Software Verification Workflow
          </p>
          <p className="oi-component-subtitle">
            Original model predictions remain immutable. Reviewer decisions are recorded separately
            in an append-only audit trail and never act as physical waste handling instructions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleExportDatasetFeedback()}
          disabled={!config.apiBaseUrl || exporting || !isAuthorizedReviewer}
          className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
          <span>{exporting ? 'Exporting...' : 'Export Approved Feedback'}</span>
        </button>
      </div>

      {exportMessage && (
        <AlertBanner
          tone={exportIsError ? 'error' : 'success'}
          message={exportMessage}
        />
      )}

      {/* Queue Status Tabs & Filter Controls */}
      <div className="oi-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3.5">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Review queue status">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all duration-200 ${
                    active
                      ? 'oi-btn-primary'
                      : 'oi-btn-secondary text-[#525252]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loading}
            className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 text-[#525252] ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh Queue</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            type="text"
            aria-label="Filter by predicted category"
            value={predictedCategory}
            onChange={(e) => setPredictedCategory(e.target.value)}
            placeholder="Predicted category..."
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            aria-label="Filter by model version"
            value={modelVersion}
            onChange={(e) => setModelVersion(e.target.value)}
            placeholder="Model version..."
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            aria-label="Filter by review reason"
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder="Review reason..."
            className="oi-input px-3 py-2 text-xs"
          />
          <input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="oi-input px-2.5 py-2 text-xs font-mono"
          />
          <input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="oi-input px-2.5 py-2 text-xs font-mono"
          />
          <select
            aria-label="Sort review queue"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as ReviewSortOption)}
            className="oi-input px-3 py-2 text-xs"
          >
            <option value="oldest_first">Sort: Oldest first</option>
            <option value="newest_first">Sort: Newest first</option>
            <option value="lowest_confidence_first">Sort: Lowest confidence first</option>
          </select>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Manual Review Queue Unavailable"
          message={error}
          onRetry={() => void loadQueue()}
        />
      )}

      {loading ? (
        <LoadingState title="Loading manual review queue..." />
      ) : !error && reviews.length === 0 ? (
        <EmptyState
          title="No manual review records match the selected filters"
          description="Uncertain, low-confidence, uncalibrated, or mapping-unconfigured classification events from POST /api/v1/classifications appear here for human verification."
        />
      ) : !error ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Review Queue Table */}
          <div className="xl:col-span-5 oi-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-[#E5E5E5] bg-[#FCFBF9] text-[#737373]">
                  <tr>
                    <th className="text-left font-medium px-3.5 py-3">Classification</th>
                    <th className="text-left font-medium px-3.5 py-3">Predicted</th>
                    <th className="text-right font-medium px-3.5 py-3">Conf / Score</th>
                    <th className="text-left font-medium px-3.5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {reviews.map((item) => {
                    const active = selectedId === item.classification_id;
                    const displayScore =
                      item.calibrated_confidence !== null
                        ? item.calibrated_confidence
                        : item.model_score;
                    const visual = resolveWasteCategoryVisual(
                      item.predicted_class,
                      getCategoryAppearance(item.predicted_class)?.color_hex
                    );
                    const Icon = visual.icon;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.classification_id)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-[#4338CA]/[0.06]' : 'hover:bg-[#FCFBF9]'
                        }`}
                      >
                        <td className="px-3.5 py-3 space-y-0.5">
                          <div className="font-mono font-medium text-[#171717] max-w-[130px] truncate">
                            {item.classification_id}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-[#737373]">
                            {formatTimestamp(item.created_at)}
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          <span className="inline-flex items-center gap-2 font-mono text-[#171717]">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md border shrink-0"
                              style={{
                                backgroundColor: visual.bgTintHex,
                                borderColor: visual.borderHex,
                                color: visual.textHex,
                              }}
                              aria-hidden="true"
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                            <span>{item.predicted_class || 'Null'}</span>
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono tabular-nums text-[#171717]">
                          {formatScore(displayScore)}
                        </td>
                        <td className="px-3.5 py-3">
                          <StatusBadge status={item.queue_status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Detail Inspector, Evidence, Actions & Audit History */}
          <div className="xl:col-span-7 space-y-6">
            {detailLoading ? (
              <LoadingState title="Loading evidence image, predictions, and audit history..." />
            ) : detailError ? (
              <ErrorState
                title="Unable to load review detail"
                message={detailError}
                onRetry={selectedId ? () => void loadDetail(selectedId) : undefined}
              />
            ) : detail ? (
              <div className="space-y-6">
                {/* Evidence & Immutable Original Model Prediction */}
                <section className="oi-panel space-y-5">
                  <PanelHeader
                    title="Review Detail & Evidence Inspection"
                    subtitle={
                      <span className="oi-metadata">
                        Classification ID: {detail.classification_id} · Version {detail.version}
                      </span>
                    }
                    meta={
                      <div className="flex items-center gap-2.5">
                        <StatusBadge status={detail.queue_status} />
                        {detail.queue_status === 'pending' && isAuthorizedReviewer && (
                          <button
                            type="button"
                            onClick={() => void handleClaim()}
                            disabled={claiming}
                            className="oi-btn-primary px-3.5 py-1.5 whitespace-nowrap"
                          >
                            {claiming ? 'Claiming...' : 'Start / Claim Review'}
                          </button>
                        )}
                      </div>
                    }
                  />

                  {/* Evidence Image + Original Prediction Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                    <div className="md:col-span-5 oi-tile h-full flex flex-col justify-between gap-2.5">
                      <p className="oi-subpanel-title">Uploaded Evidence Image</p>
                      {evidenceUrl ? (
                        <img
                          src={evidenceUrl}
                          alt={`Evidence for classification ${detail.classification_id}`}
                          className="w-full h-52 object-contain rounded-xl border border-[#E5E5E5] bg-[#FFFFFF]"
                        />
                      ) : (
                        <div className="h-52 flex items-center justify-center text-center p-4 border border-dashed border-[#D4D4D4] rounded-xl bg-[#FFFFFF] oi-component-subtitle">
                          Signed evidence URL unavailable. Check private storage permissions or
                          backend configuration.
                        </div>
                      )}
                      {detail.image_storage_path && (
                        <p className="oi-metadata break-all">
                          {detail.image_storage_path}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-7 flex flex-col justify-between gap-4">
                      <div className="oi-tile space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="oi-component-subtitle font-medium text-[#525252]">
                            Original Model Prediction (Immutable)
                          </span>
                          {detail.original_decision_status && (
                            <StatusBadge status={detail.original_decision_status} />
                          )}
                        </div>
                        <p className="font-mono text-sm font-semibold text-[#171717]">
                          {(() => {
                            const app = getCategoryAppearance(detail.predicted_class);
                            return app?.display_label
                              ? `${app.display_label} (${detail.predicted_class})`
                              : detail.predicted_class || 'Null';
                          })()}
                        </p>
                        {detail.review_reason && (
                          <AlertBanner
                            tone="warning"
                            message={`Review trigger: ${detail.review_reason}`}
                          />
                        )}
                      </div>

                      <dl className="grid grid-cols-2 gap-3 items-stretch">
                        <div className="oi-tile h-full flex flex-col justify-between gap-1">
                          <dt className="oi-component-subtitle">Top Model Score</dt>
                          <dd className="oi-metadata font-semibold text-[#171717]">
                            {formatScore(detail.model_score)}
                          </dd>
                        </div>
                        <div className="oi-tile h-full flex flex-col justify-between gap-1">
                          <dt className="oi-component-subtitle">Calibrated Confidence</dt>
                          <dd className="oi-metadata font-semibold text-[#171717]">
                            {detail.calibrated_confidence !== null
                              ? formatScore(detail.calibrated_confidence)
                              : 'Unavailable'}
                          </dd>
                        </div>
                        <div className="oi-tile h-full flex flex-col justify-between gap-1">
                          <dt className="oi-component-subtitle">Model Version</dt>
                          <dd className="oi-metadata text-[#171717] truncate">
                            {detail.model_version}
                          </dd>
                        </div>
                        <div className="oi-tile h-full flex flex-col justify-between gap-1">
                          <dt className="oi-component-subtitle">Preprocessing Version</dt>
                          <dd className="oi-metadata text-[#171717] truncate">
                            {detail.preprocessing_version || 'Unavailable'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Top Candidate Classes */}
                  {detail.candidate_predictions.length > 0 && (
                    <div className="oi-inset-sm overflow-hidden">
                      <div className="border-b border-[#E5E5E5] px-3.5 py-2.5 oi-subpanel-title">
                        Top Candidate Classes
                      </div>
                      <table className="w-full text-xs">
                        <thead className="border-b border-[#E5E5E5] text-[#737373]">
                          <tr>
                            <th className="text-left font-medium px-3.5 py-2">Taxonomy Class</th>
                            <th className="text-right font-medium px-3.5 py-2">Model Score</th>
                            <th className="text-right font-medium px-3.5 py-2">Calibrated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E5E5]">
                          {detail.candidate_predictions.map((cand) => (
                            <tr key={cand.class_name}>
                              <td className="px-3.5 py-2 font-mono text-[#171717]">
                                {cand.class_name}
                              </td>
                              <td className="px-3.5 py-2 text-right font-mono tabular-nums text-[#171717]">
                                {formatScore(cand.model_score)}
                              </td>
                              <td className="px-3.5 py-2 text-right font-mono tabular-nums text-[#525252]">
                                {cand.calibrated_confidence !== null
                                  ? formatScore(cand.calibrated_confidence)
                                  : 'Unavailable'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Separate Reviewer Decision Summary */}
                  {detail.reviewed_at && (
                    <div className="oi-tile border-[#238B68]/30 bg-[#F2FAF7] space-y-1.5">
                      <p className="oi-subpanel-title text-[#17644A]">
                        Separate Reviewer Decision Record
                      </p>
                      <p className="oi-component-subtitle text-[#171717]">
                        Resolved Class:{' '}
                        <strong className="font-mono">
                          {detail.resolved_class || 'Unresolved (Insufficient Evidence)'}
                        </strong>
                        {detail.verified_mapped_bin && (
                          <span className="ml-3">
                            Verified Mapping: <strong className="font-mono">{detail.verified_mapped_bin}</strong>
                          </span>
                        )}
                      </p>
                      <p className="oi-component-subtitle">
                        Reviewer ID:{' '}
                        <span className="font-mono text-[#171717]">
                          {detail.reviewer_display_name || detail.reviewer_id || 'Recorded'}
                        </span>{' '}
                        · Reviewed At:{' '}
                        <span className="font-mono tabular-nums text-[#171717]">
                          {formatTimestamp(detail.reviewed_at)}
                        </span>
                      </p>
                      <p className="oi-component-subtitle text-[#171717]">
                        Notes: {detail.reviewer_notes}
                      </p>
                    </div>
                  )}
                </section>

                {/* Controlled Review Action Form */}
                <form onSubmit={handleFormSubmit} className="oi-panel space-y-4">
                  <PanelHeader
                    title="Submit Controlled Review Action"
                    subtitle="Relabelling is restricted to active approved taxonomy classes. Never alters historical predictions."
                    meta={
                      !isAuthorizedReviewer ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#B45309] font-medium">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Reviewer/Admin Required</span>
                        </span>
                      ) : undefined
                    }
                  />

                  {conflictMessage && (
                    <AlertBanner
                      tone="error"
                      title="Optimistic Concurrency Conflict"
                      message={conflictMessage}
                      action={
                        <button
                          type="button"
                          onClick={() => void loadDetail(detail.classification_id)}
                          className="oi-btn-secondary px-3 py-1.5 text-xs font-medium"
                        >
                          Reload Latest State
                        </button>
                      }
                    />
                  )}

                  {submitError && <ErrorState message={submitError} />}

                  <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                    <legend className="oi-subpanel-title mb-2">
                      Review Decision
                    </legend>
                    {(
                      [
                        {
                          value: 'confirmed',
                          title: 'Confirm Prediction',
                          desc: 'Confirm existing predicted category.',
                        },
                        {
                          value: 'relabelled',
                          title: 'Relabel Category',
                          desc: 'Select approved taxonomy class with reason.',
                        },
                        {
                          value: 'unresolved',
                          title: 'Mark Unresolved',
                          desc: 'Insufficient visual evidence for assignment.',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = action === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`oi-tile h-full flex flex-col justify-between gap-1.5 cursor-pointer transition-all duration-200 ${
                            active
                              ? 'border-[#4338CA] bg-[#4338CA]/[0.05]'
                              : 'bg-[#FFFFFF] hover:border-[#D4D4D4]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="review-action"
                              value={opt.value}
                              checked={active}
                              onChange={() => setAction(opt.value)}
                              className="accent-[#4338CA]"
                            />
                            <span className="oi-subpanel-title">{opt.title}</span>
                          </div>
                          <p className="oi-component-subtitle pl-6">{opt.desc}</p>
                        </label>
                      );
                    })}
                  </fieldset>

                  {action === 'relabelled' && (
                    <div>
                      <label
                        htmlFor="review-taxonomy-select"
                        className="block text-xs font-semibold text-[#171717] mb-1.5"
                      >
                        Approved Taxonomy Category (Required)
                      </label>
                      <select
                        id="review-taxonomy-select"
                        required
                        value={resolvedClass}
                        onChange={(e) => setResolvedClass(e.target.value)}
                        className="oi-input w-full px-3.5 py-2 text-xs font-mono"
                      >
                        <option value="">Select approved taxonomy class...</option>
                        {approvedClassList.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.code} — {opt.label}
                          </option>
                        ))}
                      </select>
                      {approvedClassList.length === 0 && (
                        <p className="text-xs text-[#B45309] mt-1">
                          No active taxonomy classes loaded. Configure active classes in Settings or
                          ensure backend taxonomy table is seeded.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="review-notes"
                      className="block text-xs font-semibold text-[#171717] mb-1.5"
                    >
                      {action === 'relabelled'
                        ? 'Relabelling Reason (Required)'
                        : action === 'unresolved'
                          ? 'Insufficient-Evidence Rationale (Required)'
                          : 'Reviewer Notes (Optional for confirmation)'}
                    </label>
                    <textarea
                      id="review-notes"
                      rows={3}
                      required={action !== 'confirmed'}
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Document visual inspection rationale for the audit trail..."
                      className="oi-input w-full px-3.5 py-2.5 text-xs"
                    />
                  </div>

                  {action !== 'unresolved' && (
                    <label className="flex items-start gap-2.5 text-xs text-[#525252] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approveForExport}
                        onChange={(e) => setApproveForExport(e.target.checked)}
                        className="mt-0.5 accent-[#4338CA]"
                      />
                      <span>
                        Explicitly approve this reviewed image for dataset feedback export (separate
                        offline Google Colab retraining workflow only; never added automatically).
                      </span>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={!isAuthorizedReviewer || submitting}
                    className={`w-full px-4 py-2.5 ${
                      action === 'unresolved' ? 'oi-btn-destructive' : 'oi-btn-primary'
                    }`}
                  >
                    {submitting ? 'Persisting Review & Audit Entry...' : 'Save Review Decision'}
                  </button>

                  <ConfirmationDialog
                    open={confirmOpen}
                    title="Confirm Auditable Review Decision"
                    description={`Record "${action}"${
                      action === 'relabelled' ? ` to approved taxonomy class "${resolvedClass}"` : ''
                    } for classification ${detail.classification_id}? Original model predictions remain immutable and this action is permanently logged.`}
                    confirmLabel="Confirm & Save Decision"
                    confirmTone={action === 'unresolved' ? 'danger' : 'primary'}
                    onConfirm={() => void handleConfirmSubmit()}
                    onCancel={() => setConfirmOpen(false)}
                  />
                </form>

                {/* Append-Only Audit History */}
                <section className="oi-panel space-y-4">
                  <PanelHeader
                    title="Review Audit History"
                    subtitle="Append-only trail capturing before-and-after states, actor identity, and timestamps."
                  />

                  {detail.review_history.length === 0 ? (
                    <p className="oi-component-subtitle">
                      No audit transitions recorded for this review yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detail.review_history.map((entry) => (
                        <div
                          key={entry.id}
                          className="oi-tile space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="oi-subpanel-title font-mono">
                              {entry.event_type}
                            </span>
                            <span className="oi-metadata">
                              {formatTimestamp(entry.created_at)}
                            </span>
                          </div>
                          <p className="oi-metadata text-[#525252]">
                            Actor: {entry.actor_id || 'system'}
                            {entry.actor_role ? ` (${entry.actor_role})` : ''}
                          </p>
                          {(entry.before_state || entry.after_state) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 items-stretch">
                              <pre className="h-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-lg p-3 text-[11px] font-mono text-[#525252] overflow-x-auto">
                                Before: {JSON.stringify(entry.before_state, null, 2)}
                              </pre>
                              <pre className="h-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-lg p-3 text-[11px] font-mono text-[#171717] overflow-x-auto">
                                After: {JSON.stringify(entry.after_state, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
