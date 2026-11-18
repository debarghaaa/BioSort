import { AlertTriangle, CheckCircle2, FileImage } from 'lucide-react';
import type { ImageValidationReport } from '../../types/platform';
import { formatBytes } from '../../utils/formatters';

export function ImageValidation({ report }: { report: ImageValidationReport }) {
  return (
    <div className="oi-tile space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 oi-subpanel-title">
          <FileImage className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
          <span>File Validation</span>
        </span>
        {report.valid ? (
          <span className="oi-badge inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-[#17644A] bg-[#F2FAF7] border border-[#238B68]/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#238B68]" aria-hidden="true" />
            <span>Ready for Upload</span>
          </span>
        ) : (
          <span className="oi-badge inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-[#9F2D2A] bg-[#FDF3F2] border border-[#D9534F]/35">
            <AlertTriangle className="h-3.5 w-3.5 text-[#D9534F]" aria-hidden="true" />
            <span>Invalid File</span>
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#E5E5E5] pt-3">
        <div>
          <dt className="oi-component-subtitle">MIME Type</dt>
          <dd className="oi-metadata text-[#171717] mt-0.5">{report.mime_type}</dd>
        </div>
        <div>
          <dt className="oi-component-subtitle">Size</dt>
          <dd className="oi-metadata text-[#171717] mt-0.5">
            {formatBytes(report.byte_size)}
          </dd>
        </div>
        <div>
          <dt className="oi-component-subtitle">Dimensions</dt>
          <dd className="oi-metadata text-[#171717] mt-0.5">
            {report.width && report.height ? `${report.width} × ${report.height}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="oi-component-subtitle">SHA-256</dt>
          <dd className="oi-metadata text-[#171717] mt-0.5 truncate" title={report.sha256 || ''}>
            {report.sha256 ? `${report.sha256.slice(0, 12)}…` : '—'}
          </dd>
        </div>
      </dl>

      {report.errors.length > 0 && (
        <ul className="space-y-1 text-xs text-[#9F2D2A] border-t border-[#E5E5E5] pt-2">
          {report.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      {report.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-[#92400E] border-t border-[#E5E5E5] pt-2">
          {report.warnings.map((warn) => (
            <li key={warn}>{warn}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
