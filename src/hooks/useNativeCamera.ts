import { useCallback, useEffect, useState } from 'react';

// Lazy-loaded Capacitor camera wrapper.
//
// @capacitor/core IS in the dep tree, so a normal dynamic import is fine.
// @capacitor/camera is OPTIONAL — it isn't installed by default; users opt
// in with `bun add @capacitor/camera && npx cap sync`. Vite would fail dep
// resolution if we wrote a literal `import('@capacitor/camera')`, so we
// hide the specifier behind an indirect call that the bundler treats as
// opaque. We use Function.prototype.call rather than `new Function(...)`
// to avoid CSP `unsafe-eval`, and we restrict the input to a fixed
// allowlist so the specifier can never become data-driven.

interface NativeCameraResult {
  file: File;
  source: 'native_camera';
}

interface NativeCameraApi {
  available: boolean;
  takePhoto: () => Promise<NativeCameraResult | null>;
}

const OPTIONAL_NATIVE_MODULES = ['@capacitor/camera'] as const;
type OptionalNativeModule = (typeof OPTIONAL_NATIVE_MODULES)[number];

// Hide the specifier from Rollup/Vite static analysis. The @vite-ignore
// pragma + variable input combo means the bundler emits a runtime import()
// without trying to resolve the module at build time.
const importOptional = (m: OptionalNativeModule): Promise<any> => {
  if (!OPTIONAL_NATIVE_MODULES.includes(m)) {
    return Promise.reject(new Error(`Module not allowlisted: ${m}`));
  }
  const spec: string = m;
  return import(/* @vite-ignore */ spec).catch((): null => null);
};

export function useNativeCamera(): NativeCameraApi {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const core = await import('@capacitor/core').catch((): null => null);
        if (!core?.Capacitor?.isNativePlatform?.()) return;
        const camera = await importOptional('@capacitor/camera');
        if (camera?.Camera) setAvailable(true);
      } catch {
        // No native shell or no plugin — silently keep the web fallback.
      }
    })();
  }, []);

  const takePhoto = useCallback(async (): Promise<NativeCameraResult | null> => {
    if (!available) return null;
    try {
      const camera = await importOptional('@capacitor/camera');
      if (!camera) return null;
      const { Camera, CameraResultType, CameraSource } = camera;
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        webUseInput: true,
      });
      const path = (photo as any)?.webPath || (photo as any)?.path;
      if (!path) return null;
      const res = await fetch(path);
      const blob = await res.blob();
      const ext = (photo as any)?.format || 'jpeg';
      const file = new File([blob], `camera-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
      return { file, source: 'native_camera' };
    } catch (err) {
      console.warn('[useNativeCamera] takePhoto failed', (err as Error).message);
      return null;
    }
  }, [available]);

  return { available, takePhoto };
}
