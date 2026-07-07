import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authMode = searchParams.get("mode");
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();

  const [isLogin, setIsLogin] = useState(authMode !== "signup");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const displayNameId = "auth-display-name";
  const emailId = "auth-email";
  const passwordId = "auth-password";

  useEffect(() => {
    setIsLogin(authMode !== "signup");
  }, [authMode]);

  const passwordStrength = useMemo(() => {
    if (isLogin || !password) return null;
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
  }, [password, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          const msg = error instanceof Error ? error.message : String(error);
          toast({
            variant: "destructive",
            title: t("auth.loginFailed"),
            description: msg,
          });
        } else {
          toast({
            title: t("auth.welcomeBack"),
            description: t("auth.successLogin"),
          });
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("already registered")) {
            toast({
              variant: "destructive",
              title: t("auth.accountExists"),
              description: t("auth.emailAlreadyRegistered"),
            });
          } else {
            toast({
              variant: "destructive",
              title: t("auth.signUpFailed"),
              description: msg,
            });
          }
        } else {
          toast({
            title: t("auth.accountCreated"),
            description: t("auth.startUsingApp"),
          });
          navigate("/");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModeToggle = () => {
    const nextIsLogin = !isLogin;
    setIsLogin(nextIsLogin);
    setSearchParams(nextIsLogin ? {} : { mode: "signup" }, { replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <Link
        to="/landing"
        className="absolute left-4 top-4 inline-flex min-h-[44px] items-center gap-2 rounded-[8px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("auth.backToDarai")}
      </Link>
      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link
            to="/landing"
            aria-label={t("auth.backToDarai")}
            className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <motion.div
              className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, type: "spring" }}
            >
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </motion.div>
          </Link>
          <motion.p
            className="mt-3 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {t("auth.authSubtitle")}
          </motion.p>
          <motion.h1
            className="mt-3 text-center text-2xl font-semibold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {isLogin ? t("auth.welcomeTitle") : t("auth.createAccountTitle")}
          </motion.h1>
        </div>

        {/* Auth Card */}
        <motion.div
          className="glass-panel-solid p-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-3">
                <label htmlFor={displayNameId} className="text-sm font-medium text-foreground">
                  {t("auth.displayName")}{" "}
                  <span className="text-muted-foreground">({t("common.optional")})</span>
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id={displayNameId}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("auth.yourName")}
                    className="h-12 pl-12 text-base sm:h-12"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label htmlFor={emailId} className="text-sm font-medium text-foreground">
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 pl-12 text-base sm:h-12"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor={passwordId} className="text-sm font-medium text-foreground">
                  {t("auth.password")}
                </label>
                {isLogin && (
                  <Link
                    to="/forgot-password"
                    className="inline-flex min-h-[44px] items-center text-xs text-primary hover:underline"
                  >
                    {t("auth.forgotPassword") || "Forgot password?"}
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 pl-12 pr-12 text-base sm:h-12"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {!isLogin && passwordStrength && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted">
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
              {!isLogin && !passwordStrength && (
                <p className="text-xs text-muted-foreground">{t("auth.passwordRequirement")}</p>
              )}
            </div>

            <Button type="submit" className="mt-2 h-12 w-full gap-2 text-base" loading={loading}>
              {isLogin ? t("auth.signIn") : t("auth.createAccount")}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleModeToggle}
              className="inline-flex min-h-[44px] items-center text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {isLogin ? t("auth.dontHaveAccount") : t("auth.alreadyHaveAccount")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
