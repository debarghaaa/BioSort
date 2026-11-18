import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { OrganicLoadingScreen } from './OrganicLoadingScreen';

export function AppEntryGate({ children }: { children: React.ReactNode }) {
  const { auth, retryInitialization, clearInitError } = useAuth();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  if (!auth.initialized) {
    return (
      <OrganicLoadingScreen
        message="Restoring workspace session..."
        detail="Verifying clinical workspace access and classification policy configuration."
      />
    );
  }

  if (auth.initError) {
    const handleRetry = async () => {
      if (retrying) return;
      setRetrying(true);
      try {
        await retryInitialization();
      } finally {
        setRetrying(false);
      }
    };

    const handleContinueToLogin = () => {
      clearInitError();
      navigate('/login', { replace: true });
    };

    return (
      <OrganicLoadingScreen
        error={auth.initError}
        retrying={retrying}
        onRetry={handleRetry}
        onContinueToLogin={handleContinueToLogin}
      />
    );
  }

  return <div className="oi-fade-in">{children}</div>;
}
