import { useMemo, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Auth1, type Auth1Credentials } from '../components/ui/auth1';
import { getConfiguredOAuthProviders, useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../services/supabase/client';

export function RegisterPage() {
  const { auth, signUpWithSupabase, signInWithOAuth } = useAuth();
  const navigate = useNavigate();
  const oauthProviders = useMemo(() => getConfiguredOAuthProviders(), []);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleRegister = async ({ email, password, displayName }: Auth1Credentials) => {
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await signUpWithSupabase(email, password, displayName);
      if (result.requiresEmailConfirmation) {
        setSuccessMessage(
          'Account created. Check your inbox for a verification link before signing in to your workspace.'
        );
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account registration failed.');
    }
  };

  return (
    <div className="auth-organic-shell min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-[480px] space-y-4">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded px-1 py-1"
        >
          <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to sign in</span>
        </button>

        <Auth1
          brandName="BioSort"
          brandDescriptor="AI-assisted biomedical waste image segmentation"
          badgeText="NEW ACCOUNT"
          heading="Create workspace account."
          subheading="Register an operator profile to classify biomedical waste images, track disposal policies, and audit decisions."
          emailLabel="Workspace email"
          emailPlaceholder="Enter your email address"
          passwordLabel="Password"
          passwordPlaceholder="Create a password (min. 8 characters)"
          submitLabel="Create account"
          submittingLabel="Creating account..."
          dividerText="OR REGISTER WITH EMAIL"
          bottomPromptText="Already have an account?"
          bottomPromptLinkText="Sign in to workspace"
          footerNote="AI-assisted biomedical waste segmentation"
          showDisplayNameField
          showConfirmPasswordField
          showForgotPassword={false}
          passwordMinLength={8}
          passwordAutoComplete="new-password"
          oauthProviders={oauthProviders}
          oauthUnavailableNote={
            isSupabaseConfigured
              ? undefined
              : 'Account creation requires Supabase Auth configuration (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). Return to sign in to use Guest Mode or Foundation Role Access.'
          }
          error={error}
          successMessage={successMessage}
          onSubmit={handleRegister}
          onBottomPromptClick={() => navigate('/login')}
          onOAuthSignIn={oauthProviders.length > 0 ? signInWithOAuth : undefined}
        />

        <footer
          aria-label="Registration legal navigation"
          className="pt-3 border-t border-[#E5E5E5] flex flex-wrap items-center justify-center gap-4 text-xs text-[#737373]"
        >
          <Link to="/privacy-policy" className="hover:text-[#4338CA] transition-colors">
            Privacy Policy
          </Link>
          <Link to="/cookie-policy" className="hover:text-[#4338CA] transition-colors">
            Cookie Policy
          </Link>
          <Link to="/terms-and-conditions" className="hover:text-[#4338CA] transition-colors">
            Terms
          </Link>
          <Link to="/contact" className="hover:text-[#4338CA] transition-colors">
            Contact
          </Link>
        </footer>
      </div>
    </div>
  );
}
