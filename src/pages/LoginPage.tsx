import React, { useMemo, useState } from 'react';
import { FiArrowRight, FiCompass, FiKey, FiShield } from 'react-icons/fi';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Auth1, type Auth1Credentials } from '../components/ui/auth1';
import { getConfiguredOAuthProviders, useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../services/supabase/client';
import { UserRole } from '../types/platform';
import { sanitizeRedirectPath } from '../utils/authValidation';

const ROLE_OPTIONS: Array<{ role: UserRole; label: string; scope: string }> = [
  {
    role: UserRole.OPERATOR,
    label: 'Operator',
    scope: 'Submit waste images, view classification results, and inspect history.',
  },
  {
    role: UserRole.REVIEWER,
    label: 'Reviewer',
    scope: 'Confirm, relabel, or resolve flagged classifications in Manual Review.',
  },
  {
    role: UserRole.ADMIN,
    label: 'Administrator',
    scope: 'Configure waste taxonomy, category-to-bin mappings, and threshold policies.',
  },
];

export function LoginPage() {
  const {
    auth,
    signInWithSupabase,
    signInWithOAuth,
    enterFoundationSession,
    enterGuestSession,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const targetPath = sanitizeRedirectPath(fromState, '/');
  const oauthProviders = useMemo(() => getConfiguredOAuthProviders(), []);

  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.OPERATOR);
  const [error, setError] = useState<string | null>(null);

  if (auth.isAuthenticated) {
    return <Navigate to={targetPath} replace />;
  }

  const handleAuthSubmit = async ({ email, password }: Auth1Credentials) => {
    setError(null);
    try {
      await signInWithSupabase(email, password);
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const handleFoundationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enterFoundationSession(selectedRole);
    navigate(targetPath, { replace: true });
  };

  const handleGuestMode = () => {
    enterGuestSession();
    navigate(targetPath, { replace: true });
  };

  return (
    <div className="auth-organic-shell min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-10">
      <div className="w-full max-w-[920px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_minmax(0,380px)] items-start justify-center gap-6">
        {/* Primary Auth1 Clinical Authentication Card */}
        <Auth1
          brandName="BioSort"
          brandDescriptor="AI-assisted biomedical waste image segmentation"
          badgeText="SECURE ACCESS"
          heading="Welcome back."
          subheading="Access your workspace to process, review, and manage biomedical waste segmentation results."
          emailLabel="Workspace email"
          emailPlaceholder="Enter your email address"
          passwordLabel="Password"
          passwordPlaceholder="Enter your password"
          submitLabel="Sign in to workspace"
          dividerText="OR CONTINUE WITH EMAIL"
          forgotPasswordText="Forgot password?"
          bottomPromptText="New to the platform?"
          bottomPromptLinkText="Create an account"
          footerNote="AI-assisted biomedical waste segmentation"
          oauthProviders={oauthProviders}
          oauthUnavailableNote={
            isSupabaseConfigured
              ? undefined
              : 'Supabase Auth environment variables are not configured in this preview. Use Guest Mode or Foundation Role Access alongside to operate the platform.'
          }
          error={error}
          onSubmit={handleAuthSubmit}
          onForgotPassword={(email) => navigate('/reset-password', { state: { email } })}
          onBottomPromptClick={() => navigate('/register')}
          onOAuthSignIn={oauthProviders.length > 0 ? signInWithOAuth : undefined}
        />

        {/* Secondary Workspace Access Column: Guest Mode + Role Preview / RBAC Info */}
        <div className="space-y-5">
          {/* Separate Guest Mode Card */}
          <section
            aria-label="Guest Mode Access"
            className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_12px_36px_-16px_rgba(23,23,23,0.06)] space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#FCFBF9] border border-[#E5E5E5] flex items-center justify-center shrink-0">
                <FiCompass className="h-5 w-5 text-[#4338CA]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="oi-card-title">Guest Mode</h2>
                <p className="oi-component-subtitle">
                  Operate all platform workflows—Overview, AI Classification, History, Manual
                  Review, Analytics, Dataset &amp; Model, and Settings—without signing in.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGuestMode}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E5E5] bg-[#FCFBF9] px-4 py-2.5 text-sm font-semibold text-[#171717] transition-colors duration-150 hover:bg-[#FFFFFF] hover:border-[#4338CA]/40 hover:text-[#4338CA] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 whitespace-nowrap"
            >
              <span>Continue as Guest (Full Access)</span>
              <FiArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>

            <p className="oi-component-subtitle text-xs text-[#737373]">
              Software-only assistive platform. No patient identifiers collected and no physical bin
              hardware or automated disposal actuation is connected.
            </p>
          </section>

          {/* Foundation Mode Role Selector (shown only when Supabase env vars are unconfigured) */}
          {!isSupabaseConfigured ? (
            <section
              aria-label="Foundation Role Access"
              className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_12px_36px_-16px_rgba(23,23,23,0.06)] space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FCFBF9] border border-[#E5E5E5] flex items-center justify-center shrink-0">
                  <FiKey className="h-5 w-5 text-[#171717]" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="oi-card-title">Foundation Role Access</h2>
                  <p className="oi-component-subtitle">
                    Test role-scoped permissions locally while{' '}
                    <code className="font-mono text-[#171717]">VITE_SUPABASE_URL</code> and{' '}
                    <code className="font-mono text-[#171717]">VITE_SUPABASE_ANON_KEY</code> are
                    unconfigured.
                  </p>
                </div>
              </div>

              <form onSubmit={handleFoundationSubmit} className="space-y-3">
                <fieldset className="space-y-2">
                  <legend className="sr-only">Select Workspace Role</legend>
                  {ROLE_OPTIONS.map((item) => {
                    const checked = selectedRole === item.role;
                    return (
                      <label
                        key={item.role}
                        className={`block rounded-xl p-3.5 cursor-pointer transition-colors duration-150 border ${
                          checked
                            ? 'bg-[#4338CA]/[0.04] border-[#4338CA]'
                            : 'bg-[#FFFFFF] border-[#E5E5E5] hover:border-[#171717]/25'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="foundation-role"
                            value={item.role}
                            checked={checked}
                            onChange={() => setSelectedRole(item.role)}
                            className="accent-[#4338CA]"
                          />
                          <span className="oi-subpanel-title">{item.label}</span>
                          <span className="oi-metadata ml-auto">{item.role}</span>
                        </div>
                        <p className="oi-component-subtitle mt-1 pl-6">{item.scope}</p>
                      </label>
                    );
                  })}
                </fieldset>

                <button
                  type="submit"
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-[#FFFFFF] transition-colors duration-150 hover:bg-[#171717]/90 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 whitespace-nowrap"
                >
                  <span>Enter with Selected Role</span>
                </button>
              </form>
            </section>
          ) : (
            <section
              aria-label="Workspace Role Scopes"
              className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_12px_36px_-16px_rgba(23,23,23,0.06)] space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FCFBF9] border border-[#E5E5E5] flex items-center justify-center shrink-0">
                  <FiShield className="h-5 w-5 text-[#4338CA]" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="oi-card-title">Role-Based Access Control</h2>
                  <p className="oi-component-subtitle">
                    Operational permissions follow the signed-in profile role.
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {ROLE_OPTIONS.map((item) => (
                  <li key={item.role} className="oi-component-subtitle">
                    <span className="oi-subpanel-title">{item.label}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{item.scope}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <footer
        aria-label="Legal navigation"
        className="w-full max-w-[920px] mx-auto mt-8 pt-4 border-t border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737373]"
      >
        <span>BioSort · Assistive biomedical waste segmentation</span>
        <nav aria-label="Authentication legal links" className="flex flex-wrap items-center gap-4">
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
        </nav>
      </footer>
    </div>
  );
}
