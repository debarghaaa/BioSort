import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

export function DragAndDropZone({
  disabled,
  onFileSelected,
}: {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFileSelected(files[0]);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload medical waste image via drag and drop or file browser"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) {
          handleFiles(e.dataTransfer.files);
        }
      }}
      className={`rounded-2xl border border-dashed p-8 text-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1] ${
        disabled
          ? 'border-[#E5E5E5] bg-[#F7F5F2] cursor-not-allowed opacity-60'
          : isDragging
            ? 'border-[#4338CA] bg-[#EEF2FF]/60 cursor-pointer'
            : 'border-[#D4D4D4] bg-[#FCFBF9] hover:border-[#4338CA]/60 hover:bg-[#FFFFFF] cursor-pointer'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="h-12 w-12 rounded-xl bg-[#4338CA]/10 border border-[#4338CA]/20 text-[#4338CA] flex items-center justify-center mx-auto">
        <UploadCloud className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mt-3.5 text-sm font-semibold text-[#171717]">
        Drop a biomedical waste image here, or browse files
      </p>
      <p className="mt-1 text-xs text-[#737373]">
        JPG, JPEG, PNG · Max 10 MiB · 64–8192 px · No patient identifiers
      </p>
    </div>
  );
}
