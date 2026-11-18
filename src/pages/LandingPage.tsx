import { Suspense, lazy } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlobalFooter } from '../components/common/GlobalFooter';
import { GlobalHeader } from '../components/common/GlobalHeader';
import { SegmentationHeroVisual } from '../components/landing/SegmentationHeroVisual';
import { useAuth } from '../hooks/useAuth';

const LandingSections = lazy(() => import('../components/landing/LandingSections'));

export function LandingPage() {
  const { auth } = useAuth();

  const entryPath = auth.isAuthenticated ? '/classify' : '/login';
  const heroPrimaryLabel = auth.isAuthenticated ? 'Open Workspace' : 'Explore Platform';

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#171717] flex flex-col">
      <GlobalHeader variant="landing" />

      <main className="flex-1">
        {/* Immediate First-Paint Editorial Hero */}
        <section aria-labelledby="hero-heading" className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Editorial Copy & Primary Actions (Rendered Immediately, No Animation Delay) */}
            <div className="lg:col-span-6 space-y-6">
              <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-[#4338CA]">
                Biomedical Image Intelligence
              </p>

              <h1
                id="hero-heading"
                className="font-display text-[clamp(2.25rem,4.1vw,3.5rem)] font-semibold tracking-[-0.02em] leading-[1.12] text-[#171717] text-balance"
              >
                Give biomedical waste analysis a clearer perspective.
              </h1>

              <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#525252] max-w-xl">
                An AI-assisted platform for biomedical waste image segmentation and classification,
                designed to support visual analysis and human review.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link
                  to={entryPath}
                  className="oi-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 whitespace-nowrap shrink-0"
                >
                  <span>{heroPrimaryLabel}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>

                <a
                  href="#how-it-works"
                  className="oi-btn-secondary inline-flex items-center justify-center px-6 py-3 whitespace-nowrap shrink-0"
                >
                  How It Works
                </a>
              </div>

              <div className="pt-4 border-t border-[#E5E5E5] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#737373]">
                <span>Assistive classification software</span>
                <span aria-hidden="true">·</span>
                <span>Confidence &amp; mapping thresholds</span>
                <span aria-hidden="true">·</span>
                <span>Mandatory manual review workflow</span>
              </div>
            </div>

            {/* Restrained Segmentation Contour Visual */}
            <div className="lg:col-span-6">
              <SegmentationHeroVisual />
            </div>
          </div>
        </section>

        {/* Below-the-Fold Sections Lazy-Loaded for Fast Initial Paint */}
        <Suspense
          fallback={
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12" aria-hidden="true">
              <div className="h-40 rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF]/60" />
            </div>
          }
        >
          <LandingSections entryPath={entryPath} isAuthenticated={auth.isAuthenticated} />
        </Suspense>
      </main>

      <GlobalFooter variant="landing" />
    </div>
  );
}
