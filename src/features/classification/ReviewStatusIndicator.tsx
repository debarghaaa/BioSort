import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DecisionStatus } from '../../types/platform';

export function ReviewStatusIndicator({
  decisionStatus,
  requiresManualReview,
  reviewReason,
}: {
  decisionStatus: DecisionStatus;
  requiresManualReview: boolean;
  reviewReason: string | null;
}) {
  return (
    <div className="oi-tile space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="oi-subpanel-title">
          Policy &amp; Manual Review Status
        </span>
        <StatusBadge status={decisionStatus} />
      </div>

      {decisionStatus === DecisionStatus.ACCEPTED && !requiresManualReview && (
        <p className="oi-component-subtitle">
          Confidence met configured thresholds and destination mapping is verified. Manual review is
          not required.
        </p>
      )}

      {decisionStatus === DecisionStatus.REVIEW_REQUIRED && (
        <p className="oi-component-subtitle">
          Low-confidence or uncalibrated outcome routed to manual review. No destination bin is
          recommended until verified by a reviewer.
        </p>
      )}

      {decisionStatus === DecisionStatus.MAPPING_UNCONFIGURED && (
        <p className="oi-component-subtitle">
          Taxonomy class-to-bin mapping is missing or unverified for the active jurisdiction.
          Destination recommendation is blocked pending verification.
        </p>
      )}

      {decisionStatus === DecisionStatus.REJECTED && (
        <p className="oi-component-subtitle text-[#9F2D2A]">
          Classification rejected by validation or policy constraints.
        </p>
      )}

      {reviewReason && (
        <p className="oi-component-subtitle border-t border-[#E5E5E5] pt-2">
          <span className="font-semibold text-[#171717]">Reason: </span>
          {reviewReason}
        </p>
      )}

      {requiresManualReview && (
        <div className="pt-1">
          <Link
            to="/review"
            className="inline-flex items-center min-h-[44px] text-xs font-semibold text-[#4338CA] hover:text-[#6366F1] transition-colors"
          >
            Open Manual Review Queue
          </Link>
        </div>
      )}
    </div>
  );
}
