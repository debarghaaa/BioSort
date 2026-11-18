import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Database,
  History,
  Layers,
  ScanLine,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BioSortLogo } from '../common/BioSortLogo';

function RevealSection({
  id,
  className = '',
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (typeof window.IntersectionObserver === 'undefined') return true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
    return false;
  });

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <section
      id={id}
      ref={ref}
      className={`oi-reveal ${visible ? 'oi-reveal-visible' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

const WORKFLOW_STAGES = [
  {
    step: '01',
    title: 'Image Upload & Validation',
    detail:
      'Operators upload JPG, JPEG, or PNG waste imagery. Client and server checks verify MIME encoding, file size, image dimensions, and SHA-256 fingerprint before storage.',
  },
  {
    step: '02',
    title: 'Colab-Aligned Preprocessing',
    detail:
      'Images undergo deterministic RGB resizing and normalization matching the exported ONNX model preprocessing configuration.',
  },
  {
    step: '03',
    title: 'Segmentation & Classification',
    detail:
      'Visual waste contours and regions are analyzed by the ONNX Runtime inference service to produce ranked candidate categories across the active taxonomy.',
  },
  {
    step: '04',
    title: 'Confidence & Mapping Verification',
    detail:
      'Top score margins are evaluated against configured thresholds, and category codes are checked against verified regulatory bin mappings.',
  },
  {
    step: '05',
    title: 'Human Review & Audit Trail',
    detail:
      'Uncertain, uncalibrated, or unconfigured submissions route to the Manual Review queue where reviewers inspect stored imagery and record confirmed or relabelled decisions.',
  },
];

const CAPABILITIES = [
  {
    icon: ScanLine,
    title: 'AI-Assisted Image Classification',
    description:
      'Submit waste images for inference, view ranked candidate scores, and inspect active confidence policy decisions across infectious, plastic, sharps, and glassware categories.',
    routeLabel: 'Classify Workspace',
  },
  {
    icon: ClipboardCheck,
    title: 'Role-Scoped Manual Review Queue',
    description:
      'Reviewers and administrators inspect flagged items via private signed image URLs, confirm or relabel categories, add audit notes, and resolve queue items.',
    routeLabel: 'Manual Review',
  },
  {
    icon: History,
    title: 'Persistent Classification History',
    description:
      'Search and filter persisted classification records stored in PostgreSQL along with timestamps, model versions, and decision outcomes.',
    routeLabel: 'Audit History',
  },
  {
    icon: BarChart3,
    title: 'Server-Side Operational Analytics',
    description:
      'Inspect database-backed classification volumes, decision distributions, confidence score histograms, review trends, and export structured CSV reports.',
    routeLabel: 'Monitoring & Analytics',
  },
  {
    icon: Database,
    title: 'Model & Dataset Governance',
    description:
      'Verify loaded ONNX Runtime input/output tensor contracts, preprocessing parameters, recorded offline evaluation splits, and approved retraining export manifests.',
    routeLabel: 'Dataset & Model',
  },
  {
    icon: Settings2,
    title: 'Taxonomy & Policy Configuration',
    description:
      'Configure biomedical waste taxonomy classes, color-coded bin appearances, jurisdiction mappings, and confidence gating thresholds.',
    routeLabel: 'Settings & Policy',
  },
];

export default function LandingSections({
  entryPath,
  isAuthenticated,
}: {
  entryPath: string;
  isAuthenticated: boolean;
}) {
  return (
    <>
      {/* 1. Introduction */}
      <RevealSection
        id="introduction"
        className="scroll-mt-24 border-t border-[#E5E5E5] py-16 sm:py-20"
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 space-y-3">
            <p className="oi-metadata font-medium tracking-[0.12em] uppercase text-[#4338CA]">
              Introduction
            </p>
            <h2 className="oi-section-title">
              Structured visual analysis designed to support clinical human oversight.
            </h2>
          </div>

          <div className="lg:col-span-7 space-y-5 oi-body">
            <p>
              BioSort brings biomedical waste image segmentation, candidate classification scoring,
              and human review into a single traceable workspace. Built for laboratory teams,
              waste management operators, and facility administrators, it organizes visual triage
              around clear policy rules rather than opaque automation.
            </p>
            <p>
              The platform operates strictly as assistive software. Every prediction remains
              coupled to confidence thresholds, mapping verification status, and human review
              workflows—never replacing facility protocols, clinical judgment, or physical
              segregation verification.
            </p>

            <div className="pt-4 border-t border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
              <div className="space-y-1.5">
                <p className="oi-subpanel-title">Policy-Gated Decisions</p>
                <p className="oi-component-subtitle">
                  Thresholds and score margins separate clear outputs from uncertain cases.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="oi-subpanel-title">Private Image Storage</p>
                <p className="oi-component-subtitle">
                  Uploaded imagery is hashed and stored privately for reviewer inspection.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="oi-subpanel-title">Role-Scoped Access</p>
                <p className="oi-component-subtitle">
                  Operator, Reviewer, and Administrator scopes separate submission from approval.
                </p>
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* 2. How It Works */}
      <RevealSection
        id="how-it-works"
        className="scroll-mt-24 border-t border-[#E5E5E5] bg-[#FFFFFF] py-16 sm:py-20"
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="oi-metadata font-medium tracking-[0.12em] uppercase text-[#4338CA]">
              How It Works
            </p>
            <h2 className="oi-section-title">
              From validated image upload to verified human review.
            </h2>
            <p className="oi-body">
              Each submitted image moves through five deterministic stages before a segregation
              recommendation or audit record is finalized.
            </p>
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
            {WORKFLOW_STAGES.map((stage, idx) => (
              <li
                key={stage.step}
                className="relative bg-[#FCFBF9] border border-[#E5E5E5] rounded-2xl p-5 h-full flex flex-col justify-between gap-4 transition-colors duration-200 hover:border-[#D4D4D4]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="oi-metadata font-semibold text-[#4338CA]">
                      Stage {stage.step}
                    </span>
                    {idx < WORKFLOW_STAGES.length - 1 && (
                      <ArrowRight
                        className="hidden lg:block h-3.5 w-3.5 text-[#D4D4D4]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <h3 className="oi-card-title">{stage.title}</h3>
                  <p className="oi-component-subtitle">{stage.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </RevealSection>

      {/* 3. Platform Capabilities */}
      <RevealSection
        id="capabilities"
        className="scroll-mt-24 border-t border-[#E5E5E5] py-16 sm:py-20"
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-3">
              <p className="oi-metadata font-medium tracking-[0.12em] uppercase text-[#4338CA]">
                Platform Capabilities
              </p>
              <h2 className="oi-section-title">
                Operational tools implemented in the workspace.
              </h2>
            </div>
            <p className="oi-component-subtitle max-w-xs">
              Available through authenticated workspace access, local role preview, or Guest Mode.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <article
                  key={cap.title}
                  className="oi-card oi-card-interactive p-6 h-full flex flex-col justify-between gap-5"
                >
                  <div className="space-y-3.5">
                    <div className="h-10 w-10 rounded-xl bg-[#FCFBF9] border border-[#E5E5E5] flex items-center justify-center">
                      <Icon className="h-4.5 w-4.5 text-[#4338CA]" aria-hidden="true" />
                    </div>
                    <h3 className="oi-card-title">{cap.title}</h3>
                    <p className="oi-component-subtitle">{cap.description}</p>
                  </div>

                  <p className="pt-3 border-t border-[#E5E5E5] oi-metadata">{cap.routeLabel}</p>
                </article>
              );
            })}
          </div>
        </div>
      </RevealSection>

      {/* 4. Why It Matters */}
      <RevealSection
        id="why-it-matters"
        className="scroll-mt-24 border-t border-[#E5E5E5] bg-[#FFFFFF] py-16 sm:py-20"
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <p className="oi-metadata font-medium tracking-[0.12em] uppercase text-[#4338CA]">
              Why It Matters
            </p>
            <h2 className="oi-section-title">
              Accountable visual triage begins with knowing when an automated score is not enough.
            </h2>
            <p className="oi-body">
              Biomedical waste streams carry distinct handling, containment, and disposal
              requirements across infectious, plastic, sharps, and glassware categories. Treating
              every image prediction as certain obscures ambiguity when items overlap or lighting
              varies.
            </p>
            <p className="oi-body">
              BioSort pairs visual segmentation and scoring with explicit decision states—surfacing
              low-confidence or unmapped results directly to human reviewers while maintaining an
              auditable record of policy thresholds and manual overrides.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-[#FCFBF9] border border-[#E5E5E5] rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
                  <h3 className="oi-card-title">Segregation Decision Discipline</h3>
                </div>
                <span className="oi-metadata">Audit Principles</span>
              </div>

              <dl className="space-y-4">
                <div className="pb-4 border-b border-[#E5E5E5] space-y-1">
                  <dt className="oi-subpanel-title">Explicit Confidence &amp; Margin Gates</dt>
                  <dd className="oi-component-subtitle">
                    Accepted recommendations require both calibrated score confidence and a
                    sufficient gap over secondary candidate predictions.
                  </dd>
                </div>
                <div className="pb-4 border-b border-[#E5E5E5] space-y-1">
                  <dt className="oi-subpanel-title">Decoupled Taxonomy &amp; Disposal Policy</dt>
                  <dd className="oi-component-subtitle">
                    Model category outputs map separately to facility bin designations so
                    unverified mappings automatically pause for configuration.
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="oi-subpanel-title">Offline Dataset Feedback Separation</dt>
                  <dd className="oi-component-subtitle">
                    Reviewer confirmations and relabels never silently alter live weights; approved
                    records export cleanly for controlled offline retraining.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* 5. Final Call to Action */}
      <RevealSection className="border-t border-[#E5E5E5] py-16 sm:py-20">
        <div className="max-w-[880px] mx-auto px-4 sm:px-6">
          <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-[0_12px_36px_-16px_rgba(23,23,23,0.08)] overflow-hidden">
            <div className="p-7 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-lg">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
                    <BioSortLogo className="h-4.5 w-4.5 text-[#4338CA]" />
                  </div>
                  <span className="oi-metadata font-medium tracking-[0.12em] uppercase text-[#4338CA]">
                    Workspace Access
                  </span>
                </div>
                <h2 className="oi-section-title">Enter the BioSort workspace.</h2>
                <p className="oi-body-sm">
                  Sign in with your workspace credentials, explore role-scoped permissions, or launch
                  Guest Mode to inspect classification, manual review, and analytics workflows.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                <Link
                  to={entryPath}
                  className="oi-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 whitespace-nowrap shrink-0"
                >
                  <span>{isAuthenticated ? 'Open Workspace' : 'Explore Platform'}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
                {!isAuthenticated && (
                  <Link
                    to="/register"
                    className="oi-btn-secondary inline-flex items-center justify-center px-6 py-3 whitespace-nowrap shrink-0"
                  >
                    Create Account
                  </Link>
                )}
              </div>
            </div>

            <div className="border-t border-[#E5E5E5] bg-[#FCFBF9] px-7 sm:px-10 py-3 flex flex-wrap items-center justify-between gap-3 oi-metadata">
              <span>
                Assistive visual analysis software · Never replaces physical handling protocols
              </span>
              <span className="uppercase tracking-wider">BioSort Platform</span>
            </div>
          </div>
        </div>
      </RevealSection>
    </>
  );
}
