import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/platform';
import { EmptyState } from './EmptyState';
import { OrganicLoadingScreen } from './OrganicLoadingScreen';

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}) {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth.initialized) {
    return <OrganicLoadingScreen message="Verifying authentication session..." />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return (
      <div className="p-6">
        <EmptyState
          title="Access restricted for current role"
          description={`Your active role (${auth.role}) does not have permission to open ${location.pathname}. Required role: ${allowedRoles.join(' or ')}.`}
        />
      </div>
    );
  }

  return <>{children}</>;
}
