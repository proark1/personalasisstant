import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles, Lock, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = useMemo(() => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    if (password.length >= 12) score++;
    const labels = ["Weak", "Fair", "Good", "Strong"] as const;
    const colors = ["bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"] as const;
    const textColors = [
      "text-red-500",
      "text-yellow-500",
      "text-blue-500",
      "text-green-500",
    ] as const;
    const idx = Math.min(score, 4) - 1;
    return idx >= 0
      ? { score, label: labels[idx], color: colors[idx], textColor: textColors[idx] }
      : null;
  }, [password]);

  const passwordsMatch = confirmPassword.length > 0 ? password === confirmPassword : null;

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        // User clicked the reset link
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t("auth.error") || "Error",
        description: t("auth.passwordsDontMatch") || "Passwords do not match",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: t("auth.error") || "Error",
        description: t("auth.passwordTooShort") || "Password must be at least 6 characters",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          variant: "destructive",
          title: t("auth.error") || "Error",
          description: error.message,
        });
      } else {
        setSuccess(true);
        toast({
          title: t("auth.passwordUpdated") || "Password updated",
          description: t("auth.canNowLogin") || "You can now login with your new password",
        });
        setTimeout(() => navigate("/auth"), 2000);
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

      <h1 className="sr-only">Set new password</h1>
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
          {success ? (
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
                {t("auth.passwordReset") || "Password reset!"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("auth.redirectingToLogin") || "Redirecting you to login..."}
              </p>
            </motion.div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t("auth.setNewPassword") || "Set new password"}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t("auth.enterNewPassword") || "Enter your new password below"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t("auth.newPassword") || "New password"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 text-base"
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordStrength && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex gap-0.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-colors duration-300 ${
                              i <= passwordStrength.score ? passwordStrength.color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength.textColor}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t("auth.confirmPassword") || "Confirm password"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`pl-12 pr-12 h-12 text-base ${
                        passwordsMatch === false ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                    {passwordsMatch !== null && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {passwordsMatch ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 text-base" loading={loading}>
                  {t("auth.updatePassword") || "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}
