import { PageHeader } from '../components/common/PageHeader';
import { ManualReviewPanel } from '../features/review/ManualReviewPanel';

export function ReviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual Review"
        description="Inspect low-confidence, uncalibrated, or unconfigured classifications and record confirmed, relabelled, or unresolved audit decisions."
      />
      <ManualReviewPanel />
    </div>
  );
}
