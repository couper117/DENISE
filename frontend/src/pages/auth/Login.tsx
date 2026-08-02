import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store';
import { User } from '../../types';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setTokens } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '' });

  const from = (location.state as { from?: string })?.from || '/';

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(form).then((r) => r.data.data),
    onSuccess: (data: { user: User; accessToken: string; refreshToken: string }) => {
      setUser(data.user);
      setTokens(data.accessToken, data.refreshToken);
      navigate(from);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <h1 className="font-serif text-2xl font-bold">{t('auth.login_title')}</h1>
          <p className="text-muted-foreground mt-1">{t('auth.login_subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">{t('auth.phone')}</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input required type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+250 780 000 000"
                className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-sm font-medium">{t('auth.password')}</label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t('auth.forgot_password')}</Link>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {loginMutation.error && (
            <p className="text-sm text-destructive text-center">Invalid phone number or password.</p>
          )}

          <button type="submit" disabled={loginMutation.isPending}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70">
            {loginMutation.isPending ? 'Signing in...' : t('auth.login_btn')}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.no_account')} <Link to="/register" className="text-primary font-medium hover:underline">{t('auth.sign_up')}</Link>
          </p>
        </form>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">← Back to Home</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
