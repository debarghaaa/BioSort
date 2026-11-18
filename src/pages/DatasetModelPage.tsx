import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Layers,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { PanelHeader } from '../components/common/PanelHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { usePlatformConfig } from '../hooks/usePlatformConfig';
import {
  fetchCurrentModelMetadata,
  fetchMonitoringDashboardFromApi,
} from '../services/api/classificationApi';
import type { LoadedModelMetadata, ModelComparisonItem } from '../types/platform';
import { formatScore } from '../utils/formatters';
import { resolveWasteCategoryVisual } from '../utils/wasteCategories';

const BIOMEDICAL_STREAM_GUIDE = [
  {
    key: 'yellow',
    title: 'Yellow Category',
    subtitle: 'Infectious & Anatomical Waste',
    sampleCode: 'yellow_infectious',
    description:
      'Soiled dressings, swabs, anatomical waste, or infectious clinical disposables designated for thermal treatment.',
  },
  {
    key: 'red',
    title: 'Red Category',
    subtitle: 'Contaminated Plastic & Tubing',
    sampleCode: 'red_plastic',
    description:
      'Contaminated recyclable plastics including IV tubing, catheters, urine bags, and non-sharp plastic disposables.',
  },
  {
    key: 'white',
    title: 'White / Sharps',
    subtitle: 'Puncture-Proof Sharps Waste',
    sampleCode: 'white_sharps',
    description:
      'Needles, scalpels, blades, and fixed-needle syringes routed to puncture-proof translucent sharps containers.',
  },
  {
    key: 'blue',
    title: 'Blue Category',
    subtitle: 'Glassware & Metallic Implants',
    sampleCode: 'blue_glassware',
    description:
      'Broken or unbroken medical vials, ampoules, and contaminated glass or metallic items requiring dedicated containment.',
  },
];

export function DatasetModelPage() {
  const { auth } = useAuth();
  const { config, readiness, checkingReadiness, refreshReadiness } = usePlatformConfig();

  const [modelMeta, setModelMeta] = useState<LoadedModelMetadata | null>(null);
  const [registryModels, setRegistryModels] = useState<ModelComparisonItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModelAndRegistry = useCallback(async () => {
    if (!config.apiBaseUrl) {
      setModelMeta(null);
      setRegistryModels([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [metaResult, dashResult] = await Promise.allSettled([
        readiness.readiness === 'ready'
          ? fetchCurrentModelMetadata({
              baseUrl: config.apiBaseUrl,
              accessToken: auth.accessToken,
            })
          : Promise.resolve(null),
        fetchMonitoringDashboardFromApi({
          baseUrl: config.apiBaseUrl,
          accessToken: auth.accessToken,
        }),
      ]);

      if (metaResult.status === 'fulfilled') {
        setModelMeta(metaResult.value);
      } else {
        setModelMeta(null);
        setError(
          metaResult.reason instanceof Error
            ? metaResult.reason.message
            : 'Unable to retrieve loaded ONNX model metadata.'
        );
      }

      if (dashResult.status === 'fulfilled') {
        setRegistryModels(dashResult.value.model_version_comparison || []);
      } else {
        setRegistryModels([]);
      }
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, config.apiBaseUrl, readiness.readiness]);

  useEffect(() => {
    void loadModelAndRegistry();
  }, [loadModelAndRegistry]);

  const activeRegistryEntry =
    registryModels.find((m) => m.model_version === (modelMeta?.model_version || readiness.model_version)) ||
    registryModels[0] ||
    null;

  const evalMetrics = activeRegistryEntry?.training_eval_metrics || {};

  const renderSplitValue = (splitKey: string) => {
    const val = evalMetrics[splitKey];
    if (val === undefined || val === null) {
      return 'Not yet recorded in model registry';
    }
    if (typeof val === 'number') {
      return val <= 1 ? `${(val * 100).toFixed(2)}%` : String(val);
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return String(val);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dataset & Model Governance"
        description="Inspect loaded ONNX Runtime artefacts, preprocessing specifications, biomedical waste streams, and recorded offline evaluation splits."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                void refreshReadiness();
                void loadModelAndRegistry();
              }}
              disabled={checkingReadiness || loading}
              className="oi-btn-secondary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${checkingReadiness || loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh Model State</span>
            </button>
            <Link
              to="/classify"
              className="oi-btn-primary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap shrink-0"
            >
              <Cpu className="h-4 w-4" aria-hidden="true" />
              <span>Test Inference</span>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <MetricCard
          label="Active Model Version"
          value={modelMeta?.model_version || readiness.model_version || 'Unavailable'}
          sublabel={readiness.model_loaded ? 'Loaded at startup' : 'Model artefact not loaded'}
          tone={readiness.model_loaded ? 'sky' : 'neutral'}
        />
        <MetricCard
          label="Runtime Engine"
          value={activeRegistryEntry?.framework || 'ONNX Runtime (CPU)'}
          sublabel={modelMeta ? `Input: ${modelMeta.input_name}` : 'Connect API to inspect tensor'}
          tone="neutral"
        />
        <MetricCard
          label="Classifier Classes"
          value={modelMeta ? modelMeta.class_names.length : config.taxonomyClasses.length || 'Unavailable'}
          sublabel={modelMeta ? 'Verified from CLASS_NAMES_PATH' : 'Local taxonomy fallback'}
          tone="emerald"
        />
        <MetricCard
          label="Backend Readiness"
          value={readiness.readiness === 'ready' ? 'Ready' : readiness.readiness}
          sublabel={config.apiBaseUrl || 'API URL unconfigured'}
          tone={readiness.readiness === 'ready' ? 'emerald' : 'amber'}
        />
      </div>

      {error && (
        <ErrorState
          title="Model Metadata Request Failed"
          message={error}
          onRetry={() => void loadModelAndRegistry()}
        />
      )}

      {loading ? (
        <LoadingState title="Inspecting ONNX model metadata and evaluation registry..." />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <section className="lg:col-span-6 oi-panel h-full flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <PanelHeader
                  title="Dataset Overview & Feedback Loop"
                  subtitle="Offline Colab training lineage separated from live review exports."
                  icon={<Database className="h-4 w-4" aria-hidden="true" />}
                  meta={<span className="oi-metadata">Colab → ONNX</span>}
                />

                <div className="oi-tile oi-component-subtitle space-y-2">
                  <p>
                    Model training runs offline in{' '}
                    <strong className="font-semibold text-[#171717]">Google Colab + PyTorch</strong>{' '}
                    over curated biomedical waste imagery and exports static{' '}
                    <code className="font-mono text-[#171717]">.onnx</code> weights with
                    preprocessing and calibration metadata.
                  </p>
                  <p>
                    Manual review corrections are never folded into live model weights automatically;
                    explicitly approved records are exported via JSON manifest for separate offline
                    retraining.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <div className="oi-tile space-y-1">
                  <dt className="oi-component-subtitle">Configured Local Classes</dt>
                  <dd className="oi-numerical-sm">{config.taxonomyClasses.length}</dd>
                </div>
                <div className="oi-tile space-y-1">
                  <dt className="oi-component-subtitle">Verified Bin Mappings</dt>
                  <dd className="oi-numerical-sm">
                    {config.binMappings.filter((m) => m.verification_status === 'verified').length}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="lg:col-span-6 oi-panel h-full flex flex-col gap-4">
              <PanelHeader
                title="Model Information & Tensor Contract"
                subtitle="Active ONNX input/output bindings and preprocessing parameters."
                icon={<FileCode2 className="h-4 w-4" aria-hidden="true" />}
                meta={<StatusBadge status={readiness.readiness} />}
              />

              {modelMeta ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <dl className="grid grid-cols-2 gap-3">
                    <div className="oi-tile space-y-1">
                      <dt className="oi-component-subtitle">Input Tensor</dt>
                      <dd className="oi-metadata text-[#171717] font-medium truncate">
                        {modelMeta.input_name} [{modelMeta.input_shape.join(', ')}]
                      </dd>
                    </div>
                    <div className="oi-tile space-y-1">
                      <dt className="oi-component-subtitle">Output Tensor</dt>
                      <dd className="oi-metadata text-[#171717] font-medium truncate">
                        {modelMeta.output_name}
                      </dd>
                    </div>
                  </dl>

                  <div className="oi-tile space-y-1.5">
                    <p className="oi-subpanel-title">Preprocessing &amp; Calibration Spec</p>
                    <pre className="oi-metadata overflow-x-auto leading-relaxed">
                      {JSON.stringify(
                        {
                          preprocessing: modelMeta.preprocessing,
                          confidence_calibration: modelMeta.confidence_calibration,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center">
                  <EmptyState
                    title="Loaded ONNX artefact metadata unavailable"
                    description="Connect a running FastAPI inference service in Settings to inspect live tensor shapes, preprocessing config, and class index mappings."
                  />
                </div>
              )}
            </section>
          </div>

          <section className="oi-panel space-y-5">
            <PanelHeader
              title="Supported Biomedical Waste Categories"
              subtitle="Color-coded clinical streams paired with semantic icons and explicit text labels."
              icon={<Layers className="h-4 w-4" aria-hidden="true" />}
              meta={
                <Link
                  to="/settings"
                  className="text-sm font-medium text-[#4338CA] hover:text-[#6366F1] transition-colors whitespace-nowrap"
                >
                  Manage Taxonomy
                </Link>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {BIOMEDICAL_STREAM_GUIDE.map((stream) => {
                const visual = resolveWasteCategoryVisual(stream.sampleCode);
                const Icon = visual.icon;
                return (
                  <div
                    key={stream.key}
                    className="oi-tile h-full flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border shrink-0"
                          style={{
                            backgroundColor: visual.bgTintHex,
                            borderColor: visual.borderHex,
                            color: visual.textHex,
                          }}
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <h4 className="oi-subpanel-title truncate">{stream.title}</h4>
                          <p className="oi-metadata truncate">{stream.subtitle}</p>
                        </div>
                      </div>
                      <p className="oi-component-subtitle">{stream.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {modelMeta && modelMeta.class_names.length > 0 && (
              <div className="oi-tile space-y-1.5">
                <p className="oi-subpanel-title">
                  Active ONNX Model Class Vector ({modelMeta.class_names.length} classes)
                </p>
                <p className="oi-metadata">{modelMeta.class_names.join(' · ')}</p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <section className="lg:col-span-6 oi-panel h-full flex flex-col gap-4">
              <PanelHeader
                title="Classification & Decision Methodology"
                subtitle="Four-stage validation, ONNX pass, confidence gating, and mapping policy flow."
                icon={<GitBranch className="h-4 w-4" aria-hidden="true" />}
              />

              <ol className="space-y-3">
                {[
                  {
                    step: '01',
                    title: 'Image Validation & Preprocessing',
                    detail:
                      'Verifies magic bytes, MIME encoding, SHA-256 fingerprint, dimensions (64–8192 px), and applies Colab-matched RGB normalization.',
                  },
                  {
                    step: '02',
                    title: 'ONNX Runtime Forward Pass',
                    detail:
                      'Executes the startup-loaded ONNX graph and outputs ranked candidate scores across the active taxonomy.',
                  },
                  {
                    step: '03',
                    title: 'Confidence Calibration & Margin Gate',
                    detail:
                      'Evaluates calibrated confidence against accept/review thresholds and minimum top-2 score margin; uncertain cases route to Manual Review.',
                  },
                  {
                    step: '04',
                    title: 'Regulatory Bin Mapping Verification',
                    detail:
                      'Only verified jurisdiction-to-bin mappings emit an accepted recommendation; unconfigured classes trigger mapping_unconfigured.',
                  },
                ].map((item) => (
                  <li key={item.step} className="oi-tile flex items-start gap-3">
                    <span className="oi-metadata font-semibold text-[#4338CA] bg-[#4338CA]/10 border border-[#4338CA]/20 px-2 py-0.5 rounded-md shrink-0">
                      {item.step}
                    </span>
                    <div className="space-y-1">
                      <p className="oi-subpanel-title">{item.title}</p>
                      <p className="oi-component-subtitle">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="lg:col-span-6 oi-panel h-full flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <PanelHeader
                  title="Evaluation Metrics (Training / Validation / Test)"
                  subtitle="Offline split metrics separated cleanly from live operational confidence scores."
                  icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                  meta={<span className="oi-metadata">Registry Source</span>}
                />

                <p className="oi-component-subtitle">
                  Offline dataset split metrics load strictly from persisted{' '}
                  <code className="font-mono text-[#171717]">model_versions.training_eval_metrics</code>{' '}
                  and stay separate from live prediction scores.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                  <div className="oi-tile h-full flex flex-col justify-between gap-1.5">
                    <span className="oi-component-subtitle font-medium">Training Split</span>
                    <p className="oi-subpanel-title font-mono break-words">
                      {renderSplitValue('train')}
                    </p>
                  </div>
                  <div className="oi-tile h-full flex flex-col justify-between gap-1.5">
                    <span className="oi-component-subtitle font-medium">Validation Split</span>
                    <p className="oi-subpanel-title font-mono break-words">
                      {renderSplitValue('validation')}
                    </p>
                  </div>
                  <div className="oi-tile h-full flex flex-col justify-between gap-1.5">
                    <span className="oi-component-subtitle font-medium">Held-Out Test Split</span>
                    <p className="oi-subpanel-title font-mono break-words">
                      {renderSplitValue('test')}
                    </p>
                  </div>
                </div>
              </div>

              {registryModels.length > 0 && (
                <div className="oi-inset-sm overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-[#E5E5E5] bg-[#FFFFFF] text-[#737373]">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Version</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-right font-medium px-3 py-2">Live Events</th>
                        <th className="text-right font-medium px-3 py-2">Mean Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      {registryModels.map((m) => (
                        <tr key={m.model_version}>
                          <td className="px-3 py-2 font-mono font-semibold text-[#171717]">
                            {m.model_version}
                          </td>
                          <td className="px-3 py-2 capitalize text-[#525252]">
                            {m.deployment_status}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-[#171717]">
                            {m.total_classifications}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-[#737373]">
                            {formatScore(m.average_model_score)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
