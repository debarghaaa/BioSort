import React, { useId, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
} from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BioSortLogo } from '../components/common/BioSortLogo';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../services/supabase/client';
import { validateEmail, validatePassword } from '../utils/authValidation';

export function ResetPasswordPage() {
  const { auth, resetPasswordForEmail, updatePasswordWithSupabase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formId = useId();

  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRequestReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccessMessage(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordForEmail(email.trim());
      setSuccessMessage(
        'If an account exists for that email address, a password recovery link has been sent.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send password recovery email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccessMessage(null);

    const passwordError = validatePassword(newPassword, { minLength: 8 });
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePasswordWithSupabase(newPassword);
      setSuccessMessage('Your workspace password has been updated. You may now continue.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const isRecoveryCompletion = auth.isRecoverySession && auth.isAuthenticated;

  return (
    <div className="auth-organic-shell min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-[460px] space-y-4">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 rounded px-1 py-1"
        >
          <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to sign in</span>
        </button>

        <div className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-[0_12px_36px_-16px_rgba(23,23,23,0.08)] overflow-hidden text-[#171717]">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-[#4338CA]/10 border border-[#4338CA]/20 flex items-center justify-center shrink-0">
                    <BioSortLogo className="h-5 w-5 text-[#4338CA]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#171717] leading-tight truncate">
                      BioSort
                    </p>
                    <p className="text-xs text-[#737373] leading-snug truncate mt-0.5">
                      AI-assisted biomedical waste image segmentation
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-medium tracking-[0.12em] uppercase text-[#4338CA] bg-[#FCFBF9] border border-[#E5E5E5] rounded-md px-2.5 py-1 whitespace-nowrap shrink-0">
                  ACCOUNT RECOVERY
                </span>
              </div>

              <div className="space-y-1.5">
                <h1 className="auth-organic-display text-2xl sm:text-[28px] font-semibold tracking-tight text-[#171717] leading-tight">
                  {isRecoveryCompletion ? 'Set a new password.' : 'Reset your password.'}
                </h1>
                <p className="text-sm text-[#737373] leading-relaxed">
                  {isRecoveryCompletion
                    ? 'Enter a new password for your authenticated recovery session.'
                    : 'Enter your workspace email address and we will send password recovery instructions.'}
                </p>
              </div>
            </div>

            {!isSupabaseConfigured && (
              <p className="text-[11px] text-[#737373] leading-relaxed border border-[#E5E5E5] bg-[#FCFBF9] rounded-xl px-3.5 py-2.5">
                Password recovery emails require Supabase Auth configuration (
                <code className="font-mono text-[#171717]">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-[#171717]">VITE_SUPABASE_ANON_KEY</code>).
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#D9534F]/40 bg-[#FDF3F2] px-3.5 py-3 text-xs text-[#9F2D2A]"
              >
                <FiAlertCircle className="h-4 w-4 text-[#D9534F] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed">{error}</span>
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

            {isRecoveryCompletion ? (
              <form onSubmit={handleUpdatePassword} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${formId}-new-password`}
                    className="block text-xs font-medium text-[#171717]"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <FiLock
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                      aria-hidden="true"
                    />
                    <input
                      id={`${formId}-new-password`}
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      disabled={submitting}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 8 characters)"
                      className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-11 text-sm text-[#171717] placeholder:text-[#737373]/80 focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showNewPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#737373] hover:text-[#171717]"
                    >
                      {showNewPassword ? (
                        <FiEyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <FiEye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`${formId}-confirm-password`}
                    className="block text-xs font-medium text-[#171717]"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <FiLock
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                      aria-hidden="true"
                    />
                    <input
                      id={`${formId}-confirm-password`}
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      disabled={submitting}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-3.5 text-sm text-[#171717] placeholder:text-[#737373]/80 focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-[#FFFFFF] hover:bg-[#3730A3] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:opacity-55"
                >
                  <span>{submitting ? 'Updating password...' : 'Update password'}</span>
                  <FiArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRequestReset} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${formId}-reset-email`}
                    className="block text-xs font-medium text-[#171717]"
                  >
                    Workspace email
                  </label>
                  <div className="relative">
                    <FiMail
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]"
                      aria-hidden="true"
                    />
                    <input
                      id={`${formId}-reset-email`}
                      type="email"
                      autoComplete="email"
                      required
                      disabled={submitting}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="h-11 w-full rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] pl-10 pr-3.5 text-sm text-[#171717] placeholder:text-[#737373]/80 focus:border-[#6366F1] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-[#FFFFFF] hover:bg-[#3730A3] focus-visible:outline-2 focus-visible:outline-[#6366F1] focus-visible:outline-offset-2 disabled:opacity-55"
                >
                  <span>{submitting ? 'Sending recovery link...' : 'Send recovery link'}</span>
                  <FiArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-[#E5E5E5] bg-[#FCFBF9] px-6 sm:px-8 py-3 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#737373]">
              AI-assisted biomedical waste segmentation
            </span>
            <span className="font-mono text-[10px] tracking-wider uppercase text-[#737373]">
              Clinical AI
            </span>
          </div>
        </div>

        <footer
          aria-label="Recovery legal navigation"
          className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-[#737373]"
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
