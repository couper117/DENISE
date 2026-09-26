import { useState } from 'react';
import { Link, Location, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store';
import { User } from '../../types';
import { WHATSAPP_LINK } from '../../lib/config';
import Seo from '../../components/Seo';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setTokens } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ login: '', password: '' });

  const from = (location.state as { from?: Location })?.from;
  const requested = from && from.pathname !== '/login'
    ? `${from.pathname}${from.search}${from.hash}`
    : null;

  // One field for either: staff tend to remember the email, customers their
  // phone. The API accepts whichever is sent.
  const credentials = () => {
    const value = form.login.trim();
    return value.includes('@')
      ? { email: value, password: form.password }
      : { phone: value, password: form.password };
  };

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(credentials()).then((r) => r.data.data),
    onSuccess: (data: { user: User; accessToken: string; refreshToken: string }) => {
      setUser(data.user);
      setTokens(data.accessToken, data.refreshToken);
      // Staff land on the dashboard unless they were on their way somewhere.
      const isStaff = data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN';
      navigate(requested ?? (isStaff ? '/admin' : '/'), { replace: true });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  const inputClass = 'w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <>
      <Seo path="/login" title="Login — DENISE Textile" description="Log in to your DENISE Textile account." noindex />
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary font-serif text-xl font-semibold text-primary-foreground">D</span>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('auth.login_title')}</h1>
            <p className="mt-1.5 text-muted-foreground">{t('auth.login_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div>
              <label htmlFor="login-id" className="mb-1.5 block text-sm font-medium">{t('auth.phone_or_email', { defaultValue: 'Phone number or email' })}</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-id" required autoComplete="username" value={form.login}
                  onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
                  placeholder="+250 78… / name@email.com" className={inputClass} />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="login-password" className="text-sm font-medium">{t('auth.password')}</label>
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                  {t('auth.forgot_help', { defaultValue: 'Forgot it? Ask us on WhatsApp' })}
                </a>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-password" required type={showPass ? 'text' : 'password'} autoComplete="current-password" value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" className={`${inputClass} pr-11`} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? t('auth.hide_password', { defaultValue: 'Hide password' }) : t('auth.show_password', { defaultValue: 'Show password' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginMutation.error && (
              <p className="text-center text-sm text-destructive" role="alert">
                {t('auth.login_failed', { defaultValue: 'Wrong phone number, email or password.' })}
              </p>
            )}

            <button type="submit" disabled={loginMutation.isPending} className="btn btn-primary w-full py-3.5">
              {loginMutation.isPending ? t('auth.signing_in', { defaultValue: 'Signing in…' }) : t('auth.login_btn')}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              {t('auth.no_account')} <Link to="/register" className="font-medium text-primary hover:underline">{t('auth.sign_up')}</Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;
