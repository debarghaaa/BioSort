import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  DecisionStatus,
  MappingVerificationStatus,
  ReviewResolutionStatus,
} from '../../types/platform';

export function StatusBadge({
  status,
}: {
  status: DecisionStatus | MappingVerificationStatus | ReviewResolutionStatus | string;
}) {
  switch (status) {
    case DecisionStatus.ACCEPTED:
    case MappingVerificationStatus.VERIFIED:
    case ReviewResolutionStatus.CONFIRMED:
    case 'ready':
    case 'alive':
      return (
        <span className="oi-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#17644A] bg-[#F2FAF7] border border-[#238B68]/30 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#238B68] shrink-0" aria-hidden="true" />
          <span className="capitalize">{String(status).replace(/_/g, ' ')}</span>
        </span>
      );

    case 'in_progress':
      return (
        <span className="oi-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#3730A3] bg-[#EEF2FF] border border-[#4338CA]/25 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-[#4338CA] shrink-0" aria-hidden="true" />
          <span>In progress</span>
        </span>
      );

    case ReviewResolutionStatus.OVERRIDDEN:
    case 'relabelled':
      return (
        <span className="oi-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#3730A3] bg-[#EEF2FF] border border-[#4338CA]/25 whitespace-nowrap">
          <ShieldAlert className="h-3.5 w-3.5 text-[#4338CA] shrink-0" aria-hidden="true" />
          <span className="capitalize">{String(status).replace(/_/g, ' ')}</span>
        </span>
      );

    case DecisionStatus.REVIEW_REQUIRED:
    case MappingVerificationStatus.UNVERIFIED:
    case ReviewResolutionStatus.PENDING:
      return (
        <span className="oi-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#92400E] bg-[#FFFBEB] border border-[#F59E0B]/40 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 text-[#B45309] shrink-0" aria-hidden="true" />
          <span className="capitalize">{String(status).replace(/_/g, ' ')}</span>
        </span>
      );

    case DecisionStatus.MAPPING_UNCONFIGURED:
    case 'not_ready':
    case 'unconfigured':
    case 'unresolved':
    case 'not_required':
      return (
        <span className="oi-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#525252] bg-[#F7F5F2] border border-[#E5E5E5] whitespace-nowrap">
          <HelpCircle className="h-3.5 w-3.5 text-[#737373] shrink-0" aria-hidden="true" />
          <span className="capitalize">{String(status).replace(/_/g, ' ')}</span>
        </span>
      );

    case DecisionStatus.REJECTED:
    case MappingVerificationStatus.DEPRECATED:
    case 'unreachable':
    default:
      return (
        <span className="oi-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#9F2D2A] bg-[#FDF3F2] border border-[#D9534F]/35 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-[#D9534F] shrink-0" aria-hidden="true" />
          <span className="capitalize">{String(status).replace(/_/g, ' ')}</span>
        </span>
      );
  }
}
