import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useMemo } from 'react';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = useMemo(() => {
    if (isLogin || !password) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    if (password.length >= 12) score++;
    const labels = ['Weak', 'Fair', 'Good', 'Strong'] as const;
    const colors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'] as const;
    const textColors = ['text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'] as const;
    const idx = Math.min(score, 4) - 1;
    return idx >= 0 ? { score, label: labels[idx], color: colors[idx], textColor: textColors[idx] } : null;
  }, [password, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: t('auth.loginFailed'),
            description: error.message,
          });
        } else {
          toast({
            title: t('auth.welcomeBack'),
            description: t('auth.successLogin'),
          });
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              variant: 'destructive',
              title: t('auth.accountExists'),
              description: t('auth.emailAlreadyRegistered'),
            });
          } else {
            toast({
              variant: 'destructive',
              title: t('auth.signUpFailed'),
              description: error.message,
            });
          }
        } else {
          toast({
            title: t('auth.accountCreated'),
            description: t('auth.startUsingApp'),
          });
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent)' }}
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          initial={{ top: '10%', left: '15%' }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--accent)), transparent)' }}
          animate={{ x: [0, -25, 35, 0], y: [0, 30, -25, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          initial={{ bottom: '15%', right: '10%' }}
        />
      </div>

      <h1 className="sr-only">Sign in to DarAI</h1>
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, type: 'spring' }}
          >
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <motion.p
            className="mt-3 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Your AI-powered life dashboard
          </motion.p>
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
                <label className="text-sm font-medium text-foreground">{t('auth.displayName')}</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('auth.yourName')}
                    className="pl-12 h-12 text-base"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-12 h-12 text-base"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">{t('auth.password')}</label>
                {isLogin && (
                  <Link 
                    to="/forgot-password" 
                    className="text-xs text-primary hover:underline"
                  >
                    {t('auth.forgotPassword') || 'Forgot password?'}
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-12 pr-12 h-12 text-base"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {!isLogin && passwordStrength && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-colors duration-300 ${
                          i <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
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

            <Button type="submit" className="w-full gap-2 h-12 text-base mt-2" loading={loading}>
              {isLogin ? t('auth.signIn') : t('auth.createAccount')}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
