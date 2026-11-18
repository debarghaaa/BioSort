import { Loader2, Send } from 'lucide-react';

export function ClassificationSubmitButton({
  disabled,
  loading,
}: {
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="oi-btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 whitespace-nowrap shrink-0"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Running Classification...</span>
        </>
      ) : (
        <>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span>Start Classification</span>
        </>
      )}
    </button>
  );
}
