import { useCallback, useEffect, useState } from 'react';

// Lazy-loaded Capacitor camera wrapper.
//
// The @capacitor/camera package isn't a hard dependency. When it's
// installed (`bun add @capacitor/camera && npx cap sync`) AND the
// app runs inside a native shell, this hook exposes a real camera
// flow. Web (or no plugin) → returns { available: false } and the
// caller keeps the <input type="file" capture="environment"> flow.
//
// We deliberately route the dynamic import through `new Function`
// so Rollup CANNOT statically resolve the module name at build
// time — that's what lets the package be optional. The string sits
// in a runtime arg, so the bundler treats it as a black box.

interface NativeCameraResult {
  file: File;
  source: 'native_camera';
}

interface NativeCameraApi {
  available: boolean;
  takePhoto: () => Promise<NativeCameraResult | null>;
}

const dynamicImport: (m: string) => Promise<any> =
  new Function('m', 'return import(m)') as (m: string) => Promise<any>;

export function useNativeCamera(): NativeCameraApi {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const core = await dynamicImport('@capacitor/core').catch(() => null);
        if (!core?.Capacitor?.isNativePlatform?.()) return;
        const camera = await dynamicImport('@capacitor/camera').catch(() => null);
        if (camera?.Camera) setAvailable(true);
      } catch {
        // No native shell or no plugin — silently keep the web fallback.
      }
    })();
  }, []);

  const takePhoto = useCallback(async (): Promise<NativeCameraResult | null> => {
    if (!available) return null;
    try {
      const camera = await dynamicImport('@capacitor/camera');
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
