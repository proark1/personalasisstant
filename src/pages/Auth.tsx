import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

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
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <h1 className="sr-only">Sign in to DarAI</h1>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        {/* Auth Card */}
        <div className="glass-panel-solid p-8">
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
              <label className="text-sm font-medium text-foreground">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-12 h-12 text-base"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2 h-12 text-base mt-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? t('auth.signIn') : t('auth.createAccount')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
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
        </div>
      </div>
    </main>
  );
}
