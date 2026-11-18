import { Loader2 } from 'lucide-react';

export function InferenceLoadingState() {
  return (
    <div
      className="oi-inset p-6 sm:p-8 space-y-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center text-center space-y-2">
        <Loader2 className="h-6 w-6 text-[#4338CA] animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-[#171717]">
          Running ONNX classification and policy checks...
        </p>
        <p className="text-xs text-[#737373] max-w-md">
          Validating encoding, preprocessing tensor, executing model inference, and saving the
          classification record.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2" aria-hidden="true">
        <div className="oi-skeleton h-16 w-full" />
        <div className="oi-skeleton h-16 w-full" />
      </div>
      <div className="oi-skeleton h-24 w-full" aria-hidden="true" />
    </div>
  );
}
