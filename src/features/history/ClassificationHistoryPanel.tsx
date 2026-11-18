import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileImage, Search } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { PanelHeader } from '../../components/common/PanelHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import {
  fetchClassificationDetail,
  fetchClassificationHistory,
} from '../../services/api/classificationApi';
import { createEvidenceSignedUrl } from '../../services/supabase/client';
import {
  DecisionStatus,
  type ClassificationRecordItem,
} from '../../types/platform';
import { formatScore, formatTimestamp } from '../../utils/formatters';
import { resolveWasteCategoryVisual } from '../../utils/wasteCategories';
import { PredictionResult } from '../classification/PredictionResult';

const PAGE_SIZE = 15;

export function ClassificationHistoryPanel() {
  const { auth } = useAuth();
  const { config, getCategoryAppearance } = usePlatformConfig();

  const [items, setItems] = useState<ClassificationRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchId, setSearchId] = useState('');
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detail modal
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ClassificationRecordItem | null>(null);
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!config.apiBaseUrl) {
      setItems([]);
      setTotal(0);
      setError('Backend API URL is not configured. Persistent classification history is unavailable.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await fetchClassificationHistory({
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
        decisionStatus: statusFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(resp.items);
      setTotal(resp.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(
        err instanceof Error ? err.message : 'Unable to retrieve persistent classification history.'
      );
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, config.apiBaseUrl, page, statusFilter]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleInspect = async (classificationId: string) => {
    setDetailError(null);
    setDetailLoading(true);
    setSelectedRecord(null);
    setSelectedEvidenceUrl(null);
    try {
      const record = await fetchClassificationDetail({
        classificationId,
        baseUrl: config.apiBaseUrl,
        accessToken: auth.accessToken,
      });
      setSelectedRecord(record);
      if (record.image_storage_path) {
        const signed = await createEvidenceSignedUrl(record.image_storage_path);
        setSelectedEvidenceUrl(signed);
      }
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : 'Failed to load classification event detail.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const visibleItems = items.filter((item) => {
    if (
      searchId.trim() &&
      !item.classification_id.toLowerCase().includes(searchId.trim().toLowerCase())
    ) {
      return false;
    }
    if (
      categoryFilter.trim() &&
      !(item.predicted_class || '').toLowerCase().includes(categoryFilter.trim().toLowerCase())
    ) {
      return false;
    }
    if (scoreFilter) {
      const topCand = item.candidate_predictions[0];
      const val = topCand ? (topCand.calibrated_confidence ?? topCand.model_score) : null;
      if (val === null) return false;
      if (scoreFilter === 'high' && val < 0.85) return false;
      if (scoreFilter === 'medium' && (val < 0.5 || val >= 0.85)) return false;
      if (scoreFilter === 'low' && val >= 0.5) return false;
    }
    if (
      modelFilter.trim() &&
      !item.model_version.toLowerCase().includes(modelFilter.trim().toLowerCase())
    ) {
      return false;
    }
    if (dateFrom) {
      const itemTime = new Date(item.created_at).getTime();
      const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
      if (itemTime < fromTime) return false;
    }
    if (dateTo) {
      const itemTime = new Date(item.created_at).getTime();
      const toTime = new Date(`${dateTo}T23:59:59`).getTime();
      if (itemTime > toTime) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="oi-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        <div className="relative lg:col-span-2">
          <Search
            className="h-4 w-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search by classification ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Search classification UUID..."
            className="oi-input w-full pl-10 pr-3.5 py-2 font-mono text-[13px]"
          />
        </div>

        <select
          aria-label="Filter by decision status"
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value as DecisionStatus | '');
          }}
          className="oi-input px-3 py-2 text-[13px]"
        >
          <option value="">All Decision Statuses</option>
          <option value={DecisionStatus.ACCEPTED}>Accepted</option>
          <option value={DecisionStatus.REVIEW_REQUIRED}>Review Required</option>
          <option value={DecisionStatus.MAPPING_UNCONFIGURED}>Mapping Unconfigured</option>
          <option value={DecisionStatus.REJECTED}>Rejected</option>
        </select>

        <select
          aria-label="Filter by confidence score tier"
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
          className="oi-input px-3 py-2 text-[13px]"
        >
          <option value="">All Score Tiers</option>
          <option value="high">High (≥ 85%)</option>
          <option value="medium">Moderate (50%–84%)</option>
          <option value="low">Low (&lt; 50%)</option>
        </select>

        <input
          type="text"
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          placeholder="Category class..."
          className="oi-input px-3 py-2 font-mono text-[13px]"
        />

        <input
          type="text"
          aria-label="Filter by model version"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          placeholder="Model version..."
          className="oi-input px-3 py-2 font-mono text-[13px]"
        />

        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="oi-input w-full px-2.5 py-2 font-mono text-xs"
          />
          <input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="oi-input w-full px-2.5 py-2 font-mono text-xs"
          />
        </div>
      </div>

      {error && (
        <ErrorState
          title="Unable to load persistent history"
          message={error}
          onRetry={() => void loadHistory()}
        />
      )}

      {loading ? (
        <LoadingState title="Loading classification history..." />
      ) : !error && visibleItems.length === 0 ? (
        <EmptyState
          title="No classification records found"
          description="Persisted classification events matching your active filters will appear here."
        />
      ) : (
        !error && (
          <div className="oi-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b border-[#E5E5E5] bg-[#FCFBF9] text-xs text-[#737373]">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Evidence</th>
                    <th className="text-left font-medium px-4 py-3">Classification ID</th>
                    <th className="text-left font-medium px-4 py-3">Timestamp</th>
                    <th className="text-left font-medium px-4 py-3">Predicted Category</th>
                    <th className="text-right font-medium px-4 py-3">Top Score</th>
                    <th className="text-left font-medium px-4 py-3">Decision Status</th>
                    <th className="text-left font-medium px-4 py-3">Review State</th>
                    <th className="text-left font-medium px-4 py-3">Model</th>
                    <th className="text-right font-medium px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {visibleItems.map((item) => {
                    const topScore = item.candidate_predictions[0]?.model_score;
                    const appearance = getCategoryAppearance(item.predicted_class);
                    const visual = resolveWasteCategoryVisual(
                      item.predicted_class,
                      appearance?.color_hex
                    );
                    const Icon = visual.icon;
                    return (
                      <tr
                        key={item.classification_id}
                        className="hover:bg-[#FCFBF9] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div
                            className="h-9 w-9 rounded-lg oi-inset-sm flex items-center justify-center text-[#737373]"
                            title={item.image_filename || item.image_storage_path || 'Stored evidence'}
                          >
                            <FileImage className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[#737373] max-w-[130px] truncate">
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
                        <td className="px-4 py-3 space-y-1">
                          <StatusBadge
                            status={
                              item.review_status ||
                              (item.requires_manual_review ? 'pending' : 'not_required')
                            }
                          />
                          {item.resolved_class && (
                            <div className="font-mono text-[11px] text-[#737373]">
                              Reviewed: {item.resolved_class}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[#737373]">
                          {item.model_version}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleInspect(item.classification_id)}
                            className="oi-btn-secondary px-3 py-1.5 text-xs font-semibold text-[#171717] whitespace-nowrap"
                          >
                            View Results
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#E5E5E5] bg-[#FCFBF9] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#737373]">
              <span className="font-mono tabular-nums">
                Page {page + 1} of {totalPages} ({total} total records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="oi-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="oi-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {(detailLoading || detailError || selectedRecord) && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/35 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="oi-card-elevated max-w-2xl w-full p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            <PanelHeader
              title="Classification Event Detail"
              meta={
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecord(null);
                    setSelectedEvidenceUrl(null);
                    setDetailError(null);
                  }}
                  className="oi-btn-secondary px-3.5 py-1.5"
                >
                  Close
                </button>
              }
            />

            {detailLoading && <LoadingState title="Loading event detail..." />}
            {detailError && <ErrorState message={detailError} />}
            {selectedRecord && (
              <div className="space-y-4">
                {selectedEvidenceUrl && (
                  <div className="oi-tile p-3 flex items-center justify-center">
                    <img
                      src={selectedEvidenceUrl}
                      alt={`Evidence image for ${selectedRecord.classification_id}`}
                      className="max-h-52 w-auto object-contain rounded-lg"
                    />
                  </div>
                )}

                <PredictionResult result={selectedRecord} />
                {(selectedRecord.review_status || selectedRecord.resolved_class) && (
                  <div className="oi-tile space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="oi-subpanel-title">
                        Human Review Record
                      </span>
                      {selectedRecord.review_status && (
                        <StatusBadge status={selectedRecord.review_status} />
                      )}
                    </div>
                    {selectedRecord.resolved_class && (
                      <p className="oi-component-subtitle">
                        Verified Class:{' '}
                        <span className="font-mono font-semibold text-[#171717]">
                          {selectedRecord.resolved_class}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
