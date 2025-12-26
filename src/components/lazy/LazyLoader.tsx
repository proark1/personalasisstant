import { Suspense, ComponentType, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Default loading fallback for lazy-loaded components
 */
export function DefaultFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <div className="space-y-3 w-full max-w-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

/**
 * Full page loading fallback
 */
export function PageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="space-y-4 w-full max-w-lg px-4">
        <Skeleton className="h-10 w-1/2 mx-auto" />
        <Skeleton className="h-6 w-3/4 mx-auto" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Panel loading fallback for sidebar panels
 */
export function PanelFallback() {
  return (
    <div className="p-4 space-y-4 h-full">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Wrapper component for lazy-loaded content with Suspense
 */
export function LazyLoader({ children, fallback }: LazyLoaderProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback />}>
      {children}
    </Suspense>
  );
}

/**
 * Higher-order component to wrap a lazy component with Suspense
 */
export function withLazyLoading<P extends object>(
  LazyComponent: ComponentType<P>,
  FallbackComponent: ComponentType = DefaultFallback
) {
  return function LazyWrapped(props: P) {
    return (
      <Suspense fallback={<FallbackComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
