import { useRef } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

export function ImagePreview({
  previewUrl,
  fileName,
  disabled,
  onReplaceFile,
  onRemove,
}: {
  previewUrl: string;
  fileName: string;
  disabled?: boolean;
  onReplaceFile: (file: File) => void;
  onRemove: () => void;
}) {
  const replaceRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="oi-inset p-4 space-y-3">
      <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-2.5 flex items-center justify-center">
        <img
          src={previewUrl}
          alt={`Local preview of ${fileName}`}
          className="max-h-64 w-auto object-contain rounded-lg"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs text-[#171717] truncate max-w-xs" title={fileName}>
          {fileName}
        </span>

        <div className="flex items-center gap-2.5 shrink-0">
          <input
            ref={replaceRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            disabled={disabled}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onReplaceFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => replaceRef.current?.click()}
            className="oi-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Replace</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className="oi-btn-destructive inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}
