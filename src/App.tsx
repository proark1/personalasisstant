import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { XPBadgeProvider } from "@/components/ui/xp-badge";

import { useMorningAutoPlay } from "@/hooks/useMorningAutoPlay";
import Index from "@/pages/Index";
import CalendarCallback from "@/pages/CalendarCallback";
import {
  LazyAuth,
  LazyForgotPassword,
  LazyResetPassword,
  LazyDashboard,
  LazyContactsPage,
  LazyContractsPage,
  LazyNotFound,
  LazyOnboarding,
  PageFallback,
} from "@/components/lazy";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
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
      <NetworkStatusBanner />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="min-h-screen"
        >
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
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
    <LanguageProvider>
      <TooltipProvider>
        <XPBadgeProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary fallbackTitle="DarAI couldn't load">
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </ErrorBoundary>
        </XPBadgeProvider>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
