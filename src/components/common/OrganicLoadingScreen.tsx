import { FiAlertCircle, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import { BioSortLogo } from './BioSortLogo';

export interface OrganicLoadingScreenProps {
  message?: string;
  detail?: string;
  error?: string | null;
  retrying?: boolean;
  onRetry?: () => void;
  onContinueToLogin?: () => void;
}

export function OrganicLoadingScreen({
  message = 'Restoring workspace session...',
  detail,
  error = null,
  retrying = false,
  onRetry,
  onContinueToLogin,
}: OrganicLoadingScreenProps) {
  const isErrorState = Boolean(error);

  return (
    <div className="auth-organic-shell min-h-screen flex flex-col items-center justify-center bg-[#FCFBF9] text-[#171717] px-4 sm:px-6 py-10">
      <div
        className="w-full max-w-[420px] bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-[0_12px_36px_-16px_rgba(23,23,23,0.08)] overflow-hidden"
        role={isErrorState ? 'alert' : 'status'}
        aria-live={isErrorState ? 'assertive' : 'polite'}
      >
        <div className="p-7 sm:p-8 space-y-6">
          {/* Header Lockup matching Auth1 */}
          <div className="flex items-center justify-between gap-3 pb-5 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
                <BioSortLogo className="h-5 w-5 text-[#4338CA]" />
              </div>
              <div className="min-w-0">
                <p className="auth-organic-display text-lg font-semibold text-[#171717] leading-tight truncate">
                  BioSort
                </p>
                <p className="text-xs text-[#737373] leading-snug truncate mt-0.5">
                  Biomedical Waste Segregation
                </p>
              </div>
            </div>

            <span className="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-[#4338CA] bg-[#FCFBF9] border border-[#E5E5E5] rounded-md px-2.5 py-1 whitespace-nowrap shrink-0">
              {isErrorState ? 'SESSION ISSUE' : 'INITIALIZING'}
            </span>
          </div>

          {/* Organic Contour Wave & Segmentation Horizon */}
          <div
            className="relative rounded-xl border border-[#E5E5E5] bg-[#FCFBF9] px-4 py-5 overflow-hidden"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 360 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-14 overflow-visible"
            >
              {/* Precision clinical horizon lines */}
              <line x1="0" y1="16" x2="360" y2="16" stroke="#E5E5E5" strokeWidth="1" />
              <line x1="0" y1="32" x2="360" y2="32" stroke="#E5E5E5" strokeWidth="1" />
              <line x1="0" y1="48" x2="360" y2="48" stroke="#E5E5E5" strokeWidth="1" />

              {/* Subtle secondary contour */}
              <path
                d="M0 36 C 45 20, 90 48, 135 32 C 180 16, 225 46, 270 30 C 315 16, 340 38, 360 28"
                stroke="#6366F1"
                strokeOpacity="0.38"
                strokeWidth="1.5"
                strokeLinecap="round"
                className={isErrorState ? undefined : 'oi-wave-drift'}
              />

              {/* Primary indigo segmentation wave */}
              <path
                d="M0 32 C 48 12, 96 52, 144 32 C 192 12, 240 52, 288 32 C 324 18, 344 42, 360 32"
                stroke={isErrorState ? '#D9534F' : '#4338CA'}
                strokeWidth="2"
                strokeLinecap="round"
                className={isErrorState ? undefined : 'oi-wave-segment'}
              />

              {/* Calibration boundary nodes */}
              <circle cx="48" cy="24" r="2.5" fill={isErrorState ? '#D9534F' : '#4338CA'} />
              <circle cx="144" cy="32" r="2.5" fill="#6366F1" />
              <circle cx="240" cy="40" r="2.5" fill={isErrorState ? '#D9534F' : '#4338CA'} />
            </svg>
          </div>

          {isErrorState ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-[#D9534F]/40 bg-[#FDF3F2] px-3.5 py-3 text-xs text-[#9F2D2A]">
                <FiAlertCircle className="h-4 w-4 text-[#D9534F] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold text-[#9F2D2A]">Workspace session check interrupted</p>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    disabled={retrying}
                    className="oi-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5"
                  >
                    <FiRefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{retrying ? 'Retrying session check...' : 'Retry session restoration'}</span>
                  </button>
                )}
                {onContinueToLogin && (
                  <button
                    type="button"
                    onClick={onContinueToLogin}
                    disabled={retrying}
                    className="oi-btn-secondary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5"
                  >
                    <span>Continue to sign in</span>
                    <FiArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#171717]">{message}</p>
                {detail && <p className="text-xs text-[#737373] leading-relaxed">{detail}</p>}
              </div>

              {/* Restrained 2px indeterminate progress indicator */}
              <div className="oi-progress-track" aria-hidden="true">
                <div className="oi-progress-sweep" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E5E5] bg-[#FCFBF9] px-7 sm:px-8 py-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#737373]">
            AI-assisted biomedical waste segmentation
          </span>
          <span className="font-mono text-[10px] tracking-wider uppercase text-[#737373]">
            Clinical AI
          </span>
        </div>
      </div>
    </div>
  );
}
