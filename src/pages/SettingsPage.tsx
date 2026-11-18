import { PageHeader } from '../components/common/PageHeader';
import { SettingsPanel } from '../features/settings/SettingsPanel';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Policy"
        description="Configure inference service connectivity, inspect loaded ONNX artefacts, and manage waste taxonomy classes and regulatory bin mappings."
      />
      <SettingsPanel />
    </div>
  );
}
