import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { XPBadgeProvider } from "@/components/ui/xp-badge";
import { InfrastructureProvider } from "@/components/InfrastructureProvider";

import { useMorningAutoPlay } from "@/hooks/useMorningAutoPlay";
import { TopLoader } from "@/components/ui/top-loader";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { installGlobalErrorTelemetry } from "@/lib/telemetry";

// Capture uncaught errors + unhandled rejections app-wide (once).
installGlobalErrorTelemetry();
import Landing from "@/pages/Landing";
import CalendarCallback from "@/pages/CalendarCallback";
import { lazy } from "react";
import {
  LazyAuth,
  LazyForgotPassword,
  LazyResetPassword,
  LazyDashboard,
  LazyContactsPage,
  LazyContractsPage,
  LazyFinancePage,
  LazyTravelPage,
  LazyNotFound,
  LazyOnboarding,
  LazyIndex,
  PageFallback,
} from "@/components/lazy";

const LazyWorkspaces = lazy(() => import("@/pages/Workspaces"));
const LazyActivity = lazy(() => import("@/pages/Activity"));

// Throttle toasts so a burst of failing queries (e.g. session expired,
// every panel re-fetching at once) doesn't spam the user.
let lastErrorToastAt = 0;
function maybeToastError(err: unknown, queryKey?: readonly unknown[]) {
  const now = Date.now();
  if (now - lastErrorToastAt < 3000) return;
  lastErrorToastAt = now;
  const message = err instanceof Error ? err.message : 'Something went wrong loading your data.';
  toast.error(message, {
    description: queryKey ? `If this persists, please refresh the page.` : undefined,
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) => {
      // Background refetches that still have cached data don't need a
      // user-visible toast — the UI keeps showing the cached value.
      if (query.state.data !== undefined) return;
      maybeToastError(err, query.queryKey);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      // Cap retries so a failing module doesn't stall the load tier.
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // Prefer cached data while refetching — graceful degradation default.
      placeholderData: (prev: unknown) => prev,
    },
    mutations: {
      retry: 0,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandedLoader />;
  }

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandedLoader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  useMorningAutoPlay();
  const location = useLocation();
  
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to content
      </a>
      <TopLoader />
      <NetworkStatusBanner />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="min-h-screen"
          id="main-content"
        >
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LazyIndex />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LazyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <LazyContactsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts"
            element={
              <ProtectedRoute>
                <LazyContractsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute>
                <LazyFinancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/travel"
            element={
              <ProtectedRoute>
                <LazyTravelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces"
            element={
              <ProtectedRoute>
                <LazyWorkspaces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <LazyActivity />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landing"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <LazyAuth />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <LazyForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={<LazyResetPassword />}
          />
          <Route
            path="/auth/calendar-callback"
            element={
              <ProtectedRoute>
                <CalendarCallback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <LazyOnboarding />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<LazyNotFound />} />
        </Routes>
      </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
        <InfrastructureProvider>
          <LanguageProvider>
            <TooltipProvider>
              <XPBadgeProvider>
                <Toaster />
                <Sonner position="top-center" />
                <ErrorBoundary fallbackTitle="DarAI couldn't load">
                  <BrowserRouter>
                    <AppContent />
                  </BrowserRouter>
                </ErrorBoundary>
              </XPBadgeProvider>
            </TooltipProvider>
          </LanguageProvider>
        </InfrastructureProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
