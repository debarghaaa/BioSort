import { PageHeader } from '../components/common/PageHeader';
import { ClassificationHistoryPanel } from '../features/history/ClassificationHistoryPanel';

export function HistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Classification History"
        description="Filter persisted classification records and inspect candidate predictions, decision policy rationale, and stored evidence metadata."
      />
      <ClassificationHistoryPanel />
    </div>
  );
}
