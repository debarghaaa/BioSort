import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { AlertBanner } from '../../components/common/AlertBanner';
import { ErrorState } from '../../components/common/ErrorState';
import { PanelHeader } from '../../components/common/PanelHeader';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import { classifyWasteImage } from '../../services/api/classificationApi';
import type { ImageValidationReport, SharedClassificationResult } from '../../types/platform';
import { validateImageFile } from '../../utils/imageValidation';
import { ClassificationSubmitButton } from './ClassificationSubmitButton';
import { DragAndDropZone } from './DragAndDropZone';
import { ImagePreview } from './ImagePreview';
import { ImageValidation } from './ImageValidation';
import { InferenceLoadingState } from './InferenceLoadingState';
import { PredictionResult } from './PredictionResult';

const PIPELINE_STEPS = [
  'Image Upload',
  'Validation',
  'Preprocessing',
  'Model Inference',
  'Confidence Check',
  'Policy Mapping',
  'Result Output',
] as const;

type StepState = 'completed' | 'active' | 'error' | 'pending';

export function ImageUploadPanel() {
  const { auth } = useAuth();
  const { config, readiness, activePolicy, recordSessionClassification } = usePlatformConfig();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<ImageValidationReport | null>(null);
  const [jurisdictionCode, setJurisdictionCode] = useState(
    activePolicy?.jurisdiction_code || ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SharedClassificationResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = async (file: File) => {
    if (isSubmitting) return;
    setSubmitError(null);
    setResult(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setSelectedFile(file);
    const report = await validateImageFile(file);
    setValidationReport(report);
    if (report.valid) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemove = () => {
    if (isSubmitting) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationReport(null);
    setSubmitError(null);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedFile || !validationReport?.valid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await classifyWasteImage({
        file: selectedFile,
        jurisdictionCode: jurisdictionCode.trim() || undefined,
        accessToken: auth.accessToken,
        baseUrl: config.apiBaseUrl,
      });
      setResult(response);
      recordSessionClassification(response, {
        image_filename: selectedFile.name,
        image_sha256: validationReport.sha256,
        jurisdiction_code: jurisdictionCode.trim() || activePolicy?.jurisdiction_code || undefined,
      });
    } catch (err) {
      setResult(null);
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to complete classification against inference service.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const backendReady = readiness.readiness === 'ready';

  const getStepState = (index: number): StepState => {
    if (result) return 'completed';
    if (submitError && index >= 2) return index === 3 ? 'error' : 'pending';
    if (isSubmitting) {
      if (index < 2) return 'completed';
      if (index <= 5) return 'active';
      return 'pending';
    }
    if (index === 0) return selectedFile ? 'completed' : 'active';
    if (index === 1) {
      if (!selectedFile) return 'pending';
      if (validationReport && !validationReport.valid) return 'error';
      if (validationReport?.valid) return 'completed';
      return 'active';
    }
    if (index === 2 && selectedFile && validationReport?.valid) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <section aria-label="Classification pipeline progress" className="oi-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="oi-subpanel-title">Classification Pipeline</h3>
          <span className="oi-metadata">
            {result
              ? '7 / 7 Stages Complete'
              : isSubmitting
                ? 'Running Inference'
                : validationReport?.valid
                  ? '2 / 7 Ready to Submit'
                  : '1 / 7 Awaiting Image'}
          </span>
        </div>

        <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 items-stretch">
          {PIPELINE_STEPS.map((label, idx) => {
            const state = getStepState(idx);
            return (
              <li
                key={label}
                className={`rounded-xl px-3 py-2.5 border transition-colors duration-200 flex items-center gap-2 ${
                  state === 'completed'
                    ? 'bg-[#4338CA] border-[#4338CA] text-[#FFFFFF]'
                    : state === 'active'
                      ? 'bg-[#FFFFFF] border-[#4338CA] text-[#171717]'
                      : state === 'error'
                        ? 'bg-[#FDF3F2] border-[#D9534F]/50 text-[#9F2D2A]'
                        : 'bg-[#FCFBF9] border-[#E5E5E5] text-[#737373]'
                }`}
              >
                <span
                  className={`shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-mono font-semibold border ${
                    state === 'completed'
                      ? 'bg-[#FFFFFF] text-[#4338CA] border-[#FFFFFF]'
                      : state === 'active'
                        ? 'bg-[#EEF2FF] text-[#4338CA] border-[#4338CA]/30'
                        : state === 'error'
                          ? 'bg-[#FFFFFF] text-[#D9534F] border-[#D9534F]/40'
                          : 'bg-[#FFFFFF] text-[#737373] border-[#E5E5E5]'
                  }`}
                >
                  {state === 'completed' ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : state === 'error' ? (
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  ) : state === 'active' && isSubmitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="text-xs font-medium leading-tight">{label}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <form onSubmit={handleSubmit} className="lg:col-span-6 oi-panel h-full flex flex-col justify-between gap-5">
          <div className="space-y-5">
            <PanelHeader
              title="Upload Image"
              subtitle="Accepts JPG, JPEG, or PNG files up to 10 MiB (64–8192 px). Keep patient identifiers out of frame."
            />

            {!selectedFile || !previewUrl ? (
              <DragAndDropZone
                disabled={isSubmitting}
                onFileSelected={(f) => void handleFileSelected(f)}
              />
            ) : (
              <ImagePreview
                previewUrl={previewUrl}
                fileName={selectedFile.name}
                disabled={isSubmitting}
                onReplaceFile={(f) => void handleFileSelected(f)}
                onRemove={handleRemove}
              />
            )}

            {validationReport && <ImageValidation report={validationReport} />}

            <div>
              <label
                htmlFor="classify-jurisdiction"
                className="oi-label block mb-1.5"
              >
                Regulatory Jurisdiction Code (Optional)
              </label>
              <input
                id="classify-jurisdiction"
                type="text"
                disabled={isSubmitting}
                value={jurisdictionCode}
                onChange={(e) => setJurisdictionCode(e.target.value)}
                placeholder={activePolicy?.jurisdiction_code || 'e.g., US-OSHA'}
                className="oi-input w-full px-3.5 py-2 font-mono"
              />
            </div>

            {!backendReady && (
              <AlertBanner
                tone="warning"
                title={`Inference service not ready (${readiness.readiness})`}
                message={
                  <div className="space-y-1.5">
                    <p>
                      {readiness.errors[0] ||
                        'Deploy /services/inference-api with exported ONNX artefacts and configure API_BASE_URL.'}
                    </p>
                    <Link
                      to="/settings"
                      className="inline-flex items-center text-xs font-semibold text-[#4338CA] hover:text-[#6366F1] transition-colors"
                    >
                      Configure service in Settings
                    </Link>
                  </div>
                }
              />
            )}

            {submitError && <ErrorState title="Classification failed" message={submitError} />}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <ClassificationSubmitButton
              disabled={!selectedFile || !validationReport?.valid || !backendReady}
              loading={isSubmitting}
            />
          </div>
        </form>

        <div className="lg:col-span-6 oi-panel h-full flex flex-col gap-5">
          <PanelHeader
            title="Classification & Policy Results"
            subtitle="Displays verified backend responses only. Assistive sorting guidance; requires human verification before disposal."
          />

          {isSubmitting ? (
            <InferenceLoadingState />
          ) : result ? (
            <PredictionResult result={result} />
          ) : (
            <div className="oi-tile flex-1 flex flex-col items-center justify-center py-14 px-6 text-center space-y-2.5">
              <p className="oi-card-title">
                Awaiting image upload
              </p>
              <p className="oi-body-sm max-w-[46ch] mx-auto">
                Select a valid JPG or PNG image and start classification to inspect candidate class
                scores, calibration status, and policy routing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
