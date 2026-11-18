import React, { useId, useState } from 'react';
import { FaGithub, FaGoogle, FaMicrosoft } from 'react-icons/fa';
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiUser,
} from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { BioSortLogo } from '../../common/BioSortLogo';
import {
  validateEmail,
  validatePassword,
  type OAuthProviderConfig,
  type SupportedOAuthProvider,
} from '../../../utils/authValidation';

export interface Auth1Credentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface Auth1Props {
  brandName?: string;
  brandDescriptor?: string;
  badgeText?: string;
  heading?: string;
  subheading?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  dividerText?: string;
  forgotPasswordText?: string;
  bottomPromptText?: string;
  bottomPromptLinkText?: string;
  footerNote?: string;
  oauthProviders?: OAuthProviderConfig[];
  oauthUnavailableNote?: string;
  loading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  initialEmail?: string;
  showDisplayNameField?: boolean;
  displayNameLabel?: string;
  displayNamePlaceholder?: string;
  showConfirmPasswordField?: boolean;
  confirmPasswordLabel?: string;
  confirmPasswordPlaceholder?: string;
  showPasswordField?: boolean;
  showForgotPassword?: boolean;
  passwordMinLength?: number;
  passwordAutoComplete?: 'current-password' | 'new-password';
  onSubmit?: (credentials: Auth1Credentials) => Promise<void> | void;
  onForgotPassword?: (email: string) => void;
  onBottomPromptClick?: () => void;
  onOAuthSignIn?: (provider: SupportedOAuthProvider) => Promise<void> | void;
  className?: string;
}

function renderOAuthIcon(provider: SupportedOAuthProvider) {
  switch (provider) {
    case 'google':
      return <FaGoogle className="h-4 w-4 text-[#171717]" aria-hidden="true" />;
    case 'github':
      return <FaGithub className="h-4 w-4 text-[#171717]" aria-hidden="true" />;
    case 'azure':
      return <FaMicrosoft className="h-4 w-4 text-[#171717]" aria-hidden="true" />;
  }
}

export function Auth1({
  brandName = 'BioSort',
  brandDescriptor = 'AI-assisted biomedical waste image segmentation',
  badgeText = 'SECURE ACCESS',
  heading = 'Welcome back.',
  subheading = 'Access your workspace to process, review, and manage biomedical waste segmentation results.',
  emailLabel = 'Workspace email',
  emailPlaceholder = 'Enter your email address',
  passwordLabel = 'Password',
  passwordPlaceholder = 'Enter your password',
  submitLabel = 'Sign in to workspace',
  submittingLabel = 'Signing in...',
  dividerText = 'OR CONTINUE WITH EMAIL',
  forgotPasswordText = 'Forgot password?',
  bottomPromptText = 'New to the platform?',
  bottomPromptLinkText = 'Create an account',
  footerNote = 'AI-assisted biomedical waste segmentation',
  oauthProviders = [],
  oauthUnavailableNote,
  loading = false,
  error = null,
  successMessage = null,
  initialEmail = '',
  showDisplayNameField = false,
  displayNameLabel = 'Full name',
  displayNamePlaceholder = 'Enter your full name',
  showConfirmPasswordField = false,
  confirmPasswordLabel = 'Confirm password',
  confirmPasswordPlaceholder = 'Re-enter your password',
  showPasswordField = true,
  showForgotPassword = true,
  passwordMinLength = 1,
  passwordAutoComplete = 'current-password',
  onSubmit,
  onForgotPassword,
  onBottomPromptClick,
  onOAuthSignIn,
  className,
}: Auth1Props) {
  const formId = useId();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState<SupportedOAuthProvider | null>(null);

  const isBusy = loading || submitting || oauthSubmitting !== null;
  const activeError = localError || error;
  const hasOAuth = oauthProviders.length > 0 && Boolean(onOAuthSignIn);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isBusy) return;

    setLocalError(null);

    if (showDisplayNameField && !displayName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      setLocalError(emailError);
      return;
    }

    if (showPasswordField) {
      const passwordError = validatePassword(password, { minLength: passwordMinLength });
      if (passwordError) {
        setLocalError(passwordError);
        return;
      }
      if (showConfirmPasswordField && password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    if (!onSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit({
        email: email.trim(),
        password,
        displayName: showDisplayNameField ? displayName.trim() : undefined,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to process authentication.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthClick = async (provider: SupportedOAuthProvider) => {
    if (isBusy || !onOAuthSignIn) return;
    setLocalError(null);
    setOauthSubmitting(provider);
    try {
      await onOAuthSignIn(provider);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      setOauthSubmitting(null);
    }
  };

  return (
    <div
      className={cn(
        'w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-[0_12px_36px_-16px_rgba(23,23,23,0.08)] overflow-hidden text-[#171717]',
        className
      )}
    >
      <div className="p-6 sm:p-8 space-y-6">
        {/* Clinical Brand Header */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
                <BioSortLogo className="h-5 w-5 text-[#4338CA]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#171717] leading-tight truncate">
                  {brandName}
                </p>
                <p className="text-xs text-[#737373] leading-snug truncate mt-0.5">
                  {brandDescriptor}
                </p>
              </div>
            </div>

            {badgeText && (
              <span className="font-mono text-[11px] font-medium tracking-[0.12em] uppercase text-[#4338CA] bg-[#FCFBF9] border border-[#E5E5E5] rounded-md px-2.5 py-1 whitespace-nowrap shrink-0">
                {badgeText}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <h1 className="auth-organic-display text-2xl sm:text-[28px] font-semibold tracking-tight text-[#171717] leading-tight">
              {heading}
            </h1>
            <p className="text-sm text-[#737373] leading-relaxed">{subheading}</p>
          </div>
        </div>

        {/* Status Feedback */}
        {activeError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[#D9534F]/40 bg-[#FDF3F2] px-3.5 py-3 text-xs text-[#9F2D2A]"
          >
            <FiAlertCircle className="h-4 w-4 text-[#D9534F] shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{activeError}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-[#238B68]/35 bg-[#F2FAF7] px-3.5 py-3 text-xs text-[#17644A]"
          >
            <FiCheckCircle className="h-4 w-4 text-[#238B68] shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* OAuth Providers (Only rendered when genuinely configured) */}
        {hasOAuth && (
          <>
            <div
              className={cn(
                'grid gap-2.5',
                oauthProviders.length === 1
                  ? 'grid-cols-1'
                  : oauthProviders.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-3'
              )}
            >
              {oauthProviders.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleOAuthClick(provider.id)}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] px-3.5 py-2.5 text-xs font-medium text-[#171717] transition-colors duration-150 hover:bg-[#FCFBF9] hover:border-[#171717]/30 focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {renderOAuthIcon(provider.id)}
                  <span>
                    {oauthSubmitting === provider.id ? 'Connecting...' : provider.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-[#E5E5E5]" />
              <span className="px-3 font-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#737373] bg-[#FFFFFF]">
                {dividerText}
              </span>
              <div className="flex-grow border-t border-[#E5E5E5]" />
            </div>
          </>
        )}

        {!hasOAuth && oauthUnavailableNote && (
          <p className="text-[11px] text-[#737373] leading-relaxed border border-[#E5E5E5] bg-[#FCFBF9] rounded-xl px-3.5 py-2.5">
            {oauthUnavailableNote}
          </p>
        )}

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {showDisplayNameField && (
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-name`}
                className="block text-xs font-medium text-[#171717]"
              >
                {displayNameLabel}
              </label>
              <div className="relative">
                <FiUser
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                  aria-hidden="true"
                />
                <input
                  id={`${formId}-name`}
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={isBusy}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={displayNamePlaceholder}
                  className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-3.5 text-sm text-[#171717] placeholder:text-[#737373]/80 transition-colors focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:bg-[#FCFBF9] disabled:opacity-60"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-email`}
              className="block text-xs font-medium text-[#171717]"
            >
              {emailLabel}
            </label>
            <div className="relative">
              <FiMail
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                aria-hidden="true"
              />
              <input
                id={`${formId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isBusy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={emailPlaceholder}
                className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-3.5 text-sm text-[#171717] placeholder:text-[#737373]/80 transition-colors focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:bg-[#FCFBF9] disabled:opacity-60"
              />
            </div>
          </div>

          {showPasswordField && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${formId}-password`}
                  className="block text-xs font-medium text-[#171717]"
                >
                  {passwordLabel}
                </label>
                {showForgotPassword && onForgotPassword && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onForgotPassword(email.trim())}
                    className="text-xs font-medium text-[#4338CA] hover:text-[#6366F1] transition-colors focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded px-1 py-0.5 disabled:opacity-50"
                  >
                    {forgotPasswordText}
                  </button>
                )}
              </div>

              <div className="relative">
                <FiLock
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                  aria-hidden="true"
                />
                <input
                  id={`${formId}-password`}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={passwordAutoComplete}
                  required
                  disabled={isBusy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordPlaceholder}
                  className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-11 text-sm text-[#171717] placeholder:text-[#737373]/80 transition-colors focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:bg-[#FCFBF9] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={isBusy}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#737373] hover:text-[#171717] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-1"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <FiEye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}

          {showPasswordField && showConfirmPasswordField && (
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-confirm-password`}
                className="block text-xs font-medium text-[#171717]"
              >
                {confirmPasswordLabel}
              </label>
              <div className="relative">
                <FiLock
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                  aria-hidden="true"
                />
                <input
                  id={`${formId}-confirm-password`}
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={isBusy}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={confirmPasswordPlaceholder}
                  className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-11 text-sm text-[#171717] placeholder:text-[#737373]/80 transition-colors focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:bg-[#FCFBF9] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirmPassword}
                  disabled={isBusy}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#737373] hover:text-[#171717] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-1"
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <FiEye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-[#FFFFFF] transition-colors duration-150 hover:bg-[#3730A3] active:bg-[#312E81] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <span>{isBusy ? submittingLabel : submitLabel}</span>
            <FiArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </form>

        {/* Bottom Prompt */}
        {onBottomPromptClick && (
          <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-center gap-1.5 text-xs text-[#737373]">
            <span>{bottomPromptText}</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={onBottomPromptClick}
              className="font-semibold text-[#4338CA] hover:text-[#6366F1] transition-colors focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded px-1 py-0.5"
            >
              {bottomPromptLinkText}
            </button>
          </div>
        )}
      </div>

      {/* Clinical Footer Strip */}
      {footerNote && (
        <div className="border-t border-[#E5E5E5] bg-[#FCFBF9] px-6 sm:px-8 py-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#737373]">{footerNote}</span>
          <span className="font-mono text-[10px] tracking-wider uppercase text-[#737373]">
            Clinical AI
          </span>
        </div>
      )}
    </div>
  );
}
