import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, ScanLine } from 'lucide-react';
import { AlertBanner } from '../components/common/AlertBanner';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonMetricGrid } from '../components/common/LoadingState';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { PanelHeader } from '../components/common/PanelHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { usePlatformConfig } from '../hooks/usePlatformConfig';
import { fetchAnalyticsSummaryFromApi } from '../services/api/classificationApi';
import type { AnalyticsSummaryData } from '../types/platform';
import { formatScore, formatTimestamp } from '../utils/formatters';
import { resolveWasteCategoryVisual } from '../utils/wasteCategories';

export function DashboardPage() {
  const { auth } = useAuth();
  const {
    config,
    readiness,
    checkingReadiness,
    activePolicy,
    refreshReadiness,
    getCategoryAppearance,
  } = usePlatformConfig();

  const [analytics, setAnalytics] = useState<AnalyticsSummaryData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const loadVerifiedMetrics = useCallback(async () => {
    if (!config.apiBaseUrl || !readiness.reachable) {
      setAnalytics(null);
      setAnalyticsError(
        config.apiBaseUrl
          ? 'Inference service unreachable. Verified totals are unavailable.'
          : 'API base URL is not configured.'
      );
      return;
    }

    setLoadingMetrics(true);
    try {
      const summary = await fetchAnalyticsSummaryFromApi({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      setAnalytics(summary);
      setAnalyticsError(null);
    } catch (err) {
      setAnalytics(null);
      setAnalyticsError(
        err instanceof Error ? err.message : 'Unable to fetch verified summary from backend.'
      );
    } finally {
      setLoadingMetrics(false);
    }
  }, [auth.accessToken, config.apiBaseUrl, readiness.reachable]);

  useEffect(() => {
    void loadVerifiedMetrics();
  }, [loadVerifiedMetrics]);

  const readinessTone =
    readiness.readiness === 'ready'
      ? 'emerald'
      : readiness.readiness === 'unreachable'
        ? 'red'
        : 'amber';

  const readinessLabel =
    readiness.readiness === 'ready'
      ? 'Ready'
      : readiness.readiness === 'not_ready'
        ? 'Not Ready'
        : readiness.readiness === 'unconfigured'
          ? 'Unconfigured'
          : 'Unreachable';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Monitor inference service readiness, active confidence and bin-mapping policies, and verified classification records."
        actions={
          <>
            <button
              type="button"
              onClick={() => void refreshReadiness()}
              disabled={checkingReadiness}
              className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${checkingReadiness ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Check Readiness</span>
            </button>
            <Link
              to="/classify"
              className="oi-btn-primary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
            >
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              <span>Upload Image</span>
            </Link>
          </>
        }
      />

      {loadingMetrics ? (
        <SkeletonMetricGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          <MetricCard
            label="Inference Service"
            value={readinessLabel}
            sublabel={`Liveness: ${readiness.liveness}`}
            tone={readinessTone}
          />
          <MetricCard
            label="Loaded ONNX Model"
            value={
              readiness.model_loaded && readiness.model_version
                ? readiness.model_version
                : 'Unavailable'
            }
            sublabel={readiness.model_loaded ? 'Verified via /ready' : 'No model artefact loaded'}
            tone={readiness.model_loaded ? 'sky' : 'neutral'}
          />
          <MetricCard
            label="Persisted Classifications"
            value={analytics ? analytics.total_events : 'Unavailable'}
            sublabel={
              analytics
                ? 'Stored in PostgreSQL'
                : analyticsError || 'Connect backend to view totals'
            }
            tone="neutral"
          />
          <MetricCard
            label="Pending Reviews"
            value={analytics ? analytics.pending_reviews : 'Unavailable'}
            sublabel={
              analytics
                ? `${analytics.resolved_reviews} resolved reviews`
                : `${config.sessionRecentClassifications.length} local session event(s)`
            }
            tone={analytics && analytics.pending_reviews > 0 ? 'amber' : 'neutral'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-6 oi-panel h-full flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <PanelHeader
              title="Service Diagnostics"
              subtitle="Live connectivity across API, JWT verification, and database storage."
              meta={<StatusBadge status={readiness.readiness} />}
            />

            <dl className="grid grid-cols-2 gap-3 oi-tile">
              <div>
                <dt className="oi-component-subtitle">Backend Endpoint</dt>
                <dd className="oi-metadata text-[#171717] font-medium mt-0.5 truncate">
                  {config.apiBaseUrl || 'Not configured'}
                </dd>
              </div>
              <div>
                <dt className="oi-component-subtitle">JWT Verification</dt>
                <dd className="oi-metadata text-[#171717] font-medium mt-0.5">
                  {readiness.jwt_configured ? 'Configured' : 'Unconfigured'}
                </dd>
              </div>
              <div>
                <dt className="oi-component-subtitle">PostgreSQL Storage</dt>
                <dd className="oi-metadata text-[#171717] font-medium mt-0.5">
                  {readiness.supabase_connected ? 'Connected' : 'Disconnected'}
                </dd>
              </div>
              <div>
                <dt className="oi-component-subtitle">Physical Bin Sensors</dt>
                <dd className="oi-metadata text-[#171717] font-medium mt-0.5">
                  Unavailable (Software-only)
                </dd>
              </div>
            </dl>

            {readiness.errors.length > 0 && (
              <AlertBanner
                tone="warning"
                message={
                  <div className="space-y-1">
                    {readiness.errors.map((err) => (
                      <p key={err}>{err}</p>
                    ))}
                  </div>
                }
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5] text-xs">
            <span className="oi-component-subtitle">
              Manage endpoint, taxonomy, and mappings in Settings.
            </span>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 min-h-[44px] text-[#4338CA] font-semibold hover:text-[#6366F1] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open Settings</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="lg:col-span-6 oi-panel h-full flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <PanelHeader
              title="Active Governance Configuration"
              subtitle="Configured taxonomy definitions, bin mappings, and confidence thresholds."
              meta={<span className="oi-metadata">Role: {auth.role}</span>}
            />

            <dl className="grid grid-cols-2 gap-3">
              <div className="oi-tile space-y-1">
                <dt className="oi-component-subtitle">Configured Taxonomy Classes</dt>
                <dd className="oi-numerical-sm">{config.taxonomyClasses.length}</dd>
              </div>
              <div className="oi-tile space-y-1">
                <dt className="oi-component-subtitle">Category-to-Bin Mappings</dt>
                <dd className="oi-numerical-sm">{config.binMappings.length}</dd>
              </div>
            </dl>
          </div>

          <div className="oi-tile space-y-1.5">
            <p className="oi-subpanel-title">
              Active Policy:{' '}
              <span className="font-mono text-[#4338CA]">
                {activePolicy
                  ? `${activePolicy.policy_name} (${activePolicy.jurisdiction_code})`
                  : 'Default backend policy'}
              </span>
            </p>
            <p className="oi-component-subtitle">
              Only verified mappings and predictions meeting confidence and margin thresholds emit an
              accepted bin recommendation. All other events route to manual review.
            </p>
          </div>
        </section>
      </div>

      <section className="oi-card overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="oi-card-title">Recent Session Classifications</h3>
            <p className="oi-component-subtitle">
              Verified classification responses returned during this browser session.
            </p>
          </div>
          <Link
            to="/history"
            className="inline-flex items-center min-h-[44px] text-sm font-medium text-[#4338CA] hover:text-[#6366F1] transition-colors whitespace-nowrap shrink-0"
          >
            View History
          </Link>
        </div>

        {config.sessionRecentClassifications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No classifications submitted in this session"
              description="Upload a biomedical waste image to inspect model candidate scores and segregation policy outcomes."
              action={
                <Link
                  to="/classify"
                  className="oi-btn-primary inline-flex items-center gap-2 px-4 py-2"
                >
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  <span>Upload Image</span>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E5E5E5] bg-[#FCFBF9] text-xs text-[#737373]">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Classification ID</th>
                  <th className="text-left font-medium px-4 py-3">Timestamp</th>
                  <th className="text-left font-medium px-4 py-3">Predicted Category</th>
                  <th className="text-right font-medium px-4 py-3">Top Score</th>
                  <th className="text-left font-medium px-4 py-3">Decision Status</th>
                  <th className="text-left font-medium px-4 py-3">Recommended Bin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {config.sessionRecentClassifications.slice(0, 10).map((item) => {
                  const appearance = getCategoryAppearance(item.predicted_class);
                  const visual = resolveWasteCategoryVisual(item.predicted_class, appearance?.color_hex);
                  const Icon = visual.icon;
                  const topScore = item.candidate_predictions[0]?.model_score;
                  return (
                    <tr
                      key={item.classification_id}
                      className="hover:bg-[#FCFBF9] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-[#737373] max-w-[140px] truncate">
                        {item.classification_id}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#737373] whitespace-nowrap">
                        {formatTimestamp(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
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
                          <span>{appearance?.display_label || item.predicted_class || 'Null'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#171717]">
                        {formatScore(topScore)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.decision_status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[#525252]">
                        {item.recommended_bin || 'None (Manual Review)'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
