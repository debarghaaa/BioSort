import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_API_BASE_URL,
  probeBackendHealthAndReadiness,
} from '../services/api/classificationApi';
import {
  containsBannedOutcomeTerm,
  MappingVerificationStatus,
  UserRole,
  type AuditLogRecord,
  type ClassificationRecordItem,
  type ConfidencePolicyConfig,
  type ConfiguredCategoryAppearance,
  type ManualBinStatusNote,
  type ModelVersionRecord,
  type ReadinessProbeResult,
  type RegulatoryBinMapping,
  type SharedClassificationResult,
  type WasteTaxonomyClass,
} from '../types/platform';
import { isValidHexColor } from '../utils/formatters';
import { useAuth } from './useAuth';

const CONFIG_STORAGE_KEY = 'medwaste_platform_config_v2';

interface PlatformConfigState {
  apiBaseUrl: string;
  taxonomyClasses: WasteTaxonomyClass[];
  categoryAppearances: Record<string, ConfiguredCategoryAppearance>;
  binMappings: RegulatoryBinMapping[];
  confidencePolicies: ConfidencePolicyConfig[];
  modelVersions: ModelVersionRecord[];
  manualBinLogs: ManualBinStatusNote[];
  sessionAuditLogs: AuditLogRecord[];
  sessionRecentClassifications: ClassificationRecordItem[];
}

const DEFAULT_STATE: PlatformConfigState = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  taxonomyClasses: [],
  categoryAppearances: {},
  binMappings: [],
  confidencePolicies: [],
  modelVersions: [],
  manualBinLogs: [],
  sessionAuditLogs: [],
  sessionRecentClassifications: [],
};

function loadConfigState(): PlatformConfigState {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PlatformConfigState>;
    return {
      apiBaseUrl:
        typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : DEFAULT_API_BASE_URL,
      taxonomyClasses: Array.isArray(parsed.taxonomyClasses) ? parsed.taxonomyClasses : [],
      categoryAppearances:
        parsed.categoryAppearances && typeof parsed.categoryAppearances === 'object'
          ? parsed.categoryAppearances
          : {},
      binMappings: Array.isArray(parsed.binMappings) ? parsed.binMappings : [],
      confidencePolicies: Array.isArray(parsed.confidencePolicies)
        ? parsed.confidencePolicies
        : [],
      modelVersions: Array.isArray(parsed.modelVersions) ? parsed.modelVersions : [],
      manualBinLogs: Array.isArray(parsed.manualBinLogs) ? parsed.manualBinLogs : [],
      sessionAuditLogs: Array.isArray(parsed.sessionAuditLogs) ? parsed.sessionAuditLogs : [],
      sessionRecentClassifications: Array.isArray(parsed.sessionRecentClassifications)
        ? parsed.sessionRecentClassifications
        : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

interface PlatformConfigContextValue {
  config: PlatformConfigState;
  readiness: ReadinessProbeResult;
  checkingReadiness: boolean;
  activePolicy: ConfidencePolicyConfig | null;
  refreshReadiness: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  addTaxonomyClass: (input: {
    class_name: string;
    display_label: string;
    parent_category: string;
    description: string;
    color_hex?: string;
  }) => string | null;
  addBinMapping: (input: {
    jurisdiction_code: string;
    class_name: string;
    target_bin_code: string;
    target_bin_label: string;
    handling_notes: string;
  }) => string | null;
  updateMappingVerification: (id: string, status: MappingVerificationStatus) => string | null;
  addConfidencePolicy: (input: {
    policy_name: string;
    jurisdiction_code: string;
    accept_threshold: number;
    review_floor_threshold: number;
    require_calibrated_confidence: boolean;
    minimum_margin_over_second: number;
    documented_rationale: string;
  }) => string | null;
  activatePolicy: (id: string) => void;
  recordSessionClassification: (
    result: SharedClassificationResult,
    meta: { image_filename?: string; image_sha256?: string | null; jurisdiction_code?: string }
  ) => void;
  recordManualBinStatus: (binCode: string, statusNote: string) => string | null;
  getCategoryAppearance: (className: string | null) => ConfiguredCategoryAppearance | null;
  resetLocalConfig: () => void;
}

const PlatformConfigContext = createContext<PlatformConfigContextValue | null>(null);

export function PlatformConfigProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const [config, setConfig] = useState<PlatformConfigState>(loadConfigState);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessProbeResult>({
    reachable: false,
    liveness: 'unconfigured',
    readiness: 'unconfigured',
    model_loaded: false,
    model_version: null,
    jwt_configured: false,
    supabase_connected: false,
    errors: ['Checking backend readiness...'],
  });

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota issues
    }
  }, [config]);

  const refreshReadiness = useCallback(async () => {
    setCheckingReadiness(true);
    try {
      const probe = await probeBackendHealthAndReadiness(config.apiBaseUrl);
      setReadiness(probe);
    } finally {
      setCheckingReadiness(false);
    }
  }, [config.apiBaseUrl]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  const appendAudit = useCallback(
    (
      prev: PlatformConfigState,
      actionType: string,
      entityType: string,
      entityId: string,
      summary: string,
      payload: Record<string, unknown> = {}
    ): AuditLogRecord[] => [
      {
        id: crypto.randomUUID(),
        actor_role: auth.role,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        summary,
        payload,
        created_at: new Date().toISOString(),
      },
      ...prev.sessionAuditLogs,
    ],
    [auth.role]
  );

  const setApiBaseUrl = useCallback((url: string) => {
    setConfig((prev) => ({ ...prev, apiBaseUrl: url.trim().replace(/\/+$/, '') }));
  }, []);

  const addTaxonomyClass = useCallback(
    (input: {
      class_name: string;
      display_label: string;
      parent_category: string;
      description: string;
      color_hex?: string;
    }): string | null => {
      if (auth.role !== UserRole.ADMIN) {
        return 'Administrator permission is required to modify waste taxonomy classes.';
      }
      const normalized = input.class_name.trim().toLowerCase().replace(/\s+/g, '_');
      if (!normalized || !input.display_label.trim()) {
        return 'Class identifier and display label are required.';
      }
      if (
        containsBannedOutcomeTerm(normalized) ||
        containsBannedOutcomeTerm(input.display_label)
      ) {
        return 'Prohibited terms ("safe", "sterile", "medically approved") cannot be used.';
      }
      if (config.taxonomyClasses.some((c) => c.class_name === normalized)) {
        return `Class "${normalized}" already exists.`;
      }

      const colorHex = isValidHexColor(input.color_hex) ? input.color_hex!.trim() : null;
      const newClass: WasteTaxonomyClass = {
        id: crypto.randomUUID(),
        class_name: normalized,
        display_label: input.display_label.trim(),
        parent_category: input.parent_category.trim() || 'General',
        description: input.description.trim(),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setConfig((prev) => ({
        ...prev,
        taxonomyClasses: [newClass, ...prev.taxonomyClasses],
        categoryAppearances: {
          ...prev.categoryAppearances,
          [normalized]: {
            class_name: normalized,
            display_label: newClass.display_label,
            color_hex: colorHex,
          },
        },
        sessionAuditLogs: appendAudit(
          prev,
          'TAXONOMY_CLASS_ADDED',
          'waste_taxonomy_classes',
          newClass.id,
          `Added taxonomy class ${normalized}`
        ),
      }));
      return null;
    },
    [appendAudit, auth.role, config.taxonomyClasses]
  );

  const addBinMapping = useCallback(
    (input: {
      jurisdiction_code: string;
      class_name: string;
      target_bin_code: string;
      target_bin_label: string;
      handling_notes: string;
    }): string | null => {
      if (auth.role !== UserRole.ADMIN) {
        return 'Administrator permission is required to configure category-to-bin mappings.';
      }
      if (
        !input.jurisdiction_code.trim() ||
        !input.class_name.trim() ||
        !input.target_bin_code.trim() ||
        !input.target_bin_label.trim()
      ) {
        return 'Jurisdiction, taxonomy class, bin code, and bin label are required.';
      }
      if (
        containsBannedOutcomeTerm(input.target_bin_code) ||
        containsBannedOutcomeTerm(input.target_bin_label)
      ) {
        return 'Prohibited terms ("safe", "sterile", "medically approved") cannot be used.';
      }

      const record: RegulatoryBinMapping = {
        id: crypto.randomUUID(),
        jurisdiction_code: input.jurisdiction_code.trim().toUpperCase(),
        class_name: input.class_name.trim(),
        target_bin_code: input.target_bin_code.trim().toUpperCase(),
        target_bin_label: input.target_bin_label.trim(),
        handling_notes: input.handling_notes.trim(),
        verification_status: MappingVerificationStatus.UNVERIFIED,
        verified_by: null,
        verified_at: null,
        updated_at: new Date().toISOString(),
      };

      setConfig((prev) => ({
        ...prev,
        binMappings: [record, ...prev.binMappings],
        sessionAuditLogs: appendAudit(
          prev,
          'BIN_MAPPING_CREATED',
          'category_bin_mappings',
          record.id,
          `Created unverified mapping ${record.class_name} -> ${record.target_bin_code}`
        ),
      }));
      return null;
    },
    [appendAudit, auth.role]
  );

  const updateMappingVerification = useCallback(
    (id: string, status: MappingVerificationStatus): string | null => {
      if (auth.role !== UserRole.ADMIN) {
        return 'Administrator permission is required to verify or deprecate mappings.';
      }
      const nowIso = new Date().toISOString();
      setConfig((prev) => ({
        ...prev,
        binMappings: prev.binMappings.map((m) =>
          m.id === id
            ? {
                ...m,
                verification_status: status,
                verified_by:
                  status === MappingVerificationStatus.VERIFIED
                    ? auth.email || 'admin'
                    : m.verified_by,
                verified_at: status === MappingVerificationStatus.VERIFIED ? nowIso : m.verified_at,
                updated_at: nowIso,
              }
            : m
        ),
        sessionAuditLogs: appendAudit(
          prev,
          'BIN_MAPPING_STATUS_CHANGED',
          'category_bin_mappings',
          id,
          `Updated mapping verification status to ${status}`
        ),
      }));
      return null;
    },
    [appendAudit, auth.email, auth.role]
  );

  const addConfidencePolicy = useCallback(
    (input: {
      policy_name: string;
      jurisdiction_code: string;
      accept_threshold: number;
      review_floor_threshold: number;
      require_calibrated_confidence: boolean;
      minimum_margin_over_second: number;
      documented_rationale: string;
    }): string | null => {
      if (auth.role !== UserRole.ADMIN) {
        return 'Administrator permission is required to configure confidence policies.';
      }
      if (
        !input.policy_name.trim() ||
        !input.jurisdiction_code.trim() ||
        !input.documented_rationale.trim()
      ) {
        return 'Policy name, jurisdiction code, and documented rationale are required.';
      }
      const policy: ConfidencePolicyConfig = {
        id: crypto.randomUUID(),
        policy_name: input.policy_name.trim(),
        jurisdiction_code: input.jurisdiction_code.trim().toUpperCase(),
        accept_threshold: input.accept_threshold,
        review_floor_threshold: input.review_floor_threshold,
        require_calibrated_confidence: input.require_calibrated_confidence,
        minimum_margin_over_second: input.minimum_margin_over_second,
        documented_rationale: input.documented_rationale.trim(),
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      setConfig((prev) => ({
        ...prev,
        confidencePolicies: [
          policy,
          ...prev.confidencePolicies.map((p) => ({ ...p, is_active: false })),
        ],
        sessionAuditLogs: appendAudit(
          prev,
          'CONFIDENCE_POLICY_SAVED',
          'confidence_policies',
          policy.id,
          `Saved active policy "${policy.policy_name}"`
        ),
      }));
      return null;
    },
    [appendAudit, auth.role]
  );

  const activatePolicy = useCallback(
    (id: string) => {
      if (auth.role !== UserRole.ADMIN) return;
      setConfig((prev) => ({
        ...prev,
        confidencePolicies: prev.confidencePolicies.map((p) => ({ ...p, is_active: p.id === id })),
        sessionAuditLogs: appendAudit(
          prev,
          'CONFIDENCE_POLICY_ACTIVATED',
          'confidence_policies',
          id,
          `Activated policy ${id}`
        ),
      }));
    },
    [appendAudit, auth.role]
  );

  const recordSessionClassification = useCallback(
    (
      result: SharedClassificationResult,
      meta: { image_filename?: string; image_sha256?: string | null; jurisdiction_code?: string }
    ) => {
      const record: ClassificationRecordItem = {
        ...result,
        image_filename: meta.image_filename ?? null,
        image_sha256: meta.image_sha256 ?? null,
        jurisdiction_code: meta.jurisdiction_code ?? null,
      };
      setConfig((prev) => ({
        ...prev,
        sessionRecentClassifications: [record, ...prev.sessionRecentClassifications].slice(0, 50),
      }));
    },
    []
  );

  const recordManualBinStatus = useCallback(
    (binCode: string, statusNote: string): string | null => {
      if (!binCode.trim() || !statusNote.trim()) {
        return 'Bin code and observation note are required.';
      }
      if (containsBannedOutcomeTerm(statusNote)) {
        return 'Prohibited terms ("safe", "sterile", "medically approved") cannot be recorded.';
      }
      const note: ManualBinStatusNote = {
        id: crypto.randomUUID(),
        bin_code: binCode.trim().toUpperCase(),
        reported_status_note: statusNote.trim(),
        recorded_by_role: auth.role,
        recorded_at: new Date().toISOString(),
      };
      setConfig((prev) => ({
        ...prev,
        manualBinLogs: [note, ...prev.manualBinLogs],
        sessionAuditLogs: appendAudit(
          prev,
          'MANUAL_BIN_NOTE_ADDED',
          'manual_bin_logs',
          note.id,
          `Manual bin observation logged for ${note.bin_code}`
        ),
      }));
      return null;
    },
    [appendAudit, auth.role]
  );

  const getCategoryAppearance = useCallback(
    (className: string | null): ConfiguredCategoryAppearance | null => {
      if (!className) return null;
      return config.categoryAppearances[className] ?? null;
    },
    [config.categoryAppearances]
  );

  const resetLocalConfig = useCallback(() => {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    setConfig({ ...DEFAULT_STATE, apiBaseUrl: config.apiBaseUrl });
  }, [config.apiBaseUrl]);

  const activePolicy = config.confidencePolicies.find((p) => p.is_active) ?? null;

  return (
    <PlatformConfigContext.Provider
      value={{
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
        recordSessionClassification,
        recordManualBinStatus,
        getCategoryAppearance,
        resetLocalConfig,
      }}
    >
      {children}
    </PlatformConfigContext.Provider>
  );
}

export function usePlatformConfig() {
  const ctx = useContext(PlatformConfigContext);
  if (!ctx) {
    throw new Error('usePlatformConfig must be used within PlatformConfigProvider');
  }
  return ctx;
}
