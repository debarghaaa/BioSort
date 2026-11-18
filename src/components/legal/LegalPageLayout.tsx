import React from 'react';
import { ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '../../config/siteConfig';

export interface LegalSectionMeta {
  id: string;
  title: string;
}

export interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSectionMeta[];
  children: React.ReactNode;
}

export function LegalPageLayout({
  eyebrow,
  title,
  summary,
  sections,
  children,
}: LegalPageLayoutProps) {
  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <article className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Document Header */}
      <header className="space-y-4 border-b border-[#E5E5E5] pb-7">
        <p className="oi-metadata font-medium tracking-[0.14em] uppercase text-[#4338CA]">
          {eyebrow}
        </p>

        <h1 className="oi-page-title">{title}</h1>

        <p className="oi-body max-w-2xl">{summary}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs text-[#737373] font-mono">
          <span>Last Updated: {SITE_CONFIG.lastUpdated}</span>
          <span aria-hidden="true">·</span>
          <span>Scope: {SITE_CONFIG.platformName} Web &amp; Inference Services</span>
        </div>

        <div
          role="note"
          className="oi-inset-sm px-4 py-3 text-xs text-[#525252] leading-relaxed"
        >
          <strong className="font-semibold text-[#171717]">Legal Review Notice:</strong>{' '}
          {SITE_CONFIG.legalDraftStatus}
        </div>
      </header>

      {/* Section Jump Links */}
      <nav
        aria-label="Document Sections"
        className="oi-panel space-y-3"
      >
        <h2 className="oi-subpanel-title">Document Sections</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-[#525252] list-decimal list-inside">
          {sections.map((section) => (
            <li key={section.id} className="leading-relaxed">
              <a
                href={`#${section.id}`}
                className="hover:text-[#4338CA] underline-offset-2 hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-[#6366F1] rounded"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Legal Clauses */}
      <div className="space-y-8">{children}</div>

      {/* Document Footer Navigation */}
      <div className="pt-6 border-t border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#525252]">
          <Link to="/privacy-policy" className="hover:text-[#4338CA] transition-colors">
            Privacy Policy
          </Link>
          <Link to="/cookie-policy" className="hover:text-[#4338CA] transition-colors">
            Cookie Policy
          </Link>
          <Link to="/terms-and-conditions" className="hover:text-[#4338CA] transition-colors">
            Terms &amp; Conditions
          </Link>
          <Link to="/contact" className="hover:text-[#4338CA] transition-colors">
            Contact
          </Link>
        </div>

        <button
          type="button"
          onClick={scrollToTop}
          className="oi-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium"
        >
          <ArrowUp className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
          <span>Back to top</span>
        </button>
      </div>
    </article>
  );
}

export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 space-y-3 pb-6 border-b border-[#E5E5E5]/70 last:border-b-0"
    >
      <div className="flex items-baseline gap-2.5">
        <span className="oi-metadata text-[#4338CA] shrink-0">{number}</span>
        <h2 id={`${id}-heading`} className="font-display text-xl sm:text-2xl font-medium text-[#171717]">
          {title}
        </h2>
      </div>
      <div className="space-y-3 oi-body-sm leading-[1.7] text-[#525252]">{children}</div>
    </section>
  );
}
