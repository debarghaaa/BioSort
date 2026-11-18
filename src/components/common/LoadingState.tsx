import { Loader2 } from 'lucide-react';

export function LoadingState({
  title = 'Loading records...',
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div
      className="oi-card p-6 sm:p-8 space-y-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2.5 text-center">
        <Loader2 className="h-5 w-5 text-[#4338CA] animate-spin shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium text-[#171717]">{title}</p>
      </div>
      {detail && <p className="text-xs text-[#737373] text-center max-w-md mx-auto">{detail}</p>}

      <div className="space-y-3 pt-1" aria-hidden="true">
        <div className="oi-skeleton h-4 w-3/4 mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="oi-skeleton h-14 w-full" />
          <div className="oi-skeleton h-14 w-full" />
          <div className="oi-skeleton h-14 w-full" />
        </div>
        <div className="oi-skeleton h-4 w-1/2 mx-auto" />
      </div>
    </div>
  );
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="oi-card p-5 space-y-3">
          <div className="oi-skeleton h-3 w-24" />
          <div className="oi-skeleton h-7 w-28" />
          <div className="oi-skeleton h-3 w-36" />
        </div>
      ))}
    </div>
  );
}
