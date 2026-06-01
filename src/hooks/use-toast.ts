import * as React from "react";
import { toast as sonnerToast } from "sonner";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;

// Thin adapter: route the legacy shadcn `toast()` API through sonner so all
// existing callers keep working but render in a single place/style. The
// shadcn <Toaster /> is no longer mounted, so there's no reducer state here.
function toast({ title, description, variant }: Toast) {
  const id =
    variant === "destructive"
      ? sonnerToast.error((title ?? "") as React.ReactNode, { description })
      : sonnerToast((title ?? "") as React.ReactNode, { description });

  const dismiss = () => sonnerToast.dismiss(id);
  const update = ({ title: nextTitle, description: nextDescription, variant: nextVariant }: Partial<ToasterToast>) => {
    if (nextVariant === "destructive") {
      sonnerToast.error((nextTitle ?? "") as React.ReactNode, { id, description: nextDescription });
    } else {
      sonnerToast((nextTitle ?? "") as React.ReactNode, { id, description: nextDescription });
    }
  };

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  return {
    // No mounted shadcn viewport, so there are never any toasts to render.
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
