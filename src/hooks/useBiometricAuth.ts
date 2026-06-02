import { useState, useEffect, useCallback } from 'react';

interface BiometricAuthState {
  isAvailable: boolean;
  isEnabled: boolean;
  isAuthenticated: boolean;
  isChecking: boolean;
  biometryType: 'faceId' | 'touchId' | 'fingerprint' | 'none';
}

const STORAGE_KEY = 'biometric_auth_enabled';
const LAST_AUTH_KEY = 'biometric_last_auth';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Check if we're running on a native platform
function isNativePlatform(): boolean {
  try {
    // Check for Capacitor
    type CapacitorWindow = { Capacitor?: { isNativePlatform: () => boolean } };
    const win = window as unknown as CapacitorWindow;
    return typeof win?.Capacitor?.isNativePlatform === 'function'
      && win.Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function useBiometricAuth() {
  const [state, setState] = useState<BiometricAuthState>({
    isAvailable: false,
    isEnabled: false,
    isAuthenticated: true, // Start as true so app is usable
    isChecking: false,
    biometryType: 'none',
  });

  // Check if biometric is available on the device
  const checkAvailability = useCallback(async () => {
    if (!isNativePlatform()) {
      // Not on native platform, biometrics not available
      return;
    }

    try {
      // Dynamic import to avoid issues on web
      const { NativeBiometric } = await import('capacitor-native-biometric');
      const { Capacitor } = await import('@capacitor/core');
      
      const result = await NativeBiometric.isAvailable();
      
      let biometryType: BiometricAuthState['biometryType'] = 'none';
      if (result.isAvailable) {
        // Determine type based on platform
        if (Capacitor.getPlatform() === 'ios') {
          biometryType = result.biometryType === 1 ? 'touchId' : 'faceId';
        } else {
          biometryType = 'fingerprint';
        }
      }

      const isEnabled = localStorage.getItem(STORAGE_KEY) === 'true';

      setState(prev => ({
        ...prev,
        isAvailable: result.isAvailable,
        isEnabled,
        biometryType,
      }));
    } catch (error) {
      console.log('Biometric check failed:', error);
    }
  }, []);

  // Authenticate the user
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!state.isAvailable || !state.isEnabled) {
      setState(prev => ({ ...prev, isAuthenticated: true }));
      return true;
    }

    setState(prev => ({ ...prev, isChecking: true }));

    try {
      const { NativeBiometric } = await import('capacitor-native-biometric');
      
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock DarAI',
        title: 'Authenticate',
        subtitle: 'Use biometrics to access the app',
        description: '',
      });

      // Success
      localStorage.setItem(LAST_AUTH_KEY, Date.now().toString());
      setState(prev => ({ ...prev, isAuthenticated: true, isChecking: false }));
      return true;
    } catch (error) {
      console.log('Biometric auth failed:', error);
      setState(prev => ({ ...prev, isChecking: false }));
      return false;
    }
  }, [state.isAvailable, state.isEnabled]);

  // Enable or disable biometric auth
  const setEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(STORAGE_KEY, enabled.toString());
    setState(prev => ({ ...prev, isEnabled: enabled }));
  }, []);

  // Check if re-authentication is needed (after timeout)
  const checkAuthTimeout = useCallback(() => {
    if (!state.isEnabled) return;

    const lastAuth = localStorage.getItem(LAST_AUTH_KEY);
    if (!lastAuth) {
      setState(prev => ({ ...prev, isAuthenticated: false }));
      return;
    }

    const elapsed = Date.now() - parseInt(lastAuth, 10);
    if (elapsed > AUTH_TIMEOUT_MS) {
      setState(prev => ({ ...prev, isAuthenticated: false }));
    }
  }, [state.isEnabled]);

  // Initialize
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Check auth timeout on visibility change (app resume)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuthTimeout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkAuthTimeout]);

  // Get label for UI
  const getBiometryLabel = (): string => {
    switch (state.biometryType) {
      case 'faceId':
        return 'Face ID';
      case 'touchId':
        return 'Touch ID';
      case 'fingerprint':
        return 'Fingerprint';
      default:
        return 'Biometric';
    }
  };

  return {
    ...state,
    authenticate,
    setEnabled,
    checkAuthTimeout,
    getBiometryLabel,
  };
}
