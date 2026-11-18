import { useState } from 'react';
import { ArrowRight, LogOut, Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BioSortLogo } from './BioSortLogo';

export interface GlobalHeaderProps {
  variant?: 'landing' | 'public';
}

const LANDING_NAV_ITEMS = [
  { href: '#introduction', label: 'Introduction', isAnchor: true },
  { href: '#how-it-works', label: 'How It Works', isAnchor: true },
  { href: '#capabilities', label: 'Capabilities', isAnchor: true },
  { href: '#why-it-matters', label: 'Why It Matters', isAnchor: true },
  { href: '/contact', label: 'Contact', isAnchor: false },
];

const PUBLIC_NAV_ITEMS = [
  { to: '/welcome', label: 'Overview' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-and-conditions', label: 'Terms' },
];

export function GlobalHeader({ variant = 'public' }: GlobalHeaderProps) {
  const { auth, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const primaryActionLabel = auth.isAuthenticated ? 'Open Workspace' : 'Sign In';
  const primaryActionTo = auth.isAuthenticated ? '/' : '/login';
  const mobileNavId = variant === 'landing' ? 'landing-mobile-nav' : 'public-mobile-nav';

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 pt-3.5 max-w-[1264px] w-full mx-auto">
      <div className="bg-[#FFFFFF]/95 backdrop-blur-[6px] border border-[#E5E5E5] rounded-2xl shadow-[0_6px_20px_-10px_rgba(23,23,23,0.06)]">
        <div className="min-h-[64px] px-4 sm:px-6 flex items-center justify-between gap-6">
          {/* Zone 1: Platform Identity */}
          <Link
            to={auth.isAuthenticated ? '/welcome' : '/'}
            onClick={() => setMobileMenuOpen(false)}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded-lg py-1"
          >
            <span className="h-8 w-8 rounded-lg bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
              <BioSortLogo className="h-4.5 w-4.5 text-[#4338CA]" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-[#171717] whitespace-nowrap shrink-0">
              BioSort
            </span>
          </Link>

          {/* Zone 2: Minimal Single-Line Navigation Links */}
          <nav
            aria-label={variant === 'landing' ? 'Landing Navigation' : 'Site Navigation'}
            className="hidden md:flex items-center gap-6 text-[13px] font-medium text-[#525252]"
          >
            {variant === 'landing'
              ? LANDING_NAV_ITEMS.map((item) =>
                  item.isAnchor ? (
                    <a
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap shrink-0 hover:text-[#171717] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded py-1"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }) =>
                        `whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded py-1 ${
                          isActive ? 'text-[#4338CA] font-semibold' : 'hover:text-[#171717]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  )
                )
              : PUBLIC_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-current={location.pathname === item.to ? 'page' : undefined}
                    className={({ isActive }) =>
                      `whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded py-1 ${
                        isActive ? 'text-[#4338CA] font-semibold' : 'hover:text-[#171717]'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
          </nav>

          {/* Zone 3: Auth-Aware Action + Mobile Trigger */}
          <div className="flex items-center gap-2.5 shrink-0">
            {auth.isAuthenticated && variant !== 'landing' && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#525252] hover:text-[#171717] hover:bg-[#FCFBF9] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2"
              >
                <LogOut className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            )}

            <Link
              to={primaryActionTo}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl bg-[#4338CA] px-4 py-2 text-xs font-semibold text-[#FFFFFF] transition-colors duration-150 hover:bg-[#3730A3] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 whitespace-nowrap shrink-0"
            >
              <span>{primaryActionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileNavId}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] text-[#171717] hover:bg-[#FCFBF9] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2"
            >
              {mobileMenuOpen ? (
                <X className="h-4.5 w-4.5" aria-hidden="true" />
              ) : (
                <Menu className="h-4.5 w-4.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id={mobileNavId}
            aria-label={variant === 'landing' ? 'Mobile Landing Navigation' : 'Mobile Site Navigation'}
            className="md:hidden border-t border-[#E5E5E5] px-4 py-3 space-y-1.5"
          >
            {variant === 'landing'
              ? LANDING_NAV_ITEMS.map((item) =>
                  item.isAnchor ? (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-h-[44px] flex items-center px-3 rounded-xl text-sm font-medium text-[#525252] hover:text-[#171717] hover:bg-[#FCFBF9] transition-colors"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `min-h-[44px] flex items-center px-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-[#4338CA] bg-[#4338CA]/[0.06] font-semibold'
                            : 'text-[#525252] hover:text-[#171717] hover:bg-[#FCFBF9]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  )
                )
              : PUBLIC_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `min-h-[44px] flex items-center px-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-[#4338CA] bg-[#4338CA]/[0.06] font-semibold'
                          : 'text-[#525252] hover:text-[#171717] hover:bg-[#FCFBF9]'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}

            <div className="pt-2 border-t border-[#E5E5E5] space-y-2">
              <Link
                to={primaryActionTo}
                onClick={() => setMobileMenuOpen(false)}
                className="oi-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5"
              >
                <span>{primaryActionLabel}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>

              {auth.isAuthenticated && variant !== 'landing' && (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="oi-btn-secondary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5"
                >
                  <LogOut className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
