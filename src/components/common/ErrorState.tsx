import { AlertCircle } from 'lucide-react';

export function ErrorState({
  title = 'Request failed',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-[#D9534F]/40 bg-[#FDF3F2] p-4 flex flex-wrap items-start justify-between gap-4 text-[#9F2D2A]"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-[#D9534F] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-[13px] font-semibold leading-snug">{title}</p>
          <p className="text-[13px] leading-relaxed">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="oi-btn-secondary px-4 py-2 whitespace-nowrap shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
