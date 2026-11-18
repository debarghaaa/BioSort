import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AlertBanner } from '../../components/common/AlertBanner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { PanelHeader } from '../../components/common/PanelHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import { fetchCurrentModelMetadata } from '../../services/api/classificationApi';
import {
  MappingVerificationStatus,
  UserRole,
  type LoadedModelMetadata,
} from '../../types/platform';
import { formatTimestamp } from '../../utils/formatters';
import { resolveWasteCategoryVisual } from '../../utils/wasteCategories';

export function SettingsPanel() {
  const { auth } = useAuth();
  const {
    config,
    readiness,
    checkingReadiness,
    activePolicy,
    refreshReadiness,
    setApiBaseUrl,
    addTaxonomyClass,
    addBinMapping,
    updateMappingVerification,
    addConfidencePolicy,
    activatePolicy,
    resetLocalConfig,
  } = usePlatformConfig();

  const isAdmin = auth.role === UserRole.ADMIN;

  const [apiInput, setApiInput] = useState(config.apiBaseUrl);
  const [modelMeta, setModelMeta] = useState<LoadedModelMetadata | null>(null);
  const [modelMetaError, setModelMetaError] = useState<string | null>(null);

  // Taxonomy form
  const [className, setClassName] = useState('');
  const [displayLabel, setDisplayLabel] = useState('');
  const [parentCategory, setParentCategory] = useState('');
  const [colorHex, setColorHex] = useState('');
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  // Mapping form
  const [mapJurisdiction, setMapJurisdiction] = useState('');
  const [mapClass, setMapClass] = useState('');
  const [mapBinCode, setMapBinCode] = useState('');
  const [mapBinLabel, setMapBinLabel] = useState('');
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Confidence Policy form
  const [policyName, setPolicyName] = useState('');
  const [policyJurisdiction, setPolicyJurisdiction] = useState('');
  const [acceptThreshold, setAcceptThreshold] = useState('0.85');
  const [reviewFloor, setReviewFloor] = useState('0.50');
  const [minMargin, setMinMargin] = useState('0.15');
  const [requireCalibrated, setRequireCalibrated] = useState(true);
  const [rationale, setRationale] = useState('');
  const [policyError, setPolicyError] = useState<string | null>(null);

  useEffect(() => {
    setApiInput(config.apiBaseUrl);
  }, [config.apiBaseUrl]);

  useEffect(() => {
    if (!config.apiBaseUrl || readiness.readiness !== 'ready') {
      setModelMeta(null);
      setModelMetaError(null);
      return;
    }
    void fetchCurrentModelMetadata({
      baseUrl: config.apiBaseUrl,
      accessToken: auth.accessToken,
    })
      .then((meta) => {
        setModelMeta(meta);
        setModelMetaError(null);
      })
      .catch((err) => {
        setModelMeta(null);
        setModelMetaError(err instanceof Error ? err.message : 'Unable to load model metadata.');
      });
  }, [auth.accessToken, config.apiBaseUrl, readiness.readiness]);

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(apiInput);
    setTimeout(() => {
      void refreshReadiness();
    }, 50);
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    setTaxonomyError(null);
    const err = addTaxonomyClass({
      class_name: className,
      display_label: displayLabel,
      parent_category: parentCategory,
      description: '',
      color_hex: colorHex,
    });
    if (err) {
      setTaxonomyError(err);
      return;
    }
    setClassName('');
    setDisplayLabel('');
    setParentCategory('');
    setColorHex('');
  };

  const handleAddMapping = (e: React.FormEvent) => {
    e.preventDefault();
    setMappingError(null);
    const err = addBinMapping({
      jurisdiction_code: mapJurisdiction,
      class_name: mapClass,
      target_bin_code: mapBinCode,
      target_bin_label: mapBinLabel,
      handling_notes: '',
    });
    if (err) {
      setMappingError(err);
      return;
    }
    setMapBinCode('');
    setMapBinLabel('');
  };

  const handleAddPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyError(null);
    const err = addConfidencePolicy({
      policy_name: policyName,
      jurisdiction_code: policyJurisdiction,
      accept_threshold: Number(acceptThreshold),
      review_floor_threshold: Number(reviewFloor),
      require_calibrated_confidence: requireCalibrated,
      minimum_margin_over_second: Number(minMargin),
      documented_rationale: rationale,
    });
    if (err) {
      setPolicyError(err);
      return;
    }
    setPolicyName('');
    setRationale('');
  };

  return (
    <div className="space-y-6">
      <section className="oi-panel space-y-4">
        <PanelHeader
          title="Inference Service Connection"
          subtitle={
            <>
              Configures <code className="font-mono text-[#171717]">API_BASE_URL</code> and checks{' '}
              <code className="font-mono text-[#171717]">/health</code> and{' '}
              <code className="font-mono text-[#171717]">/ready</code>.
            </>
          }
          meta={<StatusBadge status={readiness.readiness} />}
        />

        <form onSubmit={handleSaveEndpoint} className="flex flex-wrap items-center gap-3">
          <input
            type="url"
            aria-label="API Base URL"
            value={apiInput}
            onChange={(e) => setApiInput(e.target.value)}
            placeholder="http://localhost:8000"
            className="oi-input flex-1 min-w-[240px] px-3.5 py-2 font-mono text-[13px]"
          />
          <button
            type="submit"
            disabled={checkingReadiness}
            className="oi-btn-primary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${checkingReadiness ? 'animate-spin' : ''}`} />
            <span>Save &amp; Check Readiness</span>
          </button>
        </form>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
          <div className="oi-tile h-full flex flex-col justify-between gap-1">
            <dt className="oi-component-subtitle">Liveness</dt>
            <dd className="oi-metadata font-semibold text-[#171717]">{readiness.liveness}</dd>
          </div>
          <div className="oi-tile h-full flex flex-col justify-between gap-1">
            <dt className="oi-component-subtitle">Model Loaded</dt>
            <dd className="oi-metadata font-semibold text-[#171717]">
              {readiness.model_loaded ? readiness.model_version : 'No'}
            </dd>
          </div>
          <div className="oi-tile h-full flex flex-col justify-between gap-1">
            <dt className="oi-component-subtitle">JWT Verification</dt>
            <dd className="oi-metadata font-semibold text-[#171717]">
              {readiness.jwt_configured ? 'Configured' : 'Missing'}
            </dd>
          </div>
          <div className="oi-tile h-full flex flex-col justify-between gap-1">
            <dt className="oi-component-subtitle">PostgreSQL DB</dt>
            <dd className="oi-metadata font-semibold text-[#171717]">
              {readiness.supabase_connected ? 'Connected' : 'Disconnected'}
            </dd>
          </div>
        </dl>

        {readiness.errors.length > 0 && (
          <AlertBanner
            tone="warning"
            message={
              <div className="space-y-1">
                {readiness.errors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            }
          />
        )}

        {modelMetaError && <ErrorState message={modelMetaError} />}
        {modelMeta && (
          <div className="border-t border-[#E5E5E5] pt-3 space-y-1">
            <p className="oi-subpanel-title">
              Loaded Model Metadata (<span className="font-mono">{modelMeta.model_version}</span>)
            </p>
            <p className="oi-metadata">
              Classes ({modelMeta.class_names.length}): {modelMeta.class_names.join(', ')}
            </p>
          </div>
        )}
      </section>

      {!isAdmin && (
        <AlertBanner
          tone="info"
          message={
            <span>
              Taxonomy, category-to-bin mappings, and threshold policy edits require the{' '}
              <strong>Admin</strong> role. Active role:{' '}
              <strong className="font-mono">{auth.role}</strong>.
            </span>
          }
        />
      )}

      <section className="oi-panel space-y-4">
        <PanelHeader
          title="Waste Taxonomy & Visual Identifiers"
          subtitle="Configure canonical class codes, display labels, and optional colour swatches paired with icons and text."
        />

        <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {taxonomyError && (
            <div className="sm:col-span-5">
              <ErrorState message={taxonomyError} />
            </div>
          )}
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="class_code"
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={displayLabel}
            onChange={(e) => setDisplayLabel(e.target.value)}
            placeholder="Display Label"
            className="oi-input px-3 py-2 text-xs"
          />
          <input
            type="text"
            disabled={!isAdmin}
            value={parentCategory}
            onChange={(e) => setParentCategory(e.target.value)}
            placeholder="Category Group"
            className="oi-input px-3 py-2 text-xs"
          />
          <input
            type="text"
            disabled={!isAdmin}
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            placeholder="Swatch #Hex (optional)"
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <button
            type="submit"
            disabled={!isAdmin}
            className="oi-btn-primary px-4 py-2"
          >
            Add Class
          </button>
        </form>

        {config.taxonomyClasses.length === 0 ? (
          <EmptyState
            title="No taxonomy classes configured"
            description="Add canonical classifier class codes matching your exported ONNX model artefacts."
          />
        ) : (
          <div className="oi-inset-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[#E5E5E5] bg-[#FFFFFF] text-[#737373]">
                <tr>
                  <th className="text-left font-medium px-3.5 py-2.5">Class Code</th>
                  <th className="text-left font-medium px-3.5 py-2.5">Display Label</th>
                  <th className="text-left font-medium px-3.5 py-2.5">Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] bg-[#FFFFFF]">
                {config.taxonomyClasses.map((cls) => {
                  const swatch = config.categoryAppearances[cls.class_name]?.color_hex;
                  const visual = resolveWasteCategoryVisual(cls.class_name, swatch);
                  const Icon = visual.icon;
                  return (
                    <tr key={cls.id}>
                      <td className="px-3.5 py-2.5 font-mono text-[#171717]">{cls.class_name}</td>
                      <td className="px-3.5 py-2.5 text-[#171717]">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-md border shrink-0"
                            style={{
                              backgroundColor: visual.bgTintHex,
                              borderColor: visual.borderHex,
                              color: visual.textHex,
                            }}
                            aria-hidden="true"
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <span>{cls.display_label}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[#737373]">{cls.parent_category}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="oi-panel space-y-4">
        <PanelHeader
          title="Regulatory Category-to-Bin Mappings"
          subtitle={
            <>
              Only <strong className="font-semibold text-[#171717]">Verified</strong> mappings emit a destination bin
              recommendation.
            </>
          }
        />

        <form onSubmit={handleAddMapping} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {mappingError && (
            <div className="sm:col-span-5">
              <ErrorState message={mappingError} />
            </div>
          )}
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={mapJurisdiction}
            onChange={(e) => setMapJurisdiction(e.target.value)}
            placeholder="Policy / Jurisdiction"
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <select
            required
            disabled={!isAdmin || config.taxonomyClasses.length === 0}
            value={mapClass}
            onChange={(e) => setMapClass(e.target.value)}
            className="oi-input px-3 py-2 text-xs font-mono"
          >
            <option value="">Select Class</option>
            {config.taxonomyClasses.map((c) => (
              <option key={c.id} value={c.class_name}>
                {c.class_name}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={mapBinCode}
            onChange={(e) => setMapBinCode(e.target.value)}
            placeholder="Bin Code"
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={mapBinLabel}
            onChange={(e) => setMapBinLabel(e.target.value)}
            placeholder="Bin Display Name"
            className="oi-input px-3 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={!isAdmin || config.taxonomyClasses.length === 0}
            className="oi-btn-primary px-4 py-2"
          >
            Add Pending Mapping
          </button>
        </form>

        {config.binMappings.length > 0 && (
          <div className="oi-inset-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[#E5E5E5] bg-[#FFFFFF] text-[#737373]">
                <tr>
                  <th className="text-left font-medium px-3.5 py-2.5">Policy</th>
                  <th className="text-left font-medium px-3.5 py-2.5">Class</th>
                  <th className="text-left font-medium px-3.5 py-2.5">Destination</th>
                  <th className="text-left font-medium px-3.5 py-2.5">Status</th>
                  <th className="text-right font-medium px-3.5 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] bg-[#FFFFFF]">
                {config.binMappings.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3.5 py-2.5 font-mono text-[#171717]">{m.jurisdiction_code}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[#171717]">{m.class_name}</td>
                    <td className="px-3.5 py-2.5 text-[#171717]">
                      <span className="font-mono font-semibold">{m.target_bin_code}</span> —{' '}
                      {m.target_bin_label}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={m.verification_status} />
                    </td>
                    <td className="px-3.5 py-2.5 text-right space-x-2">
                      {m.verification_status !== MappingVerificationStatus.VERIFIED && (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() =>
                            updateMappingVerification(m.id, MappingVerificationStatus.VERIFIED)
                          }
                          className="oi-btn-secondary px-3 py-1.5 text-xs font-semibold text-[#171717]"
                        >
                          Verify
                        </button>
                      )}
                      {m.verification_status !== MappingVerificationStatus.DEPRECATED && (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() =>
                            updateMappingVerification(m.id, MappingVerificationStatus.DEPRECATED)
                          }
                          className="oi-btn-secondary px-3 py-1.5 text-xs font-semibold text-[#737373]"
                        >
                          Disable
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="oi-panel space-y-4">
        <PanelHeader
          title="Confidence Policy & Local Draft Audit"
          subtitle={
            activePolicy
              ? `Active Policy: ${activePolicy.policy_name} (${activePolicy.jurisdiction_code})`
              : 'No local confidence policy configured.'
          }
          meta={
            <button
              type="button"
              onClick={resetLocalConfig}
              className="oi-btn-secondary px-3.5 py-2"
            >
              Reset Local Configuration
            </button>
          }
        />

        <form onSubmit={handleAddPolicy} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          {policyError && (
            <div className="sm:col-span-6">
              <ErrorState message={policyError} />
            </div>
          )}
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={policyName}
            onChange={(e) => setPolicyName(e.target.value)}
            placeholder="Policy Name"
            className="sm:col-span-2 oi-input px-3 py-2 text-xs"
          />
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={policyJurisdiction}
            onChange={(e) => setPolicyJurisdiction(e.target.value)}
            placeholder="Jurisdiction"
            className="oi-input px-3 py-2 text-xs font-mono"
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="1"
            required
            disabled={!isAdmin}
            value={acceptThreshold}
            onChange={(e) => setAcceptThreshold(e.target.value)}
            aria-label="Accept threshold"
            className="oi-input px-3 py-2 text-xs font-mono tabular-nums"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            required
            disabled={!isAdmin}
            value={reviewFloor}
            onChange={(e) => setReviewFloor(e.target.value)}
            aria-label="Review floor threshold"
            className="oi-input px-3 py-2 text-xs font-mono tabular-nums"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            required
            disabled={!isAdmin}
            value={minMargin}
            onChange={(e) => setMinMargin(e.target.value)}
            aria-label="Minimum margin over second"
            className="oi-input px-3 py-2 text-xs font-mono tabular-nums"
          />
          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-[#171717] cursor-pointer">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={requireCalibrated}
              onChange={(e) => setRequireCalibrated(e.target.checked)}
              className="accent-[#4338CA]"
            />
            <span>Require calibrated confidence</span>
          </label>
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Documented validation rationale"
            className="sm:col-span-3 oi-input px-3 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={!isAdmin}
            className="oi-btn-primary px-4 py-2"
          >
            Save Policy
          </button>
        </form>

        {config.confidencePolicies.length > 0 && (
          <div className="space-y-2.5">
            {config.confidencePolicies.map((pol) => (
              <div
                key={pol.id}
                className="oi-inset-sm flex items-center justify-between p-3.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#171717]">{pol.policy_name}</span>
                  <span className="font-mono text-[#737373] ml-2">
                    {pol.jurisdiction_code} · Accept ≥ {pol.accept_threshold.toFixed(2)}
                  </span>
                </div>
                {pol.is_active ? (
                  <span className="font-semibold text-[#238B68]">Active</span>
                ) : (
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => activatePolicy(pol.id)}
                    className="oi-btn-secondary px-3 py-1.5 text-xs font-semibold text-[#171717]"
                  >
                    Activate
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {config.sessionAuditLogs.length > 0 && (
          <div className="border-t border-[#E5E5E5] pt-4 space-y-2">
            <h4 className="oi-subpanel-title">Session Configuration Audit</h4>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {config.sessionAuditLogs.map((log) => (
                <div key={log.id} className="flex justify-between gap-4 oi-component-subtitle">
                  <span>
                    <span className="font-mono text-[#171717]">{log.action_type}</span> —{' '}
                    {log.summary}
                  </span>
                  <span className="oi-metadata whitespace-nowrap">
                    {formatTimestamp(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
