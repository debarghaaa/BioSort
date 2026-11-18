import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { AlertBanner } from '../../components/common/AlertBanner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState, SkeletonMetricGrid } from '../../components/common/LoadingState';
import { MetricCard } from '../../components/common/MetricCard';
import { PanelHeader } from '../../components/common/PanelHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import {
  fetchAnalyticsCsvReportFromApi,
  fetchClassificationHistory,
  fetchMonitoringDashboardFromApi,
  updateAlertThresholdsInApi,
} from '../../services/api/classificationApi';
import {
  DecisionStatus,
  UserRole,
  type AnalyticsReportType,
  type ClassificationRecordItem,
  type MonitoringDashboardData,
  type OperationalAlertItem,
} from '../../types/platform';
import { formatScore, formatTimestamp } from '../../utils/formatters';
import { resolveWasteCategoryVisual } from '../../utils/wasteCategories';

const RECORDS_PAGE_SIZE = 10;

const REPORT_BUTTONS: Array<{ type: AnalyticsReportType; label: string }> = [
  { type: 'classification_history', label: 'Classification History CSV' },
  { type: 'analytics_summary', label: 'Date-Filtered Analytics CSV' },
  { type: 'model_usage', label: 'Model Usage Report CSV' },
  { type: 'manual_review', label: 'Manual-Review Report CSV' },
  { type: 'category_distribution', label: 'Category Distribution CSV' },
];

const DECISION_COLORS: Record<string, string> = {
  accepted: '#238B68',
  review_required: '#D97706',
  mapping_unconfigured: '#6366F1',
  rejected: '#D9534F',
};

export function AnalyticsPanel() {
  const { auth } = useAuth();
  const { config, readiness, recordManualBinStatus, getCategoryAppearance } = usePlatformConfig();
  const isAdmin = auth.role === UserRole.ADMIN;

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<DecisionStatus | ''>('');
  const [modelFilter, setModelFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('');

  // Dashboard data
  const [dashboard, setDashboard] = useState<MonitoringDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paginated detailed records (server-side, no image blobs loaded)
  const [records, setRecords] = useState<ClassificationRecordItem[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Admin alert thresholds
  const [backlogThresholdInput, setBacklogThresholdInput] = useState('10');
  const [failureThresholdInput, setFailureThresholdInput] = useState('3');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdFeedback, setThresholdFeedback] = useState<string | null>(null);
  const [thresholdIsError, setThresholdIsError] = useState(false);

  // CSV Exports
  const [exportingType, setExportingType] = useState<AnalyticsReportType | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Manual bin log
  const [binCode, setBinCode] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [binError, setBinError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!config.apiBaseUrl) {
      setDashboard(null);
      setError(
        'FastAPI backend URL is not configured. Verified monitoring analytics require a connected FastAPI + PostgreSQL backend.'
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMonitoringDashboardFromApi({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
        dateFrom,
        dateTo,
        category: categoryFilter,
        decisionStatus: decisionFilter,
        modelVersion: modelFilter,
        reviewStatus: reviewStatusFilter,
      });
      setDashboard(data);
      setBacklogThresholdInput(String(data.thresholds.pending_review_backlog_threshold));
      setFailureThresholdInput(String(data.thresholds.classification_failure_threshold));
    } catch (err) {
      setDashboard(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve server-side monitoring analytics.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    auth.accessToken,
    categoryFilter,
    config.apiBaseUrl,
    dateFrom,
    dateTo,
    decisionFilter,
    modelFilter,
    reviewStatusFilter,
  ]);

  const loadDetailedRecords = useCallback(async () => {
    if (!config.apiBaseUrl) {
      setRecords([]);
      setRecordsTotal(0);
      return;
    }
    setRecordsLoading(true);
    try {
      const resp = await fetchClassificationHistory({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
        decisionStatus: decisionFilter,
        category: categoryFilter,
        modelVersion: modelFilter,
        reviewStatus: reviewStatusFilter,
        dateFrom,
        dateTo,
        limit: RECORDS_PAGE_SIZE,
        offset: recordsPage * RECORDS_PAGE_SIZE,
      });
      setRecords(resp.items);
      setRecordsTotal(resp.total);
    } catch {
      setRecords([]);
      setRecordsTotal(0);
    } finally {
      setRecordsLoading(false);
    }
  }, [
    auth.accessToken,
    categoryFilter,
    config.apiBaseUrl,
    dateFrom,
    dateTo,
    decisionFilter,
    modelFilter,
    recordsPage,
    reviewStatusFilter,
  ]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadDetailedRecords();
  }, [loadDetailedRecords]);

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('');
    setDecisionFilter('');
    setModelFilter('');
    setReviewStatusFilter('');
    setRecordsPage(0);
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !config.apiBaseUrl) return;
    setSavingThresholds(true);
    setThresholdFeedback(null);
    setThresholdIsError(false);
    try {
      await updateAlertThresholdsInApi({
        thresholds: {
          pending_review_backlog_threshold: Math.max(1, Number(backlogThresholdInput) || 10),
          classification_failure_threshold: Math.max(1, Number(failureThresholdInput) || 3),
        },
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      setThresholdFeedback('Operational alert thresholds updated.');
      await loadDashboard();
    } catch (err) {
      setThresholdIsError(true);
      setThresholdFeedback(
        err instanceof Error ? err.message : 'Unable to save alert thresholds.'
      );
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleExportCsv = async (reportType: AnalyticsReportType) => {
    if (!config.apiBaseUrl) return;
    setExportingType(reportType);
    setExportError(null);
    try {
      const csvText = await fetchAnalyticsCsvReportFromApi({
        reportType,
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
        dateFrom,
        dateTo,
        category: categoryFilter,
        decisionStatus: decisionFilter,
        modelVersion: modelFilter,
        reviewStatus: reviewStatusFilter,
      });
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export CSV report.');
    } finally {
      setExportingType(null);
    }
  };

  const handleLogBin = (e: React.FormEvent) => {
    e.preventDefault();
    setBinError(null);
    const err = recordManualBinStatus(binCode, statusNote);
    if (err) {
      setBinError(err);
      return;
    }
    setBinCode('');
    setStatusNote('');
  };

  // Compute local Model Unavailable alert even if backend /ready fails
  const offlineModelAlert: OperationalAlertItem | null =
    readiness.readiness !== 'ready'
      ? {
          event: 'model_unavailable',
          severity: 'critical',
          active: true,
          title: 'Active ONNX Classifier Unavailable',
          detail:
            readiness.errors[0] ||
            `Backend readiness is "${readiness.readiness}" and no active ONNX model is loaded.`,
          observed_value: null,
          threshold_value: null,
        }
      : null;

  const activeAlerts = [
    ...(dashboard?.alerts.filter((a) => a.active) ?? []),
    ...(offlineModelAlert && !dashboard ? [offlineModelAlert] : []),
  ];

  const recordsTotalPages = Math.max(1, Math.ceil(recordsTotal / RECORDS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Operational Alerts Banner */}
      {activeAlerts.length > 0 && (
        <section className="space-y-2.5" aria-label="Operational Alerts">
          {activeAlerts.map((alert) => (
            <AlertBanner
              key={alert.event}
              tone={alert.severity === 'critical' ? 'error' : 'warning'}
              title={alert.title}
              message={alert.detail}
              action={
                <span className="font-mono text-[11px] uppercase tracking-wide px-2.5 py-1 border border-current/25 rounded-md">
                  {alert.event.replace('_', ' ')}
                </span>
              }
            />
          ))}
        </section>
      )}

      {/* Filter Bar */}
      <section className="oi-panel space-y-4">
        <PanelHeader
          title="Server-Side Monitoring Filters"
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          meta={
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetFilters}
                className="oi-btn-secondary px-3.5 py-2"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadDashboard();
                  void loadDetailedRecords();
                }}
                disabled={loading}
                className="oi-btn-primary inline-flex items-center gap-2 px-4 py-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => {
              setRecordsPage(0);
              setDateFrom(e.target.value);
            }}
            className="oi-input px-2.5 py-2 text-xs font-mono"
          />
          <input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => {
              setRecordsPage(0);
              setDateTo(e.target.value);
            }}
            className="oi-input px-2.5 py-2 text-xs font-mono"
          />
          <input
            type="text"
            aria-label="Classification category"
            value={categoryFilter}
            onChange={(e) => {
              setRecordsPage(0);
              setCategoryFilter(e.target.value);
            }}
            placeholder="Category class_code..."
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <select
            aria-label="Decision status"
            value={decisionFilter}
            onChange={(e) => {
              setRecordsPage(0);
              setDecisionFilter(e.target.value as DecisionStatus | '');
            }}
            className="oi-input px-3 py-2 text-xs"
          >
            <option value="">All Decision Statuses</option>
            <option value={DecisionStatus.ACCEPTED}>Accepted</option>
            <option value={DecisionStatus.REVIEW_REQUIRED}>Review Required</option>
            <option value={DecisionStatus.MAPPING_UNCONFIGURED}>Mapping Unconfigured</option>
            <option value={DecisionStatus.REJECTED}>Rejected</option>
          </select>
          <input
            type="text"
            aria-label="Model version"
            value={modelFilter}
            onChange={(e) => {
              setRecordsPage(0);
              setModelFilter(e.target.value);
            }}
            placeholder="Model version..."
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <select
            aria-label="Review status"
            value={reviewStatusFilter}
            onChange={(e) => {
              setRecordsPage(0);
              setReviewStatusFilter(e.target.value);
            }}
            className="oi-input px-3 py-2 text-xs"
          >
            <option value="">All Review Statuses</option>
            <option value="not_required">Not Required</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="confirmed">Confirmed</option>
            <option value="relabelled">Relabelled</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>
      </section>

      {error && (
        <ErrorState
          title="Backend Analytics Unavailable"
          message={error}
          onRetry={() => void loadDashboard()}
        />
      )}

      {loading ? (
        <div className="space-y-6">
          <SkeletonMetricGrid count={4} />
          <LoadingState title="Running server-side PostgreSQL aggregations..." />
        </div>
      ) : dashboard ? (
        <div className="space-y-6">
          {/* 6 Core Operational Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-stretch">
            <MetricCard
              label="Total Classifications"
              value={dashboard.total_classifications}
              sublabel="Persisted events in period"
            />
            <MetricCard
              label="Accepted Predictions"
              value={dashboard.accepted_predictions}
              sublabel={
                dashboard.total_classifications > 0
                  ? `${((dashboard.accepted_predictions / dashboard.total_classifications) * 100).toFixed(1)}% (${dashboard.accepted_predictions}/${dashboard.total_classifications})`
                  : '0 samples'
              }
              tone="emerald"
            />
            <MetricCard
              label="Review Required"
              value={dashboard.review_required}
              sublabel={`Global queue backlog: ${dashboard.pending_queue_backlog}`}
              tone="amber"
            />
            <MetricCard
              label="Unconfigured Mappings"
              value={dashboard.unconfigured_mappings}
              sublabel="No verified bin mapping"
              tone="neutral"
            />
            <MetricCard
              label="Average Model Score"
              value={
                dashboard.average_model_score !== null
                  ? formatScore(dashboard.average_model_score)
                  : 'Unavailable'
              }
              sublabel="Model score only (not accuracy)"
              tone="sky"
            />
            <MetricCard
              label="Review Resolution Rate"
              value={
                dashboard.review_resolution_rate !== null
                  ? `${dashboard.review_resolution_rate.toFixed(1)}%`
                  : 'Unavailable'
              }
              sublabel={`${dashboard.resolved_review_count}/${dashboard.total_review_records} reviewed`}
              tone="sky"
            />
          </div>

          {/* Accuracy & Confidence Integrity Statement */}
          <section className="oi-panel space-y-4">
            <PanelHeader
              title="Confidence vs. Verified Review Comparison Integrity"
              meta={
                <span className="oi-metadata">
                  Calibrated samples: {dashboard.calibrated_sample_count}/{dashboard.total_classifications}
                </span>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="oi-tile h-full flex flex-col justify-between gap-2">
                <p className="oi-subpanel-title">
                  Live Prediction Scores (Not Ground-Truth Accuracy)
                </p>
                <p className="oi-component-subtitle">
                  Mean model score:{' '}
                  <strong className="font-mono text-[#171717]">
                    {formatScore(dashboard.average_model_score)}
                  </strong>{' '}
                  · Mean calibrated confidence:{' '}
                  <strong className="font-mono text-[#171717]">
                    {formatScore(dashboard.average_calibrated_confidence)}
                  </strong>
                  . Confidence scores measure model probability calibration, never ground-truth
                  correctness.
                </p>
              </div>
              <div className="oi-tile h-full flex flex-col justify-between gap-2">
                <p className="oi-subpanel-title">
                  Human-Reviewed Comparison Subset Only
                </p>
                {dashboard.reviewed_comparison.comparison_sample_count === 0 ? (
                  <p className="oi-component-subtitle">
                    Agreement metrics unavailable — no confirmed or relabelled human-reviewed records
                    exist in the selected period.
                  </p>
                ) : (
                  <p className="oi-component-subtitle">
                    Confirmed agreement on reviewed subset:{' '}
                    <strong className="font-mono text-[#171717]">
                      {dashboard.reviewed_comparison.agreement_rate_pct?.toFixed(1)}%
                    </strong>{' '}
                    ({dashboard.reviewed_comparison.confirmed_count} confirmed /{' '}
                    {dashboard.reviewed_comparison.relabelled_count} relabelled, n=
                    {dashboard.reviewed_comparison.comparison_sample_count}).
                    {dashboard.reviewed_comparison.comparison_sample_count < 30 && (
                      <span className="block text-[#B45309] mt-1 font-medium">
                        Small sample caution (n &lt; 30): do not generalize to full production
                        accuracy.
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </section>

          {dashboard.total_classifications === 0 ? (
            <EmptyState
              title="No classification events match the selected filters"
              description="Monitoring charts and tables derive strictly from persisted PostgreSQL records. Adjust filters or submit images on AI Classification."
            />
          ) : (
            <>
              {/* Row 1 Visualisations */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <section className="lg:col-span-7 oi-panel h-full flex flex-col gap-4">
                  <PanelHeader
                    title="Classification Volume Over Time"
                    subtitle={
                      <>
                        Daily persisted events from <code className="font-mono">classification_events</code>.
                      </>
                    }
                  />
                  <TimeSeriesBarChart points={dashboard.classification_volume_over_time} />
                </section>

                <section className="lg:col-span-5 oi-panel h-full flex flex-col gap-4">
                  <PanelHeader
                    title="Classification Distribution"
                    subtitle="Predicted classes with sample counts and percentages."
                  />
                  <div className="space-y-3">
                    {dashboard.classification_distribution.map((cat) => {
                      const app = getCategoryAppearance(cat.class_code);
                      const visual = resolveWasteCategoryVisual(cat.class_code, app?.color_hex);
                      const Icon = visual.icon;
                      return (
                        <div key={cat.class_code} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="inline-flex items-center gap-2 font-mono text-[#171717] truncate">
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
                              <span className="truncate">
                                {app?.display_label || cat.display_name} ({cat.class_code})
                              </span>
                            </span>
                            <span className="font-mono tabular-nums text-[#525252] whitespace-nowrap">
                              {cat.count} ({cat.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#EFECE6] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, cat.percentage)}%`,
                                backgroundColor: visual.textHex,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Row 2 Visualisations */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <section className="lg:col-span-6 oi-panel h-full flex flex-col gap-4">
                  <PanelHeader
                    title="Decision Status Distribution"
                    subtitle="Sample counts and percentages across decision policy outcomes."
                  />
                  <DecisionDonutChart
                    items={dashboard.decision_status_distribution}
                    total={dashboard.total_classifications}
                  />
                </section>

                <section className="lg:col-span-6 oi-panel h-full flex flex-col gap-4">
                  <PanelHeader
                    title="Confidence Distribution"
                    subtitle={`Histogram of calibrated confidence (${dashboard.calibrated_sample_count} calibrated record(s) available).`}
                  />
                  <ConfidenceHistogram bins={dashboard.confidence_distribution} />
                </section>
              </div>

              {/* Row 3 Visualisations */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <section className="lg:col-span-5 oi-panel h-full flex flex-col gap-4">
                  <PanelHeader
                    title="Manual Review Trends"
                    subtitle={
                      <>
                        Daily queued and resolved outcomes from <code className="font-mono">manual_reviews</code>.
                      </>
                    }
                  />
                  {dashboard.manual_review_trends.length === 0 ? (
                    <p className="oi-component-subtitle py-6 text-center">
                      No manual review records in the selected period.
                    </p>
                  ) : (
                    <ReviewTrendsChart points={dashboard.manual_review_trends} />
                  )}
                </section>

                <section className="lg:col-span-7 oi-panel h-full flex flex-col gap-4">
                  <PanelHeader
                    title="Model Version Comparison"
                    subtitle="Live monitoring volume separated from offline training evaluation metrics."
                  />
                  <div className="oi-inset-sm overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b border-[#E5E5E5] text-[#737373]">
                        <tr>
                          <th className="text-left font-medium px-3 py-2.5">Model Version</th>
                          <th className="text-left font-medium px-3 py-2.5">Status</th>
                          <th className="text-right font-medium px-3 py-2.5">Live Count</th>
                          <th className="text-right font-medium px-3 py-2.5">Accepted</th>
                          <th className="text-right font-medium px-3 py-2.5">Mean Score</th>
                          <th className="text-left font-medium px-3 py-2.5">Offline Training Metrics</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E5E5]">
                        {dashboard.model_version_comparison.map((m) => (
                          <tr key={m.model_version}>
                            <td className="px-3 py-2.5 font-mono text-[#171717]">
                              <div>{m.model_version}</div>
                              <div className="text-[11px] text-[#737373]">{m.framework}</div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[#525252] capitalize">
                              {m.deployment_status}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#171717]">
                              {m.total_classifications}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#238B68]">
                              {m.accepted_count}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#525252]">
                              {formatScore(m.average_model_score)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-[#737373] max-w-[200px] truncate">
                              {Object.keys(m.training_eval_metrics || {}).length > 0
                                ? JSON.stringify(m.training_eval_metrics)
                                : 'None recorded'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* Virtual Bin Analytics */}
          <section className="oi-panel space-y-4">
            <PanelHeader
              title="Virtual Bin Assignment Counts"
              subtitle="Software-only count of accepted classification records routed to configured destination codes. Does not represent physical bin contents, capacity, or fill levels."
              meta={
                <span className="oi-inset-sm oi-metadata px-3 py-1.5 text-[#525252]">
                  Physical Sensors: Unavailable
                </span>
              }
            />

            {dashboard.virtual_bin_assignments.length === 0 ? (
              <p className="oi-component-subtitle py-3">
                No accepted classification events with verified destination mappings in the selected
                period. Physical bin sensor status remains <strong>Unavailable</strong>.
              </p>
            ) : (
              <div className="oi-inset-sm overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-[#E5E5E5] text-[#737373]">
                    <tr>
                      <th className="text-left font-medium px-3 py-2.5">Destination Bin Code</th>
                      <th className="text-right font-medium px-3 py-2.5">Virtual Assignment Count</th>
                      <th className="text-right font-medium px-3 py-2.5">Share of Accepted</th>
                      <th className="text-left font-medium px-3 py-2.5">Last Assigned</th>
                      <th className="text-left font-medium px-3 py-2.5">Physical Fill / Sensor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {dashboard.virtual_bin_assignments.map((bin) => (
                      <tr key={bin.bin_code}>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#171717]">
                          {bin.bin_code}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#171717]">
                          {bin.virtual_assignment_count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#525252]">
                          {bin.percentage.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-[#525252] whitespace-nowrap">
                          {bin.last_assigned_at ? formatTimestamp(bin.last_assigned_at) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#737373]">
                          Unavailable (Hardware excluded)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* CSV Reporting Exports */}
          <section className="oi-panel space-y-4">
            <PanelHeader
              title="CSV Reporting Exports"
              subtitle="Generates valid RFC-4180 CSV reports scoped to the active date, category, decision, model, and review filters."
            />
            {exportError && <ErrorState message={exportError} />}
            <div className="flex flex-wrap gap-3">
              {REPORT_BUTTONS.map((btn) => (
                <button
                  key={btn.type}
                  type="button"
                  disabled={exportingType !== null}
                  onClick={() => void handleExportCsv(btn.type)}
                  className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2"
                >
                  <Download className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
                  <span>{exportingType === btn.type ? 'Exporting...' : btn.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Admin Operational Alert Threshold Configuration */}
          <section className="oi-panel space-y-4">
            <PanelHeader
              title="Operational Alert Thresholds"
              subtitle={
                isAdmin
                  ? 'Configure alert thresholds for pending review backlog and recorded failures.'
                  : 'View configured alert thresholds (Admin role required to edit).'
              }
            />
            <form onSubmit={handleSaveThresholds} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="oi-label block mb-1.5">
                  Review Backlog Alert Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isAdmin || savingThresholds}
                  value={backlogThresholdInput}
                  onChange={(e) => setBacklogThresholdInput(e.target.value)}
                  className="oi-input w-full px-3 py-2 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="oi-label block mb-1.5">
                  Failure Count Alert Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isAdmin || savingThresholds}
                  value={failureThresholdInput}
                  onChange={(e) => setFailureThresholdInput(e.target.value)}
                  className="oi-input w-full px-3 py-2 font-mono tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={!isAdmin || savingThresholds}
                className="oi-btn-primary px-4 py-2"
              >
                {savingThresholds ? 'Saving...' : 'Save Alert Thresholds'}
              </button>
            </form>
            {thresholdFeedback && (
              <AlertBanner
                tone={thresholdIsError ? 'error' : 'success'}
                message={thresholdFeedback}
              />
            )}
          </section>

          {/* Paginated Detailed Records */}
          <section className="oi-card overflow-hidden">
            <PanelHeader
              className="px-6 pt-5 pb-4"
              title="Paginated Classification Records"
              subtitle="Server-side paginated metadata matching active filters (images are not loaded)."
              meta={
                <span className="oi-metadata">
                  {recordsTotal} matching record(s)
                </span>
              }
            />

            {recordsLoading ? (
              <div className="p-6">
                <LoadingState title="Loading detailed records..." />
              </div>
            ) : records.length === 0 ? (
              <div className="p-6 oi-component-subtitle text-center">
                No records match the active filter selection.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-[#E5E5E5] bg-[#FCFBF9] text-[#737373]">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Classification ID</th>
                        <th className="text-left font-medium px-4 py-3">Timestamp</th>
                        <th className="text-left font-medium px-4 py-3">Predicted Class</th>
                        <th className="text-right font-medium px-4 py-3">Model Score</th>
                        <th className="text-left font-medium px-4 py-3">Decision Status</th>
                        <th className="text-left font-medium px-4 py-3">Review State</th>
                        <th className="text-left font-medium px-4 py-3">Model Version</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      {records.map((rec) => (
                        <tr key={rec.classification_id} className="hover:bg-[#FCFBF9] transition-colors">
                          <td className="px-4 py-2.5 font-mono text-[#525252] max-w-[140px] truncate">
                            {rec.classification_id}
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-[#525252] whitespace-nowrap">
                            {formatTimestamp(rec.created_at)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[#171717]">
                            {rec.predicted_class || 'Null'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#171717]">
                            {formatScore(rec.candidate_predictions[0]?.model_score)}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={rec.decision_status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={rec.review_status || 'not_required'} />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[#525252]">
                            {rec.model_version}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-[#E5E5E5] px-4 py-3 flex items-center justify-between text-xs text-[#525252]">
                  <span className="font-mono tabular-nums">
                    Page {recordsPage + 1} of {recordsTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={recordsPage === 0}
                      onClick={() => setRecordsPage((p) => Math.max(0, p - 1))}
                      className="oi-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      disabled={recordsPage + 1 >= recordsTotalPages}
                      onClick={() => setRecordsPage((p) => p + 1)}
                      className="oi-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {/* Manual Bin Observations */}
      <div className="oi-panel space-y-4">
        <PanelHeader
          title="Physical Bin Status & Manual Observations"
          subtitle={
            <>
              Physical sensor readings: <strong className="font-semibold text-[#171717]">Unavailable</strong> (software-only platform; no
              automated sensors, fill-level probes, or bin hardware exist). Operators may record
              manual log notes below.
            </>
          }
        />

        <form onSubmit={handleLogBin} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {binError && (
            <div className="sm:col-span-4">
              <AlertBanner tone="error" message={binError} />
            </div>
          )}
          <input
            type="text"
            required
            value={binCode}
            onChange={(e) => setBinCode(e.target.value)}
            placeholder="Bin Code (e.g. BIN-BIO-02)"
            className="oi-input px-3 py-2 font-mono text-[13px]"
          />
          <input
            type="text"
            required
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Manual observation note..."
            className="sm:col-span-2 oi-input px-3 py-2 text-[13px]"
          />
          <button
            type="submit"
            className="oi-btn-primary px-4 py-2 whitespace-nowrap"
          >
            Record Manual Note
          </button>
        </form>

        {config.manualBinLogs.length > 0 && (
          <div className="border-t border-[#E5E5E5] pt-3 space-y-2">
            {config.manualBinLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-4 text-xs border-b border-[#E5E5E5]/70 pb-2"
              >
                <div>
                  <span className="font-mono font-semibold text-[#171717]">{log.bin_code}</span>
                  <span className="text-[#525252] ml-2">{log.reported_status_note}</span>
                </div>
                <span className="font-mono tabular-nums text-[#737373] whitespace-nowrap">
                  {formatTimestamp(log.recorded_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeSeriesBarChart({
  points,
}: {
  points: MonitoringDashboardData['classification_volume_over_time'];
}) {
  if (points.length === 0) {
    return <p className="oi-component-subtitle py-8 text-center">No daily series data.</p>;
  }
  const maxVal = Math.max(1, ...points.map((p) => p.total));
  return (
    <div className="space-y-3">
      <div className="oi-inset flex items-end gap-2 h-44 px-3.5 pt-4 pb-2 overflow-x-auto">
        {points.map((p) => {
          const accH = (p.accepted / maxVal) * 124;
          const revH = (p.review_required / maxVal) * 124;
          const mapH = (p.mapping_unconfigured / maxVal) * 124;
          const rejH = (p.rejected / maxVal) * 124;
          return (
            <div
              key={p.date}
              className="flex flex-col items-center gap-1 min-w-[36px] flex-1"
              title={`${p.date}: ${p.total} total (${p.accepted} accepted, ${p.review_required} review_required)`}
            >
              <span className="font-mono text-[10px] text-[#737373] tabular-nums">{p.total}</span>
              <div className="w-6 flex flex-col-reverse rounded-t-md overflow-hidden bg-[#EFECE6]">
                {accH > 0 && <div style={{ height: accH, backgroundColor: DECISION_COLORS.accepted }} />}
                {revH > 0 && (
                  <div style={{ height: revH, backgroundColor: DECISION_COLORS.review_required }} />
                )}
                {mapH > 0 && (
                  <div
                    style={{ height: mapH, backgroundColor: DECISION_COLORS.mapping_unconfigured }}
                  />
                )}
                {rejH > 0 && <div style={{ height: rejH, backgroundColor: DECISION_COLORS.rejected }} />}
              </div>
              <span className="font-mono text-[10px] text-[#737373] whitespace-nowrap">
                {p.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-[#525252]">
        {Object.entries(DECISION_COLORS).map(([key, color]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DecisionDonutChart({
  items,
  total,
}: {
  items: MonitoringDashboardData['decision_status_distribution'];
  total: number;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        className="shrink-0"
        aria-label="Decision status donut chart"
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#EFECE6"
          strokeWidth="18"
        />
        {total > 0 &&
          items.map((item) => {
            const frac = item.count / total;
            const dash = frac * circumference;
            const currentOffset = offset;
            offset += dash;
            if (item.count === 0) return null;
            return (
              <circle
                key={item.status}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={DECISION_COLORS[item.status] || '#4338CA'}
                strokeWidth="18"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 70 70)"
              />
            );
          })}
        <text x="70" y="67" textAnchor="middle" className="fill-[#171717] font-mono text-base font-semibold">
          {total}
        </text>
        <text x="70" y="83" textAnchor="middle" className="fill-[#737373] text-[10px]">
          events
        </text>
      </svg>

      <div className="flex-1 w-full space-y-2.5 text-xs">
        {items.map((item) => (
          <div key={item.status} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[#171717] capitalize">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: DECISION_COLORS[item.status] || '#4338CA' }}
              />
              <span>{String(item.status).replace(/_/g, ' ')}</span>
            </span>
            <span className="font-mono tabular-nums text-[#525252]">
              {item.count} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceHistogram({
  bins,
}: {
  bins: MonitoringDashboardData['confidence_distribution'];
}) {
  const maxBin = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="space-y-2">
      <div className="oi-inset flex items-end gap-1.5 h-44 px-3.5 pt-4 pb-2">
        {bins.map((b) => {
          const height = (b.count / maxBin) * 124;
          return (
            <div
              key={b.bin_index}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${b.label}: ${b.count} record(s)`}
            >
              <span className="font-mono text-[10px] text-[#737373] tabular-nums">{b.count}</span>
              <div
                className="w-full bg-[#4338CA] rounded-t"
                style={{ height: b.count > 0 ? Math.max(4, height) : 2, opacity: b.count > 0 ? 1 : 0.2 }}
              />
              <span className="font-mono text-[9px] text-[#737373] whitespace-nowrap">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewTrendsChart({
  points,
}: {
  points: MonitoringDashboardData['manual_review_trends'];
}) {
  const maxVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.queued, p.confirmed + p.relabelled + p.unresolved))
  );
  return (
    <div className="space-y-3">
      <div className="oi-inset-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[#E5E5E5] text-[#737373]">
            <tr>
              <th className="text-left font-medium px-2.5 py-2">Date</th>
              <th className="text-right font-medium px-2.5 py-2">Queued</th>
              <th className="text-right font-medium px-2.5 py-2">Confirmed</th>
              <th className="text-right font-medium px-2.5 py-2">Relabelled</th>
              <th className="text-right font-medium px-2.5 py-2">Unresolved</th>
              <th className="text-left font-medium px-2.5 py-2 w-24">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {points.map((p) => {
              const widthPct = Math.round((p.queued / maxVal) * 100);
              return (
                <tr key={p.date}>
                  <td className="px-2.5 py-2 font-mono text-[#525252] whitespace-nowrap">
                    {p.date}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[#171717]">
                    {p.queued}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[#238B68]">
                    {p.confirmed}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[#4338CA]">
                    {p.relabelled}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[#D9534F]">
                    {p.unresolved}
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="h-2 bg-[#EFECE6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#4338CA] rounded-full" style={{ width: `${widthPct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
