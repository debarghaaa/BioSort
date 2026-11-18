import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppEntryGate } from './components/common/AppEntryGate';
import { ApplicationLayout } from './components/common/ApplicationLayout';
import { CookieConsent } from './components/common/CookieConsent';
import { LoadingState } from './components/common/LoadingState';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { PublicLayout } from './components/common/PublicLayout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PlatformConfigProvider } from './hooks/usePlatformConfig';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { UserRole } from './types/platform';

const ClassifyPage = lazy(() =>
  import('./pages/ClassifyPage').then((m) => ({ default: m.ClassifyPage }))
);
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage }))
);
const ReviewPage = lazy(() =>
  import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage }))
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const DatasetModelPage = lazy(() =>
  import('./pages/DatasetModelPage').then((m) => ({ default: m.DatasetModelPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const CookiePolicyPage = lazy(() =>
  import('./pages/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage }))
);
const TermsPage = lazy(() =>
  import('./pages/TermsPage').then((m) => ({ default: m.TermsPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);

function RouteSuspenseFallback() {
  return <LoadingState title="Loading view..." />;
}

function WorkspaceRootGate() {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated && location.pathname === '/') {
    return <LandingPage />;
  }

  return (
    <ProtectedRoute>
      <ApplicationLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PlatformConfigProvider>
          <AppEntryGate>
            <Routes>
              <Route path="/welcome" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Public Legal & Contact Routes accessible both signed out and signed in */}
              <Route element={<PublicLayout />}>
                <Route
                  path="/privacy-policy"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <PrivacyPolicyPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/cookie-policy"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <CookiePolicyPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/terms-and-conditions"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <TermsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/contact"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <ContactPage />
                    </Suspense>
                  }
                />
              </Route>

              <Route element={<WorkspaceRootGate />}>
                <Route index element={<DashboardPage />} />
                <Route
                  path="/classify"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <ClassifyPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <HistoryPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/review"
                  element={
                    <ProtectedRoute allowedRoles={[UserRole.REVIEWER, UserRole.ADMIN]}>
                      <Suspense fallback={<RouteSuspenseFallback />}>
                        <ReviewPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <AnalyticsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/models"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <DatasetModelPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <SettingsPage />
                    </Suspense>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <CookieConsent />
          </AppEntryGate>
        </PlatformConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
