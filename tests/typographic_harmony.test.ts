import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MetricCard } from '../src/components/common/MetricCard';
import { PanelHeader } from '../src/components/common/PanelHeader';
import LandingSections from '../src/components/landing/LandingSections';
import { ImageValidation } from '../src/features/classification/ImageValidation';
import { PredictionResult } from '../src/features/classification/PredictionResult';
import { ReviewStatusIndicator } from '../src/features/classification/ReviewStatusIndicator';
import { AuthProvider } from '../src/hooks/useAuth';
import { PlatformConfigProvider } from '../src/hooks/usePlatformConfig';
import { DatasetModelPage } from '../src/pages/DatasetModelPage';
import { LandingPage } from '../src/pages/LandingPage';
import { DecisionStatus } from '../src/types/platform';

const ROOT = path.resolve(import.meta.dirname, '..');

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, 'src', relPath), 'utf-8');
}

test('src/index.css defines complete semantic typography and spacing tokens', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf-8');
  const requiredTokens = [
    '--font-display:',
    '--font-interface:',
    '--font-technical:',
    '--text-component-title:',
    '--text-component-subtitle:',
    '--text-body:',
    '--text-metadata:',
    '--text-numerical:',
    '--line-height-heading:',
    '--line-height-body:',
    '--spacing-component:',
    '--spacing-card:',
    '--color-heading:',
    '--color-body:',
    '--color-muted:',
    '.oi-section-title',
    '.oi-component-title',
    '.oi-component-subtitle',
    '.oi-subpanel-title',
    '.oi-numerical',
    '.oi-numerical-sm',
    '.oi-metadata',
    '.oi-panel',
    '.oi-panel-header',
    '.oi-tile',
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `Missing semantic token/primitive "${token}" in src/index.css`);
  }
});

test('Adjacent grid panels and tiles use harmonized surface, stretch, and typography primitives', () => {
  const filesUsingPanelHeader = [
    'pages/DashboardPage.tsx',
    'pages/DatasetModelPage.tsx',
    'features/classification/ImageUploadPanel.tsx',
    'features/analytics/AnalyticsPanel.tsx',
    'features/review/ManualReviewPanel.tsx',
    'features/settings/SettingsPanel.tsx',
    'features/history/ClassificationHistoryPanel.tsx',
  ];

  for (const file of filesUsingPanelHeader) {
    const src = readSrc(file);
    assert.ok(
      src.includes('PanelHeader'),
      `Expected ${file} to use shared PanelHeader for adjacent header consistency`
    );
  }

  const filesRequiringStretchRows = [
    'pages/DashboardPage.tsx',
    'pages/DatasetModelPage.tsx',
    'components/landing/LandingSections.tsx',
    'features/classification/ImageUploadPanel.tsx',
    'features/classification/PredictionResult.tsx',
    'features/analytics/AnalyticsPanel.tsx',
    'features/review/ManualReviewPanel.tsx',
    'features/settings/SettingsPanel.tsx',
  ];

  for (const file of filesRequiringStretchRows) {
    const src = readSrc(file);
    assert.ok(
      src.includes('items-stretch'),
      `Expected ${file} to enforce equal-height grid rows via items-stretch`
    );
    assert.ok(
      src.includes('h-full'),
      `Expected ${file} adjacent cards/tiles to fill grid height via h-full`
    );
  }

  const loginPage = readSrc('pages/LoginPage.tsx');
  assert.equal(
    loginPage.includes('font-display'),
    false,
    'LoginPage adjacent info cards should not mix Playfair Display titles with Inter card titles'
  );
  assert.ok(loginPage.includes('oi-card-title'));
  assert.ok(loginPage.includes('oi-component-subtitle'));
  assert.ok(loginPage.includes('oi-subpanel-title'));

  const landingSections = readSrc('components/landing/LandingSections.tsx');
  assert.equal(
    landingSections.includes('md:col-span-2'),
    false,
    'LandingSections 6-card capability grid should maintain symmetric columns across breakpoints'
  );
});

test('SSR DOM markup verification confirms consistent roles across MetricCard, PanelHeader, Validation, PredictionResult, DatasetModelPage, Review, and LandingPage', () => {
  const metricMarkup = renderToStaticMarkup(
    React.createElement(MetricCard, {
      label: 'Total Events',
      value: 42,
      sublabel: 'Session verified',
    })
  );
  assert.ok(metricMarkup.includes('oi-component-subtitle'));
  assert.ok(metricMarkup.includes('oi-numerical'));
  assert.ok(metricMarkup.includes('oi-metadata'));
  assert.ok(metricMarkup.includes('h-full'));

  const panelHeaderMarkup = renderToStaticMarkup(
    React.createElement(PanelHeader, {
      title: 'Diagnostics',
      subtitle: 'Service health snapshot',
      meta: React.createElement('span', { className: 'oi-metadata' }, 'Live'),
    })
  );
  assert.ok(panelHeaderMarkup.includes('oi-panel-header'));
  assert.ok(panelHeaderMarkup.includes('oi-card-title'));
  assert.ok(panelHeaderMarkup.includes('oi-component-subtitle'));

  const validationMarkup = renderToStaticMarkup(
    React.createElement(ImageValidation, {
      report: {
        valid: true,
        file_name: 'sample-specimen.png',
        mime_type: 'image/png',
        byte_size: 2048,
        width: 512,
        height: 512,
        sha256: 'abcdef1234567890',
        errors: [],
        warnings: [],
      },
    })
  );
  assert.ok(validationMarkup.includes('oi-tile'));
  assert.ok(validationMarkup.includes('oi-subpanel-title'));
  assert.ok(validationMarkup.includes('oi-component-subtitle'));
  assert.ok(validationMarkup.includes('oi-metadata'));

  const reviewMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReviewStatusIndicator, {
        decisionStatus: DecisionStatus.REVIEW_REQUIRED,
        requiresManualReview: true,
        reviewReason: 'Below confidence threshold',
      })
    )
  );
  assert.ok(reviewMarkup.includes('oi-tile'));
  assert.ok(reviewMarkup.includes('oi-subpanel-title'));
  assert.ok(reviewMarkup.includes('oi-component-subtitle'));

  const predictionMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          PlatformConfigProvider,
          null,
          React.createElement(PredictionResult, {
            result: {
              classification_id: 'cls-001',
              predicted_class: 'sharps',
              candidate_predictions: [
                {
                  class_name: 'sharps',
                  model_score: 0.94,
                  calibrated_confidence: 0.91,
                },
              ],
              decision_status: DecisionStatus.ACCEPTED,
              recommended_bin: 'SHARPS-RED-01',
              requires_manual_review: false,
              review_reason: null,
              model_version: 'onnx-v1',
              created_at: '2026-01-01T00:00:00Z',
            },
          })
        )
      )
    )
  );
  assert.ok(predictionMarkup.includes('items-stretch'));
  assert.ok(predictionMarkup.includes('oi-tile h-full'));
  assert.ok(predictionMarkup.includes('oi-subpanel-title'));

  const datasetMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          PlatformConfigProvider,
          null,
          React.createElement(DatasetModelPage)
        )
      )
    )
  );
  assert.ok(datasetMarkup.includes('oi-panel'));
  assert.ok(datasetMarkup.includes('oi-panel-header'));
  assert.ok(datasetMarkup.includes('oi-tile h-full'));

  const sectionsMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(LandingSections)
    )
  );
  const sectionHeadingCount = (sectionsMarkup.match(/class="oi-section-title/g) || []).length;
  assert.ok(
    sectionHeadingCount >= 5,
    `Expected all landing sections to share .oi-section-title, got ${sectionHeadingCount}`
  );
  assert.ok(sectionsMarkup.includes('items-stretch'));
  assert.ok(sectionsMarkup.includes('oi-card-title'));

  const landingMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(LandingPage)
      )
    )
  );
  assert.ok(landingMarkup.includes('BioSort'));
  assert.ok(landingMarkup.includes('Explore Platform'));
});
