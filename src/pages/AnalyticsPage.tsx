import { PageHeader } from '../components/common/PageHeader';
import { AnalyticsPanel } from '../features/analytics/AnalyticsPanel';

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring & Analytics"
        description="Server-side operational metrics over persisted classification events, review activity, confidence distributions, model versions, and CSV exports."
      />
      <AnalyticsPanel />
    </div>
  );
}
