import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
  ApiRequestError,
  classifyWasteImage,
  fetchAnalyticsCsvReportFromApi,
  fetchClassificationHistory,
  fetchMonitoringDashboardFromApi,
  fetchReviewsFromApi,
  probeBackendHealthAndReadiness,
  submitReviewDecisionToApi,
} from '../src/services/api/classificationApi.ts';
import { DecisionStatus } from '../src/contracts/classification.ts';

interface StubState {
  mode:
    | 'accepted'
    | 'low_confidence'
    | 'missing_mapping'
    | 'inference_unavailable'
    | 'persistence_unavailable';
  events: Array<{
    classification_id: string;
    predicted_class: string | null;
    decision_status: DecisionStatus;
    recommended_bin: string | null;
    requires_manual_review: boolean;
    review_reason: string | null;
    model_version: string;
    review_status: string;
    resolved_class: string | null;
    created_at: string;
  }>;
}

function createSamplePngFile(): File {
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  return new File([pngBytes], 'waste_sample.png', { type: 'image/png' });
}

async function withMockBackend(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void,
  fn: (baseUrl: string) => Promise<void>
) {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      handler(req, res, Buffer.concat(chunks).toString('utf-8'));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

test('E2E integration scenarios via real frontend API client', async () => {
  const state: StubState = {
    mode: 'accepted',
    events: [],
  };

  await withMockBackend(
    (req, res, body) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const auth = req.headers.authorization || '';

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'alive' }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/ready') {
        const ready = state.mode !== 'inference_unavailable';
        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: ready ? 'ready' : 'not_ready',
            model_loaded: ready,
            model_version: ready ? 'mobilenetv3-medwaste-v1' : null,
            jwt_configured: true,
            supabase_connected: state.mode !== 'persistence_unavailable',
            errors: ready ? [] : ['ONNX model artefact missing'],
          })
        );
        return;
      }

      if (!auth.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Missing Bearer token' }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/v1/classifications') {
        if (state.mode === 'inference_unavailable') {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ detail: 'ONNX classifier is not loaded.' }));
          return;
        }
        if (state.mode === 'persistence_unavailable') {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              detail: 'Database persistence failure; classification was not saved.',
            })
          );
          return;
        }

        const id = `00000000-0000-4000-8000-00000000000${state.events.length + 1}`;
        const now = new Date().toISOString();

        const result =
          state.mode === 'accepted'
            ? {
                classification_id: id,
                predicted_class: 'sharps_needle',
                candidate_predictions: [
                  { class_name: 'sharps_needle', model_score: 0.94, calibrated_confidence: 0.91 },
                  {
                    class_name: 'infectious_dressing',
                    model_score: 0.06,
                    calibrated_confidence: 0.09,
                  },
                ],
                model_version: 'mobilenetv3-medwaste-v1',
                decision_status: DecisionStatus.ACCEPTED,
                recommended_bin: 'BIN-SHARPS-01 — Puncture-Resistant Sharps Receptacle',
                requires_manual_review: false,
                review_reason: null,
                created_at: now,
              }
            : state.mode === 'low_confidence'
              ? {
                  classification_id: id,
                  predicted_class: 'infectious_dressing',
                  candidate_predictions: [
                    {
                      class_name: 'infectious_dressing',
                      model_score: 0.56,
                      calibrated_confidence: 0.54,
                    },
                    { class_name: 'sharps_needle', model_score: 0.44, calibrated_confidence: 0.46 },
                  ],
                  model_version: 'mobilenetv3-medwaste-v1',
                  decision_status: DecisionStatus.REVIEW_REQUIRED,
                  recommended_bin: null,
                  requires_manual_review: true,
                  review_reason: 'Calibrated confidence below threshold 0.85.',
                  created_at: now,
                }
              : {
                  classification_id: id,
                  predicted_class: 'pharmaceutical_vial',
                  candidate_predictions: [
                    {
                      class_name: 'pharmaceutical_vial',
                      model_score: 0.93,
                      calibrated_confidence: 0.9,
                    },
                  ],
                  model_version: 'mobilenetv3-medwaste-v1',
                  decision_status: DecisionStatus.MAPPING_UNCONFIGURED,
                  recommended_bin: null,
                  requires_manual_review: true,
                  review_reason: 'No verified category-to-bin mapping for pharmaceutical_vial.',
                  created_at: now,
                };

        state.events.push({
          ...result,
          review_status: result.requires_manual_review ? 'pending' : 'not_required',
          resolved_class: null,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/classifications') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            items: state.events,
            total: state.events.length,
            limit: 25,
            offset: 0,
          })
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/reviews') {
        const pendingItems = state.events
          .filter((e) => e.requires_manual_review)
          .map((e) => ({
            id: `rev-${e.classification_id}`,
            classification_id: e.classification_id,
            queue_status: e.review_status,
            version: 1,
            predicted_class: e.predicted_class,
            candidate_predictions: [],
            model_score: 0.56,
            calibrated_confidence: 0.54,
            original_decision_status: e.decision_status,
            model_version: e.model_version,
            preprocessing_version: 'prep-v1',
            review_reason: e.review_reason || '',
            image_storage_path: null,
            image_signed_url: null,
            resolved_class: e.resolved_class,
            verified_mapped_bin: null,
            reviewer_notes: '',
            reviewer_id: null,
            reviewer_display_name: null,
            claimed_by: null,
            claimed_at: null,
            reviewed_at: null,
            created_at: e.created_at,
            approved_for_dataset_export: false,
            review_history: [],
          }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ items: pendingItems, total: pendingItems.length }));
        return;
      }

      if (req.method === 'POST' && url.pathname.startsWith('/api/v1/reviews/')) {
        const cid = url.pathname.split('/').pop();
        const payload = JSON.parse(body || '{}') as {
          action: 'confirmed' | 'relabelled' | 'unresolved';
          resolved_class: string | null;
          reviewer_notes: string;
        };
        const target = state.events.find((e) => e.classification_id === cid);
        assert.ok(target);
        target.review_status = payload.action;
        target.resolved_class =
          payload.action === 'confirmed' ? target.predicted_class : payload.resolved_class;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: `rev-${cid}`,
            classification_id: cid,
            queue_status: target.review_status,
            version: 2,
            predicted_class: target.predicted_class,
            candidate_predictions: [],
            model_score: 0.56,
            calibrated_confidence: 0.54,
            original_decision_status: target.decision_status,
            model_version: target.model_version,
            preprocessing_version: 'prep-v1',
            review_reason: target.review_reason || '',
            image_storage_path: null,
            image_signed_url: null,
            resolved_class: target.resolved_class,
            verified_mapped_bin: null,
            reviewer_notes: payload.reviewer_notes,
            reviewer_id: 'rev-user-1',
            reviewer_display_name: 'Reviewer',
            claimed_by: null,
            claimed_at: null,
            reviewed_at: new Date().toISOString(),
            created_at: target.created_at,
            approved_for_dataset_export: true,
            review_history: [
              {
                id: 'audit-1',
                actor_id: 'rev-user-1',
                actor_role: 'reviewer',
                event_type: `manual_reviews.decision.${payload.action}`,
                entity_id: `rev-${cid}`,
                before_state: { queue_status: 'pending' },
                after_state: { queue_status: target.review_status },
                created_at: new Date().toISOString(),
              },
            ],
          })
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/analytics/dashboard') {
        const resolvedCount = state.events.filter((e) =>
          ['confirmed', 'relabelled', 'unresolved'].includes(e.review_status)
        ).length;
        const pendingCount = state.events.filter((e) => e.review_status === 'pending').length;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            generated_at: new Date().toISOString(),
            total_classifications: state.events.length,
            accepted_predictions: state.events.filter(
              (e) => e.decision_status === DecisionStatus.ACCEPTED
            ).length,
            review_required: pendingCount,
            unconfigured_mappings: state.events.filter(
              (e) => e.decision_status === DecisionStatus.MAPPING_UNCONFIGURED
            ).length,
            rejected_inputs: 0,
            average_model_score: 0.81,
            average_calibrated_confidence: 0.78,
            calibrated_sample_count: state.events.length,
            total_review_records: state.events.filter((e) => e.requires_manual_review).length,
            resolved_review_count: resolvedCount,
            review_resolution_rate: 50,
            pending_queue_backlog: pendingCount,
            reviewed_comparison: {
              comparison_sample_count: resolvedCount,
              confirmed_count: 0,
              relabelled_count: resolvedCount,
              agreement_rate_pct: 0,
            },
            classification_volume_over_time: [],
            classification_distribution: [],
            decision_status_distribution: [],
            confidence_distribution: [],
            manual_review_trends: [],
            model_version_comparison: [],
            virtual_bin_assignments: [],
            unmapped_categories: [],
            failure_event_count: 0,
            thresholds: {
              pending_review_backlog_threshold: 10,
              classification_failure_threshold: 3,
            },
            alerts: [],
            source_note: 'Mock DB aggregate',
          })
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/analytics/export') {
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
        res.end('metric,value\ntotal_classifications,3\nphysical_sensor_status,unavailable\n');
        return;
      }

      res.writeHead(404);
      res.end();
    },
    async (baseUrl) => {
      const sampleFile = createSamplePngFile();

      // Scenario 1: Successful classification
      state.mode = 'accepted';
      const probeOk = await probeBackendHealthAndReadiness(baseUrl);
      assert.equal(probeOk.readiness, 'ready');
      assert.equal(probeOk.model_version, 'mobilenetv3-medwaste-v1');

      const acceptedRes = await classifyWasteImage({
        file: sampleFile,
        jurisdictionCode: 'US-OSHA',
        accessToken: 'op-jwt-token',
        baseUrl,
      });
      assert.equal(acceptedRes.decision_status, DecisionStatus.ACCEPTED);
      assert.ok(acceptedRes.recommended_bin?.includes('BIN-SHARPS-01'));
      assert.equal(acceptedRes.requires_manual_review, false);

      // Scenario 2: Low-confidence classification -> review_required -> appears in review queue
      state.mode = 'low_confidence';
      const lowConfRes = await classifyWasteImage({
        file: sampleFile,
        accessToken: 'op-jwt-token',
        baseUrl,
      });
      assert.equal(lowConfRes.decision_status, DecisionStatus.REVIEW_REQUIRED);
      assert.equal(lowConfRes.recommended_bin, null);
      assert.equal(lowConfRes.requires_manual_review, true);

      const pendingReviews = await fetchReviewsFromApi({
        baseUrl,
        accessToken: 'rev-jwt-token',
        status: 'pending',
      });
      assert.ok(
        pendingReviews.some((r) => r.classification_id === lowConfRes.classification_id)
      );

      // Scenario 3: Missing mapping -> mapping_unconfigured, no definitive bin
      state.mode = 'missing_mapping';
      const unmappedRes = await classifyWasteImage({
        file: sampleFile,
        accessToken: 'op-jwt-token',
        baseUrl,
      });
      assert.equal(unmappedRes.decision_status, DecisionStatus.MAPPING_UNCONFIGURED);
      assert.equal(unmappedRes.recommended_bin, null);

      // Scenario 4: Manual review -> persists audit -> reflected in history & analytics
      const reviewOutcome = await submitReviewDecisionToApi({
        classificationId: lowConfRes.classification_id,
        action: 'relabelled',
        resolvedClass: 'sharps_needle',
        reviewerNotes: 'Verified sharps item in queue',
        expectedVersion: 1,
        approvedForDatasetExport: true,
        baseUrl,
        accessToken: 'rev-jwt-token',
      });
      assert.equal(reviewOutcome.queue_status, 'relabelled');
      assert.equal(reviewOutcome.review_history.length, 1);

      const history = await fetchClassificationHistory({ baseUrl, accessToken: 'op-jwt-token' });
      assert.equal(history.total, 3);

      const dash = await fetchMonitoringDashboardFromApi({ baseUrl, accessToken: 'op-jwt-token' });
      assert.equal(dash.total_classifications, 3);
      assert.equal(dash.resolved_review_count, 1);

      const csv = await fetchAnalyticsCsvReportFromApi({
        baseUrl,
        accessToken: 'op-jwt-token',
        reportType: 'analytics_summary',
      });
      assert.ok(csv.includes('physical_sensor_status,unavailable'));

      // Scenario 5: Inference unavailable -> controlled 503, no fake prediction
      state.mode = 'inference_unavailable';
      const probeDown = await probeBackendHealthAndReadiness(baseUrl);
      assert.equal(probeDown.readiness, 'not_ready');
      assert.equal(probeDown.model_loaded, false);

      await assert.rejects(
        () =>
          classifyWasteImage({
            file: sampleFile,
            accessToken: 'op-jwt-token',
            baseUrl,
          }),
        (err: unknown) => err instanceof ApiRequestError && err.status === 503
      );

      // Scenario 6: Persistence unavailable -> explicit 502 error, does not report success
      state.mode = 'persistence_unavailable';
      await assert.rejects(
        () =>
          classifyWasteImage({
            file: sampleFile,
            accessToken: 'op-jwt-token',
            baseUrl,
          }),
        (err: unknown) => err instanceof ApiRequestError && err.status === 502
      );
    }
  );
});
