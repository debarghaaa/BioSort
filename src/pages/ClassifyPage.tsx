import { PageHeader } from '../components/common/PageHeader';
import { ImageUploadPanel } from '../features/classification/ImageUploadPanel';

export function ClassifyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Classify Waste"
        description="Validate JPG, JPEG, or PNG images locally, submit to the ONNX Runtime inference service, and inspect confidence verification and segregation policy output."
      />
      <ImageUploadPanel />
    </div>
  );
}
