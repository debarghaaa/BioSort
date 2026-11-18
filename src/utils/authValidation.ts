export type SupportedOAuthProvider = 'google' | 'github' | 'azure';

export interface OAuthProviderConfig {
  id: SupportedOAuthProvider;
  label: string;
}

const PROVIDER_LABELS: Record<SupportedOAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  azure: 'Microsoft',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Please enter your workspace email address.';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validatePassword(
  password: string,
  options: { minLength?: number } = {}
): string | null {
  if (!password) {
    return 'Please enter your password.';
  }
  const minLength = options.minLength ?? 1;
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long.`;
  }
  return null;
}

export function sanitizeRedirectPath(
  pathname: string | null | undefined,
  fallback = '/'
): string {
  if (!pathname || typeof pathname !== 'string') {
    return fallback;
  }
  const trimmed = pathname.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }
  const lower = trimmed.toLowerCase();
  if (
    lower === '/login' ||
    lower === '/register' ||
    lower === '/reset-password' ||
    lower.startsWith('/login?') ||
    lower.startsWith('/register?') ||
    lower.startsWith('/reset-password?')
  ) {
    return fallback;
  }
  return trimmed;
}

export function parseConfiguredOAuthProviders(
  rawProviders: string | undefined,
  supabaseConfigured: boolean
): OAuthProviderConfig[] {
  if (!supabaseConfigured || !rawProviders) {
    return [];
  }
  const seen = new Set<SupportedOAuthProvider>();
  const result: OAuthProviderConfig[] = [];

  for (const token of rawProviders.split(',')) {
    const normalized = token.trim().toLowerCase();
    const mapped: SupportedOAuthProvider | null =
      normalized === 'google'
        ? 'google'
        : normalized === 'github'
          ? 'github'
          : normalized === 'azure' || normalized === 'microsoft'
            ? 'azure'
            : null;

    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      result.push({ id: mapped, label: PROVIDER_LABELS[mapped] });
    }
  }

  return result;
}
