import { useEffect, useMemo, useState } from "react";

export type NetworkStatus = {
  online: boolean;
  effectiveType?: string;
};

export function useNetworkStatus(): NetworkStatus {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const effectiveType =
    typeof navigator !== "undefined" && "connection" in navigator
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).connection?.effectiveType
      : undefined;

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return useMemo(() => ({ online, effectiveType }), [online, effectiveType]);
}
