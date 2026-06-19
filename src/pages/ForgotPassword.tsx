import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles, Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: t("auth.error") || "Error",
          description: error.message,
        });
      } else {
        setSent(true);
        toast({
          title: t("auth.emailSent") || "Email sent",
          description: t("auth.checkInbox") || "Check your inbox for the reset link",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/8 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      <h1 className="sr-only">Reset your password</h1>
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
          >
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </motion.div>
        </div>

        {/* Reset Card */}
        <div className="glass-panel-solid p-8">
          {sent ? (
            <motion.div
              className="text-center space-y-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring" }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("auth.checkYourEmail") || "Check your email"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("auth.resetLinkSent") || `We've sent a password reset link to ${email}`}
              </p>
              <Link to="/auth">
                <Button variant="outline" className="mt-4 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t("auth.backToLogin") || "Back to login"}
                </Button>
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t("auth.forgotPassword") || "Forgot password?"}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t("auth.resetInstructions") ||
                    "Enter your email and we'll send you a reset link"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t("auth.email") || "Email"}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-12 h-12 text-base"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 text-base" loading={loading}>
                  {t("auth.sendResetLink") || "Send reset link"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/auth"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("auth.backToLogin") || "Back to login"}
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}
