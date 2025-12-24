import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

async function resetWebCaches() {
  // Unregister service workers
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }

  // Clear Cache Storage
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export function NetworkStatusBanner() {
  const { online, effectiveType } = useNetworkStatus();
  const { toast } = useToast();
  const [resetting, setResetting] = useState(false);

  const hint = useMemo(() => {
    if (online) return null;
    if (effectiveType) return `Connection looks offline (${effectiveType}).`;
    return "Connection looks offline.";
  }, [online, effectiveType]);

  if (online) return null;

  return (
    <aside className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <p className="text-sm text-foreground">
          <span className="font-medium">Offline:</span> data can’t load right now. {hint}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={resetting}
            onClick={async () => {
              try {
                setResetting(true);
                await resetWebCaches();
                toast({
                  title: "Reset complete",
                  description: "Reloading the app now…",
                });
                window.location.reload();
              } catch (e) {
                toast({
                  title: "Reset failed",
                  description: "Couldn’t reset cache/service worker. Please hard refresh.",
                  variant: "destructive",
                });
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? "Resetting…" : "Reset cache"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
