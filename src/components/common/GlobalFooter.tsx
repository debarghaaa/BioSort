import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '../../config/siteConfig';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/platform';
import { BioSortLogo } from './BioSortLogo';

export interface GlobalFooterProps {
  variant?: 'landing' | 'public' | 'workspace';
}

export function GlobalFooter({ variant = 'public' }: GlobalFooterProps) {
  const { auth } = useAuth();
  const canAccessReview =
    auth.isAuthenticated &&
    (auth.role === UserRole.REVIEWER || auth.role === UserRole.ADMIN);

  const containerWidth =
    variant === 'workspace' ? 'max-w-[1440px]' : 'max-w-[1200px]';

  return (
    <footer className="border-t border-[#E5E5E5] bg-[#FFFFFF]/90 mt-auto">
      <div
        className={`${containerWidth} w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Platform Identity */}
          <div className="max-w-md space-y-2">
            <div className="inline-flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-lg bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
                <BioSortLogo className="h-4 w-4 text-[#4338CA]" />
              </span>
              <span className="font-display font-semibold text-base text-[#171717]">
                {SITE_CONFIG.platformName}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#525252]">
              AI-assisted biomedical waste image segmentation and classification platform supporting
              visual analysis and human review.
            </p>
            <p className="font-mono text-[11px] text-[#737373]">
              Assistive software only · Never replaces physical handling SOPs
            </p>
          </div>

          {/* Structured Footer Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-10 text-xs">
            <nav aria-label="Platform Navigation" className="space-y-2">
              <p className="font-semibold text-[#171717]">Platform</p>
              <ul className="space-y-1.5 text-[#525252]">
                {auth.isAuthenticated ? (
                  <>
                    <li>
                      <Link to="/" className="hover:text-[#4338CA] transition-colors">
                        Overview
                      </Link>
                    </li>
                    <li>
                      <Link to="/classify" className="hover:text-[#4338CA] transition-colors">
                        Classify Waste
                      </Link>
                    </li>
                    <li>
                      <Link to="/history" className="hover:text-[#4338CA] transition-colors">
                        History
                      </Link>
                    </li>
                    {canAccessReview && (
                      <li>
                        <Link to="/review" className="hover:text-[#4338CA] transition-colors">
                          Manual Review
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link to="/analytics" className="hover:text-[#4338CA] transition-colors">
                        Analytics
                      </Link>
                    </li>
                    <li>
                      <Link to="/models" className="hover:text-[#4338CA] transition-colors">
                        Dataset &amp; Model
                      </Link>
                    </li>
                    <li>
                      <Link to="/settings" className="hover:text-[#4338CA] transition-colors">
                        Settings
                      </Link>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link to="/" className="hover:text-[#4338CA] transition-colors">
                        Introduction
                      </Link>
                    </li>
                    <li>
                      <Link to="/login" className="hover:text-[#4338CA] transition-colors">
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link to="/register" className="hover:text-[#4338CA] transition-colors">
                        Create Account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>

            <nav aria-label="Legal & Trust Navigation" className="space-y-2">
              <p className="font-semibold text-[#171717]">Legal &amp; Trust</p>
              <ul className="space-y-1.5 text-[#525252]">
                <li>
                  <Link to="/privacy-policy" className="hover:text-[#4338CA] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/cookie-policy" className="hover:text-[#4338CA] transition-colors">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms-and-conditions"
                    className="hover:text-[#4338CA] transition-colors"
                  >
                    Terms &amp; Conditions
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Support & Contact Navigation" className="space-y-2 col-span-2 sm:col-span-1">
              <p className="font-semibold text-[#171717]">Contact &amp; Storage</p>
              <ul className="space-y-1.5 text-[#525252]">
                <li>
                  <Link to="/contact" className="hover:text-[#4338CA] transition-colors">
                    Contact Platform Team
                  </Link>
                </li>
                <li>
                  <Link to="/cookie-policy#storage-controls" className="hover:text-[#4338CA] transition-colors">
                    Storage Preferences
                  </Link>
                </li>
                <li>
                  <Link to="/welcome" className="hover:text-[#4338CA] transition-colors">
                    Platform Overview
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Truthful Ownership & Legal Status Line */}
        <div className="pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#737373]">
          <span>
            {SITE_CONFIG.legalEntityName
              ? `${SITE_CONFIG.legalEntityName} · ${SITE_CONFIG.platformName}`
              : `${SITE_CONFIG.platformName} Project · Legal entity & operator details pending configuration`}
          </span>
          <span className="font-mono">
            Policy Last Updated: {SITE_CONFIG.lastUpdated}
          </span>
        </div>
      </div>
    </footer>
  );
}
