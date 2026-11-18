import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  containsBannedOutcomeTerm,
  DecisionStatus,
  isValidSharedClassificationResult,
} from '../src/contracts/classification.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

test('JSON Schema contract matches SharedClassificationResult required fields and enums', () => {
  const schemaPath = path.join(ROOT, 'contracts', 'classification.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as {
    required: string[];
    properties: {
      decision_status: { enum: string[] };
    };
  };

  assert.deepEqual(schema.required, [
    'classification_id',
    'predicted_class',
    'candidate_predictions',
    'model_version',
    'decision_status',
    'recommended_bin',
    'requires_manual_review',
    'review_reason',
    'created_at',
  ]);
  assert.deepEqual(schema.properties.decision_status.enum, Object.values(DecisionStatus));
});

test('OpenAPI specification documents all frontend-consumed endpoints', () => {
  const openApi = fs.readFileSync(path.join(ROOT, 'contracts', 'openapi.yaml'), 'utf-8');
  const expectedPaths = [
    '/health:',
    '/ready:',
    '/api/v1/classifications:',
    '/api/v1/classifications/{classification_id}:',
    '/api/v1/models/current:',
    '/api/v1/bin-mappings:',
    '/api/v1/reviews:',
    '/api/v1/reviews/{classification_id}:',
    '/api/v1/reviews/{classification_id}/claim:',
    '/api/v1/reviews/taxonomy:',
    '/api/v1/reviews/export/dataset-feedback:',
    '/api/v1/analytics/summary:',
    '/api/v1/analytics/dashboard:',
    '/api/v1/analytics/alerts/config:',
    '/api/v1/analytics/export:',
  ];
  for (const endpoint of expectedPaths) {
    assert.ok(openApi.includes(endpoint), `Missing OpenAPI endpoint ${endpoint}`);
  }
});

test('SharedClassificationResult validator enforces contract invariants and rejects banned terms', () => {
  const validAccepted = {
    classification_id: '11111111-1111-4111-8111-111111111111',
    predicted_class: 'sharps_needle',
    candidate_predictions: [
      { class_name: 'sharps_needle', model_score: 0.94, calibrated_confidence: 0.91 },
    ],
    model_version: 'mobilenetv3-test-v1',
    decision_status: DecisionStatus.ACCEPTED,
    recommended_bin: 'BIN-SHARPS-01 — Puncture-Resistant Sharps Receptacle',
    requires_manual_review: false,
    review_reason: null,
    created_at: '2026-11-17T10:00:00Z',
  };
  assert.equal(isValidSharedClassificationResult(validAccepted), true);

  assert.equal(containsBannedOutcomeTerm('sterile_item'), true);
  assert.equal(containsBannedOutcomeTerm('medically approved'), true);
  assert.equal(containsBannedOutcomeTerm('safe disposal'), true);
  assert.equal(containsBannedOutcomeTerm('sharps_needle'), false);

  const bannedResult = {
    ...validAccepted,
    predicted_class: 'safe_item',
  };
  assert.equal(isValidSharedClassificationResult(bannedResult), false);

  const missingField = { ...validAccepted } as Record<string, unknown>;
  delete missingField.model_version;
  assert.equal(isValidSharedClassificationResult(missingField), false);
});
