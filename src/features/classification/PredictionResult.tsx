import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import { DecisionStatus, type SharedClassificationResult } from '../../types/platform';
import { formatTimestamp } from '../../utils/formatters';
import { resolveWasteCategoryVisual } from '../../utils/wasteCategories';
import { ConfidenceDisplay } from './ConfidenceDisplay';
import { ReviewStatusIndicator } from './ReviewStatusIndicator';

export function PredictionResult({ result }: { result: SharedClassificationResult }) {
  const { getCategoryAppearance } = usePlatformConfig();
  const appearance = getCategoryAppearance(result.predicted_class);
  const visual = resolveWasteCategoryVisual(result.predicted_class, appearance?.color_hex);
  const CategoryIcon = visual.icon;

  const showRecommendedDestination =
    result.decision_status === DecisionStatus.ACCEPTED && Boolean(result.recommended_bin);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <div className="oi-tile h-full flex flex-col justify-between gap-2.5">
          <span className="oi-component-subtitle font-medium text-[#525252]">
            Predicted Waste Class
          </span>
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border shrink-0"
              style={{
                backgroundColor: visual.bgTintHex,
                borderColor: visual.borderHex,
                color: visual.textHex,
              }}
              aria-hidden="true"
            >
              <CategoryIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-[#171717] truncate">
                {appearance?.display_label
                  ? `${appearance.display_label} (${result.predicted_class})`
                  : result.predicted_class || 'Unresolved (Null)'}
              </p>
              <p className="oi-component-subtitle font-medium" style={{ color: visual.textHex }}>
                {visual.streamLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="oi-tile h-full flex flex-col justify-between gap-2.5">
          <span className="oi-component-subtitle font-medium text-[#525252]">
            Recommended Destination
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-[#171717] leading-snug">
              {showRecommendedDestination
                ? result.recommended_bin
                : 'Unavailable — Verified Mapping & Accepted Confidence Required'}
            </p>
          </div>
        </div>
      </div>

      <ReviewStatusIndicator
        decisionStatus={result.decision_status}
        requiresManualReview={result.requires_manual_review}
        reviewReason={result.review_reason}
      />

      <ConfidenceDisplay candidates={result.candidate_predictions} />

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#E5E5E5] pt-4">
        <div>
          <dt className="oi-component-subtitle">Model Version</dt>
          <dd className="oi-metadata text-[#171717] font-medium mt-0.5">{result.model_version}</dd>
        </div>
        <div>
          <dt className="oi-component-subtitle">Timestamp</dt>
          <dd className="oi-metadata text-[#171717] mt-0.5">
            {formatTimestamp(result.created_at)}
          </dd>
        </div>
        <div>
          <dt className="oi-component-subtitle">Classification ID</dt>
          <dd
            className="oi-metadata text-[#171717] mt-0.5 truncate"
            title={result.classification_id}
          >
            {result.classification_id}
          </dd>
        </div>
      </dl>

      <p className="oi-component-subtitle">
        Assistive recordkeeping output only. Verify physical container markings and facility safety
        procedures prior to disposal.
      </p>
    </div>
  );
}
